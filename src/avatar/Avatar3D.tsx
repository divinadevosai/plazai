import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Look } from "../types";
import { faceTexture } from "./face";

export type Pose = "idle" | "walk" | "work" | "wave";

interface Props {
  look: Look;
  /** Read every frame, so it can change without re-rendering. */
  pose?: React.RefObject<Pose> | Pose;
  seed?: number;
}

const HEAD_R = 0.5;

/** A chunky, friendly avatar: big round head, simple body, animated by pose. */
export function Avatar3D({ look, pose = "idle", seed = 0 }: Props) {
  const root = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);

  const face = useMemo(() => {
    const t = new THREE.CanvasTexture(faceTexture(look));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [look]);
  useEffect(() => () => face.dispose(), [face]);

  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: look.skin, roughness: 0.55 }), [look.skin]);
  const hair = useMemo(() => new THREE.MeshStandardMaterial({ color: look.hairColor, roughness: 0.7, side: THREE.DoubleSide }), [look.hairColor]);
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color: look.shirt, roughness: 0.6 }), [look.shirt]);
  const pants = useMemo(() => new THREE.MeshStandardMaterial({ color: look.pants, roughness: 0.7 }), [look.pants]);
  const shoe = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f4f4f6", roughness: 0.4 }), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 1.7;
    const p = typeof pose === "string" ? pose : pose.current ?? "idle";
    const swing = p === "walk" ? Math.sin(t * 9) * 0.6 : 0;
    if (legL.current && legR.current) {
      legL.current.rotation.x = swing;
      legR.current.rotation.x = -swing;
    }
    if (armL.current && armR.current) {
      if (p === "work") {
        // typing: arms forward, quick taps
        armL.current.rotation.set(-1.2 + Math.sin(t * 14) * 0.08, 0, 0.15);
        armR.current.rotation.set(-1.2 + Math.cos(t * 13) * 0.08, 0, -0.15);
      } else if (p === "wave") {
        armL.current.rotation.set(0, 0, 0.12);
        armR.current.rotation.set(0, 0, -2.6 + Math.sin(t * 8) * 0.35);
      } else {
        armL.current.rotation.set(-swing * 0.8, 0, 0.12 + Math.sin(t * 1.5) * 0.02);
        armR.current.rotation.set(swing * 0.8, 0, -0.12 - Math.sin(t * 1.5) * 0.02);
      }
    }
    if (head.current) {
      head.current.position.y = 1.45 + (p === "walk" ? Math.abs(Math.sin(t * 9)) * 0.04 : Math.sin(t * 1.8) * 0.012);
      head.current.rotation.x = p === "work" ? 0.18 + Math.sin(t * 2) * 0.03 : Math.sin(t * 0.7) * 0.04;
      head.current.rotation.z = p === "idle" ? Math.sin(t * 0.5) * 0.05 : 0;
    }
    if (root.current) root.current.position.y = p === "walk" ? Math.abs(Math.sin(t * 9)) * 0.05 : 0;
  });

  const b = look.build;
  return (
    <group scale={look.height}>
      <group ref={root}>
        {/* legs */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s < 0 ? legL : legR} position={[s * 0.14 * b, 0.5, 0]}>
            <mesh material={pants} position={[0, -0.22, 0]} castShadow>
              <capsuleGeometry args={[0.1 * b, 0.32, 6, 12]} />
            </mesh>
            <mesh material={shoe} position={[0, -0.47, 0.05]} castShadow>
              <sphereGeometry args={[0.12, 16, 12]} />
            </mesh>
          </group>
        ))}
        {/* torso */}
        <mesh material={shirt} position={[0, 0.78, 0]} castShadow>
          <capsuleGeometry args={[0.27 * b, 0.3, 8, 16]} />
        </mesh>
        {/* arms */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s < 0 ? armL : armR} position={[s * 0.33 * b, 0.98, 0]}>
            <mesh material={shirt} position={[0, -0.2, 0]} castShadow>
              <capsuleGeometry args={[0.075, 0.3, 6, 10]} />
            </mesh>
            <mesh material={skin} position={[0, -0.42, 0]}>
              <sphereGeometry args={[0.085, 14, 10]} />
            </mesh>
          </group>
        ))}
        {/* head */}
        <group ref={head} position={[0, 1.45, 0]}>
          <mesh material={skin} castShadow>
            <sphereGeometry args={[HEAD_R, 40, 28]} />
          </mesh>
          <mesh>
            <sphereGeometry args={[HEAD_R * 1.004, 40, 28]} />
            <meshStandardMaterial map={face} transparent roughness={0.6} depthWrite={false} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={skin} position={[s * HEAD_R * 0.98, -0.02, 0]}>
              <sphereGeometry args={[0.09, 14, 10]} />
            </mesh>
          ))}
          <Hair style={look.hair} material={hair} />
        </group>
      </group>
    </group>
  );
}

function Hair({ style, material }: { style: number; material: THREE.Material }) {
  const R = HEAD_R * 1.05;
  // Top cap: a sphere slice from the crown down to `theta` radians.
  const cap = (theta: number, tilt = -0.25) => (
    <mesh material={material} rotation={[tilt, 0, 0]} castShadow>
      <sphereGeometry args={[R, 36, 20, 0, Math.PI * 2, 0, theta]} />
    </mesh>
  );
  // Curtain round the back and sides, leaving an opening for the face (+Z is at phi = PI/2).
  const OPEN = 0.95;
  const back = (theta: number, scaleY = 1, r = R) => (
    <mesh material={material} scale={[1.03, scaleY, 1.03]} position={[0, (1 - scaleY) * 0.45, 0]} castShadow>
      <sphereGeometry args={[r, 40, 22, Math.PI / 2 + OPEN, Math.PI * 2 - OPEN * 2, 0, theta]} />
      {/* inside faces are visible through the face opening */}
    </mesh>
  );
  switch (style) {
    case 0:
      return null;
    case 1:
      return cap(0.95);
    case 2:
      return (
        <>
          {cap(1.15)}
          <mesh material={material} position={[-0.16, 0.36, 0.3]} rotation={[0.5, 0, 0.45]} scale={[1.6, 0.55, 0.8]}>
            <sphereGeometry args={[0.2, 18, 12]} />
          </mesh>
        </>
      );
    case 3:
      return (
        <>
          {cap(1.05)}
          {Array.from({ length: 9 }, (_, i) => {
            const a = (i / 9) * Math.PI * 2;
            return (
              <mesh key={i} material={material} position={[Math.cos(a) * 0.26, 0.5, Math.sin(a) * 0.26 - 0.05]} rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}>
                <coneGeometry args={[0.1, 0.3, 10]} />
              </mesh>
            );
          })}
        </>
      );
    case 4:
      return (
        <>
          {cap(1.25, -0.15)}
          {back(2.1)}
        </>
      );
    case 5:
      return (
        <>
          {cap(1.25, -0.15)}
          {back(2.35, 1.3)}
        </>
      );
    case 6:
      return (
        <group position={[0, 0.16, -0.08]}>
          <mesh material={material} castShadow>
            <sphereGeometry args={[0.68, 32, 20, 0, Math.PI * 2, 0, 1.18]} />
          </mesh>
          <mesh material={material} castShadow>
            <sphereGeometry args={[0.68, 32, 20, Math.PI / 2 + 1.1, Math.PI * 2 - 2.2, 0, 2.05]} />
          </mesh>
        </group>
      );
    case 7:
      return (
        <>
          {cap(1.15)}
          <mesh material={material} position={[0, 0.6, -0.12]} castShadow>
            <sphereGeometry args={[0.2, 18, 14]} />
          </mesh>
        </>
      );
    default:
      return cap(1.1);
  }
}
