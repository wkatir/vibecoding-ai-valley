// Headless balance check: plays the game with simple bots and prints the outcome.
// Usage: node scripts/sim.mjs [runs]
import { game, input } from '../src/game/engine.js';
import { FIELD, PLAYER } from '../src/game/constants.js';

const DT = 1 / 60;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function danger(x, z) {
  let d = 0;
  for (const e of game.eBullets) {
    for (const t of [0.1, 0.2, 0.3, 0.45, 0.6]) {
      const dist = Math.hypot(e.x + e.vx * t - x, e.z + e.vz * t - z);
      if (dist < 1.4) d += 1.4 - dist;
    }
  }
  for (const m of game.minions) if (m.hp > 0 && Math.hypot(m.x - x, m.z - z) < 1.6) d += 2;
  const bm = game.boss.beam;
  if (bm.state !== 'idle' && Math.abs(x - bm.x) < 2.2 && z > game.boss.z) d += 6;
  return d;
}

function skilled() {
  const p = game.player;
  let best = null;
  let bestScore = -Infinity;
  let bestDanger = 0;
  for (let dx = -8; dx <= 8; dx += 0.5) {
    for (const dz of [-2, 0, 2]) {
      const x = clamp(p.x + dx, -FIELD.halfW + 1, FIELD.halfW - 1);
      const z = clamp(p.z + dz, PLAYER.minZ, PLAYER.maxZ);
      const score = -danger(x, z) * 10 - Math.abs(x - game.boss.x) * 0.4 - Math.abs(dx) * 0.05 - Math.abs(z - 4.5) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestDanger = danger(x, z);
        best = { x, z };
      }
    }
  }
  input.targetX = best.x;
  input.targetZ = best.z;
  if (bestDanger > 1.2 || danger(p.x, p.z) > 2) game.useClear();
}

const bots = {
  skilled,
  idle: () => {
    input.targetX = null;
  },
  wander: (frame) => {
    if (frame % 40 === 0) {
      input.targetX = (Math.random() * 2 - 1) * (FIELD.halfW - 1);
      input.targetZ = 2 + Math.random() * 4;
    }
  },
};

function run(name) {
  game.start();
  const phases = {};
  let frame = 0;
  let peak = 0;
  const limit = 60 * 300;
  while (frame < limit && game.status === 'playing') {
    if (name !== 'skilled' || frame % 3 === 0) bots[name](frame);
    game.update(DT);
    peak = Math.max(peak, game.eBullets.length);
    if (!(game.boss.phase in phases)) phases[game.boss.phase] = +game.time.toFixed(1);
    frame++;
  }
  return {
    bot: name,
    status: game.status,
    time: +game.time.toFixed(1),
    hpLeft: game.player.hp,
    bossLeft: Math.round((game.boss.hp / 600) * 100) + '%',
    clearsLeft: game.player.clears,
    hurt: game.hurtLog,
    peakBullets: peak,
    phases,
  };
}

const runs = Number(process.argv[2] || 3);
for (const name of Object.keys(bots)) {
  for (let i = 0; i < runs; i++) console.log(JSON.stringify(run(name)));
}
