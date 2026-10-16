import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { assign } from "../engine/run";
import { activityOf, useStore } from "../store";
import { BUILDINGS, buildingById, buildingSpot } from "../world/buildings";
import { Buildings } from "../world/Buildings";
import { Island } from "../world/Island";
import { PlazaAgent, tail } from "../world/PlazaAgent";
import { MenuButton } from "./Chrome";

type Focus = { kind: "agent" | "building"; id: string } | null;

export function Plaza({ nav }: { nav: Nav }) {
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const tasks = useStore((s) => s.tasks);
  const reminders = useStore((s) => s.reminders);
  const github = useStore((s) => s.settings.github);
  const [focus, setFocus] = useState<Focus>(null);
  const [who, setWho] = useState(() => (teams[0] ? `team:${teams[0].id}` : agents[0] ? `agent:${agents[0].id}` : ""));
  const [where, setWhere] = useState("auto");
  const [repo, setRepo] = useState(github.defaultRepo);
  const [prompt, setPrompt] = useState("");
  const [inside, setInside] = useState<Record<string, string>>({});
  const positions = useMemo(() => new Map<string, THREE.Vector3>(), []);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const now = useTick(1000);

  const activity = agents.map((a) => activityOf(tasks, a.id));
  const justDone = agents.map((a) => tasks.some((t) => t.steps.some((s) => s.agentId === a.id && s.status === "done" && s.endedAt && now - s.endedAt < 6000)));
  const running = tasks.filter((t) => t.status === "running").length;
  const occupants = (bid: string) => agents.filter((a) => inside[a.id] === bid);
  const busy = Object.fromEntries(BUILDINGS.map((b) => [b.id, occupants(b.id).length]));
  const celebrate = { launch: tasks.some((t) => t.buildingId === "launch" && t.status === "done" && t.finishedAt && now - t.finishedAt < 4000) };

  const onInside = useCallback((id: string, bid: string | null) => {
    setInside((m) => {
      const next = { ...m };
      if (bid) next[id] = bid;
      else delete next[id];
      return next;
    });
  }, []);

  const go = () => {
    if (!prompt.trim() || !who) return;
    const [kind, id] = who.split(":") as ["agent" | "team", string];
    assign("", prompt, { kind, id }, { buildingId: where, repo: where === "repo" || where === "auto" ? repo : undefined });
    setPrompt("");
  };

  const selectBuilding = (id: string) => {
    setFocus({ kind: "building", id });
    setWhere(id);
  };
  const building = focus?.kind === "building" ? buildingById(focus.id) : undefined;

  return (
    <div className="plaza screen">
      <Canvas shadows camera={{ position: [0, 26, 38], fov: 45 }} dpr={[1, 2]} onPointerMissed={() => setFocus(null)}>
        <color attach="background" args={["#bfe9ff"]} />
        <fog attach="fog" args={["#bfe9ff", 60, 140]} />
        <hemisphereLight args={["#e6f6ff", "#8fd16f", 0.9]} />
        <directionalLight
          position={[16, 28, 12]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[3072, 3072]}
          shadow-camera-left={-32}
          shadow-camera-right={32}
          shadow-camera-top={32}
          shadow-camera-bottom={-32}
          shadow-bias={-0.0004}
        />
        <Island desks={agents.length} busy={activity.map((a) => a?.status === "working" && a.buildingId === "plaza")} />
        <Buildings busy={busy} celebrate={celebrate} selected={building?.id ?? null} onSelect={selectBuilding} />
        {agents.map((a, i) => (
          <PlazaAgent
            key={a.id}
            agent={a}
            index={i}
            count={agents.length}
            activity={activity[i] ?? null}
            selected={focus?.kind === "agent" && focus.id === a.id}
            onSelect={(id) => {
              setFocus({ kind: "agent", id });
              setWho(`agent:${id}`);
            }}
            positions={positions}
            onInside={onInside}
          />
        ))}
        <CameraRig focus={focus} positions={positions} />
        <LabelProjector agents={agents.map((a) => ({ id: a.id, h: 2.35 * a.look.height }))} positions={positions} labels={labels.current} />
      </Canvas>

      <div className="labels" aria-hidden>
        {agents.map((a, i) => {
          const act = activity[i];
          const heading = act && !inside[a.id] && (act.status === "walking" || act.buildingId !== "plaza");
          const thought = heading
            ? `On my way to the ${buildingById(act.buildingId)?.name ?? "desks"}!`
            : act?.status === "working" ? tail(act.text) || "Thinking…" : null;
          return (
            <div key={a.id} className="label3d" ref={(el) => void (el ? labels.current.set(a.id, el) : labels.current.delete(a.id))} style={inside[a.id] ? { display: "none" } : undefined}>
              {thought && <div className="thought">{thought}</div>}
              {!act && justDone[i] && <div className="thought done">✓ Done!</div>}
              <div className="tag">{a.name}</div>
            </div>
          );
        })}
        {BUILDINGS.map((b) => {
          const occ = occupants(b.id);
          if (!occ.length) return null;
          const first = activity[agents.indexOf(occ[0]!)];
          return (
            <div key={b.id} className="label3d" ref={(el) => void (el ? labels.current.set(`b:${b.id}`, el) : labels.current.delete(`b:${b.id}`))}>
              <div className="thought">{tail(first?.text ?? "") || "Working inside…"}</div>
              <div className="tag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {occ.map((a) => <Portrait key={a.id} look={a.look} size={20} />)}
                {occ.map((a) => a.name).join(" & ")} inside
              </div>
            </div>
          );
        })}
      </div>

      <div className="overlay-top">
        <MenuButton nav={nav} />
        <span className="chip" style={{ background: "#fff", fontSize: 15, padding: "8px 16px" }}>
          {running ? `${running} task${running > 1 ? "s" : ""} in progress` : "Everyone's free"}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => nav.go("calendar")}>Calendar</button>
        <button className="btn" onClick={() => nav.go("board")}>Message Board</button>
      </div>

      {building ? (
        <div className="panel plaza-side" key={building.id}>
          <div className="row" style={{ justifyContent: "space-between", padding: "4px 6px 0" }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{building.name}</h2>
            <button className="btn small" onClick={() => setFocus(null)} aria-label="Close">✕</button>
          </div>
          <p className="hint" style={{ margin: "6px 6px 12px" }}>{building.blurb}</p>
          <div className="field" style={{ margin: "0 6px 6px" }}><span>Inside now</span></div>
          <p style={{ margin: "0 6px 12px" }}>{occupants(building.id).map((a) => a.name).join(", ") || <span className="hint">Nobody yet. Give someone a job here below.</span>}</p>
          {building.id === "calendar" && (
            <div style={{ margin: "0 6px 12px" }}>
              <div className="field"><span>Coming up</span></div>
              {reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at).slice(0, 4).map((r) => (
                <div key={r.id} className="hint">⏰ {r.text} · {new Date(r.at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</div>
              ))}
              <button className="btn small" style={{ marginTop: 8 }} onClick={() => nav.go("calendar")}>Open Calendar</button>
            </div>
          )}
          {building.id === "repo" && (
            <label className="field" style={{ margin: "0 6px 12px" }}>
              <span>Repository</span>
              <input className="input" placeholder="owner/name" value={repo} onChange={(e) => setRepo(e.target.value.trim())} />
              <span className="hint" style={{ textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
                {github.token ? "Using your GitHub token from Settings." : "Public repos can be read without a token. Add one in Settings to upload."}
              </span>
            </label>
          )}
          <button className="btn small" style={{ margin: "0 6px" }} onClick={() => nav.go("tasks", { buildingId: building.id })}>Open in Tasks</button>
        </div>
      ) : (
        <div className="panel plaza-side">
          {agents.map((a, i) => {
            const act = activity[i];
            const b = act ? buildingById(act.buildingId) : undefined;
            return (
              <button
                key={a.id}
                className={focus?.id === a.id ? "on" : ""}
                onClick={() => {
                  setFocus({ kind: "agent", id: a.id });
                  setWho(`agent:${a.id}`);
                }}
              >
                <Portrait look={a.look} size={44} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="hint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {act ? (inside[a.id] ? `In the ${b?.name}` : act.status === "working" && !b ? "Working at the desks" : `Heading to the ${b?.name ?? "desks"}…`) : a.role}
                  </div>
                </span>
                <span className="dot" style={{ background: act ? "var(--warn)" : justDone[i] ? "var(--ok)" : "#cfd8e4" }} />
              </button>
            );
          })}
          {!agents.length && <p className="hint" style={{ padding: 8 }}>The plaza is empty. Make an avatar to get started!</p>}
          <p className="hint" style={{ padding: "8px 8px 0", margin: 0 }}>Tip: click a building to see what it's for.</p>
        </div>
      )}

      <form
        className="panel quick"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <select className="select" style={{ width: 150, borderRadius: 999, border: 0, background: "#f2f5f9" }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who should do it">
          <optgroup label="Teams">{teams.map((t) => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}</optgroup>
          <optgroup label="Avatars">{agents.map((a) => <option key={a.id} value={`agent:${a.id}`}>{a.name}</option>)}</optgroup>
        </select>
        <select className="select" style={{ width: 160, borderRadius: 999, border: 0, background: "#f2f5f9" }} value={where} onChange={(e) => setWhere(e.target.value)} aria-label="Where">
          <option value="auto">Anywhere (auto)</option>
          <option value="plaza">Plaza desks</option>
          {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input className="input" placeholder="Give them a task…" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Task" />
        <button className="btn primary" disabled={!prompt.trim() || !who}>Go!</button>
      </form>
    </div>
  );
}

/** Keeps DOM labels pinned above avatars' heads and building roofs (no React re-render per frame). */
function LabelProjector({ agents, positions, labels }: { agents: { id: string; h: number }[]; positions: Map<string, THREE.Vector3>; labels: Map<string, HTMLDivElement> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const roofs = useMemo(() => BUILDINGS.map((b) => ({ id: `b:${b.id}`, p: buildingSpot(b.id), h: b.id === "calendar" ? 8.6 : 5.8 })), []);
  useFrame(({ camera, size }) => {
    const place = (key: string, x: number, y: number, z: number) => {
      const el = labels.get(key);
      if (!el) return;
      v.set(x, y, z);
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      if (v.z > 1) {
        el.style.visibility = "hidden";
        return;
      }
      const scale = Math.max(0.85, Math.min(1.15, 24 / dist));
      el.style.visibility = "visible";
      el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%) scale(${scale})`;
      el.style.transformOrigin = "50% 100%";
      el.style.zIndex = String(Math.round(1000 - dist * 10));
    };
    for (const a of agents) {
      const p = positions.get(a.id);
      if (p) place(a.id, p.x, a.h, p.z);
    }
    for (const r of roofs) place(r.id, r.p.x, r.h, r.p.z);
  });
  return null;
}

/** Eases the camera's focus toward the selected avatar or building (and back to the fountain). */
function CameraRig({ focus, positions }: { focus: Focus; positions: Map<string, THREE.Vector3> }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (focus?.kind === "agent") {
      const p = positions.get(focus.id);
      goal.set(p?.x ?? 0, 1, p?.z ?? 0);
    } else if (focus?.kind === "building") {
      const s = buildingSpot(focus.id);
      goal.set(s.x * 0.85, 2, s.z * 0.85);
    } else goal.set(0, 0.5, 0);
    c.target.lerp(goal, Math.min(1, dt * 2.5));
    c.update();
  });
  return <OrbitControls ref={controls} enablePan={false} minDistance={6} maxDistance={75} maxPolarAngle={1.35} minPolarAngle={0.35} />;
}

function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
