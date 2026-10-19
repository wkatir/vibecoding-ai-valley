import { BASE_SPEED, FACTIONS, LEVELS } from './constants.js';

// Each faction plays a little differently.
const PERSONAS = {
  claude: { sendFrac: 0.6, minRatio: 1.25, build: 0.75, sloppy: 0 },
  codex: { sendFrac: 0.75, minRatio: 1.12, build: 0.5, sloppy: 1 },
  grok: { sendFrac: 0.8, minRatio: 1.0, build: 0.6, sloppy: 2 },
  meta: { sendFrac: 0.55, minRatio: 1.3, build: 0.9, sloppy: 1 },
  gemini: { sendFrac: 0.65, minRatio: 1.2, build: 0.65, sloppy: 1 },
};

export class AIController {
  constructor(world, faction) {
    this.w = world;
    this.f = faction;
    this.persona = PERSONAS[FACTIONS[faction].key];
    this.timer = world.rng.range(1.5, 4);
  }

  update(dt) {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = this.w.difficulty.think * this.w.rng.range(0.8, 1.25);
    this.think();
  }

  isFront(v) {
    return this.w.neighbors(v.id).some((n) => this.w.villages[n].owner !== this.f);
  }

  // Expected defenders by the time a squad from `from` arrives.
  defenseOf(t, from) {
    const w = this.w;
    const link = w.edgeOf.get(`${from.id}-${t.id}`);
    const eta = link ? link.edge.len / (BASE_SPEED * FACTIONS[this.f].speed) : 4;
    const regrow = t.owner >= 0 ? w.productionOf(t) * eta : 0;
    return (t.troops + regrow) * w.defenseMult(t);
  }

  think() {
    const w = this.w;
    const f = this.f;
    const P = this.persona;
    const mine = w.villages.filter((v) => v.owner === f);
    if (!mine.length) return;
    const atk = FACTIONS[f].attack;

    for (const v of mine) {
      if (v.level >= 3 || v.building > 0) continue;
      const cost = w.upgradeCost(v, f);
      const reserve = this.isFront(v) ? 12 : 4;
      if (v.troops >= cost + reserve && w.rng.chance(P.build)) w.upgrade(v.id, f);
    }

    const orders = w.difficulty.think < 1.5 ? 2 : 1;
    const used = new Set();
    for (let o = 0; o < orders; o++) {
      const plans = [];
      for (const s of mine) {
        if (used.has(s.id)) continue;
        const keep = this.isFront(s) ? 5 : 2;
        const avail = Math.floor(s.troops) - keep;
        if (avail < 4) continue;
        for (const to of w.neighbors(s.id)) {
          const t = w.villages[to];
          if (t.owner === f) continue;
          const send = Math.floor(avail * P.sendFrac);
          if (send < 4) continue;
          const def = this.defenseOf(t, s);
          const power = (send + w.incoming(t.id, f)) * atk;
          const ratio = power / (def + 1);
          // A full village wastes its production, so it can afford riskier attacks.
          // Without this, two AIs with every village full never attack each other.
          const full = s.troops >= LEVELS[s.level].capacity * 0.9;
          if (ratio < P.minRatio * w.difficulty.ratio * (full ? 0.55 : 1)) continue;
          let value = ratio;
          if (t.owner < 0) value += 0.2 + 0.25 * (t.level - 1);
          else value += 0.25 + (def < 10 ? 0.3 : 0);
          plans.push({ s, t, send, value });
        }
      }
      if (!plans.length) break;
      plans.sort((a, b) => b.value - a.value);
      const pick = plans[Math.min(plans.length - 1, w.rng.int(0, P.sloppy))];
      if (w.sendFrom(pick.s.id, pick.t.id, pick.send / pick.s.troops, f)) used.add(pick.s.id);
    }

    // Villages far from the front feed the ones that touch the enemy.
    const front = mine.filter((v) => this.isFront(v));
    if (front.length) {
      for (const v of mine) {
        if (this.isFront(v) || v.troops < 10 || used.has(v.id)) continue;
        let best = null;
        let bestD = 1e9;
        for (const t of front) {
          const d = Math.hypot(t.x - v.x, t.y - v.y);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
        if (best) w.sendFrom(v.id, best.id, 0.7, f);
      }
    }
  }
}
