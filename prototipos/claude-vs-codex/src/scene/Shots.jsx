import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game } from '../game/engine.js';
import { COLORS, PLAYER } from '../game/constants.js';

const MAX_PLAYER = 96;
const MAX_ENEMY = 460;
const MAX_PARTICLES = 450;

// Claude's shots: small elongated diamonds.
export function PlayerShots() {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const list = game.pBullets;
    const mesh = ref.current;
    const n = Math.min(list.length, MAX_PLAYER);
    for (let i = 0; i < n; i++) {
      dummy.position.set(list[i].x, 0.3, list[i].z);
      dummy.scale.set(0.16, 0.16, 0.7);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PLAYER]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={COLORS.claudeLight} />
    </instancedMesh>
  );
}

// Codex's shots are ">" chevrons that point where they are going.
function chevron() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55);
  s.lineTo(0.5, 0);
  s.lineTo(0.5, -0.32);
  s.lineTo(0, 0.2);
  s.lineTo(-0.5, -0.32);
  s.lineTo(-0.5, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.07, 0);
  return g;
}

export function EnemyShots() {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(chevron, []);
  useFrame(() => {
    const list = game.eBullets;
    const mesh = ref.current;
    const n = Math.min(list.length, MAX_ENEMY);
    for (let i = 0; i < n; i++) {
      const e = list[i];
      dummy.position.set(e.x, 0.3, e.z);
      dummy.rotation.set(0, Math.atan2(-e.vx, -e.vz), 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, MAX_ENEMY]} frustumCulled={false}>
      <meshBasicMaterial color={COLORS.codexLight} />
    </instancedMesh>
  );
}

export function Particles() {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    // Allocate the instance color buffer up front.
    ref.current.setColorAt(0, color.set('#ffffff'));
  }, [color]);
  useFrame(() => {
    const list = game.particles;
    const mesh = ref.current;
    const n = Math.min(list.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
      const q = list[i];
      const k = 1 - q.life / q.max;
      dummy.position.set(q.x, q.y, q.z);
      dummy.rotation.set(q.life * 6, q.life * 4, 0);
      dummy.scale.setScalar(q.size * (0.3 + 0.7 * k));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.setHex(q.color));
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial />
    </instancedMesh>
  );
}

// Expanding ring for /clear.
export function ClearRing() {
  const ref = useRef();
  const mat = useRef();
  useFrame(() => {
    const p = game.player;
    const mesh = ref.current;
    mesh.visible = p.clearFx > 0;
    if (!mesh.visible) return;
    const k = 1 - p.clearFx / PLAYER.clearTime;
    const r = 1 + k * 30;
    mesh.scale.set(r, r, 1);
    mesh.position.set(p.x, 0.2, p.z);
    mat.current.opacity = 0.9 * (1 - k);
  });
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.96, 1, 96]} />
      <meshBasicMaterial ref={mat} color={COLORS.ink} transparent depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}
