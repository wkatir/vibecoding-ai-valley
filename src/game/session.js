import { World } from './engine.js';
import { Renderer, chooseSize } from '../render/renderer.js';
import { Art } from '../render/art.js';
import { FACTIONS, LEVELS } from './constants.js';
import { sfx } from './audio.js';

// Glues the world, the renderer and pointer input together. Lives outside React.
export class Session {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.art = new Art();
    this.world = null;
    this.renderer = null;
    this.selected = -1;
    this.hover = -1;
    this.drag = null;
    this.pointer = { x: 0, y: 0, inside: false, mouse: false };
    this.sendPct = 0.5;
    this.log = [];
    this.mode = 'attract';
    this.clock = 0;
  }

  get playing() {
    return this.mode === 'play' && this.world && this.world.status === 'playing';
  }

  measure() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    return { w: Math.max(1, rect.width), h: Math.max(1, rect.height), dpr };
  }

  newWorld({ player = -1, difficulty = 'normal', seed = Math.floor(Math.random() * 1e6) + 1 } = {}) {
    const m = this.measure();
    const size = chooseSize(m.w, m.h);
    this.renderer?.destroy();
    this.world = new World({ w: size.w, h: size.h, seed, player, difficulty, portrait: size.portrait });
    this.portrait = size.portrait;
    this.renderer = new Renderer(this.world, this.art);
    this.mode = player >= 0 ? 'play' : 'attract';
    this.selected = -1;
    this.hover = -1;
    this.drag = null;
    this.log = [];
    this.world.on((type, data) => this.onWorld(type, data));
    this.resize();
  }

  resize() {
    const m = this.measure();
    this.canvas.width = Math.floor(m.w * m.dpr);
    this.canvas.height = Math.floor(m.h * m.dpr);
    this.renderer?.resize(m.w, m.h, m.dpr);
    this.measured = m;
  }

  // ---- events from the world

  onWorld(type, d) {
    const w = this.world;
    const me = w.player;
    const name = (id) => FACTIONS[id].name;
    const place = (id) => w.villages[id].name;
    const line = (text, faction, mine) => {
      this.log.push({ at: this.clock, text, faction, mine });
      if (this.log.length > 8) this.log.shift();
    };
    if (type === 'capture') {
      const mine = d.faction === me || d.from === me;
      if (d.from >= 0) line(`${name(d.faction)} arrebató ${place(d.vid)} a ${name(d.from)}`, d.faction, mine);
      else line(`${name(d.faction)} tomó ${place(d.vid)}`, d.faction, mine);
      if (this.mode === 'play') sfx.capture(d.faction === me);
    } else if (type === 'eliminated') {
      line(`${name(d.faction)} se quedó sin pueblos`, d.faction, d.faction === me);
      if (this.mode === 'play') sfx.eliminated();
    } else if (type === 'fight' && this.mode === 'play') {
      sfx.fight();
    } else if (type === 'send' && this.mode === 'play') {
      sfx.send(d.faction === me);
    } else if (type === 'upgraded' && this.mode === 'play' && d.faction === me) {
      sfx.built();
    } else if (type === 'upgradeStart' && this.mode === 'play' && d.faction === me) {
      sfx.upgrade();
    } else if (type === 'won') {
      sfx.win();
    } else if (type === 'lost') {
      sfx.lose();
    }
    if (type === 'capture' && this.selected === d.vid && w.villages[d.vid].owner !== me) this.selected = -1;
  }

  // ---- frame

  frame(dt) {
    if (!this.world) return;
    dt = Math.max(0, dt);
    this.clock += dt;
    this.world.update(dt);
    this.renderer.update(this.world.paused ? 0 : dt);
    const target = this.drag?.moved ? this.hover : this.selected >= 0 ? this.hover : -1;
    this.renderer.draw({ selected: this.selected, hover: this.pointer.mouse ? this.hover : -1, target });
    this.renderer.present(this.ctx);
  }

  // ---- input

  logical(e) {
    const rect = this.canvas.getBoundingClientRect();
    return this.renderer.toLogical(e.clientX - rect.left, e.clientY - rect.top);
  }

  pointerDown(e) {
    if (!this.renderer) return;
    this.pointer.mouse = e.pointerType === 'mouse';
    const p = this.logical(e);
    const vid = this.renderer.pick(p.x, p.y);
    this.hover = vid;
    if (!this.playing) return;
    const w = this.world;
    if (vid >= 0 && w.villages[vid].owner === w.player) {
      this.drag = { src: vid, moved: false, wasSelected: this.selected === vid, x: p.x, y: p.y };
      this.selected = vid;
      sfx.select();
    } else if (vid >= 0 && this.selected >= 0) {
      this.order(this.selected, vid);
    } else if (vid >= 0) {
      this.inspect = vid;
    } else {
      this.selected = -1;
    }
  }

  pointerMove(e) {
    if (!this.renderer) return;
    this.pointer = { x: e.clientX, y: e.clientY, inside: true, mouse: e.pointerType === 'mouse' };
    const p = this.logical(e);
    this.hover = this.renderer.pick(p.x, p.y);
    if (this.drag && Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 6) this.drag.moved = true;
  }

  pointerUp() {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.moved) {
      if (this.hover >= 0 && this.hover !== d.src) this.order(d.src, this.hover);
    } else if (d.wasSelected) {
      this.selected = -1;
    }
  }

  pointerLeave() {
    this.pointer.inside = false;
    this.hover = -1;
  }

  order(src, dst) {
    if (!this.playing) return false;
    const ok = this.world.sendFrom(src, dst, this.sendPct, this.world.player);
    if (!ok) sfx.deny();
    return ok;
  }

  setPct(p) {
    this.sendPct = p;
    sfx.click();
  }

  upgradeSelected() {
    if (this.selected < 0 || !this.playing) return false;
    const ok = this.world.upgrade(this.selected, this.world.player);
    if (!ok) sfx.deny();
    return ok;
  }

  deselect() {
    this.selected = -1;
  }

  togglePause() {
    if (this.mode === 'play' && this.world.status === 'playing') this.world.paused = !this.world.paused;
  }

  setSpeed(s) {
    if (this.world) this.world.speed = s;
    sfx.click();
  }

  // ---- data for the HUD

  villageInfo(id) {
    const w = this.world;
    const v = w.villages[id];
    const lv = LEVELS[v.level];
    return {
      id,
      name: v.name,
      owner: v.owner,
      mine: v.owner === w.player,
      level: v.level,
      troops: Math.floor(v.troops),
      capacity: lv.capacity,
      prod: w.productionOf(v),
      building: v.building > 0,
      upgradeCost: w.upgradeCost(v, w.player >= 0 ? w.player : 0),
      canUpgrade: w.player >= 0 && w.canUpgrade(v, w.player),
    };
  }

  snapshot() {
    const w = this.world;
    if (!w) return null;
    const hourF = w.timeOfDay * 24;
    const stats = w.stats();
    return {
      mode: this.mode,
      status: w.status,
      paused: w.paused,
      speed: w.speed,
      day: w.day,
      hour: Math.floor(hourF),
      minute: Math.floor((hourF % 1) * 60),
      player: w.player,
      stats,
      alive: w.alive.slice(),
      villageCount: w.villages.length,
      time: w.t,
      sendPct: this.sendPct,
      portrait: this.portrait,
      selected: this.selected >= 0 ? this.villageInfo(this.selected) : null,
      hover: this.hover >= 0 && this.pointer.mouse && this.pointer.inside ? { ...this.villageInfo(this.hover), x: this.pointer.x, y: this.pointer.y } : null,
      log: this.log.filter((l) => this.clock - l.at < 9).slice(-4),
    };
  }
}
