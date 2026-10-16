import { useEffect } from "react";
import { HOME_R } from "../world/Homes";

type Vec = [number, number, number];

/** Where the camera looks for a step: a fixed view, an avatar, or a building's front door. */
export type TourShot = { kind: "view"; pos: Vec; target: Vec; dur?: number } | { kind: "agent"; index: number } | { kind: "building"; id: string };

export interface TourStep {
  icon: string;
  title: string;
  body: React.ReactNode;
  shot: TourShot;
  /** Point at the quick task bar. */
  quick?: boolean;
}

const OVERVIEW: Extract<TourShot, { kind: "view" }> = { kind: "view", pos: [0, 26, 38], target: [0, 0.5, 0] };

/** The opening shot flies in from high above the sea. */
export const INTRO_CAMERA: Vec = [46, 62, 92];

export function tourSteps(names: string[], lunch: { start: string; end: string }, sleep: { bedtime: string; wake: string }): TourStep[] {
  const crew = names.length ? names.slice(0, 3).join(", ").replace(/, ([^,]*)$/, " and $1") : "Your avatars";
  return [
    {
      icon: "🏝️",
      title: "This is the Plaza",
      body: (
        <>
          <p>A little island town where your AI avatars live and work. Everything you see is real: when they walk to a building, they're working on your task.</p>
          <p className="hint">Drag to look around. Scroll or pinch to zoom.</p>
        </>
      ),
      shot: { ...OVERVIEW, dur: 2.6 },
    },
    {
      icon: "👋",
      title: "Meet your avatars",
      body: (
        <>
          <p>{crew} are AI helpers, each with their own personality and way of working.</p>
          <p>Click any avatar and the camera swings round to say hello. You'll see who they are, what they've done, and you can give them a job.</p>
          <p className="hint">Make your own in the Avatar Maker.</p>
        </>
      ),
      shot: { kind: "agent", index: 0 },
    },
    {
      icon: "🏢",
      title: "Every building has a job",
      body: (
        <>
          <p>The Server Room is for backend work, the Design Studio for UI, the Test Lab for tests, the Security Vault for security, and so on.</p>
          <p>Plazai reads your task and sends avatars to the right building, or you can pick one yourself.</p>
          <p className="hint">Click any building for a close-up of what it's for.</p>
        </>
      ),
      shot: { kind: "building", id: "servers" },
    },
    {
      icon: "🐙",
      title: "Repo HQ ships to GitHub",
      body: (
        <>
          <p>Avatars in Repo HQ read your repository and write complete files.</p>
          <p>When they finish, <b>Upload to GitHub</b> pushes the files as a new branch with a pull request, or as a brand-new repo.</p>
          <p className="hint">Your main branch is never touched, and nothing is uploaded until you click. Add a token in Settings.</p>
        </>
      ),
      shot: { kind: "building", id: "repo" },
    },
    {
      icon: "⏰",
      title: "The Calendar Tower",
      body: (
        <>
          <p>Set reminders, or schedule tasks to run once, every day, on weekdays or every week.</p>
          <p className="hint">They go off while Plazai is open. Anything missed runs as soon as you're back.</p>
        </>
      ),
      shot: { kind: "building", id: "calendar" },
    },
    {
      icon: "🥪",
      title: "Lunch at the Picnic Grill",
      body: (
        <>
          <p>The plaza follows your real clock. From {lunch.start} to {lunch.end} everyone eats together here.</p>
          <p>Work you send over lunch waits until they're back. Mark it <b>⚡ Urgent</b> to call them back straight away.</p>
        </>
      ),
      shot: { kind: "view", pos: [-1.5, 10, 6], target: [10.5, 1, 2.4] },
    },
    {
      icon: "🌙",
      title: "Home time",
      body: (
        <>
          <p>Each avatar has a cottage. In the evening they walk home, and at {sleep.bedtime} the lights go out until {sleep.wake}.</p>
          <p>Tasks sent at night are queued for the morning. If something's urgent, wake them up and they'll rush to it.</p>
          <p className="hint">Change the hours, or switch lunch and bedtime off, in Settings → Daily routine.</p>
        </>
      ),
      shot: { kind: "view", pos: [-2.6, 7, 1.5], target: [-2.6, 1.2, HOME_R] },
    },
    {
      icon: "✍️",
      title: "Give them a job",
      body: (
        <>
          <p>Type a task in the bar below, choose who does it and where, then press <b>Go!</b></p>
          <p>Watch them walk over and think out loud. Finished work lands on the <b>Message Board</b>.</p>
        </>
      ),
      shot: OVERVIEW,
      quick: true,
    },
    {
      icon: "🧭",
      title: "Everything else is in the Menu",
      body: (
        <>
          <ul className="b-list">
            <li><b>Avatar Maker:</b> design avatars and give them roles and instructions.</li>
            <li><b>Teams:</b> line avatars up (Researcher → Writer → Reviewer) so each builds on the last.</li>
            <li><b>Tasks</b> and the <b>Message Board:</b> follow work and read results.</li>
            <li><b>Settings:</b> choose a brain (Gemini, Claude, OpenAI or free local Ollama). Demo mode works with no key.</li>
          </ul>
          <p className="hint" style={{ marginTop: 10 }}>Replay this guide any time with the <b>?</b> button.</p>
        </>
      ),
      shot: OVERVIEW,
    },
  ];
}

/** The welcome splash, shown before the step-by-step guide on a first visit. */
export function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <div className="welcome-kicker">Welcome to</div>
        <h1 id="welcome-title">Plazai</h1>
        <p>A cosy island town where AI avatars do real work for you: they research, write, code, test, and ship to GitHub. Then they break for lunch and head home to bed.</p>
        <div className="row" style={{ justifyContent: "center", gap: 10 }}>
          <button className="btn primary big" onClick={onStart} autoFocus>Show me around</button>
          <button className="btn" onClick={onSkip}>Skip, I'll explore</button>
        </div>
      </div>
    </div>
  );
}

/** One step of the guide, in the same spot as the building and avatar cards so the camera framing matches. */
export function TourCard({ steps, step, onStep, onDone }: { steps: TourStep[]; step: number; onStep: (n: number) => void; onDone: () => void }) {
  const s = steps[step]!;
  const last = step === steps.length - 1;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      else if (e.key === "ArrowRight") last ? onDone() : onStep(step + 1);
      else if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onStep, onDone]);

  return (
    <aside className="panel building-card tour-card" aria-label="Guide" aria-live="polite">
      <header>
        <span className="b-icon" style={{ fontSize: 30 }} aria-hidden>{s.icon}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800 }}>Step {step + 1} of {steps.length}</p>
          <h2>{s.title}</h2>
        </div>
        <button className="b-close" onClick={onDone} aria-label="Close the guide (Esc)">✕</button>
      </header>
      <div className="b-body tour-body" key={step}>{s.body}</div>
      <footer className="tour-foot">
        <div className="tour-dots" aria-hidden>
          {steps.map((_, i) => <span key={i} className={i === step ? "on" : ""} />)}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {step > 0 && <button className="btn" onClick={() => onStep(step - 1)}>Back</button>}
          <button className="btn primary" onClick={() => (last ? onDone() : onStep(step + 1))}>{last ? "Start playing!" : "Next"}</button>
        </div>
      </footer>
    </aside>
  );
}
