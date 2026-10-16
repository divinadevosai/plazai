import { useState } from "react";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { assign } from "../engine/run";
import { useStore } from "../store";
import { ScreenFrame } from "./Chrome";
import { TaskCard } from "./TaskCard";

const IDEAS = ["Write a short blog post about houseplants for beginners", "Plan a 3-day trip to Edinburgh on a budget", "Explain how solar panels work to a 10-year-old", "Come up with 5 names for a cosy coffee shop"];

export function Tasks({ nav, initialAgentId }: { nav: Nav; initialAgentId?: string }) {
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const tasks = useStore((s) => s.tasks);
  const [who, setWho] = useState(initialAgentId ? `agent:${initialAgentId}` : teams[0] ? `team:${teams[0].id}` : agents[0] ? `agent:${agents[0].id}` : "");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const recent = tasks.slice(0, 12);

  const start = () => {
    setError("");
    try {
      const [kind, id] = who.split(":") as ["agent" | "team", string];
      assign(title, prompt, { kind, id });
      setTitle("");
      setPrompt("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <ScreenFrame nav={nav} title="Tasks" actions={<button className="btn" onClick={() => nav.go("plaza")}>Watch in the Plaza</button>}>
      <div className="grid2">
        <form
          className="panel"
          style={{ padding: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <div className="field"><span>Who's doing it?</span></div>
          {teams.length > 0 && (
            <div className="pick" style={{ marginBottom: 10 }}>
              {teams.map((t) => (
                <button type="button" key={t.id} className={who === `team:${t.id}` ? "on" : ""} onClick={() => setWho(`team:${t.id}`)}>
                  <span style={{ display: "flex" }}>
                    {t.memberIds.slice(0, 3).map((id) => {
                      const a = agents.find((x) => x.id === id);
                      return a ? <Portrait key={id} look={a.look} size={34} /> : null;
                    })}
                  </span>
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div className="pick" style={{ marginBottom: 18 }}>
            {agents.map((a) => (
              <button type="button" key={a.id} className={who === `agent:${a.id}` ? "on" : ""} onClick={() => setWho(`agent:${a.id}`)}>
                <Portrait look={a.look} size={34} />
                {a.name}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Title (optional)</span>
            <input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span>What should they do?</span>
            <textarea className="textarea" value={prompt} maxLength={6000} rows={5} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the task in plain words." />
          </label>
          <div className="row" style={{ marginBottom: 16 }}>
            {IDEAS.map((i) => (
              <button type="button" key={i} className="chip" style={{ border: 0 }} onClick={() => setPrompt(i)}>{i}</button>
            ))}
          </div>
          {error && <p style={{ color: "var(--bad)" }} role="alert">{error}</p>}
          <button className="btn primary" style={{ width: "100%" }} disabled={!prompt.trim() || !who}>Start task</button>
          <p className="hint" style={{ textAlign: "center" }}>Teams pass the work along, one avatar after another.</p>
        </form>

        <div>
          {recent.length ? recent.map((t) => <TaskCard key={t.id} task={t} />) : <p className="empty-note">No tasks yet. Give your avatars something to do!</p>}
        </div>
      </div>
    </ScreenFrame>
  );
}
