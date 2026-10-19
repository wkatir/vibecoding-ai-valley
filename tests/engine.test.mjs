// Automatic checks for the game rules. Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/game/engine.js';
import { FACTIONS, LEVELS, BUILD_TIME, BASE_SPEED } from '../src/game/constants.js';

const reach = (w) => {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const id = queue.shift();
    for (const n of w.neighbors(id)) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size;
};

// A world without AI, so each test controls everything that happens.
const quiet = (opts = {}) => {
  const w = new World({ seed: 3, player: 0, ...opts });
  w.ais = [];
  return w;
};
const home = (w, f = 0) => w.villages.find((v) => v.owner === f);

test('el mapa siempre queda conectado y dentro de los límites', () => {
  for (let seed = 1; seed <= 25; seed++) {
    for (const size of [{ w: 640, h: 360 }, { w: 300, h: 650, portrait: true }]) {
      const w = new World({ seed, ...size });
      assert.equal(reach(w), w.villages.length, `seed ${seed}: hay pueblos aislados`);
      assert.ok(w.villages.length >= 5, `seed ${seed}: muy pocos pueblos`);
      for (const v of w.villages) {
        assert.ok(v.x >= 0 && v.x <= w.w && v.y >= 0 && v.y <= w.h, `seed ${seed}: pueblo fuera del mapa`);
      }
    }
  }
});

test('cada IA empieza con un solo pueblo y el resto son libres', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const w = new World({ seed, player: 0 });
    for (const f of FACTIONS) {
      const own = w.villages.filter((v) => v.owner === f.id);
      assert.equal(own.length, 1, `${f.name} debe tener 1 pueblo`);
      assert.equal(own[0].troops, 18);
      assert.equal(own[0].level, 1);
    }
    for (const v of w.villages.filter((x) => x.owner < 0)) assert.ok(v.troops >= 6 && v.troops <= 24);
  }
});

test('la producción suma tropas por segundo y respeta la capacidad', () => {
  const w = quiet();
  const v = home(w);
  for (let i = 0; i < 10; i++) w.step(1);
  assert.ok(Math.abs(v.troops - (18 + 10 * LEVELS[1].prod)) < 0.01, `tropas: ${v.troops}`);
  v.troops = LEVELS[1].capacity - 0.2;
  for (let i = 0; i < 20; i++) w.step(1);
  assert.ok(v.troops <= LEVELS[1].capacity + 1e-9, 'no debe pasar la capacidad');
});

test('combate: gana el atacante solo si supera a los defensores', () => {
  const w = quiet();
  const t = w.villages.find((v) => v.owner < 0);
  t.level = 1;
  t.troops = 10;
  w.arrive({ faction: 0, count: 20 }, t);
  assert.equal(t.owner, 0);
  assert.equal(t.troops, 10);

  const u = w.villages.filter((v) => v.owner < 0)[0];
  u.troops = 12;
  u.level = 1;
  const before = u.owner;
  w.arrive({ faction: 0, count: 10 }, u);
  assert.equal(u.owner, before, 'el ataque debía fallar');
  assert.equal(u.troops, 2);
});

test('combate: la defensa por nivel y el bono de Grok cuentan', () => {
  const w = quiet();
  const t = w.villages.find((v) => v.owner < 0);
  t.level = 2; // defensa x1.15
  t.troops = 10; // 11.5 efectivos
  w.arrive({ faction: 0, count: 11 }, t);
  assert.equal(t.owner, -1, '11 no alcanzan contra 11.5');
  t.troops = 10;
  w.arrive({ faction: 0, count: 12 }, t);
  assert.equal(t.owner, 0, '12 sí alcanzan');

  const g = w.villages.find((v) => v.owner < 0);
  g.level = 1;
  g.troops = 10;
  w.arrive({ faction: 2, count: 10 }, g); // Grok pega x1.1 = 11
  assert.equal(g.owner, 2);
});

test('mejorar casa cuesta tropas, tarda y sube el nivel', () => {
  const w = quiet();
  const v = home(w);
  v.troops = 40;
  assert.ok(w.upgrade(v.id, 0));
  assert.equal(v.troops, 40 - LEVELS[1].cost);
  assert.ok(v.building > 0);
  w.step(BUILD_TIME + 0.1);
  assert.equal(v.level, 2);
  assert.equal(v.building, 0);

  v.troops = 10;
  assert.equal(w.upgrade(v.id, 0), false, 'sin tropas suficientes no debe construir');
  v.level = 3;
  v.troops = 90;
  assert.equal(w.upgrade(v.id, 0), false, 'el nivel 3 es el máximo');
});

test('Gemini paga 20% menos por mejorar', () => {
  const w = quiet({ player: 4 });
  const v = home(w, 4);
  assert.equal(w.upgradeCost(v, 4), Math.ceil(LEVELS[1].cost * 0.8));
});

test('enviar tropas deja al menos una en casa y crea una escuadra', () => {
  const w = quiet();
  const v = home(w);
  const dst = w.neighbors(v.id)[0];
  assert.ok(w.sendFrom(v.id, dst, 1, 0));
  assert.equal(Math.floor(v.troops), 1);
  assert.equal(w.squads.length, 1);
  assert.equal(w.squads[0].count, 17);
  assert.equal(w.sendFrom(dst, v.id, 0.5, 0), false, 'no se puede enviar desde un pueblo ajeno');
});

test('la escuadra llega por el camino en el tiempo esperado', () => {
  const w = quiet();
  const v = home(w);
  const dst = w.neighbors(v.id)[0];
  w.villages[dst].troops = 1;
  w.villages[dst].owner = -1;
  w.sendFrom(v.id, dst, 0.9, 0);
  const sq = w.squads[0];
  const eta = sq.edge.len / BASE_SPEED;
  let t = 0;
  while (w.squads.length && t < eta + 5) {
    w.step(0.05);
    t += 0.05;
  }
  assert.equal(w.squads.length, 0, 'la escuadra debía llegar');
  assert.ok(Math.abs(t - eta) < 0.2, `llegó en ${t}s y se esperaba ${eta.toFixed(2)}s`);
  assert.equal(w.villages[dst].owner, 0, 'con 16 contra 1 debía conquistar');
});

test('las rutas empiezan y terminan donde deben y usan caminos reales', () => {
  for (const seed of [1, 2, 3]) {
    const w = new World({ seed, player: 0 });
    for (const a of w.villages) {
      for (const b of w.villages) {
        if (a.id === b.id) continue;
        const path = w.findPath(a.id, b.id, 0);
        assert.equal(path[0], a.id);
        assert.equal(path[path.length - 1], b.id);
        for (let i = 0; i + 1 < path.length; i++) assert.ok(w.edgeOf.has(`${path[i]}-${path[i + 1]}`));
      }
    }
  }
});

test('se gana al eliminar a todas las IAs y se pierde sin pueblos', () => {
  const won = quiet();
  won.villages.forEach((v) => (v.owner = 0));
  won.squads = [];
  won.checkEnd();
  assert.equal(won.status, 'won');

  const lost = quiet();
  lost.villages.forEach((v) => (v.owner = 1));
  lost.squads = [];
  lost.checkEnd();
  assert.equal(lost.status, 'lost');
});

test('la misma semilla da la misma partida (reproducible)', () => {
  const run = (seed) => {
    const w = new World({ seed, player: -1 });
    for (let i = 0; i < 1200; i++) w.update(0.1);
    return JSON.stringify(w.villages.map((v) => [v.owner, v.level, Math.floor(v.troops)]));
  };
  assert.equal(run(7), run(7));
  assert.notEqual(run(7), run(8));
});

test('una partida larga entre IAs no produce valores inválidos', () => {
  const w = new World({ seed: 11, player: -1 });
  let captures = 0;
  w.on((type) => {
    if (type === 'capture') captures++;
  });
  for (let i = 0; i < 3000 && w.status === 'playing'; i++) w.update(0.1);
  assert.ok(captures > 0, 'las IAs debían conquistar algo');
  for (const v of w.villages) {
    assert.ok(Number.isFinite(v.troops) && v.troops >= 0, `tropas inválidas en ${v.name}`);
    assert.ok(v.level >= 1 && v.level <= 3);
  }
  const total = w.stats().reduce((n, s) => n + s.villages, 0);
  assert.ok(total <= w.villages.length);
});
