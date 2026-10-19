import { makeCanvas } from './platform.js';
import { Rng } from '../game/rng.js';
import { hexToRgb } from './pen.js';

const hash = (ix, iy, seed) => {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

export function vnoise(x, y, seed = 1) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const C = {
  grass: ['#68a238', '#78b546', '#89c653'].map(hexToRgb),
  forest: ['#5a9333', '#67a13b', '#74b042'].map(hexToRgb),
  dirt: ['#b98649', '#c8975b', '#d6a96d'].map(hexToRgb),
  dirtEdge: hexToRgb('#a87843'),
  dirtLip: hexToRgb('#d9b27a'),
  cobble: ['#c2a672', '#d4bb88', '#e0c99b'].map(hexToRgb),
  mortar: hexToRgb('#a88c5c'),
  plazaEdge: hexToRgb('#8d7647'),
  sand: ['#d9c58c', '#e8d79f'].map(hexToRgb),
  rim: hexToRgb('#5a9333'),
  water: ['#3b8bc7', '#4aa5da', '#6bbbe8'].map(hexToRgb),
  waterEdge: hexToRgb('#2d6f9f'),
  pebble: hexToRgb('#8d939b'),
};

export function renderTerrain(map) {
  const { w, h } = map;
  const rng = new Rng(map.seed || 4242);
  const canvas = makeCanvas(w, h);
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const d = img.data;

  // Masks: pond 1 water, 2 shore, 3 rim. path 1 dirt, 2 plaza.
  const pond = new Uint8Array(w * h);
  const path = new Uint8Array(w * h);
  const at = (x, y) => y * w + x;

  const waterSpots = [];
  for (const p of map.ponds) {
    const rx = p.r * p.sx;
    const ry = p.r * 0.72;
    for (let y = Math.floor(p.y - ry * 1.5); y <= Math.ceil(p.y + ry * 1.5); y++) {
      for (let x = Math.floor(p.x - rx * 1.5); x <= Math.ceil(p.x + rx * 1.5); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const dx = (x - p.x) / rx;
        const dy = (y - p.y) / ry;
        const wob = 1 + (vnoise(x / 5, y / 5, p.seed) - 0.5) * 0.4;
        const dist = Math.sqrt(dx * dx + dy * dy) * wob;
        if (dist < 0.76) {
          pond[at(x, y)] = 1;
          if (rng.chance(0.03)) waterSpots.push([x, y]);
        } else if (dist < 0.94) pond[at(x, y)] = 2;
        else if (dist < 1.0) pond[at(x, y)] = 3;
      }
    }
  }

  for (const e of map.edges) {
    for (const p of e.pts) {
      const r = 3.5 + (vnoise(p.x / 6, p.y / 6, 7) - 0.5) * 1.2;
      for (let dy = -5; dy <= 5; dy++) {
        for (let dx = -5; dx <= 5; dx++) {
          if (dx * dx + dy * dy > r * r) continue;
          const x = Math.round(p.x) + dx;
          const y = Math.round(p.y) + dy;
          if (x >= 0 && y >= 0 && x < w && y < h && !pond[at(x, y)]) path[at(x, y)] = 1;
        }
      }
    }
  }
  for (const v of map.points) {
    for (let dy = -9; dy <= 9; dy++) {
      for (let dx = -15; dx <= 15; dx++) {
        if ((dx * dx) / 225 + (dy * dy) / 81 > 1) continue;
        const x = v.x + dx;
        const y = v.y + dy;
        if (x >= 0 && y >= 0 && x < w && y < h) path[at(x, y)] = 2;
      }
    }
  }

  const isPath = (x, y) => x >= 0 && y >= 0 && x < w && y < h && path[at(x, y)] > 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = at(x, y);
      let col;
      const edge = Math.min(x, w - 1 - x, y, h - 1 - y);
      const n = 0.62 * vnoise(x / 24, y / 24, 3) + 0.38 * vnoise(x / 9, y / 9, 5) - (edge < 46 ? (1 - edge / 46) * 0.3 : 0);
      let tone = 1;
      const alt = (x + y) & 1;
      if (n < 0.37) tone = 0;
      else if (n < 0.41) tone = alt ? 0 : 1;
      else if (n > 0.69) tone = 2;
      else if (n > 0.65) tone = alt ? 2 : 1;
      col = (edge < 30 ? C.forest : C.grass)[tone];

      const pm = pond[i];
      if (pm === 1) {
        const dyN = vnoise(x / 10, y / 3, 11);
        let t = 1;
        if (dyN > 0.72) t = 2;
        else if (dyN < 0.28) t = 0;
        col = C.water[t];
      } else if (pm === 2) {
        col = C.sand[(x + y) % 5 === 0 ? 0 : 1];
      } else if (pm === 3) {
        col = C.rim;
      } else if (path[i] === 1) {
        const dn = vnoise(x / 5, y / 5, 21);
        let t = dn < 0.36 ? 0 : dn > 0.66 ? 2 : 1;
        col = C.dirt[t];
        const up = isPath(x, y - 1);
        const down = isPath(x, y + 1);
        const left = isPath(x - 1, y);
        const right = isPath(x + 1, y);
        if (!down) col = C.dirtEdge;
        else if (!up) col = C.dirtLip;
        else if (!left || !right) col = C.dirt[0];
        if (rng.chance(0.012) && up && down) col = C.pebble;
      } else if (path[i] === 2) {
        const up = isPath(x, y - 1);
        const down = isPath(x, y + 1);
        const left = isPath(x - 1, y);
        const right = isPath(x + 1, y);
        if (!up || !down || !left || !right) {
          col = path[at(x, y)] === 2 && (!down || !right) ? C.plazaEdge : C.cobble[0];
        } else {
          const row = Math.floor(y / 3);
          const stagger = (row & 1) * 3;
          const mortarV = (x + stagger) % 6 === 0;
          const mortarH = y % 3 === 0;
          col = mortarV || mortarH ? C.mortar : C.cobble[((x + y * 3) % 7 === 0 ? 2 : 1)];
        }
      }
      const o = i * 4;
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);

  // Grass tufts and flowers on open ground.
  const open = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !pond[at(x, y)] && !path[at(x, y)];
  for (let i = 0; i < (w * h) / 85; i++) {
    const x = rng.int(2, w - 3);
    const y = rng.int(3, h - 2);
    if (!open(x, y)) continue;
    const dark = rng.chance(0.6);
    g.fillStyle = dark ? '#5a9533' : '#9bd35f';
    g.fillRect(x, y, 1, 1);
    g.fillRect(x - 1, y - 1, 1, 1);
    g.fillRect(x + 1, y - 1, 1, 1);
    if (rng.chance(0.3)) g.fillRect(x, y - 2, 1, 1);
  }
  const petals = ['#f48fb1', '#ffd54f', '#ffffff', '#81d4fa'];
  for (const f of map.flowers) {
    if (!open(f.x, f.y)) continue;
    const col = petals[f.c];
    g.fillStyle = '#4f9e3a';
    g.fillRect(f.x, f.y + 1, 1, 1);
    g.fillStyle = col;
    g.fillRect(f.x - 1, f.y, 1, 1);
    g.fillRect(f.x + 1, f.y, 1, 1);
    g.fillRect(f.x, f.y - 1, 1, 1);
    g.fillStyle = f.c === 1 || f.c === 2 ? '#f29b2f' : '#ffeb3b';
    g.fillRect(f.x, f.y, 1, 1);
  }
  // Pebbles along path edges
  for (let i = 0; i < 90; i++) {
    const x = rng.int(2, w - 3);
    const y = rng.int(2, h - 3);
    if (isPath(x, y) || isPath(x + 3, y) || isPath(x - 3, y) || !open(x, y)) {
      if (!isPath(x, y) && open(x, y)) {
        g.fillStyle = '#8d939b';
        g.fillRect(x, y, 2, 1);
        g.fillStyle = '#b3b8be';
        g.fillRect(x, y - 1, 1, 1);
      }
    }
  }

  return { canvas, waterSpots, pond, path };
}
