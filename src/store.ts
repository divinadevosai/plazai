import { create } from "zustand";
import { persist } from "zustand/middleware";
import { randomLook } from "./avatar/parts";
import type { Agent, Reminder, Repeat, Schedule, Settings, Step, Task, Team } from "./types";

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const SEED_AGENTS: Agent[] = [
  {
    id: "pip",
    name: "Pip",
    role: "Researcher",
    personality: "Curious, upbeat and thorough. Loves a good fact.",
    instructions: "Gather the key facts, ideas and angles on the task. Use short bullet points.",
    look: { skin: "#f6d3b3", hair: 2, hairColor: "#3b2a20", eyes: 0, brows: 0, nose: 0, mouth: 0, shirt: "#4fb3e8", pants: "#3d4a66", height: 0.95, build: 1, glasses: true, blush: true },
    provider: "default",
    model: "",
    createdAt: 1,
  },
  {
    id: "juno",
    name: "Juno",
    role: "Writer",
    personality: "Warm, clear and a little playful.",
    instructions: "Turn the notes you're given into a polished, friendly piece of writing.",
    look: { skin: "#e8b48f", hair: 4, hairColor: "#b5562c", eyes: 2, brows: 1, nose: 1, mouth: 1, shirt: "#f28bb6", pants: "#2f3b55", height: 1.02, build: 0.95, glasses: false, blush: true },
    provider: "default",
    model: "",
    createdAt: 2,
  },
  {
    id: "bo",
    name: "Bo",
    role: "Reviewer",
    personality: "Calm, kind and has an eye for detail.",
    instructions: "Check the work for mistakes and gaps, fix them, and give the final version with a one-line verdict.",
    look: { skin: "#a46a46", hair: 1, hairColor: "#1d1714", eyes: 1, brows: 2, nose: 2, mouth: 2, shirt: "#7bd389", pants: "#46413b", height: 1.08, build: 1.1, glasses: false, blush: false },
    provider: "default",
    model: "",
    createdAt: 3,
  },
];

const SEED_TEAMS: Team[] = [{ id: "blog-team", name: "Blog Team", memberIds: ["pip", "juno", "bo"] }];

const DEFAULT_SETTINGS: Settings = {
  provider: "demo",
  keys: { google: "", anthropic: "", openai: "" },
  models: { google: "gemini-2.5-flash", anthropic: "claude-haiku-5-5", openai: "gpt-5-mini", ollama: "llama3.2" },
  sound: true,
  ownerName: "",
  github: { token: "", defaultRepo: "" },
  sleep: { enabled: true, bedtime: "22:30", wake: "07:00" },
};

interface State {
  agents: Agent[];
  teams: Team[];
  tasks: Task[];
  reminders: Reminder[];
  schedules: Schedule[];
  settings: Settings;
  saveAgent: (a: Agent) => void;
  removeAgent: (id: string) => void;
  newAgent: () => Agent;
  saveTeam: (t: Team) => void;
  removeTeam: (id: string) => void;
  addTask: (t: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  updateStep: (taskId: string, index: number, patch: Partial<Step>) => void;
  appendOutput: (taskId: string, index: number, text: string) => void;
  removeTask: (id: string) => void;
  markRead: (id: string) => void;
  setSettings: (patch: Partial<Settings>) => void;
  saveReminder: (r: Reminder) => void;
  removeReminder: (id: string) => void;
  saveSchedule: (s: Schedule) => void;
  removeSchedule: (id: string) => void;
  resetAll: () => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      agents: SEED_AGENTS,
      teams: SEED_TEAMS,
      tasks: [],
      reminders: [],
      schedules: [],
      settings: DEFAULT_SETTINGS,
      saveAgent: (a) => set((s) => ({ agents: s.agents.some((x) => x.id === a.id) ? s.agents.map((x) => (x.id === a.id ? a : x)) : [...s.agents, a] })),
      removeAgent: (id) =>
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          teams: s.teams.map((t) => ({ ...t, memberIds: t.memberIds.filter((m) => m !== id) })),
        })),
      newAgent: () => ({
        id: uid("agent"),
        name: "",
        role: "Helper",
        personality: "Friendly and helpful.",
        instructions: "",
        look: randomLook(),
        provider: "default",
        model: "",
        createdAt: Date.now(),
      }),
      saveTeam: (t) => set((s) => ({ teams: s.teams.some((x) => x.id === t.id) ? s.teams.map((x) => (x.id === t.id ? t : x)) : [...s.teams, t] })),
      removeTeam: (id) => set((s) => ({ teams: s.teams.filter((t) => t.id !== id) })),
      addTask: (t) => set((s) => ({ tasks: [t, ...s.tasks].slice(0, 100) })),
      updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      updateStep: (taskId, i, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, steps: t.steps.map((st, j) => (j === i ? { ...st, ...patch } : st)) } : t)) })),
      appendOutput: (taskId, i, text) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, steps: t.steps.map((st, j) => (j === i ? { ...st, output: st.output + text } : st)) } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      markRead: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, read: true } : t)) })),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      saveReminder: (r) => set((s) => ({ reminders: upsert(s.reminders, r) })),
      removeReminder: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
      saveSchedule: (x) => set((s) => ({ schedules: upsert(s.schedules, x) })),
      removeSchedule: (id) => set((s) => ({ schedules: s.schedules.filter((x) => x.id !== id) })),
      resetAll: () => set({ agents: SEED_AGENTS, teams: SEED_TEAMS, tasks: [], reminders: [], schedules: [], settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "plazai",
      version: 3,
      // v1 → v2: buildings, reminders, schedules and GitHub settings.
      migrate: (old, version) => {
        const s = old as Partial<State>;
        if (version < 2) {
          s.tasks = (s.tasks ?? []).map((t) => ({ ...t, buildingId: t.buildingId ?? "plaza" }));
          s.reminders ??= [];
          s.schedules ??= [];
          s.settings = { ...DEFAULT_SETTINGS, ...s.settings, github: s.settings?.github ?? DEFAULT_SETTINGS.github };
        }
        // v2 → v3: bedtimes.
        if (version < 3) s.settings = { ...DEFAULT_SETTINGS, ...s.settings, sleep: s.settings?.sleep ?? DEFAULT_SETTINGS.sleep };
        return s as State;
      },
      // A reload can't resume a half-finished run, so mark interrupted ones as stopped.
      onRehydrateStorage: () => (state) => {
        state?.tasks.forEach((t) => {
          if (t.status === "running") state.updateTask(t.id, { status: "stopped", steps: t.steps.map((s) => (s.status === "done" || s.status === "failed" ? s : { ...s, status: "failed" })) });
        });
      },
    },
  ),
);

/** Which agent (if any) is busy, and with what, derived from running tasks. */
export interface Activity {
  status: Step["status"];
  text: string;
  buildingId: string;
  urgent?: boolean;
}

export function activityOf(tasks: Task[], agentId: string): Activity | null {
  for (const t of tasks) {
    if (t.status !== "running") continue;
    const step = t.steps.find((s) => s.agentId === agentId && (s.status === "working" || s.status === "walking"));
    if (step) return { status: step.status, text: step.output, buildingId: t.buildingId ?? "plaza", urgent: t.urgent };
  }
  return null;
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

/** The next time something repeating should happen after `from`. */
export function nextOccurrence(at: number, repeat: Repeat, from = Date.now()): number | null {
  if (repeat === "none") return null;
  const d = new Date(at);
  const step = () => {
    if (repeat === "weekly") d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    if (repeat === "weekdays") while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  };
  do step();
  while (d.getTime() <= from);
  return d.getTime();
}
