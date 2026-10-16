import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Avatar3D, type Pose } from "../avatar/Avatar3D";
import type { Activity } from "../store";
import type { Agent } from "../types";
import { buildingSpot, PLAZA_ID } from "./buildings";
import { deskSpot } from "./Island";

const SPEED = 1.7;
const WANDER_MIN = 3.4;
const WANDER_MAX = 14.5;
const FOUNTAIN_R = 2.9;

interface Props {
  agent: Agent;
  index: number;
  count: number;
  activity: Activity | null;
  /** Called when the avatar steps inside a building (or comes back out). */
  onInside: (id: string, buildingId: string | null) => void;
  selected: boolean;
  onSelect: (id: string) => void;
  positions: Map<string, THREE.Vector3>;
}

function wanderPoint() {
  const a = Math.random() * Math.PI * 2;
  const d = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
  return new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
}

/** One avatar living in the plaza: wanders when free, walks to its desk and works when busy. */
export function PlazaAgent({ agent, index, count, activity, selected, onSelect, positions, onInside }: Props) {
  const group = useRef<THREE.Group>(null);
  const pose = useRef<Pose>("idle");
  const state = useRef({ pos: wanderPoint(), target: wanderPoint(), pauseUntil: 0, wasBusy: false, celebrate: false, inside: null as string | null, facing: Math.random() * Math.PI * 2 });
  const busy = activity !== null;

  useFrame(({ clock }, dt) => {
    const s = state.current;
    const now = clock.elapsedTime;
    const spot = deskSpot(index, count);
    const inBuilding = busy && activity!.buildingId !== PLAZA_ID;
    const door = inBuilding ? buildingSpot(activity!.buildingId).door : null;
    if (busy) {
      s.target = door ? new THREE.Vector3(door.x, 0, door.z) : spot.stand;
      s.wasBusy = true;
      s.pauseUntil = 0;
    } else if (s.wasBusy) {
      if (s.inside) {
        s.inside = null;
        onInside(agent.id, null);
        if (group.current) group.current.visible = true;
      }
      // just finished: stay a moment to celebrate, then wander off
      s.wasBusy = false;
      s.celebrate = true;
      s.pauseUntil = now + 2.5;
      s.target = wanderPoint();
    } else if (s.pos.distanceTo(s.target) < 0.15 && now > s.pauseUntil) {
      // reached a stroll target: rest a little, then pick somewhere new
      s.celebrate = false;
      s.pauseUntil = now + 1 + Math.random() * 4;
      s.target = wanderPoint();
    }

    const to = s.target.clone().sub(s.pos);
    const dist = to.length();
    // Arrived at the door with work to do: step inside (the building shows what they're up to).
    const shouldBeInside = inBuilding && activity!.status === "working" && dist < 0.3 ? activity!.buildingId : null;
    if (shouldBeInside !== s.inside) {
      s.inside = shouldBeInside;
      onInside(agent.id, shouldBeInside);
      if (group.current) group.current.visible = !shouldBeInside;
    }
    const moving = dist > 0.08 && (busy || now > s.pauseUntil);
    if (moving) {
      to.normalize();
      s.pos.addScaledVector(to, Math.min(dist, (busy ? SPEED * 3 : SPEED) * dt));
      // slide around the fountain instead of walking through it
      const r = Math.hypot(s.pos.x, s.pos.z);
      if (r < FOUNTAIN_R) s.pos.multiplyScalar(FOUNTAIN_R / Math.max(r, 0.001));
      s.facing = lerpAngle(s.facing, Math.atan2(to.x, to.z), Math.min(1, dt * 8));
    } else if (busy && door) {
      s.facing = lerpAngle(s.facing, Math.atan2(buildingSpot(activity!.buildingId).x - s.pos.x, buildingSpot(activity!.buildingId).z - s.pos.z), Math.min(1, dt * 6));
    } else if (busy) {
      // face the desk while working
      s.facing = lerpAngle(s.facing, Math.atan2(spot.desk.x - s.pos.x, spot.desk.z - s.pos.z), Math.min(1, dt * 6));
    }
    pose.current = moving ? "walk" : busy && activity?.status === "working" ? "work" : now < s.pauseUntil && s.celebrate ? "wave" : "idle";
    if (group.current) {
      group.current.position.copy(s.pos);
      group.current.rotation.y = s.facing;
    }
    positions.set(agent.id, s.pos);
  });

  return (
    <group
      ref={group}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(agent.id);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <Avatar3D look={agent.look} pose={pose} seed={index} />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.7, 40]} />
          <meshBasicMaterial color="#2fb5f0" />
        </mesh>
      )}
    </group>
  );
}

export const tail = (t: string) => {
  const clean = t.replace(/\s+/g, " ").trim();
  return clean.length > 110 ? `…${clean.slice(-110)}` : clean;
};

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
