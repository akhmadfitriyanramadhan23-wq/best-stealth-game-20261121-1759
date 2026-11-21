// main.js — boot, game loop, keyboard + mouse, screens, shot mode.
// In shot mode (?shot=cover|hide|alarm|escape) the staged scene is drawn
// once and frozen: the loop draws but never steps the world.

import { createWorld, stepWorld } from './world.js';
import { drawWorld, fitView } from './render.js';
import { stageShot } from './shots.js';
import * as audio from './audio.js';

const DT = 1 / 60;
const FIELD_W = 960;
const FIELD_H = 640;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;
const shotKind = params.get('shot');

let world;
let ui = { toasts: [] };
let shotMode = false;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

function setStatus(text) {
  if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
}

function statusFor(world) {
  if (world.state === 'title') return 'The Amber Heist. Press Enter to begin stealing.';
  if (world.state === 'play') {
    return world.alarmed
      ? `Spotted! Run! ${world.artefactsTaken} of 3 artefacts, score ${world.score}.`
      : `${world.artefactsTaken} of 3 artefacts, score ${world.score}, ${world.lives} lives.`;
  }
  if (world.state === 'paused') return 'Paused.';
  if (world.state === 'caught') return `Caught! ${world.lives} lives left.`;
  if (world.state === 'win') return `The heist is done. Score ${world.score}.`;
  if (world.state === 'over') return `The night ends. Score ${world.score}.`;
  return '';
}

function toast(text) {
  ui.toasts.push({ text, life: 2.5 });
  if (ui.toasts.length > 3) ui.toasts.shift();
}

/** Turn world events into sounds and toasts. */
function handleEvents(world) {
  for (const ev of world.events) {
    if (ev.type === 'artefact') {
      audio.playArtefact();
      toast(`${ev.name} taken! (${world.artefactsTaken}/3)`);
    } else if (ev.type === 'gem') {
      audio.playPickup();
      toast('Gem pocketed. +50');
    } else if (ev.type === 'lure') {
      audio.playCoin();
    } else if (ev.type === 'alert') {
      audio.playAlarm();
      toast('SPOTTED — RUN!');
    } else if (ev.type === 'caught') {
      audio.playCaught();
    } else if (ev.type === 'win') {
      audio.playWin();
    } else if (ev.type === 'locked') {
      audio.playLocked();
      toast(`The front door is locked — ${ev.have}/3 artefacts.`);
    } else if (ev.type === 'step') {
      const pan = (world.player.x - FIELD_W / 2) / (FIELD_W / 2);
      audio.playFootstep(pan);
    }
  }
  world.events.length = 0;
}

function newGame() {
  world = createWorld(seed);
  world.state = 'title';
  ui.toasts = [];
  setStatus(statusFor(world));
}

// --- input -------------------------------------------------------------------

const keys = new Set();
let mouseLure = null;

function readInput() {
  let x = 0;
  let y = 0;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('w')) y -= 1;
  if (keys.has('arrowdown') || keys.has('s')) y += 1;
  const input = {
    x,
    y,
    sneak: keys.has('shift'),
    lure: mouseLure,
  };
  mouseLure = null;
  return input;
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * (canvas.width / rect.width);
  const py = (clientY - rect.top) * (canvas.height / rect.height);
  const { scale, ox, oy } = fitView(canvas);
  return { x: (px - ox) / scale, y: (py - oy) / scale };
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) e.preventDefault();
  audio.ensureAudio();
  if (key === 'enter') {
    if (world.state === 'title') {
      world.state = 'play';
    } else if (world.state === 'win' || world.state === 'over') {
      newGame();
      world.state = 'play';
    }
    return;
  }
  if (key === 'p' && (world.state === 'play' || world.state === 'paused')) {
    world.state = world.state === 'play' ? 'paused' : 'play';
    return;
  }
  if (key === 'm') {
    audio.setMuted(true);
    return;
  }
  keys.add(key);
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('pointerdown', (e) => {
  audio.ensureAudio();
  if (world.state === 'title') {
    world.state = 'play';
    return;
  }
  if (world.state === 'win' || world.state === 'over') {
    newGame();
    world.state = 'play';
    return;
  }
  if (world.state !== 'play') return;
  const p = screenToWorld(e.clientX, e.clientY);
  if (p.x >= 0 && p.x <= FIELD_W && p.y >= 0 && p.y <= FIELD_H) mouseLure = p;
});

// --- loop ----------------------------------------------------------------------

let last = performance.now();
let accumulator = 0;
let guardStepTimer = 0;

function frame(now) {
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!shotMode) {
    accumulator += elapsed;
    while (accumulator >= DT) {
      if (world.state === 'play') {
        stepWorld(world, readInput(), DT);
        handleEvents(world);
      } else if (world.state === 'caught') {
        stepWorld(world, { x: 0, y: 0, sneak: false, lure: null }, DT);
      }
      accumulator -= DT;
    }
    // Guard footsteps: the nearest moving guard within earshot ticks
    // quietly, panned to where it is — footsteps tell you where a guard is.
    guardStepTimer -= elapsed;
    if (guardStepTimer <= 0 && world.state === 'play') {
      guardStepTimer = 0.45;
      let nearest = null;
      let nearestD = Infinity;
      for (const g of world.guards) {
        const d = Math.hypot(g.x - world.player.x, g.y - world.player.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = g;
        }
      }
      if (nearest && nearestD < 260 && nearest.mode !== 'search') {
        audio.playFootstep((nearest.x - FIELD_W / 2) / (FIELD_W / 2));
      }
    }
    for (const t of ui.toasts) t.life -= elapsed;
    ui.toasts = ui.toasts.filter((t) => t.life > 0);
    setStatus(statusFor(world));
  }
  drawWorld(ctx, canvas, world, ui);
  requestAnimationFrame(frame);
}

// --- boot ----------------------------------------------------------------------

resize();
window.addEventListener('resize', resize);

if (shotKind) {
  // Shot mode: stage the scene, draw it once, freeze.
  shotMode = true;
  const staged = stageShot(shotKind, seed);
  world = staged.world;
  document.title = `The Amber Heist — ${shotKind}`;
  setStatus(`The Amber Heist, ${shotKind} scene.`);
  drawWorld(ctx, canvas, world, ui);
  requestAnimationFrame(frame);
} else {
  newGame();
  requestAnimationFrame(frame);
}
