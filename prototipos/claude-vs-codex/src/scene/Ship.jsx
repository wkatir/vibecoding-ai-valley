import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game } from '../game/engine.js';
import { COLORS } from '../game/constants.js';

// Flat swept wing. In the shape, +y is forward. After rotateX it lies on the XZ plane.
function wing(side) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.35);
  shape.lineTo(side * 1.45, -0.6);
  shape.lineTo(side * 1.45, -0.95);
  shape.lineTo(0, -0.7);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

const RAYS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];

export default function Ship() {
  const root = useRef();
  const body = useRef();
  const emblem = useRef();
  const flame = useRef();
  const wings = useMemo(() => [wing(1), wing(-1)], []);

  useFrame((_, dt) => {
    const p = game.player;
    if (!root.current) return;
    root.current.visible = p.alive && (p.invuln <= 0 || p.invuln > 50 || Math.floor(game.clock * 14) % 2 === 0);
    root.current.position.set(p.x, 0, p.z);
    const k = Math.min(1, dt * 12);
    const bank = THREE.MathUtils.clamp(-p.vx * 0.04, -0.6, 0.6);
    const pitch = THREE.MathUtils.clamp(p.vz * 0.012, -0.25, 0.25);
    body.current.rotation.z += (bank - body.current.rotation.z) * k;
    body.current.rotation.x += (pitch - body.current.rotation.x) * k;
    emblem.current.rotation.y += dt * 1.6;
    flame.current.scale.y = 0.8 + Math.random() * 0.6;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.42, 2.1, 5]} />
          <meshStandardMaterial color={COLORS.claude} flatShading roughness={0.8} />
        </mesh>
        {wings.map((geometry, i) => (
          <mesh key={i} geometry={geometry} position={[0, -0.04, 0.25]}>
            <meshStandardMaterial color={COLORS.claudeDark} flatShading roughness={0.8} />
          </mesh>
        ))}
        {/* The cockpit doubles as the hitbox marker. */}
        <mesh position={[0, 0.3, -0.15]} scale={[1, 0.8, 1.4]}>
          <icosahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={COLORS.ink} flatShading />
        </mesh>
        <group ref={emblem} position={[0, 0.36, 0.5]}>
          {RAYS.map((r) => (
            <mesh key={r} rotation-y={r}>
              <boxGeometry args={[0.62, 0.035, 0.07]} />
              <meshBasicMaterial color={COLORS.ink} />
            </mesh>
          ))}
        </group>
        <group ref={flame} position={[0, 0, 1.05]} rotation-x={Math.PI / 2}>
          <mesh position={[0, 0.35, 0]}>
            <coneGeometry args={[0.17, 0.7, 6]} />
            <meshBasicMaterial color={COLORS.flame} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
