// config.js — every tuning number, the level geometry and the guard routes
// for The Amber Heist. One place to tune the whole night.

export const FIELD = { W: 960, H: 640 };

export const PLAYER = {
  radius: 12,
  walk: 150, // px/s
  sneak: 78, // px/s
  noiseWalk: 95, // px — how far a walking thief is heard
  noiseSneak: 28,
  lures: 3, // coins carried
  lureRange: 280, // px — how far a coin can be thrown
  lureNoise: 140, // px — how far a landing coin is heard
  pickupRange: 26, // px — artefact / gem pickup distance
};

export const GUARD = {
  radius: 13,
  coneRange: 175, // px
  halfAngle: 0.62, // rad
  catchDistance: 18, // px
  chaseMultiplier: 1.7, // x patrol speed while chasing
};

export const SUSPICION = {
  base: 1.4, // per second at point blank
  lampMultiplier: 1.6, // easier to spot in a lamp pool
  sneakMultiplier: 0.5, // harder to spot while sneaking
  decay: 0.3, // per second while unseen
  investigateAt: 0.35, // suspicion that sends a guard to look
  alarmAt: 1.0, // suspicion that raises the alarm
  alarmSeconds: 7, // how long the alarm lasts
  unseenGiveUp: 2.5, // seconds unseen before the alarm ends early
  searchSeconds: 2, // how long an investigating guard searches on arrival
  postAlarm: 0.6, // suspicion guards keep after an alarm ends
  stuckSeconds: 2, // no progress while investigating -> give up
};

export const SCORE = {
  artefact: 500,
  gem: 50,
  ghost: 1000, // never alarmed
  timeBonusSeconds: 600,
  timeBonusPerSecond: 5,
};

export const LIVES = 3;
export const CAUGHT_SECONDS = 1.8; // caught screen before respawn

export const START = { x: 480, y: 565 };
export const EXIT = { x: 450, y: 588, w: 60, h: 32 };

// Walls: [x, y, w, h]. Outer border 20 px thick; the top band is solid
// except the north vault's opening (x 320..640); the vault's bottom wall
// has doorways at x 300..360 and x 600..660; the wing dividers and the
// entrance divider each leave doorways.
export const WALLS = [
  // Outer border
  [0, 0, 960, 20], [0, 620, 960, 20], [0, 0, 20, 640], [940, 0, 20, 640],
  // Top band, solid except the north vault's opening (x 320..640)
  [20, 20, 300, 160], [640, 20, 300, 160],
  // Vault's bottom wall (y 180), doorways at x 300..360 and x 600..660
  [180, 180, 120, 20], [360, 180, 240, 20], [660, 180, 120, 20],
  // West divider (x 180), doorway at y 300..360
  [180, 180, 20, 120], [180, 360, 20, 140],
  // East divider (x 760), doorway at y 300..360
  [760, 180, 20, 120], [760, 360, 20, 140],
  // Entrance divider (y 500), doorways at x 200..260 and x 700..760
  [20, 500, 180, 20], [260, 500, 440, 20], [760, 500, 180, 20],
];

// Cover: [x, y, w, h, kind] — blocks sight and movement.
export const COVER = [
  // Central cases
  [280, 260, 90, 40, 'case'], [590, 260, 90, 40, 'case'],
  [280, 400, 90, 40, 'case'], [590, 400, 90, 40, 'case'],
  [420, 330, 120, 36, 'case'], // the long case in the middle
  // Central pillars — stand OFF the patrol lanes
  [467, 227, 26, 26, 'pillar'], [467, 447, 26, 26, 'pillar'],
  // West wing cases, against the west wall
  [25, 300, 40, 110, 'case'], [25, 420, 40, 36, 'case'],
  // East wing cases, against the east wall
  [895, 300, 40, 110, 'case'], [895, 420, 40, 36, 'case'],
  // Vault cases flanking the Amber Idol
  [380, 60, 50, 50, 'case'], [530, 60, 50, 50, 'case'],
];

// Lamp pools: [x, y, r] — standing in one makes the thief easier to spot.
export const LIGHTS = [
  [480, 100, 120], [300, 340, 120], [660, 340, 120],
  [100, 320, 110], [860, 320, 110], [480, 565, 120], [480, 240, 100],
];

export const ARTIFACTS = [
  { name: 'Jade Mask', x: 100, y: 240, color: '#4ade80' },
  { name: 'Star Sapphire', x: 860, y: 240, color: '#60a5fa' },
  { name: 'Amber Idol', x: 480, y: 90, color: '#f59e0b' },
];

export const GEMS = [
  { x: 380, y: 340 }, // in the lamplight between two cases — a risky grab
  { x: 100, y: 460 },
  { x: 860, y: 460 },
  { x: 620, y: 120 },
];

// Guard routes — loops in clear lanes, never through a wall or a case.
export const GUARD_ROUTES = [
  {
    name: 'Marlow', color: '#2e3a5c', speed: 55, pause: 1.2,
    route: [[230, 315], [730, 315], [730, 385], [230, 385]],
  },
  {
    name: 'Iris', color: '#3a2e5c', speed: 50, pause: 1.5,
    route: [[100, 220], [100, 460], [150, 460], [150, 220]],
  },
  {
    name: 'Bram', color: '#2e4a3a', speed: 50, pause: 1.5,
    route: [[860, 220], [860, 460], [810, 460], [810, 220]],
  },
  {
    name: 'Wren', color: '#5c2e3a', speed: 60, pause: 1.0,
    route: [[340, 130], [620, 130], [620, 160], [340, 160]],
  },
];
