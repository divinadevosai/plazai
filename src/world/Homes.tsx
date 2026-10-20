import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Agent } from "../types";
import { sky } from "./skyColors";

export const HOME_R = 11.8;

/** Each avatar's cottage sits in a little street on the near side of the plaza, facing the fountain. */
export function homeSpot(i: number, n: number) {
  const step = Math.min(0.3, 2.4 / Math.max(1, n));
  const a = Math.PI / 2 + (i - (n - 1) / 2) * step;
  const x = Math.cos(a) * HOME_R, z = Math.sin(a) * HOME_R;
  const door = { x: Math.cos(a) * (HOME_R - 1.5), z: Math.sin(a) * (HOME_R - 1.5) };
  return { x, z, door, rotY: Math.atan2(-x, -z), angle: a };
}

export type HomeState = "homeAwake" | "asleep";

export function Homes({ agents, states }: { agents: Agent[]; states: Record<string, HomeState | undefined> }) {
  return (
    <>
      {agents.map((a, i) => (
        <Home key={a.id} agent={a} index={i} count={agents.length} state={states[a.id]} />
      ))}
    </>
  );
}

function Home({ agent, index, count, state }: { agent: Agent; index: number; count: number; state?: HomeState }) {
  const spot = homeSpot(index, count);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d9eef8", emissive: "#ffc966", emissiveIntensity: 0, roughness: 0.25 }), []);
  useEffect(() => () => glass.dispose(), [glass]);
  useFrame(() => {
    // Lights on while they're home and awake; off when they're asleep or out.
    const target = state === "homeAwake" ? 1.3 : 0;
    glass.emissiveIntensity += (target - glass.emissiveIntensity) * 0.08;
    glass.color.set(state === "asleep" || (sky.night > 0.5 && !state) ? "#3a4560" : "#d9eef8");
  });
  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.rotY, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 1.8, 2]} />
        <meshStandardMaterial color="#fbf6ec" roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.95, 1.1, 4]} />
        <meshStandardMaterial color={agent.look.shirt} roughness={0.6} />
      </mesh>
      <mesh position={[0.6, 2.55, -0.3]} castShadow>
        <boxGeometry args={[0.3, 0.7, 0.3]} />
        <meshStandardMaterial color="#c9a98a" />
      </mesh>
      <mesh position={[0, 0.6, 1.01]}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial color={agent.look.pants} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[x, 1.05, 1.01]} material={glass}>
          <planeGeometry args={[0.5, 0.5]} />
        </mesh>
      ))}
      {/* front path */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 1.7]} receiveShadow>
        <planeGeometry args={[0.7, 1.5]} />
        <meshStandardMaterial color="#efe8d4" />
      </mesh>
    </group>
  );
}
