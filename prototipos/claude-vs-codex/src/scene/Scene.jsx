import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { game, input } from '../game/engine.js';
import { COLORS, FIELD } from '../game/constants.js';
import Ship from './Ship.jsx';
import { Boss, Minions, Beam } from './Boss.jsx';
import { PlayerShots, EnemyShots, Particles, ClearRing } from './Shots.jsx';

export const FOV = 38;
const TILT = 0.42; // radians from vertical
const TARGET = new THREE.Vector3(0, 0, -1.5);

function placeCamera(cam, dist, sx = 0, sz = 0) {
  cam.position.set(TARGET.x + sx, TARGET.y + dist * Math.cos(TILT), TARGET.z + dist * Math.sin(TILT) + sz);
  cam.lookAt(TARGET);
}

// Smallest camera distance that keeps the whole play area on screen.
function fitDistance(aspect) {
  const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 300);
  const w = FIELD.halfW + 1.2;
  const corners = [
    [-w, FIELD.top],
    [w, FIELD.top],
    [-w, FIELD.bottom],
    [w, FIELD.bottom],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  let lo = 6;
  let hi = 160;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    placeCamera(cam, mid);
    cam.updateMatrixWorld();
    const fits = corners.every((c) => {
      const v = c.clone().project(cam);
      return Math.abs(v.x) < 0.94 && v.y > -0.84 && v.y < 0.8;
    });
    if (fits) hi = mid;
    else lo = mid;
  }
  return hi;
}

function Loop() {
  // Priority -1 runs before every other frame callback.
  useFrame((_, delta) => game.update(delta), -1);
  return null;
}

function Rig() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dist = useRef(30);

  useLayoutEffect(() => {
    const aspect = width / height;
    game.setAspect(aspect);
    dist.current = fitDistance(aspect);
  }, [width, height]);

  useFrame(() => {
    const s = game.shake * game.shake;
    placeCamera(camera, dist.current, (Math.random() - 0.5) * s * 1.4, (Math.random() - 0.5) * s);
  });
  return null;
}

function Lights() {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[5, 14, 6]} intensity={2.2} />
      <directionalLight position={[-6, 8, -4]} intensity={0.6} color={COLORS.codexLight} />
    </>
  );
}

// The background is a codebase scrolling by: rows of tokens, like an editor minimap.
const TILE = 36;
const PITCH = 1.1;
const PANES = [-50, -24, 2, 28];
const TOKEN_COLORS = ['#232a38', '#232a38', '#232a38', '#2c2a52', '#1f3a33', '#3d2a26', '#1a202b'];

function buildTokens() {
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const tokens = [];
  const rows = Math.floor(TILE / PITCH);
  for (let r = 0; r < rows; r++) {
    const z = -TILE / 2 + r * PITCH;
    for (const left of PANES) {
      if (rnd() < 0.22) continue;
      let x = left + Math.floor(rnd() * 5) * 1.5;
      const count = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < count; i++) {
        const len = 0.8 + rnd() * 4.5;
        if (x + len > left + 21) break;
        tokens.push({ x: x + len / 2, z, len, color: TOKEN_COLORS[Math.floor(rnd() * TOKEN_COLORS.length)] });
        x += len + 0.55;
      }
    }
  }
  return tokens;
}

function CodeLines() {
  const group = useRef();
  const mesh = useRef();
  const tokens = useMemo(buildTokens, []);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    tokens.forEach((t, i) => {
      for (let copy = 0; copy < 2; copy++) {
        dummy.position.set(t.x, -1.2, t.z - copy * TILE);
        dummy.scale.set(t.len, 1, 1);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(i * 2 + copy, dummy.matrix);
        mesh.current.setColorAt(i * 2 + copy, color.set(t.color));
      }
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.instanceColor.needsUpdate = true;
  }, [tokens]);

  useFrame(() => {
    group.current.position.z = (game.clock * 2.2) % TILE;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, undefined, tokens.length * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 0.04, 0.3]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

function Rails() {
  const left = useRef();
  const right = useRef();
  const length = FIELD.bottom - FIELD.top + 3;
  const z = (FIELD.top + FIELD.bottom) / 2;
  useFrame(() => {
    left.current.position.x = -FIELD.halfW - 0.6;
    right.current.position.x = FIELD.halfW + 0.6;
  });
  return (
    <>
      {[left, right].map((ref, i) => (
        <mesh key={i} ref={ref} position={[0, 0, z]}>
          <boxGeometry args={[0.07, 0.02, length]} />
          <meshBasicMaterial color={COLORS.ink} transparent opacity={0.2} />
        </mesh>
      ))}
    </>
  );
}

// Invisible plane that turns mouse and touch positions into world coordinates.
function PointerPlane() {
  const update = (e) => {
    const touch = e.nativeEvent.pointerType === 'touch';
    input.targetX = e.point.x;
    input.targetZ = e.point.z - (touch ? 3 : 0); // keep the ship above the finger
  };
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} onPointerMove={update} onPointerDown={update}>
      <planeGeometry args={[400, 400]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export default function Scene() {
  return (
    <>
      <Loop />
      <Rig />
      <Lights />
      <CodeLines />
      <Rails />
      <PointerPlane />
      <Ship />
      <Boss />
      <Minions />
      <Beam />
      <PlayerShots />
      <EnemyShots />
      <Particles />
      <ClearRing />
    </>
  );
}
