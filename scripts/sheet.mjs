// Renders sprites to PNG sheets for inspection. Usage: node scripts/sheet.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { setCanvasFactory } from '../src/render/platform.js';
let createCanvas;
try {
  ({ createCanvas } = await import('@napi-rs/canvas'));
} catch {
  console.error('Falta @napi-rs/canvas. Instalar con: npm i -D @napi-rs/canvas');
  process.exit(1);
}
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'evidencia', 'capturas-nodo');
fs.mkdirSync(OUT, { recursive: true });
setCanvasFactory((w, h) => createCanvas(w, h));
const { Art } = await import('../src/render/art.js');
const { FACTIONS } = await import('../src/game/constants.js');

const art = new Art();

function sheet(name, W, H, S, layout) {
  const c = createCanvas(W, H);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#78b546';
  g.fillRect(0, 0, W, H);
  layout((spr, x, y) => g.drawImage(spr.canvas || spr, x, y, (spr.w || spr.width) * S, (spr.h || spr.height) * S), g);
  fs.writeFileSync(`${OUT}/${name}.png`, c.toBuffer('image/png'));
}

sheet('buildings', 1100, 760, 3, (put) => {
  [-1, 0, 1, 2, 3, 4].forEach((fid, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    let x = 8 + col * 540;
    const y = 8 + row * 250;
    for (const kind of ['cottage', 'barn', 'hall']) {
      const b = art.building(kind, fid);
      put(b, x, y + (126 - b.h * 3));
      x += b.w * 3 + 10;
    }
  });
});

sheet('units', 1100, 760, 6, (put) => {
  FACTIONS.forEach((f, i) => {
    let x = 6 + i * 215;
    put(art.trooper(f.id, 'down', 0), x, 6);
    put(art.trooper(f.id, 'down', 1), x + 66, 6);
    put(art.trooper(f.id, 'side', 0), x, 110);
    put(art.trooper(f.id, 'side', 1), x + 66, 110);
    put(art.trooper(f.id, 'up', 0), x, 214);
    put(art.flag(f.id, 0), x + 140, 214);
    put(art.emblem(f.id, 3), x, 330);
  });
  [art.chicken[0], art.chicken[1], art.butterfly[0][0], art.butterfly[1][1]].forEach((s, i) => put(s, 6 + i * 70, 460));
});

sheet('scenery', 1100, 700, 4, (put) => {
  put(art.oakTrunk, 20, 130);
  put(art.oakCanopy[0], 20, 20);
  put(art.oakCanopy[1], 140, 20);
  put(art.oakTrunk, 140, 130);
  put(art.pine[0], 280, 10);
  put(art.pine[1], 380, 10);
  put(art.bush[0], 500, 40);
  put(art.bush[1], 580, 40);
  put(art.bush[2], 660, 40);
  put(art.rock[0], 760, 40);
  put(art.rock[1], 830, 40);
  put(art.rock[2], 900, 40);
  put(art.stump, 980, 40);
  put(art.mushroom, 1040, 40);
  put(art.well, 20, 290);
  put(art.plot[0], 120, 290);
  put(art.plot[1], 120, 370);
  put(art.plot[2], 120, 450);
  put(art.hay, 420, 290);
  put(art.crates, 500, 290);
  put(art.barrel, 600, 290);
  put(art.lamp, 660, 290);
  put(art.fence[0], 730, 290);
  put(art.fence[1], 730, 340);
  put(art.scaffold, 480, 400);
  put(art.fx.lily, 640, 420);
});
console.log('sheets written');
