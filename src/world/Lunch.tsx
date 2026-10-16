import * as THREE from "three";

/** The Picnic Grill: a food stand on the east side of the plaza, with picnic tables in front. */
export const GRILL = { x: 13, z: 0, rotY: -Math.PI / 2 };
export const GRILL_LABEL_H = 4.7;

const PER_TABLE = 4;
const SEAT_R = 1.2;

/** Where table t sits: a column of up to three tables, then a second column nearer the fountain. */
function tableSpot(t: number, tables: number) {
  const col = Math.floor(t / 3);
  const inCol = Math.min(3, tables - col * 3);
  const row = t % 3;
  return new THREE.Vector3(9.4 - col * 2.9, 0, (row - (inCol - 1) / 2) * 3.3);
}

/** Avatar i's place at lunch: a spot round a table, facing it. */
export function lunchSeat(i: number, n: number) {
  const tables = Math.max(1, Math.ceil(n / PER_TABLE));
  const table = tableSpot(Math.floor(i / PER_TABLE), tables);
  const a = (i % PER_TABLE) * (Math.PI / 2) + Math.PI / 4;
  const stand = new THREE.Vector3(table.x + Math.cos(a) * SEAT_R, 0, table.z + Math.sin(a) * SEAT_R);
  return { table, stand };
}

const STRIPES = 7;

export function Lunch({ count }: { count: number }) {
  const tables = Math.max(1, Math.ceil(count / PER_TABLE));
  return (
    <group>
      <group position={[GRILL.x, 0, GRILL.z]} rotation={[0, GRILL.rotY, 0]} scale={1.25}>
        {/* the stand */}
        <mesh position={[0, 1.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.6, 2.2, 2]} />
          <meshStandardMaterial color="#ffd36e" roughness={0.7} />
        </mesh>
        {/* serving hatch + counter */}
        <mesh position={[0, 1.35, 1.01]}>
          <planeGeometry args={[2.6, 0.9]} />
          <meshStandardMaterial color="#5a3a26" />
        </mesh>
        <mesh position={[0, 0.85, 1.2]} castShadow>
          <boxGeometry args={[3, 0.12, 0.45]} />
          <meshStandardMaterial color="#fff6e6" />
        </mesh>
        {/* striped awning */}
        {Array.from({ length: STRIPES }, (_, k) => (
          <mesh key={k} position={[-1.8 + (k + 0.5) * (3.6 / STRIPES), 2.15, 1.45]} rotation={[0.45, 0, 0]} castShadow>
            <boxGeometry args={[3.6 / STRIPES, 0.06, 1.1]} />
            <meshStandardMaterial color={k % 2 ? "#ffffff" : "#ff6b6b"} />
          </mesh>
        ))}
        {/* a giant sandwich on the roof */}
        <group position={[0, 2.55, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.65, 0.7, 0.18, 24]} />
            <meshStandardMaterial color="#e7a85a" />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.75, 0.75, 0.07, 24]} />
            <meshStandardMaterial color="#79c95b" />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.68, 0.68, 0.09, 24]} />
            <meshStandardMaterial color="#c4553b" />
          </mesh>
          <mesh position={[0, 0.36, 0]}>
            <sphereGeometry args={[0.68, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#efb565" />
          </mesh>
        </group>
      </group>
      {Array.from({ length: tables }, (_, t) => {
        const p = tableSpot(t, tables);
        return (
          <group key={t} position={[p.x, 0, p.z]}>
            <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.72, 0.72, 0.08, 28]} />
              <meshStandardMaterial color="#ff8a8a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.36, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.12, 0.72, 10]} />
              <meshStandardMaterial color="#8a6a4e" />
            </mesh>
            {[0, 1, 2, 3].map((k) => {
              const a = k * (Math.PI / 2) + Math.PI / 4;
              return (
                <mesh key={k} position={[Math.cos(a) * 0.45, 0.78, Math.sin(a) * 0.45]}>
                  <cylinderGeometry args={[0.16, 0.13, 0.03, 16]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
              );
            })}
            {/* umbrella */}
            <mesh position={[0, 1.8, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 2.2, 6]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0, 3, 0]} castShadow>
              <coneGeometry args={[0.85, 0.35, 8]} />
              <meshStandardMaterial color={t % 2 ? "#6cc6ff" : "#ffd84d"} roughness={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
