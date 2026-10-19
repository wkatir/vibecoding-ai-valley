// Factions. "art" colors are used by the sprite factory.
export const FACTIONS = [
  {
    id: 0,
    key: 'claude',
    name: 'Claude',
    maker: 'Anthropic',
    home: 'Aldea Claude',
    trait: 'Defensa firme',
    desc: 'Sus pueblos resisten un 12% más.',
    defense: 1.12,
    attack: 1,
    speed: 1,
    prod: 1,
    upgrade: 1,
    art: { roof: '#d97757', roofD: '#a9553a', roofL: '#f2a27f', wall: '#f3e6cf', wallD: '#d6c09a', accent: '#fff6e8', cloth: '#d97757' },
  },
  {
    id: 1,
    key: 'codex',
    name: 'Codex',
    maker: 'OpenAI',
    home: 'Nube Codex',
    trait: 'Marcha veloz',
    desc: 'Sus tropas caminan un 20% más rápido.',
    defense: 1,
    attack: 1,
    speed: 1.2,
    prod: 1,
    upgrade: 1,
    art: { roof: '#6c63ff', roofD: '#4a43c9', roofL: '#a9a4ff', wall: '#ebe9fb', wallD: '#c7c2ee', accent: '#ffffff', cloth: '#6c63ff' },
  },
  {
    id: 2,
    key: 'grok',
    name: 'Grok',
    maker: 'xAI',
    home: 'Fuerte Grok',
    trait: 'Ataque directo',
    desc: 'Sus tropas pegan un 10% más fuerte.',
    defense: 1,
    attack: 1.1,
    speed: 1,
    prod: 1,
    upgrade: 1,
    art: { roof: '#3a3a46', roofD: '#1f1f27', roofL: '#686878', wall: '#a2a2b0', wallD: '#7c7c8b', accent: '#ffffff', cloth: '#2b2b34' },
  },
  {
    id: 3,
    key: 'meta',
    name: 'Muse',
    maker: 'Meta',
    home: 'Villa Muse',
    trait: 'Escala rápido',
    desc: 'Sus pueblos producen un 12% más.',
    defense: 1,
    attack: 1,
    speed: 1,
    prod: 1.12,
    upgrade: 1,
    art: { roof: '#2d7cf6', roofD: '#1c58c0', roofL: '#7db3ff', wall: '#f1f5fb', wallD: '#cdd8ea', accent: '#ffffff', cloth: '#2d7cf6' },
  },
  {
    id: 4,
    key: 'gemini',
    name: 'Gemini',
    maker: 'Google',
    home: 'Estrella Gemini',
    trait: 'Obra barata',
    desc: 'Mejorar casas cuesta un 20% menos.',
    defense: 1,
    attack: 1,
    speed: 1,
    prod: 1,
    upgrade: 0.8,
    art: { roof: '#17b3a3', roofD: '#0f857a', roofL: '#6fe0d4', wall: '#e5f6f2', wallD: '#bcdcd5', accent: '#ffffff', cloth: '#17b3a3' },
  },
];

export const NEUTRAL_ART = {
  roof: '#d9b45a',
  roofD: '#a8842f',
  roofL: '#efd48a',
  wall: '#cfa670',
  wallD: '#a37c49',
  accent: '#ffffff',
  cloth: '#cfc7b4',
};

// Index = level. cost = troops needed to go from this level to the next.
export const LEVELS = [
  null,
  { capacity: 30, prod: 0.5, defense: 1.0, cost: 18 },
  { capacity: 55, prod: 0.85, defense: 1.15, cost: 36 },
  { capacity: 90, prod: 1.3, defense: 1.3, cost: null },
];

export const BUILD_TIME = 3.2;
export const BASE_SPEED = 34; // logical px per second
export const DAY_LENGTH = 150; // seconds

export const DIFFICULTY = {
  easy: { label: 'Tranquilo', think: 3.4, prod: 0.85, ratio: 1.15 },
  normal: { label: 'Normal', think: 2.1, prod: 1, ratio: 1 },
  hard: { label: 'Difícil', think: 1.25, prod: 1.12, ratio: 0.92 },
};

export const VILLAGE_NAMES = [
  'Puente Prompt',
  'Valle Token',
  'Colina Caché',
  'Lago Contexto',
  'Molino Gradiente',
  'Bosque Tensor',
  'Granja GPU',
  'Puerto API',
  'Cumbre Latencia',
  'Río Embedding',
  'Aldea Beta',
  'Campo Dataset',
  'Paso Backprop',
  'Mirador Logits',
];
