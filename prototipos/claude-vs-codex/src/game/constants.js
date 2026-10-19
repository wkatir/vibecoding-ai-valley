export const COLORS = {
  ground: '#0f1319',
  ink: '#e6e1d8',
  claude: '#d97757',
  claudeDark: '#a9553a',
  claudeLight: '#f2a27f',
  flame: '#ffb454',
  codex: '#6c63ff',
  codexLight: '#a9a4ff',
  panel: '#07080c',
  screen: '#f4f3ff',
  warn: '#ffc857',
  danger: '#ff5c5c',
};

// Play area in world units. halfW is adjusted to the screen aspect at runtime.
export const FIELD = { halfW: 13, top: -11, bottom: 8 };

export const PLAYER = {
  hp: 5,
  speed: 15,
  minZ: -1.5,
  maxZ: 7,
  radius: 0.28,
  fireEvery: 0.16,
  bulletSpeed: 36,
  invuln: 1.6,
  clears: 2,
  maxClears: 3,
  hitsPerClear: 40,
  clearTime: 0.7,
  clearDamage: 12,
};

export const BOSS = {
  hp: 600,
  z: -7.5,
  startZ: -20,
  rx: 3.6,
  rz: 2.5,
  intro: 3,
  shield: 1.4,
  phaseAt: [0.66, 0.33],
  beamTele: 1.1,
  beamFire: 0.8,
  beamHalf: 0.85,
};
