import { chime } from "../sound";
import { nextOccurrence, uid, useStore } from "../store";
import type { Agent, Provider, Task } from "../types";
import { buildingById, PLAZA_ID, routeTask } from "../world/buildings";
import { toast } from "../toast";

const controllers = new Map<string, AbortController>();
const WALK_MS = 2600;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("stopped", "AbortError"));
    });
  });

export interface AssignOptions {
  /** A building id, "plaza", or "auto" (default) to pick from the task's wording. */
  buildingId?: string;
  repo?: string;
}

/** Creates a task for one agent or a whole team and starts it. */
export function assign(title: string, prompt: string, assignee: Task["assignee"], opts: AssignOptions = {}) {
  const { agents, teams, addTask } = useStore.getState();
  const ids = assignee.kind === "agent" ? [assignee.id] : (teams.find((t) => t.id === assignee.id)?.memberIds ?? []);
  const members = ids.filter((id) => agents.some((a) => a.id === id));
  if (!members.length) throw new Error("Nobody to give this task to yet.");
  const task: Task = {
    id: uid("task"),
    title: title.trim() || prompt.trim().slice(0, 48),
    prompt: prompt.trim(),
    assignee,
    buildingId: !opts.buildingId || opts.buildingId === "auto" ? routeTask(`${title} ${prompt}`) : opts.buildingId,
    repo: opts.repo?.trim() || undefined,
    status: "running",
    steps: members.map((agentId) => ({ agentId, status: "waiting", output: "" })),
    createdAt: Date.now(),
  };
  addTask(task);
  void runTask(task.id);
  return task.id;
}

export function stopTask(id: string) {
  controllers.get(id)?.abort();
}

async function runTask(taskId: string) {
  const ac = new AbortController();
  controllers.set(taskId, ac);
  const s = () => useStore.getState();
  chime("start");
  try {
    const task = s().tasks.find((t) => t.id === taskId)!;
    const handoffs: { agent: Agent; output: string }[] = [];
    const context = task.buildingId === "repo" && task.repo ? await repoContext(task.repo, ac.signal) : "";
    for (let i = 0; i < task.steps.length; i++) {
      const agent = s().agents.find((a) => a.id === task.steps[i]!.agentId);
      if (!agent) continue;
      s().updateStep(taskId, i, { status: "walking", startedAt: Date.now() });
      await sleep(WALK_MS, ac.signal);
      s().updateStep(taskId, i, { status: "working" });
      const demo = await work(taskId, i, agent, task, context, handoffs, ac.signal);
      const output = s().tasks.find((t) => t.id === taskId)!.steps[i]!.output.trim();
      const failed = /\n?\[error\][^\n]*$/.test(output);
      s().updateStep(taskId, i, { status: failed ? "failed" : "done", endedAt: Date.now(), demo });
      if (failed) throw new Error("step failed");
      handoffs.push({ agent, output });
      chime("step");
    }
    s().updateTask(taskId, { status: "done", finishedAt: Date.now() });
    chime("done");
    toast(`✓ ${task.title}`, "Finished. It's on the Message Board.");
  } catch (e) {
    const stopped = (e as Error).name === "AbortError";
    const t = s().tasks.find((x) => x.id === taskId);
    t?.steps.forEach((st, i) => {
      if (st.status === "walking" || st.status === "working") s().updateStep(taskId, i, { status: "failed", endedAt: Date.now() });
    });
    s().updateTask(taskId, { status: stopped ? "stopped" : "failed", finishedAt: Date.now() });
    if (!stopped) chime("error");
  } finally {
    controllers.delete(taskId);
  }
}

/** Streams one agent's work into its step. Returns true when it used the built-in demo. */
async function work(taskId: string, i: number, agent: Agent, task: Task, context: string, handoffs: { agent: Agent; output: string }[], signal: AbortSignal) {
  const prompt = task.prompt;
  const { settings, appendOutput } = useStore.getState();
  const provider: Provider | "demo" = agent.provider === "default" ? settings.provider : agent.provider;
  if (provider === "demo") {
    await streamDemo(taskId, i, agent, task, handoffs, signal);
    return true;
  }
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    signal,
    body: JSON.stringify({
      provider,
      model: agent.model.trim() || settings.models[provider],
      apiKey: provider === "ollama" ? undefined : settings.keys[provider] || undefined,
      system: systemPrompt(agent, settings.ownerName, task.buildingId),
      prompt: userPrompt(prompt, handoffs, context),
    }),
  });
  if (!res.ok || !res.body) {
    const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Request failed (${res.status})`;
    appendOutput(taskId, i, `[error] ${msg}`);
    return false;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    appendOutput(taskId, i, decoder.decode(value, { stream: true }));
  }
  return false;
}

function systemPrompt(a: Agent, owner: string, buildingId: string) {
  const b = buildingById(buildingId);
  return [
    `You are ${a.name}, the ${a.role} in Plazai, a small team of friendly AI helpers who live in a plaza.`,
    a.personality && `Personality: ${a.personality}`,
    a.instructions && `How you work: ${a.instructions}`,
    b && b.expertise,
    owner && `You're helping ${owner}.`,
    buildingId === "repo"
      ? "Stay in character but be genuinely useful. Be concise in your explanation; files can be as long as they need to be."
      : "Stay in character but be genuinely useful. Keep it under 250 words. Plain text or simple markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(prompt: string, handoffs: { agent: Agent; output: string }[], context: string) {
  const parts = [`Task: ${prompt}`];
  if (context) parts.push(context);
  for (const h of handoffs) parts.push(`${h.agent.name} (${h.agent.role}) handed you this:\n${h.output}`);
  if (handoffs.length) parts.push("Build on your teammates' work. Your answer is passed on next, or shown to the user if you're last.");
  return parts.join("\n\n");
}

/** Scripted answers so Plazai works with no API key at all. */
async function streamDemo(taskId: string, i: number, agent: Agent, task: Task, handoffs: { agent: Agent; output: string }[], signal: AbortSignal) {
  const topic = task.prompt.replace(/\s+/g, " ").slice(0, 80);
  const place = buildingById(task.buildingId)?.name;
  const role = agent.role.toLowerCase();
  const from = handoffs.at(-1)?.agent.name;
  let text: string;
  if (task.buildingId === "repo" && i === 0) {
    text = `Here's a starter README for ${task.repo || "your repo"}, based on "${topic}":\n\nFILE: README.md\n\`\`\`\n# ${(task.repo || "my-project").split("/").pop()}\n\n${topic}.\n\n## Getting started\n\nnpm install\nnpm run dev\n\`\`\`\n\n(Demo mode: with a real model I'd read the repo first. You can still try "Upload to GitHub" below.)`;
  } else if (/research|analy|scout/.test(role)) {
    text = `Here's what I dug up on "${topic}":\n\n• The core idea, in one line\n• Two or three facts worth knowing\n• Who it matters to, and why\n• One surprising angle we could lead with\n\n(Demo mode: add an API key in Settings and I'll do real research!)`;
  } else if (/writ|author|copy|story/.test(role)) {
    text = `${from ? `Thanks ${from}! ` : ""}Here's a first draft:\n\n"${topic}" is easier than it looks. Start with the one thing that matters most, keep it simple, and build from there. A little curiosity goes a long way.\n\n(Demo mode: connect a model in Settings for a real draft.)`;
  } else if (/review|edit|check|critic/.test(role)) {
    text = `${from ? `Nice work, ${from}. ` : ""}I tightened a couple of lines and checked it reads clearly.\n\n✅ Verdict: ready to share!\n\n(Demo mode: with a real model I'd give detailed feedback.)`;
  } else {
    text = `On it! For "${topic}", here's my take as ${agent.role}: break it into small steps, do the first one today, and check in on progress.\n\n(Demo mode: add an API key in Settings to make me smarter.)`;
  }
  if (place && task.buildingId !== "repo") text = `[at the ${place}] ${text}`;
  const { appendOutput } = useStore.getState();
  for (const word of text.split(/(\s+)/)) {
    await sleep(word.trim() ? 45 + Math.random() * 60 : 0, signal);
    appendOutput(taskId, i, word);
  }
}

/** README + file list for Repo HQ tasks, fetched by the local server (your token never leaves it). */
async function repoContext(repo: string, signal: AbortSignal): Promise<string> {
  const { token } = useStore.getState().settings.github;
  try {
    const res = await fetch("/api/github/context", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ repo, token: token || undefined }), signal });
    const data = (await res.json()) as { context?: string; error?: string };
    if (!res.ok) return `(Couldn't read ${repo}: ${data.error ?? res.status}. Work from the task alone.)`;
    return data.context ?? "";
  } catch {
    return `(Couldn't reach ${repo}. Work from the task alone.)`;
  }
}

/** Fires due reminders and scheduled tasks. Called every few seconds while Plazai is open. */
export function tickScheduler(now = Date.now()) {
  const s = useStore.getState();
  for (const r of s.reminders) {
    if (r.done || r.at > now) continue;
    s.addTask({ id: uid("note"), kind: "reminder", title: `⏰ ${r.text}`, prompt: r.text, assignee: { kind: "agent", id: "" }, buildingId: "calendar", status: "done", steps: [], createdAt: now, finishedAt: now });
    const next = nextOccurrence(r.at, r.repeat, now);
    s.saveReminder(next ? { ...r, at: next } : { ...r, done: true });
    chime("done");
    toast(`⏰ ${r.text}`, "Reminder from the Calendar Tower");
  }
  for (const x of s.schedules) {
    if (x.done || x.at > now) continue;
    const next = nextOccurrence(x.at, x.repeat, now);
    s.saveSchedule(next ? { ...x, at: next } : { ...x, done: true });
    try {
      assign(x.title, x.prompt, x.assignee, { buildingId: x.buildingId, repo: x.repo });
    } catch {
      toast("A scheduled task couldn't start", "Its avatar or team no longer exists.");
    }
  }
}

export { PLAZA_ID };
