import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { clockNow, daylight } from "../clock";
import { sky } from "./sky";

const DAY = new THREE.Color("#bfe9ff");
const DUSK = new THREE.Color("#f6b98e");
const NIGHT = new THREE.Color("#141b33");
const SUN = new THREE.Color("#ffffff");
const MOON = new THREE.Color("#9fb4ff");

/** Lights, sky colour, stars and street lamps, all following the real time of day. */
export function Sky() {
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const starMat = useRef<THREE.PointsMaterial>(null);
  const bulbs = useMemo(() => new THREE.MeshStandardMaterial({ color: "#fff3c4", emissive: "#ffd36b", emissiveIntensity: 0 }), []);
  const color = useMemo(() => new THREE.Color(), []);
  const last = useRef(-1);

  const stars = useMemo(() => {
    const pts = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = 0.12 + Math.random() * 1.3; // elevation, above the horizon
      pts.set([Math.cos(a) * Math.cos(e) * 110, Math.sin(e) * 110, Math.sin(a) * Math.cos(e) * 110], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return g;
  }, []);

  const lamps = useMemo(() => Array.from({ length: 14 }, (_, i) => (i / 14) * Math.PI * 2 + 0.11), []);

  useFrame(({ clock }) => {
    // The sky changes slowly: recompute a few times a second, not every frame.
    if (clock.elapsedTime - last.current < 0.25) return;
    last.current = clock.elapsedTime;
    const d = daylight(clockNow());
    sky.night = 1 - d;
    if (d > 0.5) color.copy(DUSK).lerp(DAY, (d - 0.5) * 2);
    else color.copy(NIGHT).lerp(DUSK, d * 2);
    if (scene.background instanceof THREE.Color) scene.background.copy(color);
    if (scene.fog) scene.fog.color.copy(color);
    if (hemi.current) hemi.current.intensity = 0.28 + 0.62 * d;
    if (sun.current) {
      sun.current.intensity = 0.35 + 1.45 * d;
      sun.current.color.copy(MOON).lerp(SUN, d);
    }
    if (starMat.current) starMat.current.opacity = Math.max(0, (sky.night - 0.45) / 0.55);
    bulbs.emissiveIntensity = sky.night > 0.35 ? 1.6 * Math.min(1, (sky.night - 0.35) / 0.3) : 0;
  });

  return (
    <>
      <color attach="background" args={["#bfe9ff"]} />
      <fog attach="fog" args={["#bfe9ff", 60, 140]} />
      <hemisphereLight ref={hemi} args={["#e6f6ff", "#8fd16f", 0.9]} />
      <directionalLight
        ref={sun}
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
      <points geometry={stars}>
        <pointsMaterial ref={starMat} color="#ffffff" size={0.9} sizeAttenuation transparent opacity={0} depthWrite={false} fog={false} />
      </points>
      {lamps.map((a) => (
        <group key={a} position={[Math.cos(a) * 14.9, 0, Math.sin(a) * 14.9]}>
          <mesh position={[0, 1.3, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.09, 2.6, 8]} />
            <meshStandardMaterial color="#5a6478" />
          </mesh>
          <mesh position={[0, 2.7, 0]} material={bulbs}>
            <sphereGeometry args={[0.22, 14, 10]} />
          </mesh>
        </group>
      ))}
    </>
  );
}
