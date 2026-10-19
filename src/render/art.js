import { Pen } from './pen.js';
import { EMBLEMS } from './glyphs.js';
import { FACTIONS, NEUTRAL_ART } from '../game/constants.js';

export const OUT = '#33211a';
const STONE = { l: '#b3b8be', m: '#8d939b', d: '#6a7078' };
const WOOD = { l: '#b57a3d', m: '#8b5a2b', d: '#5e3a1a' };
const GREEN = { l: '#7fcf4c', m: '#4f9e3a', d: '#357a2f', dd: '#25592a' };

const finish = (pen, extra = {}) => ({ canvas: pen.canvas, w: pen.w, h: pen.h, ax: pen.w >> 1, ay: pen.h - 1, ...extra });

function emblemAt(pen, key, cx, cy, color) {
  const rows = EMBLEMS[key];
  pen.bitmap(Math.round(cx - rows[0].length / 2), Math.round(cy - rows.length / 2), rows, color);
}

// ---------------------------------------------------------------- buildings

function chimney(pen, x, y) {
  pen.rect(x, y + 2, 4, 9, STONE.m);
  pen.vline(x, y + 2, 9, STONE.l);
  pen.vline(x + 3, y + 2, 9, STONE.d);
  pen.rect(x - 1, y, 6, 2, STONE.l);
  pen.hline(x - 1, y + 1, 6, STONE.d);
  pen.px(x + 1, y + 5, STONE.d);
  pen.px(x + 2, y + 8, STONE.d);
}

// Trapezoid roof with shingle rows.
function roof(pen, cx, y0, rows, topW, botW, pal) {
  for (let r = 0; r < rows; r++) {
    const w = Math.round(topW + ((botW - topW) * r) / (rows - 1));
    const x0 = Math.round(cx - w / 2);
    pen.rect(x0, y0 + r, w, 1, r % 3 === 2 ? pal.roofD : pal.roof);
    if (r % 3 !== 2) for (let x = x0 + 1 + (r % 2) * 2; x < x0 + w - 1; x += 4) pen.px(x, y0 + r, pal.roofD);
    pen.px(x0, y0 + r, pal.roofL);
    pen.px(x0 + w - 1, y0 + r, pal.roofD);
  }
  const w0 = Math.round(topW);
  pen.hline(Math.round(cx - w0 / 2), y0, w0, pal.roofL);
}

function wall(pen, x, y, w, h, pal) {
  pen.rect(x, y, w, h, pal.wall);
  pen.hline(x, y, w, pal.wallD);
  pen.hline(x + 1, y + 1, w - 2, pal.wallD);
  for (let px = x + 4; px < x + w - 2; px += 5) pen.vline(px, y + 2, h - 4, pal.wallD);
  pen.vline(x, y + 1, h - 1, pal.wallD);
  pen.rect(x, y + h - 2, w, 2, STONE.m);
  pen.hline(x, y + h - 2, w, STONE.l);
  for (let px = x + 2; px < x + w; px += 5) pen.px(px, y + h - 1, STONE.d);
}

function door(pen, x, y, w, h) {
  pen.rect(x - 1, y - 1, w + 2, h + 1, WOOD.d);
  pen.rect(x, y, w, h, WOOD.m);
  pen.vline(x + (w >> 1), y, h, WOOD.d);
  pen.hline(x, y, 1, WOOD.d);
  pen.hline(x + w - 1, y, 1, WOOD.d);
  pen.px(x + w - 2, y + (h >> 1), '#f3c845');
  pen.rect(x - 1, y + h, w + 2, 1, STONE.l);
}

function windowAt(pen, x, y, w, h, glow = false) {
  pen.rect(x - 1, y - 1, w + 2, h + 2, WOOD.d);
  pen.rect(x, y, w, h, glow ? '#ffd36b' : '#cfe9f5');
  pen.vline(x + (w >> 1), y, h, WOOD.d);
  pen.hline(x, y + (h >> 1), w, WOOD.d);
  if (!glow) pen.px(x, y, '#ffffff');
}

function flowerBox(pen, x, y, w) {
  pen.rect(x, y, w, 2, WOOD.m);
  pen.hline(x, y + 1, w, WOOD.d);
  const cols = ['#f06292', '#ffd54f', '#ff8a65', '#f48fb1'];
  for (let i = 0; i < w; i += 2) pen.px(x + i, y - 1, cols[(i >> 1) % cols.length]);
  for (let i = 1; i < w; i += 2) pen.px(x + i, y - 1, '#4f9e3a');
}

function badge(pen, key, cx, cy, pal) {
  pen.disc(cx, cy, 4, pal.roofD);
  emblemAt(pen, key, cx, cy, pal.accent);
}

function cottage(pal, key) {
  const pen = new Pen(26, 29);
  chimney(pen, 17, 1);
  roof(pen, 13, 4, 11, 12, 24, pal);
  wall(pen, 3, 15, 20, 13, pal);
  windowAt(pen, 5, 18, 4, 4);
  windowAt(pen, 17, 18, 4, 4);
  flowerBox(pen, 16, 23, 6);
  door(pen, 11, 20, 5, 7);
  if (key) badge(pen, key, 13, 9, pal);
  pen.outline(OUT);
  return finish(pen, { windows: [{ x: 5, y: 18, w: 4, h: 4 }, { x: 17, y: 18, w: 4, h: 4 }], smoke: { x: 20, y: 1 } });
}

function barn(pal, key) {
  const pen = new Pen(34, 29);
  roof(pen, 17, 3, 11, 14, 32, pal);
  wall(pen, 3, 14, 28, 14, pal);
  // big door with a cross brace
  pen.rect(11, 17, 12, 11, WOOD.m);
  pen.rect(10, 16, 14, 1, WOOD.d);
  pen.vline(10, 16, 12, WOOD.d);
  pen.vline(23, 16, 12, WOOD.d);
  pen.vline(16, 17, 11, WOOD.d);
  for (let i = 0; i < 5; i++) {
    pen.px(11 + i, 18 + i * 2, WOOD.l);
    pen.px(22 - i, 18 + i * 2, WOOD.l);
  }
  windowAt(pen, 5, 18, 3, 3);
  windowAt(pen, 26, 18, 3, 3);
  if (key) badge(pen, key, 17, 8, pal);
  pen.outline(OUT);
  return finish(pen, { windows: [{ x: 5, y: 18, w: 3, h: 3 }, { x: 26, y: 18, w: 3, h: 3 }], smoke: null });
}

function hall(pal, key, cloth) {
  const pen = new Pen(36, 42);
  // tower
  pen.rect(13, 13, 10, 12, pal.wall);
  pen.hline(13, 13, 10, pal.wallD);
  pen.vline(13, 13, 12, pal.wallD);
  pen.vline(22, 13, 12, pal.wallD);
  roof(pen, 18, 6, 8, 2, 14, pal);
  // flag
  pen.vline(18, 0, 7, WOOD.d);
  pen.rect(19, 1, 6, 3, cloth);
  pen.px(25, 2, cloth);
  pen.hline(19, 1, 6, pal.roofL);
  // main body
  roof(pen, 18, 21, 9, 22, 34, pal);
  wall(pen, 3, 30, 30, 12, pal);
  windowAt(pen, 6, 33, 4, 4);
  windowAt(pen, 26, 33, 4, 4);
  windowAt(pen, 16, 16, 4, 5);
  door(pen, 14, 34, 8, 8);
  if (key) {
    pen.disc(18, 25, 4, pal.roofD);
    emblemAt(pen, key, 18, 25, pal.accent);
  }
  pen.outline(OUT);
  return finish(pen, {
    windows: [{ x: 6, y: 33, w: 4, h: 4 }, { x: 26, y: 33, w: 4, h: 4 }, { x: 16, y: 16, w: 4, h: 5 }],
    smoke: null,
    flag: { x: 18, y: 0 },
  });
}

function scaffold() {
  const pen = new Pen(30, 30);
  pen.rect(3, 6, 2, 22, WOOD.m);
  pen.rect(25, 6, 2, 22, WOOD.m);
  pen.rect(13, 3, 2, 25, WOOD.m);
  pen.rect(2, 12, 26, 2, WOOD.l);
  pen.rect(2, 20, 26, 2, WOOD.l);
  pen.rect(5, 14, 8, 6, '#e8dcc0');
  pen.rect(15, 14, 10, 6, '#e8dcc0');
  pen.hline(5, 19, 8, '#cdbf9e');
  pen.hline(15, 19, 10, '#cdbf9e');
  pen.rect(1, 27, 28, 2, '#a98458');
  pen.outline(OUT);
  return finish(pen);
}

// ---------------------------------------------------------------- troops

const BODY = {
  down: [
    '........',
    '..hhhh..',
    '.hLhhhh.',
    '.HHHHHH.',
    '.ssssss.',
    '.sesses.',
    '..ssss..',
    '.bbbbbb.',
    'bbbaabbb',
    'sbbaabbs',
    '.bbbbbb.',
    '.BBBBBB.',
    '.pp..pp.',
    '.kk..kk.',
  ],
  up: [
    '........',
    '..hhhh..',
    '.hLhhhh.',
    '.HHHHHH.',
    '.dddddd.',
    '.dddddd.',
    '..dddd..',
    '.bbbbbb.',
    'bbbbbbbb',
    'sbbbbbbs',
    '.bbbbbb.',
    '.BBBBBB.',
    '.pp..pp.',
    '.kk..kk.',
  ],
  side: [
    '........',
    '..hhhh..',
    '.hLhhhhh',
    '.HHHHHHH',
    '..sssss.',
    '..sssess',
    '...ssss.',
    '..bbbbb.',
    '.bbbaabb',
    '.bbbaabs',
    '..bbbbb.',
    '..BBBBB.',
    '..pp.pp.',
    '..kk.kk.',
  ],
};

const HATS = {
  claude: { down: ['...aa...', '..hhhh..', '.hLhhhh.', '.aaaaaa.'], side: ['...aa...', '..hhhh..', '.hLhhhhh', '.aaaaaaa'] },
  codex: { down: ['..w.ww..', '.wwwwww.', '.wWwwww.', '.HHHHHH.'], side: ['..w.ww..', '.wwwwww.', '.wWwwwww', '.HHHHHHH'] },
  grok: { down: ['........', '..hhhh..', '.hhhhah.', '.HHHHHH.'], side: ['........', '..hhhh..', '.hhhahhh', '.HHHHHHH'] },
  meta: { down: ['........', '..hhhh..', '.hLhhhh.', '.aaaaaa.'], side: ['........', '..hhhh..', '.hLhhhhh', '.aaaaaaa'] },
  gemini: { down: ['...a....', '..hahh..', '.hLhhhh.', '.HHHHHH.'], side: ['...a....', '..hahh..', '.hLhhhhh', '.HHHHHHH'] },
};

function trooper(f, dir, frame) {
  const a = f.art;
  const pen = new Pen(10, 16);
  const rows = BODY[dir].map((r) => r);
  const hats = HATS[f.key][dir === 'up' ? 'down' : dir];
  for (let i = 0; i < 4; i++) rows[i] = hats[i];
  if (dir === 'up') for (let i = 4; i < 7; i++) rows[i] = BODY.up[i];
  if (frame === 1) {
    if (dir === 'side') {
      rows[12] = '..pppp..';
      rows[13] = '..kkkk..';
    } else {
      rows[12] = '..pppp..';
      rows[13] = '..kkkk..';
      rows[9] = rows[9].replace('s', 'b').replace(/s$/, 'b');
    }
  }
  const pal = {
    h: a.roof,
    H: a.roofD,
    L: a.roofL,
    b: a.cloth,
    B: a.roofD,
    a: a.accent,
    s: '#f2c9a0',
    S: '#d9a77c',
    d: a.roofD,
    e: '#2a1a12',
    p: '#5a4636',
    P: '#3f2f23',
    k: '#2e2018',
    w: '#f6f6ff',
    W: '#c7c7e6',
  };
  pen.stamp(1, 1, rows, pal);
  pen.outline(OUT);
  return finish(pen, { ax: 5, ay: 15 });
}

function flag(f, frame) {
  const pen = new Pen(11, 17);
  pen.vline(1, 0, 16, WOOD.d);
  const cloth = f.art.cloth;
  pen.rect(2, 1, 7, 5, cloth);
  pen.hline(2, 1, 7, f.art.roofL);
  pen.hline(2, 5, 7, f.art.roofD);
  if (frame === 0) {
    pen.px(9, 3, cloth);
    pen.px(9, 2, cloth);
  } else {
    pen.px(9, 4, cloth);
    pen.px(9, 3, cloth);
    pen.px(2, 6, f.art.roofD);
  }
  pen.px(4, 3, f.art.accent);
  pen.px(5, 3, f.art.accent);
  pen.outline(OUT);
  return finish(pen, { ax: 1, ay: 16 });
}

// ---------------------------------------------------------------- scenery

function blob(pen, cx, cy, r, c) {
  pen.disc(cx, cy, r, c);
}

function oakCanopy(v) {
  const pen = new Pen(26, 22);
  const sizes = [[13, 11, 9], [13, 11, 10], [13, 12, 8]][v];
  const [cx, cy, r] = sizes;
  blob(pen, cx, cy, r, GREEN.dd);
  blob(pen, cx - 6, cy + 2, r - 3, GREEN.dd);
  blob(pen, cx + 6, cy + 2, r - 3, GREEN.dd);
  blob(pen, cx, cy - 1, r - 1, GREEN.d);
  blob(pen, cx - 6, cy + 1, r - 4, GREEN.d);
  blob(pen, cx + 6, cy + 1, r - 4, GREEN.d);
  blob(pen, cx - 1, cy - 3, r - 3, GREEN.m);
  blob(pen, cx - 6, cy - 1, r - 6, GREEN.m);
  blob(pen, cx - 3, cy - 5, r - 6, GREEN.l);
  const dots = [[cx - 7, cy - 1], [cx + 2, cy - 6], [cx - 4, cy + 3], [cx + 5, cy - 1]];
  for (const [x, y] of dots) pen.px(x, y, GREEN.l);
  pen.outline(OUT);
  return finish(pen, { ax: 13, ay: 21 });
}

function oakTrunk() {
  const pen = new Pen(26, 12);
  pen.rect(11, 0, 5, 9, WOOD.m);
  pen.vline(11, 0, 9, WOOD.l);
  pen.vline(15, 0, 9, WOOD.d);
  pen.rect(10, 8, 7, 1, WOOD.d);
  pen.px(9, 9, WOOD.d);
  pen.px(17, 9, WOOD.d);
  pen.px(13, 3, WOOD.d);
  pen.px(12, 5, WOOD.d);
  pen.outline(OUT);
  return finish(pen, { ax: 13, ay: 10 });
}

function pine(v) {
  const pen = new Pen(20, 30);
  const tiers = [[2, 9, 7], [8, 9, 10], [14, 10, 13]];
  const cx = 10;
  pen.rect(8, 24, 4, 5, WOOD.m);
  pen.vline(8, 24, 5, WOOD.l);
  pen.vline(11, 24, 5, WOOD.d);
  tiers.forEach(([y0, h, bw], t) => {
    for (let i = 0; i < h; i++) {
      const half = Math.max(0, Math.round(((i + 1) / h) * (bw / 2)) - (i === 0 ? 1 : 0));
      const x0 = cx - half;
      const w = half * 2 + 1;
      pen.rect(x0, y0 + i, w, 1, i % 3 === 2 ? GREEN.dd : GREEN.d);
      pen.rect(x0, y0 + i, Math.max(1, Math.round(w / 3)), 1, i % 3 === 2 ? GREEN.d : GREEN.m);
      if (t === 0 && i < 3) pen.px(cx - 1, y0 + i, GREEN.l);
    }
  });
  pen.outline(OUT);
  return finish(pen, { ax: 10, ay: 28 });
}

function bush(v) {
  const pen = new Pen(16, 12);
  blob(pen, 8, 6, 4, GREEN.dd);
  blob(pen, 4, 7, 3, GREEN.dd);
  blob(pen, 12, 7, 3, GREEN.dd);
  blob(pen, 8, 5, 3, GREEN.d);
  blob(pen, 4, 6, 2, GREEN.d);
  blob(pen, 12, 6, 2, GREEN.d);
  pen.px(7, 4, GREEN.m);
  pen.px(8, 4, GREEN.l);
  pen.px(4, 5, GREEN.m);
  pen.px(11, 5, GREEN.m);
  if (v === 1) {
    [[6, 6], [10, 5], [8, 8]].forEach(([x, y]) => pen.px(x, y, '#e8443c'));
  } else if (v === 2) {
    [[6, 6], [10, 5], [8, 8]].forEach(([x, y]) => pen.px(x, y, '#ffd54f'));
  }
  pen.outline(OUT);
  return finish(pen, { ax: 8, ay: 10 });
}

function rock(v) {
  const pen = new Pen(14, 11);
  const w = [10, 8, 11][v];
  const h = [6, 6, 7][v];
  const x0 = 2;
  const y0 = 10 - h - 1;
  pen.rect(x0 + 1, y0, w - 2, h, STONE.m);
  pen.rect(x0, y0 + 2, w, h - 2, STONE.m);
  pen.hline(x0 + 1, y0, w - 3, STONE.l);
  pen.hline(x0 + 1, y0 + 1, w - 5, STONE.l);
  pen.hline(x0 + 1, y0 + h - 1, w - 2, STONE.d);
  pen.vline(x0 + w - 1, y0 + 2, h - 2, STONE.d);
  pen.outline(OUT);
  return finish(pen, { ax: 7, ay: 9 });
}

function stump() {
  const pen = new Pen(12, 11);
  pen.rect(2, 4, 8, 5, WOOD.m);
  pen.vline(2, 4, 5, WOOD.l);
  pen.vline(9, 4, 5, WOOD.d);
  pen.hline(1, 8, 10, WOOD.d);
  pen.ellipse(6, 4, 4, 2, '#d9a066');
  pen.ellipse(6, 4, 2, 1, '#b57a3d');
  pen.px(6, 4, WOOD.m);
  pen.outline(OUT);
  return finish(pen, { ax: 6, ay: 9 });
}

function mushroom() {
  const pen = new Pen(10, 9);
  pen.rect(4, 4, 2, 3, '#f1e6d0');
  pen.rect(2, 1, 6, 3, '#d9453a');
  pen.px(3, 2, '#ffffff');
  pen.px(6, 2, '#ffffff');
  pen.outline(OUT);
  return finish(pen, { ax: 5, ay: 7 });
}

function lily() {
  const pen = new Pen(8, 5);
  pen.rect(1, 1, 6, 3, '#4f9e3a');
  pen.hline(2, 0, 4, '#4f9e3a');
  pen.hline(2, 4, 4, '#357a2f');
  pen.px(6, 2, '#2d6fa0');
  pen.px(3, 2, '#f48fb1');
  pen.px(4, 1, '#f8bbd0');
  return finish(pen, { ax: 4, ay: 3 });
}

// ---------------------------------------------------------------- props

function well() {
  const pen = new Pen(16, 20);
  pen.rect(2, 2, 2, 11, WOOD.m);
  pen.rect(12, 2, 2, 11, WOOD.m);
  pen.rect(1, 0, 14, 3, '#9a5b34');
  pen.hline(1, 0, 14, '#c27a4a');
  pen.hline(1, 2, 14, '#6e3f22');
  pen.ellipse(8, 14, 7, 4, STONE.m);
  pen.ellipse(8, 13, 7, 3, STONE.l);
  pen.ellipse(8, 13, 5, 2, '#2f77b0');
  pen.hline(5, 13, 3, '#6fb7e6');
  pen.rect(1, 14, 14, 3, STONE.m);
  pen.hline(1, 16, 14, STONE.d);
  for (let x = 3; x < 14; x += 4) pen.vline(x, 14, 3, STONE.d);
  pen.outline(OUT);
  return finish(pen, { ax: 8, ay: 18 });
}

function plot(stage) {
  const pen = new Pen(36, 17);
  pen.rect(1, 2, 34, 13, '#8a5a34');
  pen.rect(2, 1, 32, 15, '#8a5a34');
  pen.hline(2, 1, 32, '#a77249');
  for (let row = 0; row < 3; row++) {
    const y = 4 + row * 4;
    pen.hline(3, y + 1, 30, '#5e3a1a');
    pen.hline(3, y, 30, '#6f4527');
    for (let x = 5; x < 32; x += 4) {
      if (stage === 0) {
        pen.px(x, y - 1, '#7fcf4c');
      } else if (stage === 1) {
        pen.px(x, y - 1, '#7fcf4c');
        pen.px(x - 1, y - 2, '#4f9e3a');
        pen.px(x + 1, y - 2, '#4f9e3a');
        pen.px(x, y - 2, '#7fcf4c');
      } else {
        pen.rect(x - 1, y - 3, 3, 3, '#4f9e3a');
        pen.px(x, y - 4, '#7fcf4c');
        pen.px(x - 1, y - 3, '#7fcf4c');
        pen.px(x, y - 2, row === 1 ? '#f2a03c' : row === 0 ? '#e8443c' : '#ffd54f');
      }
    }
  }
  pen.outline(OUT);
  return finish(pen, { ax: 18, ay: 15 });
}

function hay() {
  const pen = new Pen(14, 12);
  pen.ellipse(7, 7, 6, 4, '#e3c254');
  pen.ellipse(7, 6, 6, 3, '#f0d472');
  pen.hline(3, 6, 8, '#c9a53f');
  pen.hline(2, 8, 10, '#b8923a');
  pen.vline(5, 4, 6, '#9a7a30');
  pen.vline(9, 4, 6, '#9a7a30');
  pen.outline(OUT);
  return finish(pen, { ax: 7, ay: 10 });
}

function crates() {
  const pen = new Pen(16, 14);
  const box = (x, y, s) => {
    pen.rect(x, y, s, s, WOOD.l);
    pen.hline(x, y, s, '#d9a066');
    pen.hline(x, y + s - 1, s, WOOD.d);
    pen.vline(x, y, s, WOOD.m);
    pen.vline(x + s - 1, y, s, WOOD.d);
    pen.hline(x + 1, y + (s >> 1), s - 2, WOOD.m);
  };
  box(1, 5, 7);
  box(8, 6, 7);
  box(4, 0, 6);
  pen.outline(OUT);
  return finish(pen, { ax: 8, ay: 12 });
}

function barrel() {
  const pen = new Pen(10, 12);
  pen.rect(1, 1, 7, 9, WOOD.m);
  pen.vline(1, 1, 9, WOOD.l);
  pen.vline(7, 1, 9, WOOD.d);
  pen.hline(1, 3, 7, '#6a7078');
  pen.hline(1, 7, 7, '#6a7078');
  pen.hline(2, 1, 5, '#d9a066');
  pen.outline(OUT);
  return finish(pen, { ax: 5, ay: 10 });
}

function fence(len) {
  const pen = new Pen(len, 9);
  pen.rect(0, 3, len, 1, WOOD.l);
  pen.rect(0, 5, len, 1, WOOD.m);
  for (let x = 1; x < len; x += 8) {
    pen.rect(x, 1, 2, 7, WOOD.m);
    pen.vline(x, 1, 7, WOOD.l);
  }
  pen.outline(OUT);
  return finish(pen, { ax: len >> 1, ay: 8 });
}

function lamp() {
  const pen = new Pen(9, 20);
  pen.rect(4, 5, 1, 13, '#3d3228');
  pen.rect(2, 1, 5, 5, '#3d3228');
  pen.rect(3, 2, 3, 3, '#ffe9a8');
  pen.hline(3, 18, 3, '#3d3228');
  pen.outline(OUT);
  return finish(pen, { ax: 4, ay: 18, light: { x: 4, y: 3 } });
}

function chicken(frame) {
  const pen = new Pen(9, 9);
  pen.ellipse(4, 5, 3, 2, '#fbfbf2');
  pen.px(2, 4, '#f0efe0');
  pen.rect(6, 2, 2, 3, '#fbfbf2');
  pen.px(7, 1, '#e8443c');
  pen.px(8, 3, '#f2a03c');
  pen.px(7, 3, '#2a1a12');
  pen.px(1, 3, '#f0efe0');
  if (frame === 0) {
    pen.px(3, 8, '#f2a03c');
    pen.px(5, 8, '#f2a03c');
  } else {
    pen.px(4, 8, '#f2a03c');
    pen.px(3, 7, '#f2a03c');
  }
  pen.outline(OUT);
  return finish(pen, { ax: 4, ay: 8 });
}

function butterfly(color, frame) {
  const pen = new Pen(5, 4);
  if (frame === 0) {
    pen.rect(0, 0, 2, 2, color);
    pen.rect(3, 0, 2, 2, color);
    pen.rect(2, 1, 1, 2, '#2a1a12');
  } else {
    pen.rect(1, 1, 1, 2, color);
    pen.rect(3, 1, 1, 2, color);
    pen.rect(2, 1, 1, 2, '#2a1a12');
  }
  return finish(pen, { ax: 2, ay: 2 });
}

function emblemIcon(f, scale) {
  const rows = EMBLEMS[f.key];
  const side = Math.max(rows[0].length, rows.length) + 4;
  const pen = new Pen(side * scale, side * scale);
  const g = pen.g;
  g.fillStyle = f.art.roof;
  g.fillRect(0, 0, pen.w, pen.h);
  g.fillStyle = f.art.roofD;
  g.fillRect(0, pen.h - scale, pen.w, scale);
  g.fillStyle = f.art.roofL;
  g.fillRect(0, 0, pen.w, scale);
  const ox = Math.floor((side - rows[0].length) / 2);
  const oy = Math.floor((side - rows.length) / 2);
  g.fillStyle = f.art.accent;
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') g.fillRect((c + ox) * scale, (r + oy) * scale, scale, scale);
  });
  return pen.canvas;
}

// ---------------------------------------------------------------- catalog

export class Art {
  constructor() {
    this.cache = new Map();
    this.fx = { lily: lily() };
    this.oakCanopy = [0, 1, 2].map(oakCanopy);
    this.oakTrunk = oakTrunk();
    this.pine = [0, 1, 2].map(pine);
    this.bush = [0, 1, 2].map(bush);
    this.rock = [0, 1, 2].map(rock);
    this.stump = stump();
    this.mushroom = mushroom();
    this.well = well();
    this.plot = [0, 1, 2].map(plot);
    this.hay = hay();
    this.crates = crates();
    this.barrel = barrel();
    this.fence = [24, 40].map(fence);
    this.lamp = lamp();
    this.scaffold = scaffold();
    this.chicken = [0, 1].map(chicken);
    this.butterfly = ['#ffd54f', '#f48fb1', '#81d4fa', '#fff59d'].map((c) => [0, 1].map((f) => butterfly(c, f)));
  }

  memo(key, build) {
    if (!this.cache.has(key)) this.cache.set(key, build());
    return this.cache.get(key);
  }

  // kind: cottage | barn | hall. fid -1 is a free village.
  building(kind, fid) {
    return this.memo(`b:${kind}:${fid}`, () => {
      const f = FACTIONS[fid];
      const pal = f ? f.art : NEUTRAL_ART;
      const key = f ? f.key : null;
      if (kind === 'cottage') return cottage(pal, key);
      if (kind === 'barn') return barn(pal, key);
      return hall(pal, key, pal.cloth);
    });
  }

  trooper(fid, dir, frame) {
    return this.memo(`t:${fid}:${dir}:${frame}`, () => trooper(FACTIONS[fid], dir, frame));
  }

  flag(fid, frame) {
    return this.memo(`f:${fid}:${frame}`, () => flag(FACTIONS[fid], frame));
  }

  emblem(fid, scale = 1) {
    return this.memo(`e:${fid}:${scale}`, () => emblemIcon(FACTIONS[fid], scale));
  }
}
