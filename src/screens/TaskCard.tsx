import { useState } from "react";
import { Portrait } from "../avatar/Portrait";
import { parseFiles } from "../engine/files";
import { stopTask, wakeFor } from "../engine/run";
import { buildingById } from "../world/buildings";
import { UploadDialog } from "./Upload";
import { useStore } from "../store";
import type { Task } from "../types";

const STATUS: Record<Task["status"], [string, string]> = {
  queued: ["Waiting for morning", "#8a6ce0"],
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
  const [uploading, setUploading] = useState(false);
  const building = buildingById(task.buildingId);
  const [label, color] = task.status === "queued" && task.waitFor === "lunch" ? ["Waiting for after lunch", "#e08a3c"] : STATUS[task.status];
  const final = [...task.steps].reverse().find((s) => s.status === "done")?.output ?? "";
  const files = task.status === "done" ? parseFiles(task.steps.filter((s) => s.status === "done").map((s) => s.output).join("\n\n")) : [];

  if (task.kind === "reminder") {
    return (
      <div className="panel card row" style={{ justifyContent: "space-between" }}>
        <span>
          <b>{task.title}</b>
          <div className="hint">Reminder · {new Date(task.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</div>
        </span>
        <button className="btn small danger" onClick={() => removeTask(task.id)}>Delete</button>
      </div>
    );
  }

  return (
    <div className="panel card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <h3>{task.title}</h3>
          <div className="hint">
            {new Date(task.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            {" · "}
            {building ? (
              <span style={{ color: building.roof, fontWeight: 800 }}>{building.name}</span>
            ) : (
              "Plaza desks"
            )}
            {task.repo ? ` · ${task.repo}` : ""}
          </div>
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
                      {s.output || (task.status === "queued" ? (task.waitFor === "lunch" ? "Mmm, lunch… I'll do this as soon as I'm back." : "Zzz… I'll do this first thing in the morning.") : s.status === "waiting" ? "Waiting for my turn…" : s.status === "walking" ? "On my way to my desk…" : s.status === "working" ? "Thinking…" : "—")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 14, justifyContent: "flex-end" }}>
            {task.status === "queued" ? (
              <>
                <button className="btn small primary" onClick={() => wakeFor(task.id)}>{task.waitFor === "lunch" ? "⚡ Urgent: call them back now" : "⚡ Urgent: wake them now"}</button>
                <button className="btn small danger" onClick={() => removeTask(task.id)}>Cancel</button>
              </>
            ) : task.status === "running" ? (
              <button className="btn small" onClick={() => stopTask(task.id)}>Stop</button>
            ) : (
              <>
                {files.length > 0 && (
                  <button className="btn small primary" onClick={() => setUploading(true)}>
                    Upload {files.length} file{files.length > 1 ? "s" : ""} to GitHub
                  </button>
                )}
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
      {uploading && <UploadDialog task={task} files={files} onClose={() => setUploading(false)} />}
    </div>
  );
}
