import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { BUILDINGS, buildingSpot } from "./buildings";

export const ISLAND_R = 28;
export const ROAD_IN = 15.4;
export const ROAD_OUT = 17.6;
export const DESK_R = 8.2;

/** Where agent i (of n) works: an arc of desks behind the fountain. */
export function deskSpot(i: number, n: number) {
  const spread = Math.min(0.32, 2.6 / Math.max(1, n));
  const a = -Math.PI / 2 + (i - (n - 1) / 2) * spread;
  const desk = new THREE.Vector3(Math.cos(a) * DESK_R, 0, Math.sin(a) * DESK_R);
  const stand = new THREE.Vector3(Math.cos(a) * (DESK_R - 0.95), 0, Math.sin(a) * (DESK_R - 0.95));
  return { desk, stand, angle: a };
}

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export function Island({ desks, busy }: { desks: number; busy: boolean[] }) {
  const trees = useMemo(() => {
    const r = rng(7);
    const angles = BUILDINGS.map((b) => buildingSpot(b.id).angle);
    const nearBuilding = (a: number) => angles.some((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.26);
    const out: { x: number; z: number; s: number; hue: number }[] = [];
    // outer ring, in the gaps between buildings
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + r() * 0.08;
      if (nearBuilding(a)) continue;
      const d = 22 + r() * 4.5;
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.8 + r() * 0.6, hue: r() });
    }
    // a few inside the road, away from the desks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      const d = 11.5 + r() * 2;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z < -5 && Math.abs(x) < 7) continue; // desks
      if (z > 6 && Math.abs(x) < 9) continue; // the homes street
      if (x > 5.5 && Math.abs(z) < 6) continue; // the Picnic Grill
      out.push({ x, z, s: 0.75 + r() * 0.35, hue: r() });
    }
    return out;
  }, []);
  const flowers = useMemo(() => {
    const r = rng(42);
    const colors = ["#ff8fb1", "#ffd84d", "#ffffff", "#b38cff", "#ff9f5a"];
    return Array.from({ length: 110 }, () => {
      const a = r() * Math.PI * 2;
      const d = 5.5 + r() * 8.5;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d, c: colors[Math.floor(r() * colors.length)]! };
    }).filter((f) => !(f.z < -5 && Math.abs(f.x) < 6.5) && !(f.z > 8.5 && f.z < 14 && Math.abs(f.x) < 8.5) && !(f.x > 5.5 && Math.abs(f.z) < 5.5));
  }, []);

  return (
    <group>
      {/* sea */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]} receiveShadow>
        <circleGeometry args={[140, 64]} />
        <meshStandardMaterial color="#7fd0ef" roughness={0.25} metalness={0.05} />
      </mesh>
      {/* sand + grass */}
      <mesh position={[0, -0.32, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_R + 0.9, ISLAND_R + 1.3, 0.4, 64]} />
        <meshStandardMaterial color="#f3e2b3" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R + 0.2, 0.4, 64]} />
        <meshStandardMaterial color="#93d673" roughness={0.95} />
      </mesh>
      {/* ring road + a path up to every building */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <ringGeometry args={[ROAD_IN, ROAD_OUT, 96]} />
        <meshStandardMaterial color="#efe8d4" roughness={0.9} />
      </mesh>
      {BUILDINGS.map((b) => {
        const { angle } = buildingSpot(b.id);
        const mid = (ROAD_OUT + 18.6) / 2;
        return (
          <mesh key={b.id} rotation={[-Math.PI / 2, 0, -angle]} position={[Math.cos(angle) * mid, 0.007, Math.sin(angle) * mid]} receiveShadow>
            <planeGeometry args={[18.6 - ROAD_OUT + 0.4, 1.6]} />
            <meshStandardMaterial color="#efe8d4" roughness={0.9} />
          </mesh>
        );
      })}
      {/* inner path ring round the fountain */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <ringGeometry args={[3.2, 4.6, 64]} />
        <meshStandardMaterial color="#efe8d4" roughness={0.9} />
      </mesh>
      <Fountain />
      {trees.map((t, i) => <Tree key={i} {...t} />)}
      {flowers.map((f, i) => (
        <mesh key={i} position={[f.x, 0.08, f.z]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color={f.c} />
        </mesh>
      ))}
      <Bench position={[6, 0, 3.5]} rotation={-2.1} />
      <Bench position={[-6, 0, 3.5]} rotation={2.1} />
      {Array.from({ length: desks }, (_, i) => <Desk key={i} index={i} count={desks} busy={busy[i] ?? false} />)}
      <Clouds />
    </group>
  );
}

function Fountain() {
  const drops = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    drops.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.9 + i / 12) % 1;
      const a = (i / 12) * Math.PI * 2;
      const r = 0.15 + t * 1.1;
      m.position.set(Math.cos(a) * r, 2.0 + Math.sin(t * Math.PI) * 0.7 - t * 1.0, Math.sin(a) * r);
    });
  });
  const stone = <meshStandardMaterial color="#f4f5f7" roughness={0.6} />;
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.3, 2.45, 0.45, 48]} />
        {stone}
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <cylinderGeometry args={[2.05, 2.05, 0.05, 48]} />
        <meshStandardMaterial color="#6fd0f5" roughness={0.15} />
      </mesh>
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.3, 20]} />
        {stone}
      </mesh>
      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.35, 0.3, 32]} />
        {stone}
      </mesh>
      <group ref={drops}>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color="#bfeeff" transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Tree({ x, z, s, hue }: { x: number; z: number; s: number; hue: number }) {
  const green = new THREE.Color().setHSL(0.27 + hue * 0.08, 0.5, 0.42 + hue * 0.08);
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 1.2, 10]} />
        <meshStandardMaterial color="#9a6b45" />
      </mesh>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[0.85, 18, 14]} />
        <meshStandardMaterial color={green} roughness={0.85} />
      </mesh>
      <mesh position={[0.35, 2.2, 0.1]} castShadow>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshStandardMaterial color={green} roughness={0.85} />
      </mesh>
    </group>
  );
}

function Bench({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  const wood = <meshStandardMaterial color="#c98d5a" roughness={0.8} />;
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[1.8, 0.1, 0.5]} />
        {wood}
      </mesh>
      <mesh position={[0, 0.8, -0.22]} castShadow>
        <boxGeometry args={[1.8, 0.35, 0.08]} />
        {wood}
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]}>
          <boxGeometry args={[0.1, 0.45, 0.45]} />
          <meshStandardMaterial color="#8e98a8" />
        </mesh>
      ))}
    </group>
  );
}

function Desk({ index, count, busy }: { index: number; count: number; busy: boolean }) {
  const { desk, angle } = deskSpot(index, count);
  const screen = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (screen.current) screen.current.emissiveIntensity = busy ? 0.8 + Math.sin(clock.elapsedTime * 6 + index) * 0.25 : 0.15;
  });
  // Face the desk toward the plaza centre.
  return (
    <group position={desk} rotation={[0, -angle - Math.PI / 2, 0]}>
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.08, 0.75]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.36, 0]}>
          <boxGeometry args={[0.08, 0.72, 0.6]} />
          <meshStandardMaterial color="#dfe5ee" />
        </mesh>
      ))}
      <mesh position={[0, 1.12, -0.18]} castShadow>
        <boxGeometry args={[0.9, 0.58, 0.06]} />
        <meshStandardMaterial color="#f7f8fa" />
      </mesh>
      <mesh position={[0, 1.12, -0.145]}>
        <planeGeometry args={[0.8, 0.48]} />
        <meshStandardMaterial ref={screen} color="#1b2a3a" emissive="#5fd0ff" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.79, 0.12]}>
        <boxGeometry args={[0.55, 0.03, 0.18]} />
        <meshStandardMaterial color="#e8ecf2" />
      </mesh>
    </group>
  );
}

function Clouds() {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.01;
  });
  const clouds = useMemo(() => {
    const r = rng(3);
    return Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2, d: 40 + r() * 14, y: 16 + r() * 5, s: 1 + r() * 0.8 }));
  }, []);
  return (
    <group ref={g}>
      {clouds.map((c, i) => (
        <group key={i} position={[Math.cos(c.a) * c.d, c.y, Math.sin(c.a) * c.d]} scale={c.s * 1.4}>
          {[[0, 0, 0, 1.6], [1.5, -0.2, 0.2, 1.2], [-1.4, -0.3, 0, 1.1], [0.4, 0.6, -0.3, 1.1]].map(([x, y, z, r], j) => (
            <mesh key={j} position={[x!, y!, z!]}>
              <sphereGeometry args={[r!, 16, 12]} />
              <meshStandardMaterial color="#ffffff" roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
