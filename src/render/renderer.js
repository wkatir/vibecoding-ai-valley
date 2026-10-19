import { makeCanvas } from './platform.js';
import { renderTerrain, vnoise } from './terrain.js';
import { drawDigits, textWidth } from './glyphs.js';
import { Rng } from '../game/rng.js';
import { FACTIONS, LEVELS } from '../game/constants.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - t) * (1 - t);

// Light multiplier over the day: [hour, rgb]
const LIGHT = [
  [0, [76, 90, 160]],
  [4.5, [76, 90, 160]],
  [6, [255, 188, 148]],
  [8, [255, 255, 255]],
  [17, [255, 255, 255]],
  [18.5, [255, 196, 150]],
  [20, [206, 148, 150]],
  [21.5, [76, 90, 160]],
  [24, [76, 90, 160]],
];

function lightAt(hour) {
  for (let i = 0; i < LIGHT.length - 1; i++) {
    const [h0, c0] = LIGHT[i];
    const [h1, c1] = LIGHT[i + 1];
    if (hour >= h0 && hour <= h1) {
      const t = (hour - h0) / (h1 - h0);
      return c0.map((v, k) => Math.round(lerp(v, c1[k], t)));
    }
  }
  return [255, 255, 255];
}

const OUTLINE = '#33211a';

function shadow(g, x, y, rx, ry, a = 0.2) {
  g.fillStyle = `rgba(24,40,12,${a})`;
  for (let j = -ry; j <= ry; j++) {
    const half = Math.round(rx * Math.sqrt(1 - (j * j) / (ry * ry + 0.4)));
    g.fillRect(Math.round(x - half), Math.round(y + j), half * 2, 1);
  }
}

function disc(g, cx, cy, r, color, alpha = 1) {
  g.globalAlpha = alpha;
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + 0.6 * r));
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
  g.globalAlpha = 1;
}

function plate(g, cx, y, text, bg, fg = '#ffffff') {
  const w = textWidth(String(text)) + 5;
  const x = Math.round(cx - w / 2);
  g.fillStyle = OUTLINE;
  g.fillRect(x - 1, y - 1, w + 2, 11);
  g.fillStyle = bg;
  g.fillRect(x, y, w, 9);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(x, y, w, 1);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(x, y + 8, w, 1);
  drawDigits(g, text, x + 3, y + 3, 'rgba(0,0,0,0.45)');
  drawDigits(g, text, x + 3, y + 2, fg);
}

function arrow(g, x, y, color) {
  g.fillStyle = OUTLINE;
  g.fillRect(x - 3, y - 1, 7, 2);
  g.fillRect(x - 2, y + 1, 5, 1);
  g.fillRect(x - 1, y + 2, 3, 1);
  g.fillRect(x, y + 3, 1, 1);
  g.fillStyle = color;
  g.fillRect(x - 2, y, 5, 1);
  g.fillRect(x - 1, y + 1, 3, 1);
  g.fillRect(x, y + 2, 1, 1);
}

// Picks the logical (pixel art) resolution so one logical pixel is at least ~2 CSS pixels.
export function chooseSize(cssW, cssH) {
  const portrait = cssH > cssW * 1.05;
  const s = portrait ? Math.max(1.3, cssW / 300) : Math.max(2, Math.round(cssH / 360));
  return { w: clamp(Math.floor(cssW / s), 280, 760), h: clamp(Math.floor(cssH / s), 240, 760), portrait };
}

export class Renderer {
  constructor(world, art) {
    this.world = world;
    this.art = art;
    this.w = world.w;
    this.h = world.h;
    this.buf = makeCanvas(this.w, this.h);
    this.g = this.buf.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.time = 0;
    this.rng = new Rng(world.seed + 99);
    this.parts = [];
    this.clouds = [];
    this.vs = world.villages.map((v) => ({ flagT: 1, level: v.level, owner: v.owner, smokeT: this.rng.range(0, 1), shake: 0 }));
    this.target = { w: 0, h: 0, dpr: 1, k: 1, ox: 0, oy: 0 };

    const terrain = renderTerrain(world.map);
    this.waterSpots = terrain.waterSpots;
    this.ground = makeCanvas(this.w, this.h);
    const gg = this.ground.getContext('2d');
    gg.drawImage(terrain.canvas, 0, 0);
    this.buildStatic(gg);

    this.shadowCanvas = makeCanvas(Math.ceil(this.w / 4) + 1, Math.ceil(this.h / 4) + 1);
    this.shadowG = this.shadowCanvas.getContext('2d');
    this.angles = this.computeAngles();
    this.pieceCache = new Map();
    this.initLife();
    this.unsub = world.on((type, data) => this.onEvent(type, data));
  }

  destroy() {
    this.unsub?.();
  }

  // ------------------------------------------------------------ set up

  buildStatic(gg) {
    const map = this.world.map;
    const art = this.art;
    this.objects = [];
    for (const t of map.trees) {
      shadow(gg, t.x + 2, t.y, t.type === 'oak' ? 9 : 6, 3, 0.2);
      this.objects.push({ y: t.y, kind: t.type, x: t.x, v: t.v, phase: (t.x * 13 + t.y * 7) % 100 });
    }
    for (const p of map.props) {
      const rx = p.type === 'bush' ? 6 : 4;
      shadow(gg, p.x + 1, p.y, rx, 2, 0.18);
      this.objects.push({ y: p.y, kind: p.type, x: p.x, v: p.v });
    }
    // lily pads
    for (const pond of map.ponds) {
      const n = 3 + (pond.seed % 3);
      for (let i = 0; i < n; i++) {
        const a = (pond.seed * (i + 3)) % 628 / 100;
        const rr = 0.25 + ((pond.seed * (i + 7)) % 40) / 100;
        const x = Math.round(pond.x + Math.cos(a) * pond.r * pond.sx * rr * 0.8);
        const y = Math.round(pond.y + Math.sin(a) * pond.r * 0.72 * rr * 0.8);
        gg.drawImage(art.fx.lily.canvas, x - 4, y - 2);
      }
    }
    this.objects.sort((a, b) => a.y - b.y);
  }

  computeAngles() {
    const w = this.world;
    return w.villages.map((v) => {
      const out = [];
      for (const { to, edge } of w.adj[v.id]) {
        const e = w.edges[edge];
        const pts = e.a === v.id ? e.pts : [...e.pts].reverse();
        const p = pts[Math.min(4, pts.length - 1)];
        out.push(Math.atan2(p.y - v.y, p.x - v.x));
      }
      return out;
    });
  }

  initLife() {
    const w = this.world;
    this.chickens = [];
    w.villages.forEach((v) => {
      const n = 1 + (v.id % 2);
      for (let i = 0; i < n; i++) {
        const hx = v.x + this.rng.range(-34, 34);
        const hy = v.y + this.rng.range(14, 26);
        this.chickens.push({ vid: v.id, x: hx, y: hy, tx: hx, ty: hy, timer: this.rng.range(0, 3), face: 1, hop: 0 });
      }
    });
    this.butterflies = Array.from({ length: 9 }, (_, i) => ({
      x: this.rng.range(20, this.w - 20),
      y: this.rng.range(30, this.h - 20),
      a: this.rng.range(0, 6.28),
      speed: this.rng.range(7, 13),
      color: i % 4,
      phase: this.rng.range(0, 6),
    }));
    this.fireflies = Array.from({ length: 34 }, () => ({
      x: this.rng.range(10, this.w - 10),
      y: this.rng.range(20, this.h - 10),
      a: this.rng.range(0, 6.28),
      phase: this.rng.range(0, 6),
    }));
    this.rain = Array.from({ length: 140 }, () => ({ x: this.rng.range(0, this.w + 40), y: this.rng.range(0, this.h), s: this.rng.range(150, 230) }));
  }

  // The set of things standing in a village at a given level.
  piecesFor(v, level) {
    const key = `${v.id}:${level}:${v.owner}`;
    if (this.pieceCache.has(key)) return this.pieceCache.get(key);
    const art = this.art;
    const fid = v.owner;
    const list = [];
    const add = (spr, dx, dy, extra = {}) => list.push({ spr, x: v.x + dx, y: v.y + dy, ...extra });
    const roads = this.angles[v.id];
    const free = (dx, dy) => {
      const a = Math.atan2(dy, dx);
      return roads.every((r) => {
        let d = Math.abs(a - r);
        if (d > Math.PI) d = 2 * Math.PI - d;
        return d > 0.55;
      });
    };

    if (level === 1) {
      add(art.building('cottage', fid), 0, -2, { kind: 'house' });
      add(art.well, 24, 3);
      add(art.crates, -22, 5);
      add(art.barrel, -31, 2);
    } else if (level === 2) {
      add(art.building('cottage', fid), -16, -2, { kind: 'house' });
      add(art.building('barn', fid), 17, -4, { kind: 'house' });
      add(art.well, 0, 10);
      add(art.hay, 36, 6);
      add(art.barrel, -33, 6);
    } else {
      add(art.building('hall', fid), 0, -10, { kind: 'house' });
      add(art.building('cottage', fid), -28, 4, { kind: 'house' });
      add(art.building('barn', fid), 28, 2, { kind: 'house' });
      add(art.well, 0, 12);
      add(art.lamp, -13, 10, { lamp: true });
      add(art.lamp, 14, 10, { lamp: true });
      add(art.hay, 44, 8);
    }
    const spots = [[-34, 24], [34, 24], [0, 31], [-46, 12], [46, 14]];
    let plots = 0;
    for (const [dx, dy] of spots) {
      if (plots >= level) break;
      if (!free(dx, dy)) continue;
      add(art.plot[Math.min(2, (v.id + plots) % 3)], dx, dy, { ground: true });
      plots++;
    }
    this.pieceCache.set(key, list);
    return list;
  }

  // ------------------------------------------------------------ events

  burst(x, y, colors, n, speed = 22, up = 18) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, 6.28);
      const s = this.rng.range(0.4, 1) * speed;
      this.parts.push({
        type: 'bit',
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5 - up,
        life: 0,
        max: this.rng.range(0.6, 1.2),
        c: colors[i % colors.length],
      });
    }
  }

  float(x, y, text, color) {
    this.parts.push({ type: 'text', x, y, vy: -14, life: 0, max: 1.3, text: String(text), c: color });
  }

  onEvent(type, d) {
    const w = this.world;
    if (type === 'send') {
      const s = w.villages[d.from];
      for (let i = 0; i < 5; i++) this.parts.push({ type: 'puff', x: s.x + this.rng.range(-5, 5), y: s.y + 6, vx: this.rng.range(-8, 8), vy: -4, life: 0, max: 0.5, r: 2, c: '#e8dcc0' });
    } else if (type === 'fight') {
      const v = w.villages[d.vid];
      this.clouds.push({ x: v.x, y: v.y - 8, t: 0, max: 1.5, seed: this.rng.int(1, 9999) });
      this.float(v.x + 14, v.y - 30, `-${Math.min(d.attackers, d.defenders)}`, '#ff7a6b');
      this.vs[d.vid].shake = 0.7;
    } else if (type === 'capture') {
      const v = w.villages[d.vid];
      const f = FACTIONS[d.faction].art;
      this.burst(v.x, v.y - 18, [f.roof, f.roofL, '#ffffff', '#ffd54f'], 26, 34, 28);
      this.vs[d.vid].flagT = 0;
    } else if (type === 'upgradeStart') {
      this.vs[d.vid].build = 0;
    } else if (type === 'upgraded') {
      const v = w.villages[d.vid];
      for (let i = 0; i < 10; i++) this.parts.push({ type: 'puff', x: v.x + this.rng.range(-18, 18), y: v.y - this.rng.range(0, 22), vx: this.rng.range(-6, 6), vy: -8, life: 0, max: 0.9, r: 3, c: '#ffffff' });
      this.burst(v.x, v.y - 16, ['#ffd54f', '#ffffff'], 14, 30, 24);
    } else if (type === 'reinforce') {
      const v = w.villages[d.vid];
      this.float(v.x, v.y - 34, `+${d.count}`, '#b6f08a');
    }
  }

  // ------------------------------------------------------------ frame

  update(dt) {
    dt = Math.max(0, dt);
    this.time += dt;
    const w = this.world;
    // visual states
    w.villages.forEach((v, i) => {
      const s = this.vs[i];
      if (s.flagT < 1) s.flagT = Math.min(1, s.flagT + dt * 1.2);
      if (s.shake > 0) s.shake = Math.max(0, s.shake - dt);
      if (s.level !== v.level) {
        s.level = v.level;
      }
      s.owner = v.owner;
      // smoke
      s.smokeT -= dt;
      if (s.smokeT <= 0) {
        s.smokeT = this.rng.range(0.5, 0.9);
        const pieces = this.piecesFor(v, v.level);
        for (const p of pieces) {
          if (p.spr.smoke) {
            this.parts.push({ type: 'smoke', x: p.x - p.spr.ax + p.spr.smoke.x + 1, y: p.y - p.spr.ay + p.spr.smoke.y, vx: 2 + this.rng.range(0, 3), vy: -7, life: 0, max: this.rng.range(1.6, 2.4), r: 1 });
          }
        }
        if (v.building > 0) {
          this.parts.push({ type: 'bit', x: v.x + 28 + this.rng.range(-6, 6), y: v.y - 10, vx: this.rng.range(-10, 10), vy: -22, life: 0, max: 0.5, c: '#ffd54f' });
        }
      }
    });
    for (const c of this.clouds) c.t += dt;
    this.clouds = this.clouds.filter((c) => c.t < c.max);
    for (const p of this.parts) {
      p.life += dt;
      p.x += (p.vx || 0) * dt;
      p.y += (p.vy || 0) * dt;
      if (p.type === 'bit') p.vy += 60 * dt;
      if (p.type === 'smoke') p.r = 1 + p.life * 1.8;
      if (p.type === 'puff') p.r += dt * 6;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);

    // life
    for (const c of this.chickens) {
      c.timer -= dt;
      if (c.timer <= 0) {
        const v = w.villages[c.vid];
        c.tx = clamp(c.x + this.rng.range(-12, 12), v.x - 48, v.x + 48);
        c.ty = clamp(c.y + this.rng.range(-5, 5), v.y + 16, v.y + 32);
        c.timer = this.rng.range(1.2, 4);
      }
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      c.moving = d > 0.8;
      if (c.moving) {
        c.x += (dx / d) * 9 * dt;
        c.y += (dy / d) * 9 * dt;
        if (Math.abs(dx) > 0.5) c.face = dx > 0 ? 1 : -1;
      }
    }
    for (const b of this.butterflies) {
      b.a += Math.sin(this.time * 1.5 + b.phase) * dt * 3;
      b.x += Math.cos(b.a) * b.speed * dt;
      b.y += Math.sin(b.a) * b.speed * dt * 0.7;
      if (b.x < 5 || b.x > this.w - 5) b.a = Math.PI - b.a;
      if (b.y < 15 || b.y > this.h - 5) b.a = -b.a;
    }
    for (const f of this.fireflies) {
      f.a += Math.sin(this.time + f.phase) * dt * 2;
      f.x += Math.cos(f.a) * 5 * dt;
      f.y += Math.sin(f.a) * 5 * dt;
      if (f.x < 4 || f.x > this.w - 4) f.a = Math.PI - f.a;
      if (f.y < 10 || f.y > this.h - 4) f.a = -f.a;
    }
  }

  rainAmount() {
    const t = this.world.t;
    if (t < 150) return 0;
    const r = Math.sin(t / 61 + 1.3) + 0.8 * Math.sin(t / 137 + 0.4);
    return clamp((r - 1.0) * 1.6, 0, 1);
  }

  draw(ui = {}) {
    const g = this.g;
    const w = this.world;
    const art = this.art;
    const time = this.time;
    const hour = w.timeOfDay * 24;
    const light = lightAt(hour);
    const night = clamp((255 - light[0]) / (255 - 76), 0, 1);
    const rain = this.rainAmount();

    g.globalCompositeOperation = 'source-over';
    g.drawImage(this.ground, 0, 0);

    // water sparkles
    g.fillStyle = '#e6f6ff';
    for (let i = 0; i < this.waterSpots.length; i++) {
      const [x, y] = this.waterSpots[i];
      if (Math.floor(time * 1.6 + i * 0.7) % 4 === 0) {
        g.fillRect(x, y, 2, 1);
      }
    }

    // collect sorted drawables
    const items = [];
    for (const o of this.objects) items.push(o);
    const selected = ui.selected ?? -1;

    for (const v of w.villages) {
      const s = this.vs[v.id];
      const pieces = this.piecesFor(v, v.level);
      for (const p of pieces) items.push({ y: p.ground ? p.y - 14 : p.y, kind: 'piece', p, v, ground: p.ground });
      if (v.building > 0) items.push({ y: v.y + 3, kind: 'scaffold', v });
    }
    for (const c of this.chickens) items.push({ y: c.y, kind: 'chicken', c });
    for (const sq of w.squads) {
      const n = clamp(Math.ceil(sq.count / 3), 1, 7);
      const len = Math.hypot(sq.dx, sq.dy) || 1;
      const ux = sq.dx / len;
      const uy = sq.dy / len;
      for (let i = 0; i < n; i++) {
        const back = i * 5.5;
        const side = i === 0 ? 0 : (i % 2 ? 2.6 : -2.6);
        const x = sq.x - ux * back - uy * side;
        const y = sq.y - uy * back + ux * side;
        items.push({ y, kind: 'troop', sq, x, y2: y, i, ux, uy });
      }
    }
    items.sort((a, b) => a.y - b.y);

    // shadows first (ground items are drawn in the same pass but need no shadow)
    for (const it of items) {
      if (it.kind === 'piece' && !it.ground) {
        const sp = it.p.spr;
        shadow(g, it.p.x + 2, it.p.y - 1, Math.max(3, (sp.w >> 1) - 2), 3, 0.2);
      } else if (it.kind === 'troop') {
        shadow(g, it.x, it.y2 - 1, 3, 1, 0.25);
      } else if (it.kind === 'chicken') {
        shadow(g, it.c.x, it.c.y - 1, 3, 1, 0.2);
      }
    }

    for (const it of items) {
      switch (it.kind) {
        case 'oak': {
          const sway = Math.round(Math.sin(time * 1.2 + it.phase) * 0.9);
          g.drawImage(art.oakTrunk.canvas, it.x - 13, it.y - 10);
          g.drawImage(art.oakCanopy[it.v].canvas, it.x - 13 + sway, it.y - 28);
          break;
        }
        case 'pine': {
          const sway = Math.round(Math.sin(time * 1.1 + it.phase) * 0.6);
          const cv = art.pine[it.v].canvas;
          g.drawImage(cv, 0, 9, 20, 21, it.x - 10, it.y - 28 + 9, 20, 21);
          g.drawImage(cv, 0, 0, 20, 9, it.x - 10 + sway, it.y - 28, 20, 9);
          break;
        }
        case 'bush':
          g.drawImage(art.bush[it.v].canvas, it.x - 8, it.y - 10);
          break;
        case 'rock':
          g.drawImage(art.rock[it.v].canvas, it.x - 7, it.y - 9);
          break;
        case 'stump':
          g.drawImage(art.stump.canvas, it.x - 6, it.y - 9);
          break;
        case 'mushroom':
          g.drawImage(art.mushroom.canvas, it.x - 5, it.y - 7);
          break;
        case 'piece': {
          const sp = it.p.spr;
          const shake = this.vs[it.v.id].shake > 0 && it.p.kind === 'house' ? Math.round(Math.sin(time * 60) * 1.2 * this.vs[it.v.id].shake) : 0;
          g.drawImage(sp.canvas, Math.round(it.p.x - sp.ax) + shake, Math.round(it.p.y - sp.ay));
          if (it.p.lamp) it.lampDraw = true;
          break;
        }
        case 'scaffold': {
          const sp = art.scaffold;
          const bob = it.v.building > 0 ? Math.round(Math.sin(time * 14) * 0.6) : 0;
          g.drawImage(sp.canvas, it.v.x + 22, it.v.y - 24 + bob);
          break;
        }
        case 'chicken': {
          const c = it.c;
          const spr = art.chicken[c.moving ? Math.floor(time * 6) % 2 : Math.floor(time * 1.2 + c.vid) % 2];
          const bob = c.moving ? 0 : (Math.floor(time * 1.2 + c.vid) % 2 ? 1 : 0);
          if (c.face < 0) {
            g.save();
            g.translate(Math.round(c.x), 0);
            g.scale(-1, 1);
            g.drawImage(spr.canvas, -spr.ax, Math.round(c.y - spr.ay) + bob);
            g.restore();
          } else {
            g.drawImage(spr.canvas, Math.round(c.x - spr.ax), Math.round(c.y - spr.ay) + bob);
          }
          break;
        }
        case 'troop': {
          const sq = it.sq;
          const frame = Math.floor((sq.walked + it.i * 3) / 4.5) % 2;
          let dir = 'down';
          let flip = false;
          if (Math.abs(it.ux) >= Math.abs(it.uy) * 0.9) {
            dir = 'side';
            flip = it.ux < 0;
          } else if (it.uy < 0) dir = 'up';
          const spr = art.trooper(sq.faction, dir, frame);
          const bob = frame === 1 ? -1 : 0;
          const x = Math.round(it.x);
          const y = Math.round(it.y2 + bob);
          if (flip) {
            g.save();
            g.translate(x, 0);
            g.scale(-1, 1);
            g.drawImage(spr.canvas, -spr.ax, y - spr.ay);
            g.restore();
          } else g.drawImage(spr.canvas, x - spr.ax, y - spr.ay);
          if (it.i === 0) {
            const fl = art.flag(sq.faction, Math.floor(time * 3 + sq.id) % 2);
            g.drawImage(fl.canvas, x + (flip ? -9 : 4) - fl.ax + (flip ? 4 : 0), y - fl.ay + 2);
          }
          break;
        }
        default:
          break;
      }
    }

    // village flags and plates
    for (const v of w.villages) {
      const s = this.vs[v.id];
      if (v.owner >= 0 && v.level < 3) {
        const fr = art.flag(v.owner, Math.floor(time * 2.5 + v.id) % 2);
        const raise = (1 - ease(s.flagT)) * 12;
        const fx = v.level === 1 ? v.x + 14 : v.x + 4;
        const fy = v.level === 1 ? v.y + 5 : v.y + 11;
        g.save();
        g.beginPath();
        g.rect(fx - 4, fy - 20, 20, 21);
        g.clip();
        g.drawImage(fr.canvas, Math.round(fx - fr.ax), Math.round(fy - fr.ay + raise));
        g.restore();
      }
    }

    // fight clouds
    for (const c of this.clouds) this.drawFight(g, c);

    // particles
    for (const p of this.parts) if (p.type !== 'text') this.drawPart(g, p);

    // butterflies
    for (const b of this.butterflies) {
      if (night > 0.6) continue;
      const frames = art.butterfly[b.color];
      const spr = frames[Math.floor(time * 7 + b.phase * 3) % 2];
      g.drawImage(spr.canvas, Math.round(b.x - 2), Math.round(b.y - 2 + Math.sin(time * 3 + b.phase) * 1.5));
    }

    // cloud shadows
    this.drawCloudShadows(g, night);

    // light
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgb(${light[0]},${light[1]},${light[2]})`;
    g.fillRect(0, 0, this.w, this.h);
    if (rain > 0) {
      g.globalAlpha = rain * 0.55;
      g.fillStyle = '#9aa7bd';
      g.fillRect(0, 0, this.w, this.h);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';

    // lit windows and lamps
    if (night > 0.12) {
      for (const it of items) {
        if (it.kind !== 'piece') continue;
        const sp = it.p.spr;
        if (sp.windows) {
          g.fillStyle = '#ffd36b';
          g.globalAlpha = clamp(night * 1.2, 0, 1);
          for (const win of sp.windows) g.fillRect(Math.round(it.p.x - sp.ax + win.x), Math.round(it.p.y - sp.ay + win.y), win.w, win.h);
          g.globalAlpha = 1;
        }
        if (it.p.lamp) {
          const lx = Math.round(it.p.x);
          const ly = Math.round(it.p.y - 15);
          g.fillStyle = `rgba(255,214,120,${0.1 * night})`;
          for (let r = 18; r >= 6; r -= 6) {
            for (let j = -r / 2; j <= r / 2; j++) {
              const half = Math.round(r * Math.sqrt(1 - (j * j) / ((r / 2) * (r / 2) + 0.4)));
              g.fillRect(lx - half, ly + j, half * 2, 1);
            }
          }
        }
      }
    }
    if (night > 0.35) {
      for (const f of this.fireflies) {
        const a = clamp(Math.sin(time * 2 + f.phase * 4) * 0.5 + 0.5, 0, 1) * night;
        g.fillStyle = `rgba(255,240,140,${a})`;
        g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
        g.fillStyle = `rgba(255,240,140,${a * 0.25})`;
        g.fillRect(Math.round(f.x) - 1, Math.round(f.y), 3, 1);
        g.fillRect(Math.round(f.x), Math.round(f.y) - 1, 1, 3);
      }
    }

    // interface layer: stays bright at night
    this.drawSelection(g, ui);
    for (const v of w.villages) {
      const bg = v.owner >= 0 ? FACTIONS[v.owner].art.roofD : '#6b5a3a';
      const y = v.y + 10;
      plate(g, v.x, y, Math.floor(v.troops), bg);
      if (w.player >= 0 && v.owner === w.player && w.canUpgrade(v, w.player)) {
        const bob = Math.round(Math.sin(time * 5 + v.id) * 1);
        arrow(g, v.x + textWidth(String(Math.floor(v.troops))) / 2 + 9, y - 2 + bob, '#9be564');
      }
    }
    for (const p of this.parts) if (p.type === 'text') this.drawPart(g, p);

    // rain
    if (rain > 0.02) {
      g.fillStyle = `rgba(200,220,255,${0.45 * rain})`;
      const count = Math.floor(this.rain.length * rain);
      for (let i = 0; i < count; i++) {
        const d = this.rain[i];
        const x = (d.x - time * d.s * 0.18) % (this.w + 40);
        const y = (d.y + time * d.s) % this.h;
        g.fillRect(Math.round((x + this.w + 40) % (this.w + 40)), Math.round(y), 1, 3);
      }
    }
  }

  drawCloudShadows(g, night) {
    if (night > 0.7) return;
    const sg = this.shadowG;
    const sw = this.shadowCanvas.width;
    const sh = this.shadowCanvas.height;
    // Clouds drift slowly, so the noise only needs recomputing a few times per second.
    if (this.time - (this.shadowStamp ?? -1) > 0.12) {
      this.shadowStamp = this.time;
      sg.clearRect(0, 0, sw, sh);
      sg.fillStyle = 'rgba(20,40,70,0.11)';
      const t = this.time * 0.35;
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const n = vnoise((x + t * 3.2) / 14, (y + t * 1.2) / 10, 77);
          if (n > 0.64) sg.fillRect(x, y, 1, 1);
        }
      }
    }
    g.drawImage(this.shadowCanvas, 0, 0, sw, sh, 0, 0, sw * 4, sh * 4);
  }

  drawFight(g, c) {
    const k = c.t / c.max;
    const grow = Math.min(1, c.t / 0.2);
    const fade = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    const step = Math.floor(c.t * 10);
    const rng = new Rng(c.seed + step);
    g.globalAlpha = fade;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * 6.28 + step * 0.4;
      const rr = (6 + (i % 3) * 3) * grow;
      const x = c.x + Math.cos(a) * rr * 1.4;
      const y = c.y + Math.sin(a) * rr * 0.9;
      disc(g, x, y, 4 + (i % 2), i % 2 ? '#fdfaf0' : '#d9d3c0');
    }
    disc(g, c.x, c.y, 6, '#fdfaf0');
    g.globalAlpha = fade;
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, 6.28);
      const rr = rng.range(5, 14) * grow;
      const x = Math.round(c.x + Math.cos(a) * rr * 1.3);
      const y = Math.round(c.y + Math.sin(a) * rr);
      g.fillStyle = i % 2 ? '#ffd54f' : '#ff9a4d';
      g.fillRect(x, y - 1, 1, 3);
      g.fillRect(x - 1, y, 3, 1);
    }
    g.globalAlpha = 1;
  }

  drawPart(g, p) {
    const k = p.life / p.max;
    switch (p.type) {
      case 'smoke':
        disc(g, p.x, p.y, Math.round(p.r), '#e9e6e0', 0.55 * (1 - k));
        break;
      case 'puff':
        disc(g, p.x, p.y, Math.round(p.r), p.c, 0.7 * (1 - k));
        break;
      case 'bit':
        g.fillStyle = p.c;
        g.globalAlpha = 1 - k * 0.6;
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        g.globalAlpha = 1;
        break;
      case 'text': {
        const x = Math.round(p.x - textWidth(p.text) / 2);
        const y = Math.round(p.y);
        g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        drawDigits(g, p.text, x + 1, y + 1, '#33211a');
        drawDigits(g, p.text, x, y, p.c);
        g.globalAlpha = 1;
        break;
      }
      default:
        break;
    }
  }

  drawSelection(g, ui) {
    const w = this.world;
    const time = this.time;
    const sel = ui.selected ?? -1;
    const hov = ui.hover ?? -1;
    const ring = (v, color, rx = 46, ry = 24) => {
      const n = 48;
      const shift = Math.floor(time * 8);
      for (let pass = 0; pass < 2; pass++) {
        g.fillStyle = pass === 0 ? 'rgba(40,24,10,0.65)' : color;
        for (let i = 0; i < n; i++) {
          if ((i + shift) % 3 === 2) continue;
          const a = (i / n) * Math.PI * 2;
          const x = Math.round(v.x + Math.cos(a) * rx);
          const y = Math.round(v.y - 4 + Math.sin(a) * ry);
          if (pass === 0) g.fillRect(x - 1, y, 4, 3);
          else g.fillRect(x, y, 3, 2);
        }
      }
    };
    if (hov >= 0 && hov !== sel) ring(w.villages[hov], '#ffffff');
    if (sel < 0) return;
    const s = w.villages[sel];
    ring(s, '#ffe27a');
    for (const to of w.neighbors(sel)) {
      const t = w.villages[to];
      const rel = t.owner === s.owner ? '#9be564' : t.owner < 0 ? '#ffd54f' : '#ff6b5e';
      const bob = Math.round(Math.sin(time * 6 + to) * 1.5);
      arrow(g, t.x, t.y - 44 + bob, rel);
    }
    // route preview
    if (ui.target != null && ui.target >= 0 && ui.target !== sel) {
      const path = w.findPath(sel, ui.target, s.owner);
      if (path) {
        const pts = w.pathPoints(path);
        let acc = 0;
        const off = (time * 14) % 6;
        g.fillStyle = '#fff8d0';
        for (let i = 1; i < pts.length; i++) {
          const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
          let d = (6 - ((acc + off) % 6)) % 6;
          while (d < seg) {
            const u = d / seg;
            g.fillRect(Math.round(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u), Math.round(pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u) - 1, 2, 2);
            d += 6;
          }
          acc += seg;
        }
      }
    }
  }

  // ------------------------------------------------------------ display

  resize(cssW, cssH, dpr = 1) {
    const devW = Math.max(1, Math.floor(cssW * dpr));
    const devH = Math.max(1, Math.floor(cssH * dpr));
    let k = Math.min(devW / this.w, devH / this.h);
    // Prefer whole-number scaling, unless it would leave a big empty margin.
    if (k >= 1 && Math.floor(k) / k >= 0.88) k = Math.floor(k);
    const drawW = Math.floor(this.w * k);
    const drawH = Math.floor(this.h * k);
    this.target = { w: devW, h: devH, dpr, k, ox: Math.floor((devW - drawW) / 2), oy: Math.floor((devH - drawH) / 2), drawW, drawH };
  }

  present(ctx) {
    const t = this.target;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#3f6f2c';
    ctx.fillRect(0, 0, t.w, t.h);
    ctx.drawImage(this.buf, 0, 0, this.w, this.h, t.ox, t.oy, t.drawW, t.drawH);
  }

  // CSS pixel position (relative to the canvas) to logical world pixels
  toLogical(cx, cy) {
    const t = this.target;
    return { x: (cx * t.dpr - t.ox) / t.k, y: (cy * t.dpr - t.oy) / t.k };
  }

  pick(lx, ly) {
    let best = -1;
    let bestD = 1e9;
    for (const v of this.world.villages) {
      const dx = Math.abs(lx - v.x);
      const dy = ly - (v.y - 12);
      if (dx > 42 || dy < -32 || dy > 30) continue;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = v.id;
      }
    }
    return best;
  }
}
