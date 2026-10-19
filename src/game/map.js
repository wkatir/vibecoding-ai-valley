import { Rng } from './rng.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Distance from a point to the closest sampled road point.
function makeRoadDist(roadPts) {
  return (x, y) => {
    let best = 1e9;
    for (const p of roadPts) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < best) best = d;
    }
    return best;
  };
}

function bezierRoad(a, b, rng) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const o1 = rng.range(-0.13, 0.13) * len;
  const o2 = rng.range(-0.13, 0.13) * len;
  const c1 = { x: a.x + dx * 0.33 + nx * o1, y: a.y + dy * 0.33 + ny * o1 };
  const c2 = { x: a.x + dx * 0.66 + nx * o2, y: a.y + dy * 0.66 + ny * o2 };
  const steps = Math.max(8, Math.round(len / 5));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    });
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return { pts, cum, len: cum[cum.length - 1] };
}

export function generateMap(w, h, seed, { portrait = false } = {}) {
  const rng = new Rng(seed);

  // Villages stay inside a safe area so HUD panels (top and bottom bands) never cover them.
  const safe = portrait
    ? { x0: 50, x1: w - 50, y0: 122, y1: h - 150 }
    : { x0: 62, x1: w - 62, y0: 80, y1: h - 80 };
  const blocked = () => false;
  const area = (safe.x1 - safe.x0) * (safe.y1 - safe.y0);
  const target = clamp(Math.round(area / 10500), 5, 12);

  // Dart throwing with a minimum spacing between village centers.
  let dmin = 94;
  let pts = [];
  for (let attempt = 0; attempt < 8 && pts.length < target; attempt++) {
    pts = [];
    for (let tries = 0; tries < 6000 && pts.length < target; tries++) {
      const p = { x: rng.range(safe.x0, safe.x1), y: rng.range(safe.y0, safe.y1) };
      if (blocked(p.x, p.y)) continue;
      if (pts.every((q) => dist(p, q) >= dmin)) pts.push(p);
    }
    dmin -= 5;
  }
  pts = pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));

  // Gabriel graph: planar and connected for most point sets.
  const maxLen = dmin * 2.6;
  const links = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = dist(pts[i], pts[j]);
      if (d > maxLen) continue;
      const mid = { x: (pts[i].x + pts[j].x) / 2, y: (pts[i].y + pts[j].y) / 2 };
      const empty = pts.every((k, idx) => idx === i || idx === j || dist(k, mid) >= d / 2);
      if (empty) links.push([i, j, d]);
    }
  }

  // Make sure everything is connected.
  const parent = pts.map((_, i) => i);
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  links.forEach(([a, b]) => {
    parent[find(a)] = find(b);
  });
  const extra = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) extra.push([i, j, dist(pts[i], pts[j])]);
  }
  extra.sort((a, b) => a[2] - b[2]);
  for (const [a, b, d] of extra) {
    if (find(a) !== find(b)) {
      parent[find(a)] = find(b);
      links.push([a, b, d]);
    }
  }

  const edges = links.map(([a, b]) => ({ a, b, ...bezierRoad(pts[a], pts[b], rng) }));
  const roadPts = edges.flatMap((e) => e.pts);
  const roadDist = makeRoadDist(roadPts);

  // Ponds go where no road or village needs the space.
  const ponds = [];
  for (let tries = 0; tries < 400 && ponds.length < 3; tries++) {
    const r = rng.range(15, 26);
    const x = rng.range(r + 16, w - r - 16);
    const y = rng.range(r + 16, h - r - 16);
    if (roadDist(x, y) < r + 14) continue;
    if (pts.some((p) => Math.hypot(p.x - x, (p.y - 10 - y) * 1.2) < r + 52)) continue;
    if (ponds.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 30)) continue;
    ponds.push({ x: Math.round(x), y: Math.round(y), r, sx: rng.range(1.2, 1.6), seed: rng.int(1, 99999) });
  }
  const inPond = (x, y, pad = 0) =>
    ponds.some((p) => {
      const dx = (x - p.x) / (p.r * p.sx + pad);
      const dy = (y - p.y) / (p.r * 0.72 + pad);
      return dx * dx + dy * dy < 1;
    });
  const nearVillage = (x, y, padX = 54, up = 34, down = 48) =>
    pts.some((p) => Math.abs(x - p.x) < padX && y > p.y - up && y < p.y + down);

  // A tree canopy reaches about 28px above its base, so keep that area clear of roads and villages.
  const canopyBlocked = (x, y) =>
    roadPts.some((p) => Math.abs(p.x - x) < 15 && p.y > y - 31 && p.y < y + 5) ||
    pts.some((v) => Math.abs(x - v.x) < 62 && y > v.y - 50 && y < v.y + 68);

  // Scenery.
  const trees = [];
  for (let tries = 0; tries < 2600 && trees.length < 260; tries++) {
    const x = rng.range(4, w - 4);
    const y = rng.range(12, h - 2);
    const edge = Math.min(x, w - x, y, h - y);
    const density = edge < 34 ? 0.92 : edge < 60 ? 0.5 : 0.17;
    if (!rng.chance(density)) continue;
    if (roadDist(x, y) < 11 || canopyBlocked(x, y) || inPond(x, y, 8)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, (t.y - y) * 1.3) < 11)) continue;
    trees.push({ x: Math.round(x), y: Math.round(y), type: rng.chance(0.62) ? 'oak' : 'pine', v: rng.int(0, 2) });
  }

  const props = [];
  const place = (count, type, pad, roadPad) => {
    for (let tries = 0; tries < count * 30 && props.filter((p) => p.type === type).length < count; tries++) {
      const x = rng.range(8, w - 8);
      const y = rng.range(16, h - 6);
      if (roadDist(x, y) < roadPad || nearVillage(x, y, pad) || inPond(x, y, 3)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < 8)) continue;
      props.push({ x: Math.round(x), y: Math.round(y), type, v: rng.int(0, 2) });
    }
  };
  place(34, 'bush', 40, 9);
  place(16, 'rock', 40, 8);
  place(7, 'stump', 44, 10);
  place(10, 'mushroom', 44, 9);

  const flowers = [];
  for (let i = 0; i < 90; i++) {
    const x = rng.range(6, w - 6);
    const y = rng.range(8, h - 6);
    if (roadDist(x, y) < 7 || inPond(x, y, 6)) continue;
    flowers.push({ x: Math.round(x), y: Math.round(y), c: rng.int(0, 3) });
  }

  return { w, h, points: pts, edges, ponds, trees, props, flowers, dmin };
}
