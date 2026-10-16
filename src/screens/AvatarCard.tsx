import { useEffect, useState } from "react";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import type { OffDuty } from "../clock";
import { assign } from "../engine/run";
import { useStore } from "../store";
import type { Agent } from "../types";
import { BUILDINGS, buildingById } from "../world/buildings";

const BRAINS: Record<string, string> = { google: "Google Gemini", anthropic: "Anthropic Claude", openai: "OpenAI", ollama: "Ollama (local)", demo: "Demo mode" };

/** The close-up of one avatar: who they are, how they work, what they're up to, and a way to give them a job. */
export function AvatarCard({ agent, status, off, nav, onClose }: { agent: Agent; status: string; off: OffDuty; nav: Nav; onClose: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const teams = useStore((s) => s.teams);
  const settings = useStore((s) => s.settings);
  const [prompt, setPrompt] = useState("");
  const [where, setWhere] = useState("auto");
  const [urgent, setUrgent] = useState(false);
  const [sent, setSent] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const recent = tasks.filter((t) => t.steps.some((s) => s.agentId === agent.id)).slice(0, 4);
  const done = tasks.filter((t) => t.status === "done" && t.steps.some((s) => s.agentId === agent.id && s.status === "done")).length;
  const memberOf = teams.filter((t) => t.memberIds.includes(agent.id)).map((t) => t.name);
  const provider = agent.provider === "default" ? settings.provider : agent.provider;
  const model = provider === "demo" ? "" : agent.model || settings.models[provider];

  const send = () => {
    if (!prompt.trim()) return;
    assign("", prompt, { kind: "agent", id: agent.id }, { buildingId: where, urgent: !!off && urgent });
    setPrompt("");
    setSent(off && !urgent ? (off === "lunch" ? "Queued for after lunch" : "Queued for the morning") : "On it!");
    setTimeout(() => setSent(""), 2500);
  };

  return (
    <aside className="panel building-card" aria-label={agent.name}>
      <header style={{ background: `linear-gradient(135deg, ${agent.look.shirt}, color-mix(in oklab, ${agent.look.shirt} 55%, white))` }}>
        <span className="b-icon" style={{ width: 76, height: 76, borderRadius: 22, overflow: "hidden" }}>
          <Portrait look={agent.look} size={76} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h2>{agent.name}</h2>
          <p>{agent.role}</p>
          <p style={{ marginTop: 6, fontWeight: 800 }}>{status}</p>
        </div>
        <button className="b-close" onClick={onClose} aria-label="Close (Esc)">✕</button>
      </header>

      <div className="b-body">
        <section>
          <h3>Personality</h3>
          <p className="muted">{agent.personality || "Friendly and helpful."}</p>
        </section>
        <section>
          <h3>How they work</h3>
          <p className="muted">{agent.instructions || "No special instructions yet. Add some in the Avatar Maker."}</p>
        </section>
        <section className="row" style={{ alignItems: "flex-start", gap: 24 }}>
          <div>
            <h3>Brain</h3>
            <p>{BRAINS[provider] ?? provider}{model ? <span className="hint"> · {model}</span> : null}</p>
          </div>
          <div>
            <h3>Tasks done</h3>
            <p>{done}</p>
          </div>
          {memberOf.length > 0 && (
            <div>
              <h3>Teams</h3>
              <p>{memberOf.join(", ")}</p>
            </div>
          )}
        </section>
        <section>
          <h3>Recent work</h3>
          {recent.length ? (
            <ul className="b-list" style={{ gap: 8 }}>
              {recent.map((t) => (
                <li key={t.id} style={{ paddingLeft: 0 }} className="recent">
                  <b>{t.title}</b>
                  <div className="hint">
                    {buildingById(t.buildingId)?.name ?? "Plaza desks"} · {t.status === "queued" ? "waiting for morning" : t.status === "running" ? "in progress" : t.status}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint" style={{ margin: 0 }}>Nothing yet. Give {agent.name} a job below!</p>
          )}
        </section>
        <section>
          <h3>Give {agent.name} a task</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <textarea className="textarea" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={`What should ${agent.name} do?`} aria-label="Task" />
            <select className="select" value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Where" style={{ margin: "8px 0" }}>
              <option value="auto">Anywhere (auto)</option>
              <option value="plaza">Plaza desks</option>
              {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {off && (
              <button type="button" className={`opt ${urgent ? "on" : ""}`} style={{ width: "100%", padding: "10px 14px", marginBottom: 8 }} aria-pressed={urgent} onClick={() => setUrgent(!urgent)}>
                {off === "lunch"
                  ? urgent ? `⚡ Urgent: call ${agent.name} back from lunch` : `🥪 ${agent.name} is on lunch. Tap to make it urgent`
                  : urgent ? `⚡ Urgent: wake ${agent.name} up` : `😴 ${agent.name} is asleep. Tap to make it urgent`}
              </button>
            )}
            <button className="btn primary" style={{ width: "100%" }} disabled={!prompt.trim()}>
              {sent ? `✓ ${sent}` : off && !urgent ? (off === "lunch" ? "Queue for after lunch" : "Queue for the morning") : off === "lunch" ? "Call them back!" : off ? "Wake them up!" : `Send ${agent.name}`}
            </button>
          </form>
          <button className="btn small" style={{ marginTop: 12 }} onClick={() => nav.go("maker", { agentId: agent.id })}>Edit in Avatar Maker</button>
        </section>
      </div>
    </aside>
  );
}
