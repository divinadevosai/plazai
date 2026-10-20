import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Avatar3D, type Pose } from "../avatar/Avatar3D";
import type { DayPhase } from "../clock";
import type { Activity } from "../store";
import type { Agent } from "../types";
import { buildingSpot, PLAZA_ID } from "./buildingList";
import { homeSpot, type HomeState } from "./Homes";
import { deskSpot } from "./Island";
import { lunchSeat } from "./Lunch";

const SPEED = 1.7;
const WANDER_MIN = 3.4;
const WANDER_MAX = 14.5;
const FOUNTAIN_R = 2.9;

interface Props {
  agent: Agent;
  index: number;
  count: number;
  activity: Activity | null;
  /** Daily routine: awake, at lunch, heading home, or asleep. */
  phase: DayPhase;
  /** Called when the avatar steps inside a building (or comes back out). */
  onInside: (id: string, buildingId: string | null) => void;
  /** Called when the avatar goes into (or leaves) their own house. */
  onHome: (id: string, state: HomeState | null) => void;
  /** Selected avatars stop, turn to the camera and wave. */
  selected: boolean;
  onSelect: (id: string) => void;
  positions: Map<string, THREE.Vector3>;
}

function wanderPoint() {
  const a = Math.random() * Math.PI * 2;
  const d = WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
  return new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
}

const v3 = (p: { x: number; z: number }) => new THREE.Vector3(p.x, 0, p.z);

/**
 * One avatar living in the plaza. By day they wander, and walk to a desk or building when given work.
 * At lunchtime they gather at the Picnic Grill. In the evening they head home; at bedtime the lights go out.
 * Urgent work gets them up (or back from lunch) and running.
 */
export function PlazaAgent({ agent, index, count, activity, phase, selected, onSelect, positions, onInside, onHome }: Props) {
  const group = useRef<THREE.Group>(null);
  const pose = useRef<Pose>("idle");
  const home = homeSpot(index, count);
  // If Plazai opens at night, they're already tucked up at home.
  const startHome = phase === "asleep" && !activity;
  const state = useRef({
    pos: startHome ? v3(home.door) : wanderPoint(),
    target: wanderPoint(),
    pauseUntil: 0,
    wasBusy: false,
    celebrate: false,
    inside: null as string | null,
    atHome: null as HomeState | null,
    homeReported: false,
    selectedAt: -1,
    wasSelected: false,
    facing: Math.random() * Math.PI * 2,
  });
  const busy = activity !== null;

  useFrame(({ clock, camera }, dt) => {
    const s = state.current;
    const now = clock.elapsedTime;
    const spot = deskSpot(index, count);
    const inBuilding = busy && activity!.buildingId !== PLAZA_ID;
    const door = inBuilding ? buildingSpot(activity!.buildingId).door : null;
    const bedtime = phase === "goingHome" || phase === "asleep";
    const lunch = phase === "lunch";
    const seat = lunchSeat(index, count);

    if (startHome && !s.homeReported) {
      s.homeReported = true;
      s.atHome = "asleep";
      onHome(agent.id, "asleep");
    }
    if (selected && !s.wasSelected) s.selectedAt = now;
    s.wasSelected = selected;

    const leaveHome = () => {
      if (!s.atHome) return;
      s.atHome = null;
      onHome(agent.id, null);
      s.pos.copy(v3(home.door));
    };

    if (busy) {
      leaveHome(); // urgent work wakes them up
      s.target = door ? v3(door) : spot.stand;
      s.wasBusy = true;
      s.pauseUntil = 0;
    } else if (s.wasBusy) {
      if (s.inside) {
        s.inside = null;
        onInside(agent.id, null);
      }
      // just finished: a little celebration, then wander off (or back to bed)
      s.wasBusy = false;
      s.celebrate = true;
      s.pauseUntil = now + 2.5;
      s.target = bedtime ? v3(home.door) : lunch ? seat.stand.clone() : wanderPoint();
    } else if (bedtime) {
      s.target = v3(home.door);
      const arrived = s.pos.distanceTo(s.target) < 0.3;
      const want: HomeState = phase === "asleep" ? "asleep" : "homeAwake";
      if (arrived && s.atHome !== want) {
        s.atHome = want;
        onHome(agent.id, want);
      }
    } else if (lunch) {
      leaveHome();
      s.target = seat.stand.clone();
    } else {
      leaveHome(); // good morning!
      if (s.pos.distanceTo(s.target) < 0.15 && now > s.pauseUntil) {
        // reached a stroll target: rest a little, then pick somewhere new
        s.celebrate = false;
        s.pauseUntil = now + 1 + Math.random() * 4;
        s.target = wanderPoint();
      }
    }

    const to = s.target.clone().sub(s.pos);
    const dist = to.length();
    // Arrived at the door with work to do: step inside (the building shows what they're up to).
    const shouldBeInside = inBuilding && activity!.status === "working" && dist < 0.3 ? activity!.buildingId : null;
    if (shouldBeInside !== s.inside) {
      s.inside = shouldBeInside;
      onInside(agent.id, shouldBeInside);
    }
    if (group.current) group.current.visible = !s.inside && !s.atHome;

    // Selected (and free): stop, turn to the camera, and wave hello.
    const posing = selected && !busy && !s.atHome;
    const moving = !posing && dist > 0.08 && (busy || bedtime || lunch || now > s.pauseUntil);
    if (moving) {
      to.normalize();
      const speed = busy ? SPEED * (activity!.urgent ? 4.5 : 3) : bedtime ? SPEED * 1.4 : lunch ? SPEED * 1.6 : SPEED;
      s.pos.addScaledVector(to, Math.min(dist, speed * dt));
      // slide around the fountain instead of walking through it
      const r = Math.hypot(s.pos.x, s.pos.z);
      if (r < FOUNTAIN_R) s.pos.multiplyScalar(FOUNTAIN_R / Math.max(r, 0.001));
      s.facing = lerpAngle(s.facing, Math.atan2(to.x, to.z), Math.min(1, dt * 8));
    } else if (posing) {
      s.facing = lerpAngle(s.facing, Math.atan2(camera.position.x - s.pos.x, camera.position.z - s.pos.z), Math.min(1, dt * 7));
    } else if (busy && door) {
      const b = buildingSpot(activity!.buildingId);
      s.facing = lerpAngle(s.facing, Math.atan2(b.x - s.pos.x, b.z - s.pos.z), Math.min(1, dt * 6));
    } else if (lunch && !busy) {
      // tuck in: face the table
      s.facing = lerpAngle(s.facing, Math.atan2(seat.table.x - s.pos.x, seat.table.z - s.pos.z), Math.min(1, dt * 6));
    } else if (busy) {
      // face the desk while working
      s.facing = lerpAngle(s.facing, Math.atan2(spot.desk.x - s.pos.x, spot.desk.z - s.pos.z), Math.min(1, dt * 6));
    }
    pose.current = moving
      ? "walk"
      : posing
        ? now - s.selectedAt < 2.2 ? "wave" : "idle"
        : (busy && activity?.status === "working") || (lunch && !busy) ? "work" : now < s.pauseUntil && s.celebrate ? "wave" : "idle";
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
