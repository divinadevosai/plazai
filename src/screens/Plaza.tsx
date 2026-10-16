import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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
import { clockNow, dayPhase, offDutyOf } from "../clock";
import { Homes, homeSpot, type HomeState } from "../world/Homes";
import { GRILL, GRILL_LABEL_H, Lunch, lunchSeat } from "../world/Lunch";
import { Sky } from "../world/Sky";
import { AvatarCard } from "./AvatarCard";
import { BuildingCard, BuildingIcon } from "./BuildingCard";
import { MenuButton } from "./Chrome";
import { INTRO_CAMERA, TourCard, tourSteps, Welcome, type TourShot } from "./Tour";

type Focus = { kind: "agent" | "building"; id: string } | null;
/** What the camera follows: the selected avatar or building, or a guide shot. */
type CamFocus = Focus | Extract<TourShot, { kind: "view" }>;

export function Plaza({ nav, tour = false }: { nav: Nav; tour?: boolean }) {
  const agents = useStore((s) => s.agents);
  const teams = useStore((s) => s.teams);
  const tasks = useStore((s) => s.tasks);
  const github = useStore((s) => s.settings.github);
  const [focus, setFocus] = useState<Focus>(null);
  const introSeen = useStore((s) => s.introSeen);
  const setIntroSeen = useStore((s) => s.setIntroSeen);
  // First visit: a welcome splash, then the guide. The ? button (or the Guide tile) replays the guide.
  const [welcome, setWelcome] = useState(() => !introSeen && !tour);
  const [tourStep, setTourStep] = useState<number | null>(() => (tour ? 0 : null));
  const [startCam] = useState<[number, number, number]>(() => (!introSeen || tour ? INTRO_CAMERA : [0, 26, 38]));
  const touring = tourStep !== null;
  const [who, setWho] = useState(() => (teams[0] ? `team:${teams[0].id}` : agents[0] ? `agent:${agents[0].id}` : ""));
  const [where, setWhere] = useState("auto");
  const repo = github.defaultRepo;
  const [prompt, setPrompt] = useState("");
  const [inside, setInside] = useState<Record<string, string>>({});
  const [homes, setHomes] = useState<Record<string, HomeState>>({});
  const [urgent, setUrgent] = useState(false);
  const sleep = useStore((s) => s.settings.sleep);
  const lunch = useStore((s) => s.settings.lunch);
  const positions = useMemo(() => new Map<string, THREE.Vector3>(), []);
  const labels = useRef(new Map<string, HTMLDivElement>());
  const now = useTick(1000);
  const phase = dayPhase({ sleep, lunch }, clockNow());
  const off = offDutyOf(phase);

  const activity = agents.map((a) => activityOf(tasks, a.id));
  const justDone = agents.map((a) => tasks.some((t) => t.steps.some((s) => s.agentId === a.id && s.status === "done" && s.endedAt && now - s.endedAt < 6000)));
  const running = tasks.filter((t) => t.status === "running").length;
  const occupants = (bid: string) => agents.filter((a) => inside[a.id] === bid);
  const busy = Object.fromEntries(BUILDINGS.map((b) => [b.id, occupants(b.id).length]));
  const celebrate = { launch: tasks.some((t) => t.buildingId === "launch" && t.status === "done" && t.finishedAt && now - t.finishedAt < 4000) };

  const atTable = (i: number) => {
    const p = positions.get(agents[i]!.id);
    return !!p && p.distanceTo(lunchSeat(i, agents.length).stand) < 0.6;
  };

  const onHome = useCallback((id: string, st: HomeState | null) => {
    setHomes((m) => {
      const next = { ...m };
      if (st) next[id] = st;
      else delete next[id];
      return next;
    });
  }, []);

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
    assign("", prompt, { kind, id }, { buildingId: where, repo: where === "repo" || where === "auto" ? repo : undefined, urgent: !!off && urgent });
    setPrompt("");
    setUrgent(false);
  };

  const finishTour = useCallback(() => {
    setWelcome(false);
    setTourStep(null);
    setIntroSeen(true);
  }, [setIntroSeen]);
  const steps = tourSteps(agents.map((a) => a.name), lunch, sleep);
  const shot = touring ? steps[tourStep]?.shot : undefined;
  const firstAgent = agents[0]?.id;
  const camFocus = useMemo<CamFocus>(() => {
    if (welcome) return { kind: "view", pos: INTRO_CAMERA, target: [0, 0.5, 0] };
    if (!shot) return focus;
    if (shot.kind === "agent") return firstAgent ? { kind: "agent", id: firstAgent } : null;
    return shot;
    // shots are static per step, so the step index stands in for the object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcome, tourStep, focus, firstAgent]);

  const selectAgent = (id: string) => {
    if (touring || welcome) finishTour();
    setFocus({ kind: "agent", id });
    setWho(`agent:${id}`);
  };
  const selectBuilding = (id: string) => {
    if (touring || welcome) finishTour();
    setFocus({ kind: "building", id });
    setWhere(id);
  };
  const building = focus?.kind === "building" ? buildingById(focus.id) : undefined;
  const closeBuilding = useCallback(() => setFocus(null), []);
  const focusedAgent = focus?.kind === "agent" ? agents.find((a) => a.id === focus.id) : undefined;
  const statusOf = (a: (typeof agents)[number], i: number) => {
    const act = activity[i];
    const b = act ? buildingById(act.buildingId) : undefined;
    if (act) return inside[a.id] ? `Working in the ${b?.name}` : act.urgent ? "⚡ Rushing to an urgent job!" : `Heading to the ${b?.name ?? "desks"}…`;
    if (homes[a.id] === "asleep") return "😴 Asleep at home";
    if (homes[a.id] === "homeAwake") return "🏠 At home, winding down";
    if (phase === "goingHome") return "Heading home for the night";
    if (phase === "lunch") return "🥪 On lunch at the Picnic Grill";
    return "Free to help";
  };

  return (
    <div className="plaza screen">
      <Canvas shadows camera={{ position: startCam, fov: 45 }} dpr={[1, 2]} onPointerMissed={() => setFocus(null)}>
        <Sky />
        <Island desks={agents.length} busy={activity.map((a) => a?.status === "working" && a.buildingId === "plaza")} />
        <Buildings busy={busy} celebrate={celebrate} selected={building?.id ?? null} onSelect={selectBuilding} />
        <Homes agents={agents} states={homes} />
        <Lunch count={agents.length} />
        {agents.map((a, i) => (
          <PlazaAgent
            key={a.id}
            agent={a}
            index={i}
            count={agents.length}
            activity={activity[i] ?? null}
            selected={camFocus?.kind === "agent" && camFocus.id === a.id}
            onSelect={selectAgent}
            positions={positions}
            onInside={onInside}
            phase={phase}
            onHome={onHome}
          />
        ))}
        <CameraRig focus={camFocus} positions={positions} spin={welcome} />
        <LabelProjector agents={agents.map((a) => ({ id: a.id, h: 2.35 * a.look.height }))} positions={positions} labels={labels.current} />
      </Canvas>

      <div className="labels">
        {agents.map((a, i) => {
          const act = activity[i];
          const heading = act && !inside[a.id] && (act.status === "walking" || act.buildingId !== "plaza");
          const thought = heading
            ? act.urgent ? "⚡ Urgent! On my way!" : `On my way to the ${buildingById(act.buildingId)?.name ?? "desks"}!`
            : !act && phase === "goingHome" ? "Heading home 🌙"
            : !act && phase === "lunch" && !atTable(i) ? "Off to lunch 🥪"
            : act?.status === "working" ? tail(act.text) || "Thinking…" : null;
          return (
            <div key={a.id} className="label3d" ref={(el) => void (el ? labels.current.set(a.id, el) : labels.current.delete(a.id))} style={inside[a.id] || homes[a.id] ? { display: "none" } : undefined}>
              {thought && <div className="thought">{thought}</div>}
              {!act && justDone[i] && <div className="thought done">✓ Done!</div>}
              <div className="tag">{a.name}</div>
            </div>
          );
        })}
        {BUILDINGS.map((b) => {
          const occ = occupants(b.id);
          const first = occ[0] ? activity[agents.indexOf(occ[0])] : null;
          return (
            <div key={b.id} className="label3d" ref={(el) => void (el ? labels.current.set(`b:${b.id}`, el) : labels.current.delete(`b:${b.id}`))}>
              {occ.length > 0 && (
                <>
                  <div className="thought">{tail(first?.text ?? "") || "Working inside…"}</div>
                  <div className="tag" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {occ.map((a) => <Portrait key={a.id} look={a.look} size={20} />)}
                    {occ.map((a) => a.name).join(" & ")} inside
                  </div>
                </>
              )}
              <button className="bname" style={{ borderBottom: `3px solid ${b.roof}` }} onClick={() => selectBuilding(b.id)} aria-label={`Open the ${b.name}`}>
                <span className="ico"><BuildingIcon def={b} size={17} /></span>
                {b.name}
              </button>
            </div>
          );
        })}
        <div className="label3d" ref={(el) => void (el ? labels.current.set("grill", el) : labels.current.delete("grill"))}>
          {phase === "lunch" && <div className="thought">Lunch is served! 🍔</div>}
          <div className="bname" style={{ borderBottom: "3px solid #ff6b6b", cursor: "default" }}>🥪 Picnic Grill</div>
        </div>
        {agents.map((a, i) => {
          const st = homes[a.id];
          return (
            <div key={`h:${a.id}`} className="label3d" ref={(el) => void (el ? labels.current.set(`h:${a.id}`, el) : labels.current.delete(`h:${a.id}`))} style={st ? undefined : { display: "none" }}>
              {st === "asleep" && <div className="thought zzz">💤 Zzz…</div>}
              <div className="tag">{st === "asleep" ? `${a.name} is asleep` : `${a.name}'s home`}</div>
              {/* keep index used for stable ordering */}
              <span hidden>{i}</span>
            </div>
          );
        })}
      </div>

      <div className="overlay-top">
        <MenuButton nav={nav} />
        <span className="chip" style={{ background: "#fff", fontSize: 15, padding: "8px 16px" }}>
          {running ? `${running} task${running > 1 ? "s" : ""} in progress` : phase === "asleep" ? "🌙 Night time · everyone's asleep" : phase === "goingHome" ? "🌆 Heading home for the night" : phase === "lunch" ? `🥪 Lunch break until ${lunch.end}` : "Everyone's free"}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn round-q" onClick={() => { setFocus(null); setWelcome(false); setTourStep(0); }} aria-label="How it works: replay the guide" title="How it works">?</button>
        <button className="btn" onClick={() => nav.go("calendar")}>Calendar</button>
        <button className="btn" onClick={() => nav.go("board")}>Message Board</button>
      </div>

      {welcome ? (
        <Welcome onStart={() => { setWelcome(false); setTourStep(0); }} onSkip={finishTour} />
      ) : touring ? (
        <TourCard steps={steps} step={tourStep} onStep={setTourStep} onDone={finishTour} />
      ) : focusedAgent ? (
        <AvatarCard key={focusedAgent.id} agent={focusedAgent} status={statusOf(focusedAgent, agents.indexOf(focusedAgent))} off={off} nav={nav} onClose={closeBuilding} />
      ) : building ? (
        <BuildingCard key={building.id} def={building} occupants={occupants(building.id)} nav={nav} onClose={closeBuilding} off={off} />
      ) : (
        <div className="panel plaza-side">
          {agents.map((a, i) => {
            const act = activity[i];
            return (
              <button
                key={a.id}
                className={focus?.id === a.id ? "on" : ""}
                onClick={() => selectAgent(a.id)}
              >
                <Portrait look={a.look} size={44} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="hint" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {act || homes[a.id] || phase !== "awake" ? statusOf(a, i) : a.role}
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

      {!welcome && (!touring || steps[tourStep]?.quick) && !building && !focusedAgent && (
      <form
        className={`panel quick ${touring ? "spotlight" : ""}`}
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
        {off && (
          <button type="button" className={`btn ${urgent ? "primary" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setUrgent(!urgent)} aria-pressed={urgent} title={off === "lunch" ? "Call them back from lunch for this one" : "Wake them up for this one"}>
            {urgent ? "⚡ Urgent" : off === "lunch" ? "🥪 After lunch" : "😴 Morning"}
          </button>
        )}
        <button className="btn primary" disabled={!prompt.trim() || !who}>{off && !urgent ? "Queue" : "Go!"}</button>
      </form>
      )}
    </div>
  );
}

/** Keeps DOM labels pinned above avatars' heads and building roofs (no React re-render per frame). */
function LabelProjector({ agents, positions, labels }: { agents: { id: string; h: number }[]; positions: Map<string, THREE.Vector3>; labels: Map<string, HTMLDivElement> }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const roofs = useMemo(() => BUILDINGS.map((b) => ({ id: `b:${b.id}`, p: buildingSpot(b.id), h: ROOF_LABEL[b.id] ?? 5.9 })), []);
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
    place("grill", GRILL.x, GRILL_LABEL_H, GRILL.z);
    agents.forEach((a, i) => {
      const h = homeSpot(i, agents.length);
      place(`h:${a.id}`, h.x, 3.4, h.z);
    });
  });
  return null;
}

const ROOF_LABEL: Record<string, number> = { calendar: 8.9, library: 6.5, observatory: 6.3, lab: 5.6, launch: 4.9, cafe: 5.4 };
const HOME_CAM = new THREE.Vector3(0, 26, 38);
const HOME_TARGET = new THREE.Vector3(0, 0.5, 0);
const FLIGHT_S = 1.1;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Clicking a building flies the camera to its front door; closing flies back to the whole town.
 * Selecting an avatar keeps the camera looking at them as they walk. Between flights you can orbit freely.
 */
function CameraRig({ focus, positions, spin }: { focus: CamFocus; positions: Map<string, THREE.Vector3>; spin: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const flight = useRef<{ fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3; t: number; dur: number } | null>(null);
  const prev = useRef<CamFocus>(null);
  const goal = useMemo(() => new THREE.Vector3(), []);
  const reduced = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);

  useEffect(() => {
    const c = controls.current;
    const was = prev.current;
    prev.current = focus;
    if (!c) return;
    let toPos: THREE.Vector3 | null = null;
    let toTarget: THREE.Vector3 | null = null;
    let dur = FLIGHT_S;
    if (focus?.kind === "view") {
      toPos = new THREE.Vector3(...focus.pos);
      toTarget = new THREE.Vector3(...focus.target);
      dur = focus.dur ?? FLIGHT_S;
    } else if (focus?.kind === "building") {
      const s = buildingSpot(focus.id);
      const inward = new THREE.Vector3(-s.x, 0, -s.z).normalize();
      // The card sits on the right of the screen, so look a little to the building's right:
      // that keeps the front door in the open left-hand side of the view, seen head-on.
      const right = new THREE.Vector3(inward.z, 0, -inward.x);
      toTarget = new THREE.Vector3(s.x, 2.6, s.z).addScaledVector(right, 3.4);
      toPos = toTarget.clone().addScaledVector(inward, 13).setY(6.5);
    } else if (focus?.kind === "agent") {
      // Swing round to face them, a little to their right so the card doesn't cover them.
      const p = positions.get(focus.id) ?? new THREE.Vector3();
      const away = camera.position.clone().sub(p).setY(0).normalize();
      const right = new THREE.Vector3(-away.z, 0, away.x);
      toTarget = new THREE.Vector3(p.x, 1.4, p.z).addScaledVector(right, -1.2);
      toPos = toTarget.clone().addScaledVector(away, 6.5).setY(3.2);
    } else if (!focus && was) {
      toPos = HOME_CAM.clone();
      toTarget = HOME_TARGET.clone();
    }
    if (toPos && toTarget) flight.current = { fromPos: camera.position.clone(), fromTarget: c.target.clone(), toPos, toTarget, t: reduced ? 1 : 0, dur };
  }, [focus, camera, reduced]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const f = flight.current;
    if (f) {
      f.t = Math.min(1, f.t + dt / f.dur);
      const k = easeInOut(f.t);
      camera.position.lerpVectors(f.fromPos, f.toPos, k);
      c.target.lerpVectors(f.fromTarget, f.toTarget, k);
      if (f.t >= 1) flight.current = null;
    } else if (focus?.kind === "agent") {
      // Keep them in view if they walk off, with the same offset as the fly-in.
      const p = positions.get(focus.id);
      const away = camera.position.clone().sub(c.target).setY(0).normalize();
      goal.set(p?.x ?? 0, 1.4, p?.z ?? 0).add(new THREE.Vector3(away.z, 0, -away.x).multiplyScalar(1.2));
      c.target.lerp(goal, Math.min(1, dt * 2.5));
    }
    c.update();
  });
  return <OrbitControls ref={controls} autoRotate={spin && !reduced} autoRotateSpeed={0.6} enablePan={false} minDistance={6} maxDistance={75} maxPolarAngle={1.35} minPolarAngle={0.35} />;
}

function useTick(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
