// Generated sound: short effects plus a calm pentatonic loop. No audio files.
let ctx = null;
let master = null;
let musicGain = null;
let muted = false;
let musicTimer = null;
let nextTime = 0;
let step = 0;
const last = {};

export function initAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.6;
  return muted;
}

const gate = (name, ms) => {
  const now = performance.now();
  if (now - (last[name] || 0) < ms) return false;
  last[name] = now;
  return true;
};

function tone(freq, to, dur, type = 'square', vol = 0.15, delay = 0, dest = master) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol = 0.2, cutoff = 1500) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buffer;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  click() {
    if (gate('click', 40)) tone(660, 880, 0.06, 'square', 0.08);
  },
  select() {
    if (gate('select', 40)) tone(520, 780, 0.09, 'triangle', 0.16);
  },
  deny() {
    if (gate('deny', 120)) tone(180, 120, 0.14, 'square', 0.1);
  },
  send(mine = true) {
    if (!gate('send', 90)) return;
    tone(mine ? 392 : 330, mine ? 587 : 392, 0.16, 'triangle', mine ? 0.18 : 0.05);
  },
  fight() {
    if (!gate('fight', 120)) return;
    noise(0.28, 0.16, 1100);
    tone(150, 80, 0.2, 'sawtooth', 0.06);
  },
  capture(mine = true) {
    if (!gate('capture', 150)) return;
    const v = mine ? 0.2 : 0.07;
    [523, 659, 784].forEach((f, i) => tone(f, f, 0.18, 'triangle', v, i * 0.08));
  },
  upgrade() {
    tone(220, 220, 0.07, 'square', 0.1);
    tone(220, 220, 0.07, 'square', 0.1, 0.18);
    tone(220, 220, 0.07, 'square', 0.1, 0.36);
  },
  built() {
    [659, 880, 1175].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.16, i * 0.07));
  },
  eliminated() {
    tone(260, 110, 0.5, 'sawtooth', 0.08);
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.22, i * 0.14));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.98, 0.45, 'triangle', 0.2, i * 0.22));
  },
};

// ---- music

const PENTA = [0, 2, 4, 7, 9];
const ROOTS = [48, 45, 53, 43];
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

function playStep() {
  const bar = Math.floor(step / 8) % ROOTS.length;
  const pos = step % 8;
  const root = ROOTS[bar];
  const t = nextTime - ctx.currentTime;
  if (pos === 0) {
    tone(midi(root - 12), midi(root - 12), 1.6, 'sine', 0.2, t, musicGain);
    [0, 4, 7].forEach((n) => tone(midi(root + 12 + n), midi(root + 12 + n), 2.4, 'sine', 0.05, t, musicGain));
  }
  if (pos === 4) tone(midi(root - 5), midi(root - 5), 0.8, 'sine', 0.12, t, musicGain);
  if (Math.random() < 0.62) {
    const n = PENTA[Math.floor(Math.random() * PENTA.length)] + (Math.random() < 0.3 ? 12 : 0);
    tone(midi(root + 24 + n), midi(root + 24 + n), 0.55, 'triangle', 0.09, t, musicGain);
  }
  step++;
}

export function startMusic() {
  if (!ctx || musicTimer) return;
  nextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.5) {
      playStep();
      nextTime += 60 / 78 / 2;
    }
  }, 120);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}
