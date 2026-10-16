import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, buildingSpot, type BuildingDef } from "./buildings";

const INK = "#3b4252";

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Rounded white sign with the building's icon and name. */
function useSign(def: BuildingDef) {
  const tex = useMemo(
    () =>
      canvasTexture(
        (ctx, w, h) => {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.roundRect(4, 4, w - 8, h - 8, 44);
          ctx.fill();
          ctx.strokeStyle = def.roof;
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.save();
          ctx.translate(34, h / 2 - 42);
          ctx.scale(3.5, 3.5);
          ctx.strokeStyle = def.roof;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.stroke(new Path2D(def.icon));
          ctx.restore();
          ctx.fillStyle = INK;
          ctx.font = `800 ${def.name.length > 13 ? 50 : 58}px "Nunito Variable", "Nunito", system-ui, sans-serif`;
          ctx.textBaseline = "middle";
          ctx.fillText(def.name, 138, h / 2 + 3, w - 160);
        },
        640,
        160,
      ),
    [def],
  );
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

interface Props {
  busy: Record<string, number>;
  /** Buildings that just finished something (for celebrations like the rocket). */
  celebrate: Record<string, boolean>;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function Buildings({ busy, celebrate, selected, onSelect }: Props) {
  return (
    <>
      {BUILDINGS.map((b) => (
        <Building key={b.id} def={b} busy={(busy[b.id] ?? 0) > 0} celebrate={celebrate[b.id] ?? false} selected={selected === b.id} onSelect={onSelect} />
      ))}
    </>
  );
}

function Building({ def, busy, celebrate, selected, onSelect }: { def: BuildingDef; busy: boolean; celebrate: boolean; selected: boolean; onSelect: (id: string) => void }) {
  const spot = buildingSpot(def.id);
  const sign = useSign(def);
  // One shared material, so every window of the building glows together when someone's inside.
  const windowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#cfeaf7", emissive: "#ffd77a", emissiveIntensity: 0.12, roughness: 0.2 }), []);
  useEffect(() => () => windowMat.dispose(), [windowMat]);
  useFrame(({ clock }) => {
    windowMat.emissiveIntensity = busy ? 0.9 + Math.sin(clock.elapsedTime * 4) * 0.25 : 0.12;
  });
  const wall = <meshStandardMaterial color={def.color} roughness={0.75} />;
  const roof = <meshStandardMaterial color={def.roof} roughness={0.6} />;

  return (
    <group
      position={[spot.x, 0, spot.z]}
      rotation={[0, spot.rotY, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(def.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {/* footprint + selection ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.6]} receiveShadow>
        <circleGeometry args={[4.2, 40]} />
        <meshStandardMaterial color={selected ? "#d6f1fd" : "#e9e3d2"} roughness={0.95} />
      </mesh>
      <Shape def={def} wall={wall} roof={roof} windowMat={windowMat} busy={busy} celebrate={celebrate} />
      {/* door + sign */}
      <mesh position={[0, 0.85, 2.02]}>
        <boxGeometry args={[1.1, 1.7, 0.08]} />
        <meshStandardMaterial color={busy ? "#ffe4a3" : "#6b5a4a"} emissive={busy ? "#ffcf6b" : "#000000"} emissiveIntensity={busy ? 0.5 : 0} />
      </mesh>
      <mesh position={[0, signY(def.id), 2.08]}>
        <planeGeometry args={[3.6, 0.9]} />
        <meshStandardMaterial map={sign} transparent roughness={0.6} />
      </mesh>
    </group>
  );
}

const signY = (id: string) => (id === "calendar" ? 2.35 : id === "launch" ? 2.25 : 2.6);

type Mat = React.ReactElement;

/** Each building's own silhouette. Front of every building faces +Z (towards the plaza). */
function Shape({ def, wall, roof, windowMat, busy, celebrate }: { def: BuildingDef; wall: Mat; roof: Mat; windowMat: THREE.Material; busy: boolean; celebrate: boolean }) {
  const box = (w: number, h: number, d: number, pos: [number, number, number], mat: Mat, cast = true) => (
    <mesh key={pos.join(",")} position={pos} castShadow={cast} receiveShadow>
      <boxGeometry args={[w, h, d]} />
      {mat}
    </mesh>
  );
  const windows = (y: number, xs: number[]) => xs.map((x) => <mesh key={x} position={[x, y, 2.01]} material={windowMat}><planeGeometry args={[0.8, 0.7]} /></mesh>);

  switch (def.id) {
    case "servers":
      return (
        <>
          {box(5, 3.2, 4, [0, 1.6, 0], wall)}
          {box(5.2, 0.25, 4.2, [0, 3.3, 0], roof)}
          {[-1.5, 0, 1.5].map((x) => box(0.9, 0.6, 0.9, [x, 3.7, -0.8], <meshStandardMaterial color="#c9d0db" />))}
          <ServerLEDs busy={busy} />
        </>
      );
    case "calendar":
      return (
        <>
          {box(3.4, 6, 3.4, [0, 3, 0], wall)}
          <mesh position={[0, 6.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2.7, 1.8, 4]} />
            {roof}
          </mesh>
          <CalendarFace />
          <Clock />
          {windows(1.2, [-1.1, 1.1])}
        </>
      );
    case "repo":
      return (
        <>
          {box(5, 2.8, 4, [0, 1.4, 0], wall)}
          <mesh position={[0, 3.6, 0]} rotation={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.01, 3.3, 1.6, 4, 1, false, Math.PI / 4]} />
            {roof}
          </mesh>
          {windows(1.3, [-1.6, 1.6])}
          {/* crates of commits waiting to ship */}
          {box(0.7, 0.7, 0.7, [2.9, 0.35, 1.6], <meshStandardMaterial color="#c98d5a" />)}
          {box(0.6, 0.6, 0.6, [2.9, 1.0, 1.6], <meshStandardMaterial color="#d9a441" />)}
        </>
      );
    case "library":
      return (
        <>
          {box(5.4, 3, 3.6, [0, 1.5, -0.2], wall)}
          {[-1.9, -0.65, 0.65, 1.9].map((x) => (
            <mesh key={x} position={[x, 1.5, 2.1]} castShadow>
              <cylinderGeometry args={[0.2, 0.22, 3, 14]} />
              <meshStandardMaterial color="#fbf8f2" />
            </mesh>
          ))}
          {box(5.8, 0.3, 4.4, [0, 3.15, 0.1], <meshStandardMaterial color="#fbf8f2" />)}
          <mesh position={[0, 3.75, 0.1]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[3.9, 1, 4]} />
            {roof}
          </mesh>
        </>
      );
    case "cafe":
      return (
        <>
          {box(4.6, 2.8, 3.6, [0, 1.4, -0.2], wall)}
          {box(4.9, 0.3, 3.9, [0, 2.95, -0.2], roof)}
          {/* striped awning */}
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-1.9 + i * 0.76, 2.15, 2.25]} rotation={[0.5, 0, 0]} castShadow>
              <boxGeometry args={[0.76, 0.06, 1]} />
              <meshStandardMaterial color={i % 2 ? "#ffffff" : def.roof} />
            </mesh>
          ))}
          {windows(1.2, [-1.5, 1.5])}
          {[-2.6, 2.6].map((x) => <Parasol key={x} x={x} color={def.roof} />)}
        </>
      );
    case "studio":
      return (
        <>
          {box(4.8, 3, 4, [0, 1.5, 0], wall)}
          <mesh position={[0, 3.35, 0]} rotation={[0.25, 0, 0]} castShadow>
            <boxGeometry args={[5.2, 0.25, 4.6]} />
            {roof}
          </mesh>
          {["#e84d4d", "#f5d04a", "#4fb3e8", "#7bd389"].map((c, i) => (
            <mesh key={c} position={[-1.7 + i * 1.13, 2.05, 2.03]}>
              <circleGeometry args={[0.3, 20]} />
              <meshStandardMaterial color={c} />
            </mesh>
          ))}
          {windows(1.15, [-1.6, 1.6])}
        </>
      );
    case "lab":
      return (
        <>
          {box(4.6, 2.6, 4, [0, 1.3, 0], wall)}
          <mesh position={[0, 2.6, 0]} castShadow>
            <sphereGeometry args={[2.1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={def.roof} roughness={0.3} metalness={0.1} />
          </mesh>
          <mesh position={[1.6, 3.8, -1]} castShadow>
            <cylinderGeometry args={[0.18, 0.3, 1.4, 12]} />
            <meshStandardMaterial color="#e9f9fb" />
          </mesh>
          <Bubbles busy={busy} />
          {windows(1.2, [-1.5, 1.5])}
        </>
      );
    case "launch":
      return (
        <>
          {box(3.6, 2.2, 3, [0, 1.1, 0.4], wall)}
          {box(3.8, 0.2, 3.2, [0, 2.3, 0.4], roof)}
          {windows(1.2, [-1.1, 1.1])}
          <mesh position={[0, 0.15, -2.6]} receiveShadow>
            <cylinderGeometry args={[1.6, 1.8, 0.3, 32]} />
            <meshStandardMaterial color="#b8c0cc" />
          </mesh>
          <Rocket celebrate={celebrate} color={def.roof} />
        </>
      );
    case "vault":
      return (
        <>
          {box(5, 3, 4, [0, 1.5, 0], wall)}
          {box(5.4, 0.5, 4.4, [0, 3.2, 0], roof)}
          <mesh position={[1.7, 1.5, 2.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.75, 0.75, 0.15, 32]} />
            <meshStandardMaterial color="#c9ced8" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[1.7, 1.5, 2.14]}>
            <torusGeometry args={[0.35, 0.06, 8, 24]} />
            <meshStandardMaterial color="#7c8597" metalness={0.6} roughness={0.3} />
          </mesh>
          {windows(2.2, [-1.6])}
        </>
      );
    case "observatory":
      return (
        <>
          <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[2.3, 2.4, 3.2, 32]} />
            {wall}
          </mesh>
          <mesh position={[0, 3.2, 0]} castShadow>
            <sphereGeometry args={[2.3, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#dfe6f2" metalness={0.3} roughness={0.35} />
          </mesh>
          <Telescope busy={busy} />
          {windows(1.2, [-1.4, 1.4])}
        </>
      );
    default:
      return box(4, 3, 4, [0, 1.5, 0], wall);
  }
}

function ServerLEDs({ busy }: { busy: boolean }) {
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const leds = useMemo(() => Array.from({ length: 24 }, (_, i) => ({ x: -1.9 + (i % 8) * 0.24 + (i % 8 >= 4 ? 2.3 : 0), y: 0.9 + Math.floor(i / 8) * 0.45, phase: i * 1.7 })), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mats.current.forEach((m, i) => {
      const on = busy ? Math.sin(t * (6 + (i % 5)) + leds[i]!.phase) > 0 : i % 3 === 0;
      m.emissiveIntensity = on ? 1.4 : 0.1;
    });
  });
  return (
    <>
      {[-1.5, 1.5].map((x) => (
        <mesh key={x} position={[x, 1.35, 2.01]}>
          <planeGeometry args={[1.4, 1.6]} />
          <meshStandardMaterial color="#1b2330" />
        </mesh>
      ))}
      {leds.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, 2.03]}>
          <planeGeometry args={[0.1, 0.1]} />
          <meshStandardMaterial ref={(m) => void (m && (mats.current[i] = m))} color="#1b2330" emissive={i % 4 === 0 ? "#ffb347" : "#48e07a"} emissiveIntensity={0.1} />
        </mesh>
      ))}
    </>
  );
}

function CalendarFace() {
  const tex = useMemo(() => {
    const d = new Date();
    return canvasTexture(
      (ctx, w, h) => {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 30);
        ctx.fill();
        ctx.fillStyle = "#e84d4d";
        ctx.fillRect(0, 0, w, 80);
        ctx.fillStyle = "#fff";
        ctx.font = '800 54px "Nunito Variable", system-ui, sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(d.toLocaleDateString([], { month: "long" }).toUpperCase(), w / 2, 42);
        ctx.fillStyle = INK;
        ctx.font = '800 150px "Nunito Variable", system-ui, sans-serif';
        ctx.fillText(String(d.getDate()), w / 2, 170);
      },
      256,
      256,
    );
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 4.1, 1.72]}>
      <planeGeometry args={[1.9, 1.9]} />
      <meshStandardMaterial map={tex} roughness={0.6} />
    </mesh>
  );
}

function Clock() {
  const hour = useRef<THREE.Mesh>(null);
  const minute = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const d = new Date();
    if (minute.current) minute.current.rotation.z = -(d.getMinutes() / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2;
  });
  return (
    <group position={[0, 5.75, 1.72]}>
      <mesh>
        <circleGeometry args={[0.55, 32]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh ref={hour} position={[0, 0, 0.01]}>
        <planeGeometry args={[0.06, 0.6]} />
        <meshStandardMaterial color={INK} />
      </mesh>
      <mesh ref={minute} position={[0, 0, 0.02]}>
        <planeGeometry args={[0.04, 0.85]} />
        <meshStandardMaterial color={INK} />
      </mesh>
    </group>
  );
}

function Parasol({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0, 3.4]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 20]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 8]} />
        <meshStandardMaterial color="#8e98a8" />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <coneGeometry args={[0.9, 0.4, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function Bubbles({ busy }: { busy: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    g.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.5 + i / 5) % 1;
      m.position.set(1.6 + Math.sin(t * 6 + i) * 0.15, 4.5 + t * 2, -1);
      m.scale.setScalar(busy ? 0.6 + t : 0.0001);
    });
  });
  return (
    <group ref={g}>
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.15, 10, 8]} />
          <meshStandardMaterial color="#bff3fa" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Telescope({ busy }: { busy: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * (busy ? 0.8 : 0.1);
  });
  return (
    <group ref={g} position={[0, 4.2, 0]}>
      <mesh position={[0.6, 0.5, 0]} rotation={[0, 0, -0.9]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 2.4, 16]} />
        <meshStandardMaterial color="#5a6478" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** The rocket lifts off when a deploy task finishes, then a fresh one rolls back onto the pad. */
function Rocket({ celebrate, color }: { celebrate: boolean; color: string }) {
  const g = useRef<THREE.Group>(null);
  const flight = useRef(-1);
  useEffect(() => {
    if (celebrate && flight.current < 0) flight.current = 0;
  }, [celebrate]);
  useFrame((_, dt) => {
    if (!g.current) return;
    if (flight.current >= 0) {
      flight.current += dt;
      const t = flight.current;
      g.current.position.y = t < 0.4 ? Math.sin(t * 80) * 0.03 : Math.pow(t - 0.4, 2) * 6;
      if (t > 5) flight.current = -1;
    } else {
      g.current.position.y += (0 - g.current.position.y) * Math.min(1, dt * 3);
    }
  });
  return (
    <group position={[0, 0.3, -2.6]}>
      <group ref={g}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.5, 2.2, 20]} />
          <meshStandardMaterial color="#f7f8fa" />
        </mesh>
        <mesh position={[0, 2.95, 0]} castShadow>
          <coneGeometry args={[0.45, 0.9, 20]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.5, 0.45, Math.sin((i / 3) * Math.PI * 2) * 0.5]} rotation={[0, -(i / 3) * Math.PI * 2, 0]} castShadow>
            <boxGeometry args={[0.5, 0.6, 0.06]} />
            <meshStandardMaterial color={color} />
          </mesh>
        ))}
        <mesh position={[0, 1.7, 0.46]}>
          <circleGeometry args={[0.16, 16]} />
          <meshStandardMaterial color="#4fb3e8" emissive="#4fb3e8" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </group>
  );
}
