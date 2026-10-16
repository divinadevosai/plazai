import { useEffect, useState } from "react";
import type { Nav, Screen } from "../App";
import { Portrait } from "../avatar/Portrait";
import { useStore } from "../store";

// Only the first visit cascades the tiles in; coming back to the menu should be instant.
let introPlayed = false;

/** The home menu: a grid of channel tiles and a clock bar, like a cosy console menu. */
export function Home({ nav }: { nav: Nav }) {
  const agents = useStore((s) => s.agents);
  const tasks = useStore((s) => s.tasks);
  const teams = useStore((s) => s.teams);
  const running = tasks.filter((t) => t.status === "running").length;
  const unread = tasks.filter((t) => t.status === "done" && !t.read).length;
  const reminders = useStore((s) => s.reminders);
  const upcoming = reminders.filter((r) => !r.done && r.at - Date.now() < 86_400_000).length;
  const now = useClock();
  const [intro] = useState(() => !introPlayed);
  useEffect(() => {
    introPlayed = true;
  }, []);

  const channels: { id: Screen; label: string; art: React.ReactNode; badge?: number; tour?: boolean }[] = [
    {
      id: "plaza",
      label: "Plaza",
      art: (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#bfe9ff 0%,#e9f8ff 55%,#9fdc8c 56%,#7cc96b 100%)" }}>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: "18%", display: "flex", justifyContent: "center", gap: 2 }}>
            {agents.slice(0, 4).map((a) => <Portrait key={a.id} look={a.look} size={58} />)}
          </div>
        </div>
      ),
      badge: running || undefined,
    },
    {
      id: "maker",
      label: "Avatar Maker",
      art: (
        <div style={{ position: "relative" }}>
          {agents[0] && <Portrait look={agents[0].look} size={110} />}
          <span style={{ position: "absolute", right: -6, bottom: 10, width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 24 }}>+</span>
        </div>
      ),
    },
    { id: "tasks", label: "Tasks", art: <Icon d="M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01" color="#f2a33a" />, badge: running || undefined },
    {
      id: "calendar",
      label: "Calendar",
      art: (
        <div style={{ width: 96, borderRadius: 18, overflow: "hidden", background: "#fff", boxShadow: "0 4px 12px rgba(40,60,90,.12)", textAlign: "center" }}>
          <div style={{ background: "#e84d4d", color: "#fff", fontWeight: 800, fontSize: 14, padding: "4px 0" }}>{now.toLocaleDateString([], { month: "short" }).toUpperCase()}</div>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#5a6478", lineHeight: 1.3 }}>{now.getDate()}</div>
        </div>
      ),
      badge: upcoming || undefined,
    },
    { id: "board", label: "Message Board", art: <Icon d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" color="#3fbf6a" />, badge: unread || undefined },
    {
      id: "teams",
      label: "Teams",
      art: (
        <div style={{ display: "flex" }}>
          {(teams[0]?.memberIds ?? []).slice(0, 3).map((id, i) => {
            const a = agents.find((x) => x.id === id);
            return a ? <Portrait key={id} look={a.look} size={70} className="" alt="" /> : <span key={i} />;
          })}
        </div>
      ),
    },
    { id: "settings", label: "Settings", art: <Icon d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" color="#8e98a8" /> },
    {
      id: "plaza",
      label: "How it works",
      tour: true,
      art: <span style={{ width: 84, height: 84, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 50, fontWeight: 900 }}>?</span>,
    },
  ];

  return (
    <div className="home screen">
      <div className={`channels ${intro ? "intro" : ""}`}>
        {channels.map((c, i) => (
          <button key={c.label} className="channel" style={{ "--i": i } as React.CSSProperties} onClick={() => nav.go(c.id, { tour: c.tour })} aria-label={c.label}>
            <div className="art">{c.art}</div>
            <div className="label">{c.label}</div>
            {c.badge ? <span className="badge">{c.badge}</span> : null}
          </button>
        ))}
        {Array.from({ length: 12 - channels.length }, (_, i) => <div key={i} className="channel empty" style={{ "--i": channels.length + i } as React.CSSProperties} aria-hidden />)}
      </div>
      <div className="homebar">
        <button className="round" onClick={() => nav.go("plaza")} aria-label="Open the plaza">Plazai</button>
        <div className="clock">
          <div className="time">{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="date">{now.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}</div>
        </div>
        <button className="round" onClick={() => nav.go("board")} aria-label="Open the message board" style={{ position: "relative" }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          </svg>
          {unread > 0 && <span className="badge" style={{ position: "absolute", top: -4, right: -4, minWidth: 26, height: 26, borderRadius: 999, background: "var(--bad)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13 }}>{unread}</span>}
        </button>
      </div>
    </div>
  );
}

function Icon({ d, color }: { d: string; color: string }) {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);
  return now;
}
