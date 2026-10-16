import { useState } from "react";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { uid, useStore } from "../store";
import type { Team } from "../types";
import { ScreenFrame } from "./Chrome";

/** Teams are simple: a line of avatars who pass the work along in order. */
export function Teams({ nav }: { nav: Nav }) {
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const { saveTeam, removeTeam } = useStore.getState();
  const [draft, setDraft] = useState<Team>(() => teams[0] ?? { id: uid("team"), name: "", memberIds: [] });
  const saved = teams.some((t) => t.id === draft.id);

  const move = (i: number, d: -1 | 1) => {
    const m = [...draft.memberIds];
    const j = i + d;
    if (j < 0 || j >= m.length) return;
    [m[i], m[j]] = [m[j]!, m[i]!];
    setDraft({ ...draft, memberIds: m });
  };

  return (
    <ScreenFrame
      nav={nav}
      title="Teams"
      actions={<button className="btn" onClick={() => setDraft({ id: uid("team"), name: "", memberIds: [] })}>+ New team</button>}
    >
      <div className="grid2">
        <div className="panel" style={{ padding: 14 }}>
          {teams.map((t) => (
            <button key={t.id} className={`btn ${t.id === draft.id ? "primary" : ""}`} style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} onClick={() => setDraft(t)}>
              {t.name}
              <span style={{ display: "flex" }}>
                {t.memberIds.slice(0, 4).map((id) => {
                  const a = agents.find((x) => x.id === id);
                  return a ? <Portrait key={id} look={a.look} size={30} /> : null;
                })}
              </span>
            </button>
          ))}
          {!teams.length && <p className="hint">No teams yet.</p>}
        </div>

        <div className="panel" style={{ padding: 22 }}>
          <label className="field">
            <span>Team name</span>
            <input className="input" value={draft.name} maxLength={40} placeholder="e.g. Blog Team" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <div className="field"><span>Order of work</span></div>
          {draft.memberIds.length === 0 && <p className="hint">Tap avatars below to add them to the line.</p>}
          <ol style={{ listStyle: "none", padding: 0, margin: "0 0 18px", display: "grid", gap: 8 }}>
            {draft.memberIds.map((id, i) => {
              const a = agents.find((x) => x.id === id);
              if (!a) return null;
              return (
                <li key={id} className="row" style={{ background: "#f6f8fb", borderRadius: 16, padding: 8 }}>
                  <b style={{ width: 22, textAlign: "center", color: "var(--accent-deep)" }}>{i + 1}</b>
                  <Portrait look={a.look} size={40} />
                  <span style={{ flex: 1 }}><b>{a.name}</b> <span className="hint">{a.role}</span></span>
                  <button className="btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">↑</button>
                  <button className="btn small" onClick={() => move(i, 1)} disabled={i === draft.memberIds.length - 1} aria-label="Move later">↓</button>
                  <button className="btn small danger" onClick={() => setDraft({ ...draft, memberIds: draft.memberIds.filter((m) => m !== id) })} aria-label={`Remove ${a.name}`}>✕</button>
                </li>
              );
            })}
          </ol>
          <div className="pick" style={{ marginBottom: 20 }}>
            {agents.filter((a) => !draft.memberIds.includes(a.id)).map((a) => (
              <button key={a.id} onClick={() => setDraft({ ...draft, memberIds: [...draft.memberIds, a.id] })}>
                <Portrait look={a.look} size={34} />+ {a.name}
              </button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button className="btn primary" disabled={!draft.name.trim() || !draft.memberIds.length} onClick={() => saveTeam({ ...draft, name: draft.name.trim() })}>
              {saved ? "Save team" : "Create team"}
            </button>
            {saved && (
              <button
                className="btn danger"
                onClick={() => {
                  removeTeam(draft.id);
                  setDraft(useStore.getState().teams[0] ?? { id: uid("team"), name: "", memberIds: [] });
                }}
              >
                Delete team
              </button>
            )}
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}
