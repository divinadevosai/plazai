import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Nav } from "../App";
import { Portrait } from "../avatar/Portrait";
import { assign } from "../engine/run";
import { activityOf, useStore } from "../store";
import { Island } from "../world/Island";
import { PlazaAgent, tail } from "../world/PlazaAgent";
import { MenuButton } from "./Chrome";

export function Plaza({ nav }: { nav: Nav }) {
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const tasks = useStore((s) => s.tasks);
  const [selected, setSelected] = useState<string | null>(null);
  const [who, setWho] = useState(() => (teams[0] ? `team:${teams[0].id}` : agents[0] ? `agent:${agents[0].id}` : ""));
  const [prompt, setPrompt] = useState("");
  const positions = useMemo(() => new Map<string, THREE.Vector3>(), []);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const now = useTick(1000);

  const activity = agents.map((a) => activityOf(tasks, a.id));
  const justDone = agents.map((a) =>
    tasks.some((t) => t.steps.some((s) => s.agentId === a.id && s.status === "done" && s.endedAt && now - s.endedAt < 6000)),
  );
  const running = tasks.filter((t) => t.status === "running").length;

  const go = () => {
    if (!prompt.trim() || !who) return;
    const [kind, id] = who.split(":") as ["agent" | "team", string];
    assign("", prompt, { kind, id });
    setPrompt("");
  };

  return (
    <div className="plaza screen">
      <Canvas shadows camera={{ position: [0, 11, 17], fov: 45 }} dpr={[1, 2]} onPointerMissed={() => setSelected(null)}>
        <color attach="background" args={["#bfe9ff"]} />
        <fog attach="fog" args={["#bfe9ff", 30, 70]} />
        <hemisphereLight args={["#e6f6ff", "#8fd16f", 0.9]} />
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-16}
          shadow-camera-right={16}
          shadow-camera-top={16}
          shadow-camera-bottom={-16}
        />
        <Island desks={agents.length} busy={activity.map((a) => a?.status === "working")} />
        {agents.map((a, i) => (
          <PlazaAgent
            key={a.id}
            agent={a}
            index={i}
            count={agents.length}
            activity={activity[i] ?? null}
            selected={selected === a.id}
            onSelect={(id) => {
              setSelected(id);
              setWho(`agent:${id}`);
            }}
            positions={positions}
          />
        ))}
        <CameraRig follow={selected ? positions : null} id={selected} />
        <LabelProjector agents={agents.map((a) => ({ id: a.id, h: 2.35 * a.look.height }))} positions={positions} labels={labels.current} />
      </Canvas>

      <div className="labels" aria-hidden>
        {agents.map((a, i) => {
          const act = activity[i];
          const thought = act?.status === "walking" ? "On my way to my desk!" : act?.status === "working" ? tail(act.text) || "Thinking…" : null;
          return (
            <div
              key={a.id}
              className="label3d"
              ref={(el) => {
                if (el) labels.current.set(a.id, el);
                else labels.current.delete(a.id);
              }}
            >
              {thought && <div className="thought">{thought}</div>}
              {!act && justDone[i] && <div className="thought done">✓ Done!</div>}
              <div className="tag">{a.name}</div>
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
        <button className="btn" onClick={() => nav.go("maker")}>+ Avatar</button>
        <button className="btn" onClick={() => nav.go("board")}>Message Board</button>
      </div>

      <div className="panel plaza-side">
        {agents.map((a, i) => {
          const act = activity[i];
          return (
            <button
              key={a.id}
              className={selected === a.id ? "on" : ""}
              onClick={() => {
                setSelected(a.id);
                setWho(`agent:${a.id}`);
              }}
            >
              <Portrait look={a.look} size={44} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{a.name}</b>
                <div className="hint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {act ? (act.status === "walking" ? "Heading to desk…" : "Working…") : a.role}
                </div>
              </span>
              <span className="dot" style={{ background: act ? "var(--warn)" : justDone[i] ? "var(--ok)" : "#cfd8e4" }} />
            </button>
          );
        })}
        {!agents.length && <p className="hint" style={{ padding: 8 }}>The plaza is empty. Make an avatar to get started!</p>}
      </div>

      <form
        className="panel quick"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <select className="select" style={{ width: 190, borderRadius: 999, border: 0, background: "#f2f5f9" }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Who should do it">
          <optgroup label="Teams">
            {teams.map((t) => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}
          </optgroup>
          <optgroup label="Avatars">
            {agents.map((a) => <option key={a.id} value={`agent:${a.id}`}>{a.name} · {a.role}</option>)}
          </optgroup>
        </select>
        <input className="input" placeholder="Give them a task, e.g. “Write a short blog post about houseplants”" value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Task" />
        <button className="btn primary" disabled={!prompt.trim() || !who}>Go!</button>
      </form>
    </div>
  );
}

/** Keeps each avatar's DOM label pinned above its head (no React re-render per frame). */
function LabelProjector({ agents, positions, labels }: { agents: { id: string; h: number }[]; positions: Map<string, THREE.Vector3>; labels: Map<string, HTMLDivElement> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const a of agents) {
      const el = labels.get(a.id);
      const p = positions.get(a.id);
      if (!el || !p) continue;
      v.set(p.x, a.h, p.z);
      const dist = camera.position.distanceTo(v);
      v.project(camera);
      if (v.z > 1) {
        el.style.visibility = "hidden";
        continue;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const scale = Math.max(0.85, Math.min(1.15, 18 / dist));
      el.style.visibility = "visible";
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
      el.style.transformOrigin = "50% 100%";
      el.style.zIndex = String(Math.round(1000 - dist * 10));
    }
  });
  return null;
}

/** Eases the camera's focus toward the selected avatar (and back to the fountain). */
function CameraRig({ follow, id }: { follow: Map<string, THREE.Vector3> | null; id: string | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const p = id && follow?.get(id);
    goal.set(p ? p.x : 0, p ? 1 : 0.5, p ? p.z : 0);
    c.target.lerp(goal, Math.min(1, dt * 2.5));
    c.update();
  });
  return <OrbitControls ref={controls} enablePan={false} minDistance={6} maxDistance={32} maxPolarAngle={1.35} minPolarAngle={0.35} />;
}

function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
