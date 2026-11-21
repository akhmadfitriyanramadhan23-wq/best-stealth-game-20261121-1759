// world.js — the rules and state of The Amber Heist. No drawing, no browser:
// the headless logic test drives this file directly in Node.
//
// State: level, player, guards, state (title/play/paused/caught/win/over),
// score, time, lives, alarmed, alarmTimer, alarmUnseen, lastSeen,
// everAlarmed, invulnerable (staging only), events, floorLures, freshLures.

import { CAUGHT_SECONDS, GUARD, LIVES, SUSPICION } from './config.js';
import { buildLevel } from './level.js';
import { guardStep, makeGuard, sendToInvestigate } from './guards.js';
import { makePlayer, playerStep } from './player.js';
import { mulberry32 } from './random.js';

/** A fresh night: guards on their routes, Sable at the front door. */
export function createWorld(seed = 1) {
  const level = buildLevel();
  return {
    seed,
    rng: mulberry32(seed),
    level,
    player: makePlayer(level.start),
    guards: level.routes.map((def, i) => makeGuard(def, i)),
    state: 'title', // title | play | paused | caught | win | over
    score: 0,
    time: 0,
    lives: LIVES,
    artefactsTaken: 0,
    gemsTaken: 0,
    timeBonus: 0,
    ghostBonus: 0,
    alarmed: false,
    alarmTimer: 0,
    alarmUnseen: 0,
    lastSeen: { x: level.start.x, y: level.start.y },
    everAlarmed: false,
    invulnerable: false, // staging only: a catch cannot end a screenshot scene
    caughtTimer: 0,
    lockedToastAt: -99,
    events: [],
    floorLures: [], // coins on the floor, drawn with an expanding ring
    freshLures: [], // coins thrown this step, for guards to hear
    footstepTimer: 0,
  };
}

/** Raise the alarm: 7 seconds, every guard chases the last seen spot. */
export function raiseAlarm(world) {
  if (world.alarmed) return;
  world.alarmed = true;
  world.everAlarmed = true;
  world.alarmTimer = SUSPICION.alarmSeconds;
  world.alarmUnseen = 0;
  for (const guard of world.guards) {
    guard.mode = 'chase';
    guard.suspicion = 1;
  }
  world.events.push({ type: 'alert', x: world.lastSeen.x, y: world.lastSeen.y });
}

/** End the alarm: guards investigate the last seen spot, suspicion 0.6. */
function endAlarm(world) {
  world.alarmed = false;
  world.alarmTimer = 0;
  world.alarmUnseen = 0;
  for (const guard of world.guards) {
    guard.suspicion = SUSPICION.postAlarm;
    sendToInvestigate(guard, world.lastSeen);
  }
}

/** Caught: lose a life, the alarm ends, respawn at the door. */
function caught(world) {
  world.lives--;
  world.alarmed = false;
  world.alarmTimer = 0;
  world.events.push({ type: 'caught', lives: world.lives });
  if (world.lives <= 0) {
    world.state = 'over';
    return;
  }
  world.state = 'caught';
  world.caughtTimer = CAUGHT_SECONDS;
}

function respawn(world) {
  const level = world.level;
  world.player.x = level.start.x;
  world.player.y = level.start.y;
  world.player.lures = 3;
  world.floorLures = [];
  world.freshLures = [];
  world.guards = level.routes.map((def, i) => makeGuard(def, i));
  world.lastSeen = { x: level.start.x, y: level.start.y };
  world.state = 'play';
}

/**
 * Advance one fixed step (dt = 1/60 s). input: { x, y, sneak, lure }.
 * Only runs while state is 'play' (or 'caught', to count the respawn timer).
 * Pushes events for the caller to turn into sounds and toasts.
 */
export function stepWorld(world, input, dt) {
  if (world.state === 'caught') {
    world.caughtTimer -= dt;
    if (world.caughtTimer <= 0) respawn(world);
    return;
  }
  if (world.state !== 'play') return;

  world.time += dt;
  world.events.length = 0;

  // --- the player ------------------------------------------------------------
  const moved = playerStep(world.player, input, { world }, dt);
  const playerNoise = moved.noise;

  // Footstep ticks for the renderer / audio (roughly every 0.35 s walking).
  if (world.player.moving) {
    world.footstepTimer -= dt;
    if (world.footstepTimer <= 0) {
      world.footstepTimer = world.player.sneak ? 0.5 : 0.35;
      world.events.push({ type: 'step', x: world.player.x, y: world.player.y });
    }
  }

  // --- the guards --------------------------------------------------------------
  const ctx = {
    level: world.level,
    player: world.player,
    playerMoving: world.player.moving,
    playerNoise,
    freshLures: world.freshLures,
    time: world.time,
    alarmed: world.alarmed,
    lastSeen: world.lastSeen,
    raiseAlarm: () => raiseAlarm(world),
  };
  for (const guard of world.guards) {
    guardStep(guard, ctx, dt);
  }
  world.freshLures = [];

  // Lure coins age out after 2 s on the floor.
  for (const lure of world.floorLures) lure.age += dt;
  world.floorLures = world.floorLures.filter((l) => l.age < 2);

  // --- the alarm ---------------------------------------------------------------
  if (world.alarmed) {
    world.alarmTimer -= dt;
    // A guard sees the thief while the alarm is up: reset the give-up clock.
    const seenNow = world.guards.some((g) => g.sees);
    if (seenNow) world.alarmUnseen = 0;
    else world.alarmUnseen += dt;
    if (world.alarmTimer <= 0 || world.alarmUnseen >= SUSPICION.unseenGiveUp) {
      endAlarm(world);
    }
  }

  // --- caught? -------------------------------------------------------------------
  if (!world.invulnerable) {
    for (const guard of world.guards) {
      const d = Math.hypot(world.player.x - guard.x, world.player.y - guard.y);
      if (d <= GUARD.catchDistance) {
        caught(world);
        return;
      }
    }
  }

  // The player may have won inside playerStep (state 'win').
}
