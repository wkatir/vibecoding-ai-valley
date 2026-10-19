import { BOSS, COLORS, FIELD, PLAYER } from './constants.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const easeOut = (t) => 1 - (1 - t) ** 3;
const hex = (s) => parseInt(s.slice(1), 16);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const swapRemove = (list, i) => {
  const last = list.pop();
  if (i < list.length) list[i] = last;
};

const BEST_KEY = 'claude-vs-codex:best';
const readBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};
const writeBest = (value) => {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* storage unavailable */
  }
};

const LINES = {
  phase: [
    'voy a refactorizar todo el repositorio',
    '38 archivos modificados para arreglar un typo',
    'git push --force',
  ],
  taunt: [
    'compilando... faltan 4 minutos',
    'en mi máquina funciona',
    'agregando una dependencia más',
    'TODO: arreglar esto después',
  ],
};

const END_DELAY = { won: 2.8, lost: 1.5 };
const SPARK_COLORS = [hex(COLORS.codexLight), hex(COLORS.screen)];
const BOOM_COLORS = [hex(COLORS.codex), hex(COLORS.codexLight), hex(COLORS.screen)];
const HURT_COLORS = [hex(COLORS.claude), hex(COLORS.claudeLight), hex(COLORS.ink)];

// Shared, mutable input state. Written by the keyboard and pointer handlers.
export const input = { x: 0, z: 0, targetX: null, targetZ: null };

class Engine {
  constructor() {
    this.listeners = new Set();
    this.best = readBest();
    this.clock = 0;
    this.shake = 0;
    this.reset('menu');
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type) {
    this.listeners.forEach((fn) => fn(type));
  }

  reset(status) {
    this.status = status;
    this.paused = false;
    this.time = 0;
    this.endT = 0;
    this.score = 0;
    this.bonus = 0;
    this.damageTaken = 0;
    this.hurtLog = {};
    this.logLines = [];
    this.player = {
      x: 0,
      z: PLAYER.maxZ - 1,
      vx: 0,
      vz: 0,
      hp: PLAYER.hp,
      alive: true,
      invuln: 0,
      fireT: 0,
      shots: 0,
      clears: PLAYER.clears,
      charge: 0,
      clearFx: 0,
    };
    this.boss = {
      x: 0,
      z: BOSS.z,
      tx: 0,
      t: 0,
      hp: BOSS.hp,
      phase: 1,
      alive: true,
      flash: 0,
      shield: 0,
      intro: 0,
      dieT: 0,
      dieBurst: 0,
      timers: this.phaseTimers(1),
      beam: { state: 'idle', t: 0, x: 0 },
    };
    this.minions = [];
    this.pBullets = [];
    this.eBullets = [];
    this.particles = [];
  }

  start() {
    this.reset('playing');
    this.boss.intro = BOSS.intro;
    this.boss.z = BOSS.startZ;
    this.log('claude', '/init');
  }

  setAspect(aspect) {
    FIELD.halfW = clamp(aspect * 9.5, 8.5, 13.5);
    const limit = FIELD.halfW - 0.9;
    this.player.x = clamp(this.player.x, -limit, limit);
  }

  togglePause() {
    if (this.status === 'playing') this.paused = !this.paused;
  }

  pause() {
    if (this.status === 'playing') this.paused = true;
  }

  log(who, text) {
    this.logLines.push({ who, text, at: this.clock });
    if (this.logLines.length > 6) this.logLines.shift();
  }

  hud() {
    const ended = this.status === 'won' || this.status === 'lost';
    return {
      status: this.status,
      paused: this.paused,
      hp: this.player.hp,
      clears: this.player.clears,
      boss: this.boss.hp / BOSS.hp,
      phase: this.boss.phase,
      score: this.score,
      bonus: this.bonus,
      best: this.best,
      time: this.time,
      hits: this.damageTaken,
      endVisible: ended && this.endT > END_DELAY[this.status],
      log: this.logLines.filter((l) => this.clock - l.at < 5).slice(-2),
    };
  }

  phaseTimers(phase) {
    return {
      fan: 1.1,
      row: 3.5,
      ring: 3,
      stream: 0,
      minion: phase === 2 ? 3 : 5,
      beam: 6,
      taunt: rand(8, 12),
    };
  }

  // ---------------------------------------------------------------- update

  update(rawDt) {
    if (this.paused) return;
    const dt = Math.min(rawDt, 1 / 30);
    this.clock += dt;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.stepParticles(dt);

    if (this.status === 'menu') {
      this.boss.t += dt;
      this.boss.x = Math.sin(this.boss.t * 0.45) * 4;
      return;
    }
    if (this.status === 'playing') {
      if (this.boss.intro <= 0) this.time += dt;
    } else {
      this.endT += dt;
    }
    this.stepPlayer(dt);
    this.stepBoss(dt);
    this.stepMinions(dt);
    this.stepBullets(dt);
  }

  stepPlayer(dt) {
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.clearFx = Math.max(0, p.clearFx - dt);
    if (!p.alive) return;

    const limit = FIELD.halfW - 0.9;
    const lastX = p.x;
    const lastZ = p.z;
    if (input.x === 0 && input.z === 0 && input.targetX !== null) {
      const k = 1 - Math.exp(-dt * 16);
      let dx = (input.targetX - p.x) * k;
      let dz = (input.targetZ - p.z) * k;
      const max = PLAYER.speed * 1.9 * dt;
      const len = Math.hypot(dx, dz);
      if (len > max) {
        dx *= max / len;
        dz *= max / len;
      }
      p.x += dx;
      p.z += dz;
    } else {
      const len = Math.hypot(input.x, input.z) || 1;
      const k = 1 - Math.exp(-dt * 20);
      p.vx += ((input.x / len) * PLAYER.speed - p.vx) * k;
      p.vz += ((input.z / len) * PLAYER.speed - p.vz) * k;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
    }
    p.x = clamp(p.x, -limit, limit);
    p.z = clamp(p.z, PLAYER.minZ, PLAYER.maxZ);
    p.vx = (p.x - lastX) / dt;
    p.vz = (p.z - lastZ) / dt;

    if (this.status === 'playing') {
      p.fireT -= dt;
      while (p.fireT <= 0) {
        p.fireT += PLAYER.fireEvery;
        this.pBullets.push({ x: p.x - 0.32, z: p.z - 0.8 }, { x: p.x + 0.32, z: p.z - 0.8 });
        if ((p.shots++ & 1) === 0) this.emit('shoot');
      }
    }
  }

  stepBoss(dt) {
    const b = this.boss;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt * 5);
    if (this.status === 'won') {
      this.stepBossDeath(dt);
      return;
    }
    if (!b.alive) return;

    if (b.intro > 0) {
      b.intro -= dt;
      const k = 1 - clamp(b.intro / BOSS.intro, 0, 1);
      b.z = BOSS.startZ + (BOSS.z - BOSS.startZ) * easeOut(k);
      if (b.intro <= 0) {
        b.z = BOSS.z;
        this.log('codex', LINES.phase[0]);
      }
      return;
    }

    const ratio = b.hp / BOSS.hp;
    const phase = ratio > BOSS.phaseAt[0] ? 1 : ratio > BOSS.phaseAt[1] ? 2 : 3;
    if (phase !== b.phase) this.enterPhase(phase);

    const amp = FIELD.halfW - 4.2;
    const speed = [0, 0.55, 0.75, 0.95][b.phase];
    let maxSpeed = 12;
    if (b.shield > 0) {
      b.shield -= dt;
      b.tx = 0;
      maxSpeed = 8;
    } else if (b.beam.state !== 'idle') {
      maxSpeed = 24;
    } else {
      b.tx = Math.sin(b.t * speed) * amp;
    }
    b.x += clamp(b.tx - b.x, -maxSpeed * dt, maxSpeed * dt);
    b.z = BOSS.z + Math.sin(b.t * 1.3) * 0.45;

    if (this.status === 'playing' && b.shield <= 0) this.stepAttacks(dt);
  }

  enterPhase(phase) {
    const b = this.boss;
    b.phase = phase;
    b.shield = BOSS.shield;
    b.beam.state = 'idle';
    b.timers = { ...this.phaseTimers(phase), taunt: b.timers.taunt };
    this.eBullets.length = 0;
    this.shake = 1;
    this.log('codex', LINES.phase[phase - 1]);
    this.emit('phase');
  }

  stepAttacks(dt) {
    const b = this.boss;
    const t = b.timers;
    const phase = b.phase;

    t.taunt -= dt;
    if (t.taunt <= 0) {
      t.taunt = rand(10, 14);
      this.log('codex', pick(LINES.taunt));
    }

    if (phase === 3) this.stepBeam(dt);

    if (b.beam.state === 'idle') {
      t.fan -= dt;
      if (t.fan <= 0) {
        if (phase === 1) {
          t.fan = 1.5;
          this.fan(3, 0.26, 8);
        } else if (phase === 2) {
          t.fan = 1.3;
          this.fan(5, 0.2, 8.5);
        } else {
          t.fan = 2.4;
          this.fan(3, 0.24, 8);
        }
      }
      if (phase <= 2) {
        t.row -= dt;
        if (t.row <= 0) {
          t.row = phase === 1 ? 4.2 : 6.5;
          this.row();
        }
      }
      if (phase === 2) {
        t.ring -= dt;
        if (t.ring <= 0) {
          t.ring = 3.6;
          this.ring(13, 6);
        }
      }
      if (phase === 3) {
        t.stream -= dt;
        if (t.stream <= 0) {
          t.stream = 0.13;
          this.stream();
        }
      }
    }

    if (phase >= 2) {
      t.minion -= dt;
      if (t.minion <= 0) {
        t.minion = phase === 2 ? 6 : 8;
        if (this.minions.length < 2) this.spawnMinion();
      }
    }
  }

  stepBeam(dt) {
    const b = this.boss;
    const bm = b.beam;
    const p = this.player;
    if (bm.state === 'idle') {
      b.timers.beam -= dt;
      if (b.timers.beam <= 0) {
        bm.state = 'tele';
        bm.t = 0;
        b.tx = clamp(p.x, -(FIELD.halfW - 2), FIELD.halfW - 2);
        this.emit('tele');
      }
      return;
    }
    bm.t += dt;
    bm.x = b.x;
    if (bm.state === 'tele') {
      if (bm.t >= BOSS.beamTele) {
        bm.state = 'fire';
        bm.t = 0;
        this.shake = Math.max(this.shake, 0.5);
        this.emit('beam');
      }
    } else {
      if (p.alive && p.invuln <= 0 && p.z > b.z && Math.abs(p.x - bm.x) < BOSS.beamHalf + PLAYER.radius) {
        this.hurtPlayer('beam');
      }
      if (bm.t >= BOSS.beamFire) {
        bm.state = 'idle';
        b.timers.beam = rand(7, 9);
      }
    }
  }

  stepBossDeath(dt) {
    const b = this.boss;
    if (!b.alive) return;
    b.dieT += dt;
    b.dieBurst -= dt;
    if (b.dieBurst <= 0) {
      b.dieBurst = 0.1;
      this.burst(b.x + rand(-BOSS.rx, BOSS.rx), b.z + rand(-BOSS.rz, BOSS.rz), 10, BOOM_COLORS, 7);
      this.shake = Math.max(this.shake, 0.45);
      this.emit('boom');
    }
    if (b.dieT > 2.4) {
      b.alive = false;
      this.burst(b.x, b.z, 120, BOOM_COLORS, 14);
      this.shake = 1;
      this.emit('boom');
    }
  }

  stepMinions(dt) {
    const p = this.player;
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      if (m.hp <= 0 || m.z > FIELD.bottom + 1) {
        swapRemove(this.minions, i);
        continue;
      }
      m.t += dt;
      m.z += (m.t < 1.4 ? 6 : 1.3) * dt;
      m.x = m.baseX + Math.sin(m.t * 1.8 + m.seed) * 3;
      if (this.status !== 'playing') continue;
      m.fire -= dt;
      if (m.fire <= 0) {
        m.fire = 1.7;
        this.aimed(m.x, m.z + 0.5, 8, 0.26);
      }
      if (p.alive && p.invuln <= 0 && Math.hypot(m.x - p.x, m.z - p.z) < 0.9) {
        this.hitMinion(m, 99);
        this.hurtPlayer('minion');
      }
    }
  }

  stepBullets(dt) {
    const b = this.boss;
    const p = this.player;
    const W = FIELD.halfW;
    const live = this.status === 'playing';

    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const s = this.pBullets[i];
      s.z -= PLAYER.bulletSpeed * dt;
      let used = false;
      if (live && b.alive && b.intro <= 0) {
        const dx = (s.x - b.x) / BOSS.rx;
        const dz = (s.z - b.z) / BOSS.rz;
        if (dx * dx + dz * dz < 1) {
          used = true;
          if (this.damageBoss(1, s.x, s.z)) {
            p.charge += 1;
            if (p.charge >= PLAYER.hitsPerClear) {
              p.charge = 0;
              if (p.clears < PLAYER.maxClears) {
                p.clears += 1;
                this.emit('charge');
              }
            }
          }
        }
      }
      if (!used && live) {
        for (const m of this.minions) {
          if (m.hp > 0 && Math.abs(s.x - m.x) < 0.75 && Math.abs(s.z - m.z) < 0.75) {
            used = true;
            this.hitMinion(m, 1);
            break;
          }
        }
      }
      if (used || s.z < FIELD.top - 4) swapRemove(this.pBullets, i);
    }

    let hurt = false;
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const e = this.eBullets[i];
      e.x += e.vx * dt;
      e.z += e.vz * dt;
      if (Math.abs(e.x) > W + 4 || e.z > FIELD.bottom + 3 || e.z < FIELD.top - 9) {
        swapRemove(this.eBullets, i);
        continue;
      }
      if (live && p.alive && p.invuln <= 0) {
        const dx = e.x - p.x;
        const dz = e.z - p.z;
        const r = e.r + PLAYER.radius;
        if (dx * dx + dz * dz < r * r) {
          swapRemove(this.eBullets, i);
          hurt = true;
        }
      }
    }
    if (hurt) this.hurtPlayer();
  }

  stepParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life += dt;
      if (q.life >= q.max) {
        swapRemove(this.particles, i);
        continue;
      }
      q.x += q.vx * dt;
      q.z += q.vz * dt;
      q.vy -= 9 * dt;
      q.y = Math.max(0.05, q.y + q.vy * dt);
    }
  }

  // --------------------------------------------------------------- attacks

  shot(x, z, vx, vz, r = 0.28) {
    if (this.eBullets.length < 450) this.eBullets.push({ x, z, vx, vz, r });
  }

  aimed(x, z, speed, r) {
    const a = Math.atan2(this.player.x - x, this.player.z - z);
    this.shot(x, z, Math.sin(a) * speed, Math.cos(a) * speed, r);
  }

  fan(count, spread, speed) {
    const b = this.boss;
    const base = Math.atan2(this.player.x - b.x, this.player.z - b.z);
    for (let i = 0; i < count; i++) {
      const a = base + (i - (count - 1) / 2) * spread;
      this.shot(b.x, b.z + 1.4, Math.sin(a) * speed, Math.cos(a) * speed);
    }
  }

  // A wall of bullets with a two-slot hole at a random position.
  row() {
    const b = this.boss;
    const step = 2.4;
    const count = Math.floor((2 * FIELD.halfW) / step) + 1;
    const span = (count - 1) * step;
    const gap = 1 + Math.floor(Math.random() * (count - 3));
    for (let i = 0; i < count; i++) {
      if (i === gap || i === gap + 1) continue;
      this.shot(-span / 2 + i * step, b.z + 1.8, 0, 5.2, 0.3);
    }
  }

  ring(n, speed) {
    const b = this.boss;
    for (let i = 0; i < n; i++) {
      const a = -1.75 + (i * 3.5) / (n - 1);
      this.shot(b.x, b.z + 1.2, Math.sin(a) * speed, Math.cos(a) * speed);
    }
  }

  // Two streams that sweep across the field like a pendulum.
  stream() {
    const b = this.boss;
    const a = Math.sin(b.t * 1.5) * 1.1;
    for (const off of [-0.3, 0.3]) {
      this.shot(b.x, b.z + 1.4, Math.sin(a + off) * 7.2, Math.cos(a + off) * 7.2);
    }
  }

  spawnMinion() {
    this.minions.push({
      baseX: rand(-FIELD.halfW + 4, FIELD.halfW - 4),
      x: 0,
      z: FIELD.top - 1,
      t: 0,
      hp: 5,
      fire: 1.2,
      seed: rand(0, TAU),
    });
  }

  // ---------------------------------------------------------------- damage

  damageBoss(amount, x, z) {
    const b = this.boss;
    if (this.status !== 'playing' || !b.alive || b.intro > 0) return false;
    if (b.shield > 0) {
      this.burst(x ?? b.x, z ?? b.z, 1, SPARK_COLORS, 3);
      return false;
    }
    b.hp = Math.max(0, b.hp - amount);
    b.flash = 1;
    this.score += amount * 10;
    this.burst(x ?? b.x, z ?? b.z, 2, SPARK_COLORS, 4);
    this.emit('hit');
    if (b.hp <= 0) this.killBoss();
    return true;
  }

  hitMinion(m, amount) {
    m.hp -= amount;
    if (m.hp <= 0) {
      this.score += 50;
      this.burst(m.x, m.z, 14, SPARK_COLORS, 6);
      this.emit('boom');
    } else {
      this.burst(m.x, m.z, 2, SPARK_COLORS, 3);
    }
  }

  hurtPlayer(source = 'bullet') {
    const p = this.player;
    if (!p.alive || p.invuln > 0 || this.status !== 'playing') return;
    this.hurtLog[source] = (this.hurtLog[source] || 0) + 1;
    p.hp -= 1;
    this.damageTaken += 1;
    p.invuln = PLAYER.invuln;
    this.shake = 1;
    this.burst(p.x, p.z, 16, HURT_COLORS, 7);
    for (let i = this.eBullets.length - 1; i >= 0; i--) {
      const e = this.eBullets[i];
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 < 20) swapRemove(this.eBullets, i);
    }
    if (p.hp <= 0) {
      this.killPlayer();
    } else {
      this.emit('hurt');
      this.log('claude', 'tienes toda la razón');
    }
  }

  killPlayer() {
    const p = this.player;
    p.alive = false;
    this.status = 'lost';
    this.endT = 0;
    this.boss.beam.state = 'idle';
    this.burst(p.x, p.z, 60, HURT_COLORS, 10);
    this.log('codex', 'merge completado');
    this.emit('lose');
  }

  killBoss() {
    const b = this.boss;
    this.status = 'won';
    this.endT = 0;
    b.hp = 0;
    b.dieT = 0;
    b.dieBurst = 0;
    b.beam.state = 'idle';
    this.eBullets.length = 0;
    this.minions.forEach((m) => {
      m.hp = 0;
    });
    this.player.invuln = 99;
    this.bonus = this.player.hp * 500 + Math.max(0, Math.round(3000 - this.time * 20));
    this.score += this.bonus;
    if (this.score > this.best) {
      this.best = this.score;
      writeBest(this.best);
    }
    this.log('claude', 'tests en verde');
    this.emit('win');
  }

  // The special move: wipes enemy bullets, kills minions, cancels the beam.
  useClear() {
    const p = this.player;
    if (this.status !== 'playing' || this.paused || p.clears <= 0 || p.clearFx > 0) return;
    p.clears -= 1;
    p.clearFx = PLAYER.clearTime;
    p.invuln = Math.max(p.invuln, 1.1);
    for (const e of this.eBullets) this.burst(e.x, e.z, 1, SPARK_COLORS, 3);
    this.eBullets.length = 0;
    this.minions.forEach((m) => this.hitMinion(m, 99));
    const b = this.boss;
    if (b.beam.state !== 'idle') {
      b.beam.state = 'idle';
      b.timers.beam = 5;
    }
    this.shake = Math.max(this.shake, 0.7);
    this.log('claude', '/clear');
    this.emit('clear');
    this.damageBoss(PLAYER.clearDamage);
  }

  burst(x, z, n, colors, speed = 5) {
    for (let i = 0; i < n && this.particles.length < 440; i++) {
      const a = rand(0, TAU);
      const s = rand(0.3, 1) * speed;
      this.particles.push({
        x,
        y: 0.4,
        z,
        vx: Math.cos(a) * s,
        vy: rand(1, 4),
        vz: Math.sin(a) * s,
        life: 0,
        max: rand(0.35, 0.8),
        size: rand(0.12, 0.3),
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }
}

export const game = new Engine();
