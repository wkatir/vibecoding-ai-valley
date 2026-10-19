// Plays faction 0 with the same AI as the opponents. A human should do better than this.
import { World } from '../src/game/engine.js';
import { AIController } from '../src/game/ai.js';

const runs = Number(process.argv[2] || 20);
for (const difficulty of ['easy', 'normal', 'hard']) {
  let won = 0;
  let lost = 0;
  let timeouts = 0;
  const times = [];
  for (let seed = 1; seed <= runs; seed++) {
    const w = new World({ seed: seed * 31, player: 0, difficulty });
    w.ais.push(new AIController(w, 0));
    while (w.t < 60 * 25 && w.status === 'playing') w.update(0.1);
    if (w.status === 'won') {
      won++;
      times.push(Math.round(w.t));
    } else if (w.status === 'lost') lost++;
    else timeouts++;
  }
  console.log(difficulty.padEnd(7), `won ${won}/${runs}, lost ${lost}, timeouts ${timeouts}, win times(s): ${times.join(',')}`);
}
