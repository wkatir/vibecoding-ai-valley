// Renders world frames to PNG.
// node scripts/shot.mjs '{"seed":3,"seconds":60,"name":"x","hour":22,"rain":1,"select":true,"crop":[x,y,w,h,scale],"fight":true,"build":true}'
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
const { World } = await import('../src/game/engine.js');
const { Art } = await import('../src/render/art.js');
const { Renderer } = await import('../src/render/renderer.js');
const { DAY_LENGTH } = await import('../src/game/constants.js');

const o = { seed: 3, seconds: 60, name: 'world', ...JSON.parse(process.argv[2] || '{}') };
const w = new World({ seed: o.seed, player: 0, w: o.w || 640, h: o.h || 360, difficulty: o.difficulty || 'normal' });
const r = new Renderer(w, new Art());
r.resize(1920, 1080, 1);
const dt = 1 / 30;
for (let t = 0; t < o.seconds; t += dt) {
  w.update(dt);
  r.update(dt);
}
if (o.hour != null) w.t = ((o.hour / 24 - 0.3 + 1) % 1) * DAY_LENGTH;
if (o.rain) r.rainAmount = () => o.rain;
const mine = w.villages.find((v) => v.owner === 0);
if (o.build) {
  mine.troops = 40;
  w.upgrade(mine.id, 0);
}
if (o.fight) {
  const t = w.villages[w.neighbors(mine.id)[0]];
  r.onEvent('fight', { vid: t.id, attacker: 0, defender: t.owner, attackers: 14, defenders: 9 });
  r.onEvent('capture', { vid: mine.id, faction: 0, from: -1, left: 5 });
}
for (let i = 0; i < 12; i++) r.update(dt);
let ui = {};
if (o.select) {
  const nb = w.neighbors(mine.id);
  ui = { selected: mine.id, hover: nb[0], target: nb.length > 1 ? nb[1] : nb[0] };
}
r.draw(ui);
const S = o.scale || 3;
const out = createCanvas(w.w * S, w.h * S);
const og = out.getContext('2d');
og.imageSmoothingEnabled = false;
og.drawImage(r.buf, 0, 0, w.w * S, w.h * S);
fs.writeFileSync(`${OUT}/${o.name}.png`, out.toBuffer('image/png'));
if (o.crop) {
  const [cx, cy, cw, ch, cs] = o.crop;
  const crop = createCanvas(cw * cs, ch * cs);
  const cg = crop.getContext('2d');
  cg.imageSmoothingEnabled = false;
  cg.drawImage(r.buf, cx, cy, cw, ch, 0, 0, cw * cs, ch * cs);
  fs.writeFileSync(`${OUT}/${o.name}_crop.png`, crop.toBuffer('image/png'));
}
console.log('mine', mine.id, mine.x, mine.y, 'squads', w.squads.length);
