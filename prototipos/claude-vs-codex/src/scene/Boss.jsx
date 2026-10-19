import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game } from '../game/engine.js';
import { BOSS, COLORS, FIELD } from '../game/constants.js';

// Codex is a cloud (it runs in the cloud) with a terminal prompt on top of it.
const BUMPS = [
  { p: [0, 0, 0], r: 2.1 },
  { p: [-2.0, -0.2, 0.5], r: 1.55 },
  { p: [2.0, -0.2, 0.5], r: 1.55 },
  { p: [-1.0, 0.3, -1.3], r: 1.4 },
  { p: [1.1, 0.3, -1.3], r: 1.4 },
  { p: [-3.0, -0.5, 1.0], r: 1.0 },
  { p: [3.0, -0.5, 1.0], r: 1.0 },
  { p: [0, -0.2, 1.6], r: 1.3 },
];

// Prompt color escalates with each phase.
const SCREEN_BY_PHASE = [COLORS.screen, COLORS.screen, COLORS.warn, COLORS.danger];

function roundedPanel(w, d, r, h) {
  const x = -w / 2;
  const y = -d / 2;
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function Boss() {
  const root = useRef();
  const bumps = useRef([]);
  const cursor = useRef();
  const cloud = useMemo(
    () => new THREE.MeshStandardMaterial({ color: COLORS.codex, flatShading: true, roughness: 0.85, metalness: 0 }),
    [],
  );
  const glyph = useMemo(() => new THREE.MeshBasicMaterial({ color: COLORS.screen }), []);
  const panel = useMemo(() => roundedPanel(3.5, 2.5, 0.45, 0.3), []);

  useFrame((_, dt) => {
    const b = game.boss;
    const g = root.current;
    if (!g) return;
    g.visible = b.alive;
    if (!b.alive) return;

    const dying = game.status === 'won';
    const jitter = dying ? 0.35 : b.shield > 0 ? 0.12 : 0;
    g.position.set(b.x + (Math.random() - 0.5) * jitter, 0, b.z + (Math.random() - 0.5) * jitter);
    g.rotation.z = Math.sin(b.t * 1.2) * 0.05;
    g.rotation.x = Math.sin(b.t * 0.9) * 0.03;

    let glow = b.flash * 0.6;
    if (b.shield > 0) glow += 0.25 + 0.2 * Math.sin(b.t * 30);
    if (dying) glow += 0.4 * Math.abs(Math.sin(b.dieT * 20));
    cloud.emissive.setRGB(glow, glow, glow);

    bumps.current.forEach((m, i) => {
      if (m) m.rotation.y += dt * (i % 2 ? 0.25 : -0.2);
    });
    glyph.color.set(SCREEN_BY_PHASE[b.phase]);
    cursor.current.visible = Math.floor(b.t * 2) % 2 === 0;
  });

  return (
    <group ref={root}>
      {BUMPS.map((bump, i) => (
        <mesh
          key={i}
          ref={(el) => {
            bumps.current[i] = el;
          }}
          position={bump.p}
          material={cloud}
        >
          <icosahedronGeometry args={[bump.r, 1]} />
        </mesh>
      ))}
      <mesh geometry={panel} position={[0, 1.85, -0.1]}>
        <meshStandardMaterial color={COLORS.panel} flatShading roughness={0.6} />
      </mesh>
      {/* The prompt: ">" and a blinking "_" lying flat on the panel. */}
      <group position={[0, 2.22, -0.1]}>
        <mesh position={[-0.8, 0, -0.35]} rotation-y={-0.72} material={glyph}>
          <boxGeometry args={[1.15, 0.08, 0.24]} />
        </mesh>
        <mesh position={[-0.8, 0, 0.35]} rotation-y={0.72} material={glyph}>
          <boxGeometry args={[1.15, 0.08, 0.24]} />
        </mesh>
        <mesh ref={cursor} position={[0.85, 0, 0.7]} material={glyph}>
          <boxGeometry args={[0.95, 0.08, 0.22]} />
        </mesh>
      </group>
    </group>
  );
}

// Cursor blocks that Codex spawns in phases 2 and 3.
const SLOTS = 4;

export function Minions() {
  const refs = useRef([]);
  useFrame(() => {
    for (let i = 0; i < SLOTS; i++) {
      const mesh = refs.current[i];
      if (!mesh) continue;
      const m = game.minions[i];
      mesh.visible = Boolean(m) && m.hp > 0;
      if (mesh.visible) {
        mesh.position.set(m.x, 0.4, m.z);
        mesh.scale.y = 1 + 0.12 * Math.sin(m.t * 12);
      }
    }
  });
  return (
    <>
      {Array.from({ length: SLOTS }, (_, i) => (
        <mesh
          key={i}
          visible={false}
          ref={(el) => {
            refs.current[i] = el;
          }}
        >
          <boxGeometry args={[0.7, 0.6, 1.1]} />
          <meshStandardMaterial color={COLORS.codexLight} flatShading roughness={0.7} />
        </mesh>
      ))}
    </>
  );
}

// The phase 3 beam. A thin blinking line warns where it will land.
export function Beam() {
  const root = useRef();
  const outer = useRef();
  const core = useRef();
  useFrame(() => {
    const b = game.boss;
    const bm = b.beam;
    const on = bm.state !== 'idle' && game.status === 'playing';
    root.current.visible = on;
    if (!on) return;
    const z0 = b.z + 1;
    const z1 = FIELD.bottom + 3;
    root.current.position.set(b.x, 0.15, (z0 + z1) / 2);
    root.current.scale.z = z1 - z0;
    if (bm.state === 'tele') {
      outer.current.visible = Math.floor(bm.t * 12) % 2 === 0;
      outer.current.scale.x = 0.12;
      core.current.visible = false;
    } else {
      outer.current.visible = true;
      outer.current.scale.x = BOSS.beamHalf * 2;
      core.current.visible = true;
      core.current.scale.x = BOSS.beamHalf;
    }
  });
  return (
    <group ref={root} visible={false}>
      <mesh ref={outer}>
        <boxGeometry args={[1, 0.05, 1]} />
        <meshBasicMaterial color={COLORS.codex} />
      </mesh>
      <mesh ref={core} position={[0, 0.03, 0]}>
        <boxGeometry args={[1, 0.05, 1]} />
        <meshBasicMaterial color={COLORS.screen} />
      </mesh>
    </group>
  );
}
