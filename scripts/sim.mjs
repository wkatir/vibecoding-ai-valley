// Headless balance check. Usage: node scripts/sim.mjs [runs] [difficulty]
import { World } from '../src/game/engine.js';
import { FACTIONS } from '../src/game/constants.js';
import { AIController } from '../src/game/ai.js';

const runs = Number(process.argv[2] || 6);
const difficulty = process.argv[3] || 'normal';
const wins = FACTIONS.map(() => 0);
const lengths = [];
let overs = 0;
let events = {};

for (let seed = 1; seed <= runs; seed++) {
  // Faction 0 is played by the same AI as everyone else, as a baseline for a human.
  const w = new World({ seed, player: -1, difficulty });
  w.on((type) => (events[type] = (events[type] || 0) + 1));
  const limit = 60 * 25;
  while (w.t < limit && w.status === 'playing') w.update(0.1);
  const stats = w.stats();
  const alive = FACTIONS.filter((f) => w.alive[f.id]).map((f) => f.key);
  const leader = stats.reduce((a, b) => (b.villages > a.villages ? b : a));
  if (w.status === 'over') {
    wins[leader.id]++;
    overs++;
  }
  lengths.push(Math.round(w.t));
  console.log(
    `seed ${seed}: ${w.villages.length} villages, ended=${w.status}, t=${Math.round(w.t)}s, alive=[${alive}], ` +
      stats.map((s) => `${FACTIONS[s.id].key}:${s.villages}v/${s.troops}t`).join(' '),
  );
}
console.log('wins by faction', Object.fromEntries(FACTIONS.map((f, i) => [f.key, wins[i]])), 'finished', overs, '/', runs);
console.log('lengths', lengths.join(','), 'events', JSON.stringify(events));
