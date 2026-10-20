import { useState } from "react";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { tickScheduler } from "../engine/run";
import { uid, useStore } from "../store";
import type { Repeat } from "../types";
import { BUILDINGS } from "../world/buildingList";
import { ScreenFrame } from "./Chrome";

const REPEATS: { id: Repeat; label: string }[] = [
  { id: "none", label: "Once" },
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Every week" },
];

/** datetime-local wants "YYYY-MM-DDTHH:mm" in local time. */
const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const inAnHour = () => toLocalInput(Math.ceil((Date.now() + 3_600_000) / 900_000) * 900_000);
const when = (ms: number) => new Date(ms).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function CalendarScreen({ nav }: { nav: Nav }) {
  const reminders = useStore((s) => s.reminders);
  const schedules = useStore((s) => s.schedules);
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const { saveReminder, removeReminder, saveSchedule, removeSchedule } = useStore.getState();
  const [mode, setMode] = useState<"reminder" | "task">("reminder");
  const [text, setText] = useState("");
  const [at, setAt] = useState(inAnHour);
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [who, setWho] = useState(teams[0] ? `team:${teams[0].id}` : agents[0] ? `agent:${agents[0].id}` : "");
  const [where, setWhere] = useState("auto");

  const add = () => {
    const ms = new Date(at).getTime();
    if (!text.trim() || Number.isNaN(ms)) return;
    if (mode === "reminder") saveReminder({ id: uid("rem"), text: text.trim(), at: ms, repeat });
    else {
      const [kind, id] = who.split(":") as ["agent" | "team", string];
      saveSchedule({ id: uid("sch"), title: text.trim().slice(0, 60), prompt: text.trim(), assignee: { kind, id }, buildingId: where, at: ms, repeat });
    }
    setText("");
    tickScheduler(); // anything already due fires straight away
  };

  const upcomingReminders = reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at);
  const upcomingTasks = schedules.filter((s) => !s.done).sort((a, b) => a.at - b.at);
  const nameOf = (a: { kind: string; id: string }) => (a.kind === "team" ? teams.find((t) => t.id === a.id)?.name : agents.find((x) => x.id === a.id)?.name) ?? "Nobody";

  return (
    <ScreenFrame nav={nav} title="Calendar">
      <div className="grid2">
        <form
          className="panel"
          style={{ padding: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="tabs" role="tablist" style={{ "--n": 2, "--i": mode === "reminder" ? 0 : 1 } as React.CSSProperties}>
            <span className="pill" aria-hidden />
            <button type="button" role="tab" aria-selected={mode === "reminder"} className={mode === "reminder" ? "on" : ""} onClick={() => setMode("reminder")}>Reminder</button>
            <button type="button" role="tab" aria-selected={mode === "task"} className={mode === "task" ? "on" : ""} onClick={() => setMode("task")}>Scheduled task</button>
          </div>
          <label className="field">
            <span>{mode === "reminder" ? "Remind me to…" : "What should they do?"}</span>
            <textarea className="textarea" rows={3} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={mode === "reminder" ? "e.g. Renew the domain" : "e.g. Summarise this week's tech news"} />
          </label>
          <div className="row" style={{ alignItems: "stretch" }}>
            <label className="field" style={{ flex: 1.3 }}>
              <span>When</span>
              <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Repeat</span>
              <select className="select" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
          </div>
          {mode === "task" && (
            <div className="row" style={{ alignItems: "stretch" }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Who</span>
                <select className="select" value={who} onChange={(e) => setWho(e.target.value)}>
                  <optgroup label="Teams">{teams.map((t) => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>
                  <optgroup label="Avatars">{agents.map((a) => <option key={a.id} value={`agent:${a.id}`}>{a.name}</option>)}</optgroup>
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Where</span>
                <select className="select" value={where} onChange={(e) => setWhere(e.target.value)}>
                  <option value="auto">Pick automatically</option>
                  <option value="plaza">Plaza desks</option>
                  {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            </div>
          )}
          <button className="btn primary" style={{ width: "100%" }} disabled={!text.trim() || (mode === "task" && !who)}>
            {mode === "reminder" ? "Add reminder" : "Schedule task"}
          </button>
          <p className="hint" style={{ textAlign: "center" }}>These go off while Plazai is open in a tab. Anything missed runs as soon as you're back.</p>
        </form>

        <div>
          <h2 className="muted" style={{ fontSize: 16, margin: "6px 4px 10px" }}>Reminders</h2>
          {upcomingReminders.length === 0 && <p className="hint" style={{ margin: "0 4px 18px" }}>No reminders yet.</p>}
          {upcomingReminders.map((r) => (
            <div key={r.id} className="panel card row" style={{ justifyContent: "space-between" }}>
              <span>
                <b>⏰ {r.text}</b>
                <div className="hint">{when(r.at)}{r.repeat !== "none" ? ` · ${REPEATS.find((x) => x.id === r.repeat)?.label}` : ""}</div>
              </span>
              <button className="btn small danger" onClick={() => removeReminder(r.id)}>Delete</button>
            </div>
          ))}
          <h2 className="muted" style={{ fontSize: 16, margin: "18px 4px 10px" }}>Scheduled tasks</h2>
          {upcomingTasks.length === 0 && <p className="hint" style={{ margin: "0 4px" }}>Nothing scheduled.</p>}
          {upcomingTasks.map((s) => {
            const a = s.assignee.kind === "agent" ? agents.find((x) => x.id === s.assignee.id) : agents.find((x) => x.id === teams.find((t) => t.id === s.assignee.id)?.memberIds[0]);
            return (
              <div key={s.id} className="panel card row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                {a && <Portrait look={a.look} size={44} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{s.title}</b>
                  <div className="hint">
                    {when(s.at)} · {nameOf(s.assignee)} · {s.buildingId === "auto" ? "auto" : s.buildingId === "plaza" ? "Plaza desks" : BUILDINGS.find((b) => b.id === s.buildingId)?.name}
                    {s.repeat !== "none" ? ` · ${REPEATS.find((x) => x.id === s.repeat)?.label}` : ""}
                  </div>
                </span>
                <button className="btn small danger" onClick={() => removeSchedule(s.id)}>Delete</button>
              </div>
            );
          })}
        </div>
      </div>
    </ScreenFrame>
  );
}
