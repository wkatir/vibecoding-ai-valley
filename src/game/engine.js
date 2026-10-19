import { BASE_SPEED, BUILD_TIME, DAY_LENGTH, DIFFICULTY, FACTIONS, LEVELS, VILLAGE_NAMES } from './constants.js';
import { generateMap } from './map.js';
import { Rng } from './rng.js';
import { AIController } from './ai.js';

export class World {
  constructor({ w = 640, h = 360, seed = 1, player = 0, difficulty = 'normal', portrait = false } = {}) {
    this.w = w;
    this.h = h;
    this.seed = seed;
    this.player = player; // faction id, or -1 when only AIs play
    this.difficulty = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.rng = new Rng(seed * 7919 + 13);
    this.map = generateMap(w, h, seed, { portrait });
    this.edges = this.map.edges;
    this.villages = this.map.points.map((p, id) => ({
      id,
      x: p.x,
      y: p.y,
      name: '',
      owner: -1,
      troops: 0,
      level: 1,
      building: 0,
      flash: 0,
    }));
    this.adj = this.villages.map(() => []);
    this.edgeOf = new Map();
    this.edges.forEach((e, i) => {
      this.adj[e.a].push({ to: e.b, edge: i });
      this.adj[e.b].push({ to: e.a, edge: i });
      this.edgeOf.set(`${e.a}-${e.b}`, { edge: e, fwd: true });
      this.edgeOf.set(`${e.b}-${e.a}`, { edge: e, fwd: false });
    });
    this.squads = [];
    this.nextSquad = 1;
    this.t = 0;
    this.speed = 1;
    this.paused = false;
    this.status = 'playing';
    this.alive = FACTIONS.map(() => true);
    this.listeners = new Set();
    this.setup();
    this.ais = FACTIONS.filter((f) => f.id !== player).map((f) => new AIController(this, f.id));
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, data = {}) {
    this.listeners.forEach((fn) => fn(type, data));
  }

  setup() {
    const vs = this.villages;
    // Spread the factions apart. The player gets the leftmost village.
    const first = vs.reduce((best, v) => {
      const score = v.x + 0.35 * Math.abs(v.y - this.h / 2);
      return score < best.score ? { v, score } : best;
    }, { v: vs[0], score: 1e9 }).v;
    const chosen = [first];
    while (chosen.length < Math.min(FACTIONS.length, vs.length)) {
      let best = null;
      let bestD = -1;
      for (const v of vs) {
        if (chosen.includes(v)) continue;
        const d = Math.min(...chosen.map((c) => Math.hypot(c.x - v.x, c.y - v.y)));
        if (d > bestD) {
          bestD = d;
          best = v;
        }
      }
      chosen.push(best);
    }
    // The human keeps the first village. Everyone else gets a random start,
    // so no AI is always stuck in the same spot.
    const shuffle = (list) => {
      const a = [...list];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.float() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    const ids = FACTIONS.map((f) => f.id);
    const order = this.player >= 0 ? [this.player, ...shuffle(ids.filter((id) => id !== this.player))] : shuffle(ids);
    chosen.forEach((v, i) => {
      const f = FACTIONS[order[i]];
      v.owner = f.id;
      v.name = f.home;
      v.level = 1;
      v.troops = 18;
    });

    const names = [...VILLAGE_NAMES];
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.float() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    let n = 0;
    for (const v of vs) {
      if (v.owner >= 0) continue;
      v.name = names[n++ % names.length];
      v.level = this.rng.chance(0.28) ? 2 : 1;
      v.troops = v.level === 1 ? this.rng.int(6, 13) : this.rng.int(16, 24);
    }
  }

  // ------------------------------------------------------------- queries

  get timeOfDay() {
    return (this.t / DAY_LENGTH + 0.3) % 1;
  }

  get day() {
    return Math.floor(this.t / DAY_LENGTH + 0.3) + 1;
  }

  neighbors(id) {
    return this.adj[id].map((a) => a.to);
  }

  defenseMult(v) {
    return LEVELS[v.level].defense * (v.owner >= 0 ? FACTIONS[v.owner].defense : 1);
  }

  upgradeCost(v, faction) {
    const base = LEVELS[v.level].cost;
    return base == null ? null : Math.ceil(base * FACTIONS[faction].upgrade);
  }

  canUpgrade(v, faction) {
    if (faction < 0) return false;
    const cost = this.upgradeCost(v, faction);
    return this.status === 'playing' && v.owner === faction && cost != null && v.building === 0 && v.troops >= cost + 1;
  }

  productionOf(v) {
    if (v.owner < 0) return 0;
    const mult = FACTIONS[v.owner].prod * (v.owner === this.player ? 1 : this.difficulty.prod);
    return LEVELS[v.level].prod * mult;
  }

  incoming(vid, faction) {
    let n = 0;
    for (const s of this.squads) if (s.faction === faction && s.path[s.path.length - 1] === vid) n += s.count;
    return n;
  }

  stats() {
    const out = FACTIONS.map((f) => ({ id: f.id, villages: 0, troops: 0 }));
    for (const v of this.villages) {
      if (v.owner >= 0) {
        out[v.owner].villages++;
        out[v.owner].troops += Math.floor(v.troops);
      }
    }
    for (const s of this.squads) out[s.faction].troops += s.count;
    return out;
  }

  // Cheapest route, avoiding villages the faction does not own unless it is the target.
  findPath(src, dst, faction) {
    const n = this.villages.length;
    const dist = new Array(n).fill(Infinity);
    const prev = new Array(n).fill(-1);
    const done = new Array(n).fill(false);
    dist[src] = 0;
    for (let k = 0; k < n; k++) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
      if (u === -1 || dist[u] === Infinity) break;
      done[u] = true;
      if (u === dst) break;
      for (const { to, edge } of this.adj[u]) {
        const pen = to !== dst && this.villages[to].owner !== faction ? 500 : 0;
        const nd = dist[u] + this.edges[edge].len + pen;
        if (nd < dist[to]) {
          dist[to] = nd;
          prev[to] = u;
        }
      }
    }
    if (dist[dst] === Infinity) return null;
    const path = [];
    for (let c = dst; c !== -1; c = prev[c]) path.unshift(c);
    return path;
  }

  pathPoints(path) {
    const pts = [];
    for (let i = 0; i + 1 < path.length; i++) {
      const { edge, fwd } = this.edgeOf.get(`${path[i]}-${path[i + 1]}`);
      const seg = fwd ? edge.pts : [...edge.pts].reverse();
      pts.push(...(i === 0 ? seg : seg.slice(1)));
    }
    return pts;
  }

  // ------------------------------------------------------------- orders

  sendFrom(srcId, dstId, pct, faction) {
    if (this.status !== 'playing' || srcId === dstId) return false;
    const s = this.villages[srcId];
    if (!s || s.owner !== faction) return false;
    const count = Math.min(Math.floor(s.troops * pct), Math.floor(s.troops) - 1);
    if (count < 1) return false;
    const path = this.findPath(srcId, dstId, faction);
    if (!path || path.length < 2) return false;
    s.troops -= count;
    const leg = this.edgeOf.get(`${path[0]}-${path[1]}`);
    const squad = {
      id: this.nextSquad++,
      faction,
      count,
      path,
      i: 0,
      d: 0,
      edge: leg.edge,
      fwd: leg.fwd,
      speed: BASE_SPEED * FACTIONS[faction].speed,
      x: s.x,
      y: s.y,
      dx: 1,
      dy: 0,
      walked: 0,
    };
    this.squads.push(squad);
    this.placeSquad(squad);
    this.emit('send', { squad, from: srcId, to: dstId, faction, count });
    return true;
  }

  upgrade(vid, faction) {
    const v = this.villages[vid];
    if (!this.canUpgrade(v, faction)) return false;
    v.troops -= this.upgradeCost(v, faction);
    v.building = BUILD_TIME;
    this.emit('upgradeStart', { vid, faction });
    return true;
  }

  // ------------------------------------------------------------ simulation

  update(rawDt) {
    if (this.paused) return;
    const dt = Math.min(rawDt, 0.1) * this.speed;
    const steps = Math.max(1, Math.ceil(dt / 0.05));
    for (let i = 0; i < steps; i++) this.step(dt / steps);
  }

  step(dt) {
    this.t += dt;
    for (const v of this.villages) {
      if (v.flash > 0) v.flash = Math.max(0, v.flash - dt);
      if (v.owner < 0) continue;
      const lv = LEVELS[v.level];
      if (v.troops < lv.capacity) v.troops = Math.min(lv.capacity, v.troops + this.productionOf(v) * dt);
      else if (v.troops > lv.capacity + 0.5) v.troops -= 0.35 * dt;
      if (v.building > 0) {
        v.building -= dt;
        if (v.building <= 0) {
          v.building = 0;
          v.level += 1;
          this.emit('upgraded', { vid: v.id, faction: v.owner, level: v.level });
        }
      }
    }

    for (let i = this.squads.length - 1; i >= 0; i--) {
      const s = this.squads[i];
      s.d += s.speed * dt;
      s.walked += s.speed * dt;
      let removed = false;
      while (s.d >= s.edge.len) {
        const nodeId = s.path[s.i + 1];
        const node = this.villages[nodeId];
        s.d -= s.edge.len;
        const last = s.i + 2 >= s.path.length;
        if (last || node.owner !== s.faction) {
          this.arrive(s, node);
          this.squads.splice(i, 1);
          removed = true;
          break;
        }
        s.i += 1;
        const leg = this.edgeOf.get(`${s.path[s.i]}-${s.path[s.i + 1]}`);
        s.edge = leg.edge;
        s.fwd = leg.fwd;
      }
      if (!removed) this.placeSquad(s);
    }

    for (const ai of this.ais) ai.update(dt);
    this.checkEnd();
  }

  placeSquad(s) {
    const e = s.edge;
    const along = s.fwd ? s.d : e.len - s.d;
    let k = 1;
    while (k < e.cum.length - 1 && e.cum[k] < along) k++;
    const a = e.pts[k - 1];
    const b = e.pts[k];
    const seg = e.cum[k] - e.cum[k - 1] || 1;
    const u = Math.min(1, Math.max(0, (along - e.cum[k - 1]) / seg));
    s.x = a.x + (b.x - a.x) * u;
    s.y = a.y + (b.y - a.y) * u;
    const sign = s.fwd ? 1 : -1;
    s.dx = (b.x - a.x) * sign;
    s.dy = (b.y - a.y) * sign;
  }

  arrive(s, node) {
    if (node.owner === s.faction) {
      node.troops += s.count;
      this.emit('reinforce', { vid: node.id, faction: s.faction, count: s.count });
      return;
    }
    const atk = FACTIONS[s.faction].attack;
    const defMult = this.defenseMult(node);
    const A = s.count * atk;
    const D = node.troops * defMult;
    const defender = node.owner;
    node.flash = 0.9;
    this.emit('fight', { vid: node.id, attacker: s.faction, defender, attackers: s.count, defenders: Math.round(node.troops) });
    if (A > D) {
      const left = Math.max(1, Math.round((A - D) / atk));
      node.owner = s.faction;
      node.troops = left;
      node.building = 0;
      this.emit('capture', { vid: node.id, faction: s.faction, from: defender, left });
    } else {
      node.troops = Math.max(0, (D - A) / defMult);
      this.emit('repel', { vid: node.id, attacker: s.faction, defender });
    }
  }

  isAlive(f) {
    return this.villages.some((v) => v.owner === f) || this.squads.some((s) => s.faction === f);
  }

  checkEnd() {
    FACTIONS.forEach((f) => {
      if (this.alive[f.id] && !this.isAlive(f.id)) {
        this.alive[f.id] = false;
        this.emit('eliminated', { faction: f.id });
      }
    });
    if (this.status !== 'playing') return;
    if (this.player >= 0) {
      if (!this.alive[this.player]) {
        this.status = 'lost';
        this.emit('lost');
      } else if (FACTIONS.every((f) => f.id === this.player || !this.alive[f.id])) {
        this.status = 'won';
        this.emit('won');
      }
    } else if (this.alive.filter(Boolean).length <= 1) {
      this.status = 'over';
      this.emit('over');
    }
  }
}
