import { useState } from "react";
import { Portrait } from "../avatar/Portrait";
import { stopTask } from "../engine/run";
import { useStore } from "../store";
import type { Task } from "../types";

const STATUS: Record<Task["status"], [string, string]> = {
  running: ["In progress", "var(--warn)"],
  done: ["Done", "var(--ok)"],
  failed: ["Something went wrong", "var(--bad)"],
  stopped: ["Stopped", "var(--faint)"],
};

/** One task: who's on it, each avatar's (live) output, and actions. */
export function TaskCard({ task, open = true }: { task: Task; open?: boolean }) {
  const agents = useStore((s) => s.agents);
  const { removeTask } = useStore.getState();
  const [copied, setCopied] = useState(false);
  const [label, color] = STATUS[task.status];
  const final = [...task.steps].reverse().find((s) => s.status === "done")?.output ?? "";

  return (
    <div className="panel card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <h3>{task.title}</h3>
          <div className="hint">{new Date(task.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>
        </div>
        <span className="chip" style={{ background: "#f2f5f9", color }}><span className="dot" style={{ background: color }} />{label}</span>
      </div>
      {open && (
        <>
          {task.prompt !== task.title && <p className="muted" style={{ margin: "10px 0 0" }}>“{task.prompt}”</p>}
          <div className="steps">
            {task.steps.map((s, i) => {
              const a = agents.find((x) => x.id === s.agentId);
              const live = s.status === "working" || s.status === "walking";
              return (
                <div className="step" key={i}>
                  {a ? <Portrait look={a.look} size={52} /> : <span />}
                  <div>
                    <div className="row" style={{ marginBottom: 4 }}>
                      <b>{a?.name ?? "Someone who left"}</b>
                      <span className="hint">{a?.role}</span>
                      {s.demo && <span className="chip" style={{ fontSize: 11 }}>demo</span>}
                    </div>
                    <div className={`bubble ${live ? "live" : ""}`}>
                      {s.output || (s.status === "waiting" ? "Waiting for my turn…" : s.status === "walking" ? "On my way to my desk…" : s.status === "working" ? "Thinking…" : "—")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            {task.status === "running" ? (
              <button className="btn small" onClick={() => stopTask(task.id)}>Stop</button>
            ) : (
              <>
                {final && (
                  <button
                    className="btn small"
                    onClick={async () => {
                      await navigator.clipboard.writeText(final);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? "Copied!" : "Copy result"}
                  </button>
                )}
                <button className="btn small danger" onClick={() => removeTask(task.id)}>Delete</button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
