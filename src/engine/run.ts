import { chime } from "../sound";
import { uid, useStore } from "../store";
import type { Agent, Provider, Task } from "../types";

const controllers = new Map<string, AbortController>();
const WALK_MS = 1800;
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("stopped", "AbortError"));
    });
  });

/** Creates a task for one agent or a whole team and starts it. */
export function assign(title: string, prompt: string, assignee: Task["assignee"]) {
  const { agents, teams, addTask } = useStore.getState();
  const ids = assignee.kind === "agent" ? [assignee.id] : (teams.find((t) => t.id === assignee.id)?.memberIds ?? []);
  const members = ids.filter((id) => agents.some((a) => a.id === id));
  if (!members.length) throw new Error("Nobody to give this task to yet.");
  const task: Task = {
    id: uid("task"),
    title: title.trim() || prompt.trim().slice(0, 48),
    prompt: prompt.trim(),
    assignee,
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
    for (let i = 0; i < task.steps.length; i++) {
      const agent = s().agents.find((a) => a.id === task.steps[i]!.agentId);
      if (!agent) continue;
      s().updateStep(taskId, i, { status: "walking", startedAt: Date.now() });
      await sleep(WALK_MS, ac.signal);
      s().updateStep(taskId, i, { status: "working" });
      const demo = await work(taskId, i, agent, task.prompt, handoffs, ac.signal);
      const output = s().tasks.find((t) => t.id === taskId)!.steps[i]!.output.trim();
      const failed = /\n?\[error\][^\n]*$/.test(output);
      s().updateStep(taskId, i, { status: failed ? "failed" : "done", endedAt: Date.now(), demo });
      if (failed) throw new Error("step failed");
      handoffs.push({ agent, output });
      chime("step");
    }
    s().updateTask(taskId, { status: "done", finishedAt: Date.now() });
    chime("done");
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
async function work(taskId: string, i: number, agent: Agent, prompt: string, handoffs: { agent: Agent; output: string }[], signal: AbortSignal) {
  const { settings, appendOutput } = useStore.getState();
  const provider: Provider | "demo" = agent.provider === "default" ? settings.provider : agent.provider;
  if (provider === "demo") {
    await streamDemo(taskId, i, agent, prompt, handoffs, signal);
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
      system: systemPrompt(agent, settings.ownerName),
      prompt: userPrompt(prompt, handoffs),
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

function systemPrompt(a: Agent, owner: string) {
  return [
    `You are ${a.name}, the ${a.role} in Plazai, a small team of friendly AI helpers who live in a plaza.`,
    a.personality && `Personality: ${a.personality}`,
    a.instructions && `How you work: ${a.instructions}`,
    owner && `You're helping ${owner}.`,
    "Stay in character but be genuinely useful. Keep it under 250 words. Plain text or simple markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(prompt: string, handoffs: { agent: Agent; output: string }[]) {
  const parts = [`Task: ${prompt}`];
  for (const h of handoffs) parts.push(`${h.agent.name} (${h.agent.role}) handed you this:\n${h.output}`);
  if (handoffs.length) parts.push("Build on your teammates' work. Your answer is passed on next, or shown to the user if you're last.");
  return parts.join("\n\n");
}

/** Scripted answers so Plazai works with no API key at all. */
async function streamDemo(taskId: string, i: number, agent: Agent, prompt: string, handoffs: { agent: Agent; output: string }[], signal: AbortSignal) {
  const topic = prompt.replace(/\s+/g, " ").slice(0, 80);
  const role = agent.role.toLowerCase();
  const from = handoffs.at(-1)?.agent.name;
  let text: string;
  if (/research|analy|scout/.test(role)) {
    text = `Here's what I dug up on "${topic}":\n\n• The core idea, in one line\n• Two or three facts worth knowing\n• Who it matters to, and why\n• One surprising angle we could lead with\n\n(Demo mode: add an API key in Settings and I'll do real research!)`;
  } else if (/writ|author|copy|story/.test(role)) {
    text = `${from ? `Thanks ${from}! ` : ""}Here's a first draft:\n\n"${topic}" is easier than it looks. Start with the one thing that matters most, keep it simple, and build from there. A little curiosity goes a long way.\n\n(Demo mode: connect a model in Settings for a real draft.)`;
  } else if (/review|edit|check|critic/.test(role)) {
    text = `${from ? `Nice work, ${from}. ` : ""}I tightened a couple of lines and checked it reads clearly.\n\n✅ Verdict: ready to share!\n\n(Demo mode: with a real model I'd give detailed feedback.)`;
  } else {
    text = `On it! For "${topic}", here's my take as ${agent.role}: break it into small steps, do the first one today, and check in on progress.\n\n(Demo mode: add an API key in Settings to make me smarter.)`;
  }
  const { appendOutput } = useStore.getState();
  for (const word of text.split(/(\s+)/)) {
    await sleep(word.trim() ? 45 + Math.random() * 60 : 0, signal);
    appendOutput(taskId, i, word);
  }
}
