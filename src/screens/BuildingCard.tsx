import { useEffect, useState } from "react";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { assign } from "../engine/run";
import { useStore } from "../store";
import type { Agent } from "../types";
import type { BuildingDef } from "../world/buildings";

export function BuildingIcon({ def, size = 22 }: { def: BuildingDef; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={def.roof} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={def.icon} />
    </svg>
  );
}

/** The close-up view of one building: what it is, what's inside, what you can do, and a way to start work here. */
export function BuildingCard({ def, occupants, nav, onClose, asleep = false }: { def: BuildingDef; occupants: Agent[]; nav: Nav; onClose: () => void; asleep?: boolean }) {
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const reminders = useStore((s) => s.reminders);
  const github = useStore((s) => s.settings.github);
  const [who, setWho] = useState(() => (teams[0] ? `team:${teams[0].id}` : agents[0] ? `agent:${agents[0].id}` : ""));
  const [prompt, setPrompt] = useState("");
  const [repo, setRepo] = useState(github.defaultRepo);
  const [sent, setSent] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const start = () => {
    if (!prompt.trim() || !who) return;
    const [kind, id] = who.split(":") as ["agent" | "team", string];
    assign("", prompt, { kind, id }, { buildingId: def.id, repo: def.id === "repo" ? repo : undefined, urgent: asleep && urgent });
    setPrompt("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <aside className="panel building-card" aria-label={def.name}>
      <header style={{ background: `linear-gradient(135deg, ${def.roof}, color-mix(in oklab, ${def.roof} 70%, white))` }}>
        <span className="b-icon"><BuildingIcon def={def} size={30} /></span>
        <div style={{ minWidth: 0 }}>
          <h2>{def.name}</h2>
          <p>{def.blurb}</p>
        </div>
        <button className="b-close" onClick={onClose} aria-label="Close building view (Esc)">✕</button>
      </header>

      <div className="b-body">
        <section>
          <h3>Inside</h3>
          <p className="muted">{def.inside}</p>
        </section>

        <section>
          <h3>What you can do here</h3>
          <ul className="b-list">
            {def.canDo.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>

        <section>
          <h3>Working here now</h3>
          {occupants.length ? (
            <div className="row">
              {occupants.map((a) => (
                <span key={a.id} className="chip" style={{ paddingLeft: 4 }}><Portrait look={a.look} size={24} />{a.name}</span>
              ))}
            </div>
          ) : (
            <p className="hint" style={{ margin: 0 }}>Nobody at the moment.</p>
          )}
        </section>

        {def.id === "calendar" && (
          <section>
            <h3>Coming up</h3>
            {reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at).slice(0, 4).map((r) => (
              <div key={r.id} className="hint">⏰ {r.text} · {new Date(r.at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div>
            ))}
            {!reminders.some((r) => !r.done) && <p className="hint" style={{ margin: 0 }}>No reminders yet.</p>}
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => nav.go("calendar")}>Open the Calendar</button>
          </section>
        )}

        <section>
          <h3>Start a task here</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <select className="select" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who" style={{ marginBottom: 8 }}>
              <optgroup label="Teams">{teams.map((t) => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>
              <optgroup label="Avatars">{agents.map((a) => <option key={a.id} value={`agent:${a.id}`}>{a.name} · {a.role}</option>)}</optgroup>
            </select>
            {def.id === "repo" && (
              <input className="input" style={{ marginBottom: 8 }} placeholder="Repository: owner/name" value={repo} onChange={(e) => setRepo(e.target.value.trim())} aria-label="Repository" />
            )}
            <textarea className="textarea" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={`What should they do in the ${def.name}?`} aria-label="Task" />
            <div className="b-examples">
              {def.examples.map((x) => (
                <button type="button" key={x} className="chip" onClick={() => setPrompt(x)}>{x}</button>
              ))}
            </div>
            {asleep && (
              <button type="button" className={`opt ${urgent ? "on" : ""}`} style={{ width: "100%", padding: "10px 14px", marginBottom: 8 }} aria-pressed={urgent} onClick={() => setUrgent(!urgent)}>
                {urgent ? "⚡ Urgent: wake them up" : "😴 Everyone's asleep. Tap to make it urgent"}
              </button>
            )}
            <button className="btn primary" style={{ width: "100%" }} disabled={!prompt.trim() || !who}>
              {sent ? (asleep && !urgent ? "✓ Queued for the morning" : "✓ On their way!") : asleep && !urgent ? "Queue for the morning" : `Send them to the ${def.name}`}
            </button>
          </form>
          {def.id === "repo" && (
            <p className="hint">{github.token ? "Finished work can be uploaded as a branch + pull request." : "Add a GitHub token in Settings to upload finished work."}</p>
          )}
        </section>
      </div>
    </aside>
  );
}
