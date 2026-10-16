export type Provider = "google" | "anthropic" | "openai" | "ollama";

/** Everything that makes an avatar look like itself. Indexes pick from the part catalogues in avatar/parts.ts. */
export interface Look {
  skin: string;
  hair: number;
  hairColor: string;
  eyes: number;
  brows: number;
  nose: number;
  mouth: number;
  shirt: string;
  pants: string;
  height: number; // 0.85 – 1.15
  build: number; // 0.85 – 1.2
  glasses: boolean;
  blush: boolean;
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  personality: string;
  instructions: string;
  look: Look;
  /** "default" uses the provider chosen in Settings. */
  provider: Provider | "default";
  model: string;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  /** Agents in the order work is passed along. */
  memberIds: string[];
}

export type StepStatus = "waiting" | "walking" | "working" | "done" | "failed";

export interface Step {
  agentId: string;
  status: StepStatus;
  output: string;
  demo?: boolean;
  startedAt?: number;
  endedAt?: number;
}

export interface Task {
  id: string;
  title: string;
  prompt: string;
  assignee: { kind: "agent" | "team"; id: string };
  status: "running" | "done" | "failed" | "stopped";
  steps: Step[];
  createdAt: number;
  finishedAt?: number;
  read?: boolean;
}

export interface Settings {
  provider: Provider | "demo";
  keys: Record<Exclude<Provider, "ollama">, string>;
  models: Record<Provider, string>;
  sound: boolean;
  ownerName: string;
}
