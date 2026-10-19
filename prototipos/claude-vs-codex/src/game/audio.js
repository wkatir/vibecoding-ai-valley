// Tiny WebAudio synth. No asset files, everything is generated on the fly.
let ctx = null;
let master = null;
let muted = false;
const lastPlayed = {};

export function initAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.2;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.2;
  return muted;
}

const gate = (name, ms) => {
  const now = performance.now();
  if (now - (lastPlayed[name] || 0) < ms) return false;
  lastPlayed[name] = now;
  return true;
};

function tone(from, to, dur, type = 'square', vol = 0.3, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 20), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur);
}

function noise(dur, vol = 0.4, cutoff = 1800) {
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
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  shoot() {
    if (gate('shoot', 90)) tone(880 + Math.random() * 120, 360, 0.06, 'square', 0.04);
  },
  hit() {
    if (gate('hit', 70)) tone(220, 110, 0.05, 'triangle', 0.1);
  },
  hurt() {
    noise(0.35, 0.5, 900);
    tone(160, 50, 0.3, 'sawtooth', 0.3);
  },
  boom() {
    if (gate('boom', 80)) noise(0.25, 0.35, 1400);
  },
  clear() {
    tone(300, 1200, 0.4, 'sine', 0.35);
    noise(0.4, 0.2, 3000);
  },
  charge() {
    tone(600, 900, 0.12, 'triangle', 0.2);
    tone(900, 1300, 0.12, 'triangle', 0.2, 0.1);
  },
  phase() {
    tone(110, 55, 0.8, 'sawtooth', 0.35);
    noise(0.6, 0.4, 600);
  },
  tele() {
    tone(440, 440, 0.1, 'square', 0.1);
    tone(440, 440, 0.1, 'square', 0.1, 0.25);
    tone(440, 440, 0.1, 'square', 0.1, 0.5);
  },
  beam() {
    tone(90, 55, 0.8, 'sawtooth', 0.4);
    noise(0.8, 0.3, 500);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.25, 'triangle', 0.3, i * 0.12));
  },
  lose() {
    tone(300, 60, 1, 'sawtooth', 0.4);
    noise(0.8, 0.5, 700);
  },
};
