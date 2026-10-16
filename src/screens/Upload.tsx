import { useEffect, useRef, useState } from "react";
import type { FileOut } from "../engine/files";
import { useStore } from "../store";
import type { Task } from "../types";

/** Review files an agent wrote, then push them to GitHub: a new branch (+ pull request) or a brand-new repo. */
export function UploadDialog({ task, files, onClose }: { task: Task; files: FileOut[]; onClose: () => void }) {
  const github = useStore((s) => s.settings.github);
  const dialog = useRef<HTMLDialogElement>(null);
  const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "update";
  const [mode, setMode] = useState<"branch" | "new">(task.repo || github.defaultRepo ? "branch" : "new");
  const [repo, setRepo] = useState(task.repo || github.defaultRepo);
  const [branch, setBranch] = useState(`plazai/${slug}`);
  const [name, setName] = useState(slug);
  const [isPrivate, setPrivate] = useState(true);
  const [pr, setPr] = useState(true);
  const [message, setMessage] = useState(task.title.slice(0, 72));
  const [picked, setPicked] = useState(() => new Set(files.map((f) => f.path)));
  const [state, setState] = useState<{ busy?: boolean; error?: string; url?: string }>({});

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const push = async () => {
    setState({ busy: true });
    try {
      const res = await fetch("/api/github/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: github.token || undefined,
          mode,
          repo,
          branch,
          name,
          private: isPrivate,
          description: task.prompt.slice(0, 200),
          message,
          pr,
          files: files.filter((f) => picked.has(f.path)),
        }),
      });
      const data = (await res.json()) as { error?: string; url?: string };
      setState(res.ok ? { url: data.url } : { error: data.error ?? `Upload failed (${res.status})` });
    } catch {
      setState({ error: "Couldn't reach the Plazai server." });
    }
  };

  return (
    <dialog ref={dialog} className="panel modal" onClose={onClose} onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
      <h2 style={{ marginTop: 0 }}>Upload to GitHub</h2>
      {state.url ? (
        <>
          <p>🚀 Done! Your files are on GitHub.</p>
          <p><a href={state.url} target="_blank" rel="noreferrer">{state.url}</a></p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn primary" onClick={() => dialog.current?.close()}>Close</button>
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void push();
          }}
        >
          {!github.token && <p className="hint" style={{ color: "var(--bad)" }}>Add a GitHub token in Settings first.</p>}
          <div className="tabs" role="tablist" style={{ "--n": 2, "--i": mode === "branch" ? 0 : 1 } as React.CSSProperties}>
            <span className="pill" aria-hidden />
            <button type="button" role="tab" aria-selected={mode === "branch"} className={mode === "branch" ? "on" : ""} onClick={() => setMode("branch")}>Existing repo</button>
            <button type="button" role="tab" aria-selected={mode === "new"} className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>New repo</button>
          </div>
          {mode === "branch" ? (
            <>
              <label className="field"><span>Repository</span><input className="input" value={repo} placeholder="owner/name" onChange={(e) => setRepo(e.target.value.trim())} /></label>
              <label className="field"><span>New branch</span><input className="input" value={branch} onChange={(e) => setBranch(e.target.value.trim())} /></label>
              <button type="button" className={`opt ${pr ? "on" : ""}`} style={{ padding: "8px 14px", marginBottom: 14 }} aria-pressed={pr} onClick={() => setPr(!pr)}>{pr ? "✓ " : ""}Open a pull request</button>
            </>
          ) : (
            <>
              <label className="field"><span>Repository name</span><input className="input" value={name} onChange={(e) => setName(e.target.value.trim())} /></label>
              <button type="button" className={`opt ${isPrivate ? "on" : ""}`} style={{ padding: "8px 14px", marginBottom: 14 }} aria-pressed={isPrivate} onClick={() => setPrivate(!isPrivate)}>{isPrivate ? "✓ " : ""}Private</button>
            </>
          )}
          <label className="field"><span>Commit message</span><input className="input" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} /></label>
          <div className="field"><span>Files</span></div>
          <div style={{ display: "grid", gap: 6, maxHeight: 180, overflow: "auto", marginBottom: 14 }}>
            {files.map((f) => (
              <label key={f.path} className="row" style={{ background: "#f6f8fb", borderRadius: 12, padding: "6px 10px", flexWrap: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={picked.has(f.path)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    if (e.target.checked) next.add(f.path);
                    else next.delete(f.path);
                    setPicked(next);
                  }}
                />
                <code style={{ flex: 1 }}>{f.path}</code>
                <span className="hint">{f.content.split("\n").length} lines</span>
              </label>
            ))}
          </div>
          {state.error && <p style={{ color: "var(--bad)" }} role="alert">{state.error}</p>}
          <p className="hint">{mode === "branch" ? "Plazai never writes to your main branch. You review the pull request on GitHub." : "A new repository is created on your account with these files."}</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn primary" disabled={state.busy || !picked.size || !github.token || (mode === "branch" ? !repo || !branch : !name)}>
              {state.busy ? "Uploading…" : mode === "branch" ? (pr ? "Push & open PR" : "Push branch") : "Create repo"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
