import { useState } from "react";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { useStore } from "../store";
import { ScreenFrame } from "./Chrome";
import { TaskCard } from "./TaskCard";

/** Finished work arrives here as messages, newest first. */
export function Board({ nav }: { nav: Nav }) {
  const tasks = useStore((s) => s.tasks).filter((t) => t.status !== "running" && t.status !== "queued");
  const agents = useStore((s) => s.agents);
  const { markRead } = useStore.getState();
  const [open, setOpen] = useState<string | null>(null);

  const days = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const d = new Date(t.finishedAt ?? t.createdAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
    days.set(d, [...(days.get(d) ?? []), t]);
  }

  return (
    <ScreenFrame nav={nav} title="Message Board">
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {!tasks.length && <p className="empty-note">No messages yet. When your avatars finish a task, their results arrive here.</p>}
        {[...days].map(([day, list]) => (
          <section key={day}>
            <h2 className="muted" style={{ fontSize: 16, margin: "18px 4px 10px" }}>{day}</h2>
            {list.map((t) => {
              const last = [...t.steps].reverse().find((s) => s.output);
              const author = agents.find((a) => a.id === last?.agentId);
              if (open === t.id) return <TaskCard key={t.id} task={t} />;
              return (
                <button
                  key={t.id}
                  className="panel card"
                  style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left", cursor: "pointer" }}
                  onClick={() => {
                    setOpen(t.id);
                    markRead(t.id);
                  }}
                >
                  {author && <Portrait look={author.look} size={56} />}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{t.title}</b>
                    <div className="hint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {author ? `${author.name}: ` : ""}{last?.output.replace(/\s+/g, " ").slice(0, 140) ?? ""}
                    </div>
                  </span>
                  {!t.read && t.status === "done" && <span className="chip">New</span>}
                  {t.status !== "done" && <span className="chip" style={{ background: "#f2f5f9", color: "var(--mute)" }}>{t.status}</span>}
                </button>
              );
            })}
          </section>
        ))}
      </div>
    </ScreenFrame>
  );
}
