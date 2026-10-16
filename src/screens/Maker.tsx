import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Nav } from "../App";
import { Avatar3D, type Pose } from "../avatar/Avatar3D";
import { BROWS, CLOTHES, EYES, HAIR_COLORS, HAIR_STYLES, MOUTHS, NOSES, PANTS, randomLook, SKINS } from "../avatar/parts";
import { Portrait } from "../avatar/Portrait";
import { chime } from "../sound";
import { useStore } from "../store";
import type { Agent, Look, Provider } from "../types";
import { ScreenFrame } from "./Chrome";

type Tab = "face" | "hair" | "body" | "job";

export function Maker({ nav, initialId }: { nav: Nav; initialId?: string }) {
  const agents = useStore((s) => s.agents);
  const { saveAgent, removeAgent, newAgent } = useStore.getState();
  const [draft, setDraft] = useState<Agent>(() => agents.find((a) => a.id === initialId) ?? agents[0] ?? newAgent());
  const [tab, setTab] = useState<Tab>("face");
  const pose = useRef<Pose>("idle");
  const saved = agents.find((a) => a.id === draft.id);
  const dirty = !saved || JSON.stringify(saved) !== JSON.stringify(draft);

  const look = (patch: Partial<Look>) => {
    chime("tap");
    setDraft((d) => ({ ...d, look: { ...d.look, ...patch } }));
  };
  const wave = () => {
    pose.current = "wave";
    setTimeout(() => (pose.current = "idle"), 1800);
  };
  useEffect(wave, [draft.id]);

  const save = () => {
    const a = { ...draft, name: draft.name.trim() || "New friend" };
    saveAgent(a);
    setDraft(a);
    chime("done");
    wave();
  };

  return (
    <ScreenFrame
      nav={nav}
      title="Avatar Maker"
      actions={
        <>
          <button className="btn" onClick={() => setDraft(newAgent())}>+ New avatar</button>
          <button className="btn primary" onClick={save} disabled={!dirty}>{saved ? "Save changes" : "Save avatar"}</button>
        </>
      }
    >
      <div className="maker">
        <div className="panel stage" style={{ display: "flex", flexDirection: "column" }}>
          <div className="roster">
            {agents.map((a) => (
              <button key={a.id} className={a.id === draft.id ? "on" : ""} onClick={() => setDraft(a)} aria-label={`Edit ${a.name}`} title={a.name}>
                <Portrait look={a.look} size={58} />
              </button>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 320, position: "relative" }}>
            <Canvas shadows camera={{ position: [0, 1.5, 4.4], fov: 35 }} dpr={[1, 2]}>
              <ambientLight intensity={0.7} />
              <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow />
              <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#bfe6ff" />
              <group position={[0, -0.9, 0]}>
                <Avatar3D look={draft.look} pose={pose} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
                  <circleGeometry args={[1.1, 48]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
                <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={4} blur={2.4} />
              </group>
              <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} target={[0, 0.2, 0]} minPolarAngle={1.1} maxPolarAngle={1.7} />
            </Canvas>
            <div className="name-plate">{draft.name || "New friend"}{draft.role ? ` · ${draft.role}` : ""}</div>
          </div>
        </div>

        <div className="panel" style={{ padding: 22, overflow: "auto" }}>
          <div className="tabs" role="tablist">
            {(["face", "hair", "body", "job"] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
                {t === "job" ? "Job" : t[0]!.toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "face" && (
            <>
              <Label>Skin</Label>
              <Swatches colors={SKINS} value={draft.look.skin} onPick={(skin) => look({ skin })} />
              <Label>Eyes</Label>
              <Options names={EYES} value={draft.look.eyes} onPick={(eyes) => look({ eyes })} />
              <Label>Eyebrows</Label>
              <Options names={BROWS} value={draft.look.brows} onPick={(brows) => look({ brows })} />
              <Label>Nose</Label>
              <Options names={NOSES} value={draft.look.nose} onPick={(nose) => look({ nose })} />
              <Label>Mouth</Label>
              <Options names={MOUTHS} value={draft.look.mouth} onPick={(mouth) => look({ mouth })} />
              <div className="row">
                <Toggle label="Rosy cheeks" on={draft.look.blush} set={(blush) => look({ blush })} />
                <Toggle label="Glasses" on={draft.look.glasses} set={(glasses) => look({ glasses })} />
              </div>
            </>
          )}

          {tab === "hair" && (
            <>
              <Label>Style</Label>
              <Options names={HAIR_STYLES} value={draft.look.hair} onPick={(hair) => look({ hair })} />
              <Label>Colour</Label>
              <Swatches colors={HAIR_COLORS} value={draft.look.hairColor} onPick={(hairColor) => look({ hairColor })} />
            </>
          )}

          {tab === "body" && (
            <>
              <Label>Height</Label>
              <input className="slider" type="range" min={0.85} max={1.15} step={0.01} value={draft.look.height} onChange={(e) => look({ height: Number(e.target.value) })} />
              <Label>Build</Label>
              <input className="slider" type="range" min={0.85} max={1.2} step={0.01} value={draft.look.build} onChange={(e) => look({ build: Number(e.target.value) })} />
              <Label>Top</Label>
              <Swatches colors={CLOTHES} value={draft.look.shirt} onPick={(shirt) => look({ shirt })} />
              <Label>Trousers</Label>
              <Swatches colors={PANTS} value={draft.look.pants} onPick={(pants) => look({ pants })} />
            </>
          )}

          {tab === "job" && (
            <>
              <label className="field">
                <span>Name</span>
                <input className="input" value={draft.name} maxLength={24} placeholder="e.g. Pip" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>
              <label className="field">
                <span>Job</span>
                <input className="input" value={draft.role} maxLength={40} placeholder="Researcher, Writer, Coder…" onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
              </label>
              <label className="field">
                <span>Personality</span>
                <input className="input" value={draft.personality} maxLength={160} onChange={(e) => setDraft({ ...draft, personality: e.target.value })} />
              </label>
              <label className="field">
                <span>How they work</span>
                <textarea className="textarea" value={draft.instructions} maxLength={2000} placeholder="What should this agent do when it gets a task?" onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} />
              </label>
              <div className="row" style={{ alignItems: "stretch" }}>
                <label className="field" style={{ flex: 1 }}>
                  <span>Brain</span>
                  <select className="select" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value as Provider | "default" })}>
                    <option value="default">Use Settings default</option>
                    <option value="google">Google Gemini</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="openai">OpenAI</option>
                    <option value="ollama">Ollama (local)</option>
                  </select>
                </label>
                <label className="field" style={{ flex: 1 }}>
                  <span>Model</span>
                  <input className="input" value={draft.model} placeholder="Default" onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
                </label>
              </div>
            </>
          )}

          <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
            <button className="btn" onClick={() => look(randomLook())}>🎲 Surprise me</button>
            {saved && (
              <div className="row">
                <button className="btn" onClick={() => nav.go("tasks", { agentId: saved.id })}>Give a task</button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (!confirm(`Say goodbye to ${saved.name}?`)) return;
                    removeAgent(saved.id);
                    const next = useStore.getState().agents[0];
                    setDraft(next ?? newAgent());
                  }}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScreenFrame>
  );
}

const Label = ({ children }: { children: string }) => <div className="field" style={{ marginBottom: 8 }}><span>{children}</span></div>;

function Options({ names, value, onPick }: { names: string[]; value: number; onPick: (i: number) => void }) {
  return (
    <div className="options">
      {names.map((n, i) => (
        <button key={n} className={`opt ${i === value ? "on" : ""}`} aria-pressed={i === value} onClick={() => onPick(i)}>{n}</button>
      ))}
    </div>
  );
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="swatches">
      {colors.map((c) => (
        <button key={c} className={`swatch ${c === value ? "on" : ""}`} style={{ background: c }} aria-label={c} aria-pressed={c === value} onClick={() => onPick(c)} />
      ))}
    </div>
  );
}

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button className={`opt ${on ? "on" : ""}`} style={{ padding: "10px 16px" }} aria-pressed={on} onClick={() => set(!on)}>
      {on ? "✓ " : ""}{label}
    </button>
  );
}
