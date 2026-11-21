// shots.js — staged screenshot scenes + the waypoint autopilot.
// The staging plays the real rules forward from a fresh world with a fixed
// seed, steered by a waypoint autopilot (followWaypoints / standStill /
// waitUntil, step 1/60 s), and the shot frame is frozen: in shot mode the
// loop draws but never steps the world, so the staged moment cannot walk
// away. world.invulnerable = true is set for the alarm and escape scenes
// only, so a catch cannot end the scene early; the game itself is unchanged.

import { createWorld, stepWorld } from './world.js';

const DT = 1 / 60;
const ZERO = { x: 0, y: 0, sneak: false, lure: null };

/** Input steering the player toward a point (normalised direction). */
function inputToward(world, target, sneak) {
  const dx = target.x - world.player.x;
  const dy = target.y - world.player.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return { x: 0, y: 0, sneak: !!sneak, lure: null };
  return { x: dx / d, y: dy / d, sneak: !!sneak, lure: null };
}

/**
 * Walk the waypoints in order at walk speed (or sneak), tracking the
 * highest suspicion any guard reaches and when the alarm first fires.
 * Stops early when stopWhen(world) is true, the world leaves 'play', or
 * maxSeconds elapse. Returns { seconds, maxSuspicion, alarmedAt, done }.
 */
function followWaypoints(world, waypoints, opts = {}) {
  const arrive = opts.arrive ?? 7.5;
  const maxSteps = Math.round((opts.maxSeconds ?? 120) * 60);
  let maxSuspicion = 0;
  let alarmedAt = null;
  let i = 0;
  for (let step = 0; step < maxSteps; step++) {
    if (world.state !== 'play') break;
    if (opts.stopWhen && opts.stopWhen(world)) break;
    if (i >= waypoints.length) break;
    const wp = waypoints[i];
    if (Math.hypot(wp.x - world.player.x, wp.y - world.player.y) <= arrive) {
      i++;
      continue;
    }
    stepWorld(world, inputToward(world, wp, opts.sneak || wp.sneak), DT);
    for (const g of world.guards) maxSuspicion = Math.max(maxSuspicion, g.suspicion);
    if (world.alarmed && alarmedAt === null) alarmedAt = world.time;
  }
  return { seconds: world.time, maxSuspicion, alarmedAt, done: i >= waypoints.length };
}

/** Stand still (optionally sneaking) until pred(world) or maxSeconds. */
function waitUntil(world, pred, maxSeconds, sneak) {
  let maxSuspicion = 0;
  let alarmedAt = null;
  const maxSteps = Math.round(maxSeconds * 60);
  for (let step = 0; step < maxSteps; step++) {
    if (world.state !== 'play') break;
    if (pred(world)) break;
    stepWorld(world, { x: 0, y: 0, sneak: !!sneak, lure: null }, DT);
    for (const g of world.guards) maxSuspicion = Math.max(maxSuspicion, g.suspicion);
    if (world.alarmed && alarmedAt === null) alarmedAt = world.time;
  }
  return { seconds: world.time, maxSuspicion, alarmedAt };
}

/** Stand still for `seconds` (input zero, optionally sneaking). */
function standStill(world, seconds, sneak) {
  const steps = Math.round(seconds * 60);
  let maxSuspicion = 0;
  for (let step = 0; step < steps; step++) {
    if (world.state !== 'play') break;
    stepWorld(world, { x: 0, y: 0, sneak: !!sneak, lure: null }, DT);
    for (const g of world.guards) maxSuspicion = Math.max(maxSuspicion, g.suspicion);
  }
  return { seconds: world.time, maxSuspicion };
}

const ESCAPE_ROUTE = [
  [230, 520], [230, 460], [395, 460], [395, 240], [230, 240], [230, 300],
  [150, 330], [100, 240], [100, 330], [150, 330], [230, 330], [230, 240],
  [395, 240], [395, 280], [520, 280], [520, 240], [565, 240], [730, 240],
  [730, 300], [810, 330], [860, 240], [860, 330], [810, 330], [730, 330],
  [730, 240], [565, 240], [520, 240], [520, 280], [395, 280], [395, 240],
  [340, 210], [340, 150], [480, 150], [480, 90], [480, 150], [340, 150],
  [340, 210], [395, 240], [395, 460], [230, 460], [230, 560], [480, 560],
  [480, 600],
];

/**
 * Stage one screenshot scene from a fresh world with a fixed seed.
 * Returns { world, seconds, maxSuspicion, alarmedAt }.
 * - cover: eight seconds of patrol, Sable at the front door.
 * - hide: sneak to (325,460) and wait until Marlow walks the south lane
 *   west with x in 280..380; Sable crouched behind the south-west case.
 * - alarm: walk to (480,380), stopping the moment the alarm fires, then
 *   stand 0.25 s; invulnerable so a catch cannot end the scene.
 * - escape: the whole heist on one 41-waypoint route, out the front door;
 *   invulnerable; ends on the win screen.
 */
export function stageShot(kind, seed = 1) {
  const world = createWorld(seed);
  world.state = 'play';
  if (kind === 'cover') {
    const r = standStill(world, 8, false);
    return { world, seconds: r.seconds, maxSuspicion: r.maxSuspicion, alarmedAt: null };
  }
  if (kind === 'hide') {
    const walk = followWaypoints(world, [
      { x: 230, y: 520 }, { x: 230, y: 460 }, { x: 325, y: 460 },
    ]);
    let maxSuspicion = walk.maxSuspicion;
    // Sneak and wait until Marlow walks the south lane west (targetIndex 3),
    // x in 280..380 — his cone sweeps past just north of the case.
    const wait = waitUntil(world, (w) => {
      const marlow = w.guards[0];
      return marlow.mode === 'patrol' && marlow.targetIndex === 3 && marlow.x >= 280 && marlow.x <= 380;
    }, 60, true);
    maxSuspicion = Math.max(maxSuspicion, wait.maxSuspicion);
    return { world, seconds: world.time, maxSuspicion, alarmedAt: null };
  }
  if (kind === 'alarm') {
    world.invulnerable = true;
    // Sneak the last legs: walking past Marlow's north lane would let him
    // hear the footsteps and derail his patrol, pushing the alarm minutes
    // late; sneaking keeps him on his route so he spots Sable on his first
    // south-lane pass, as the scene is meant to show.
    const walk = followWaypoints(world, [
      { x: 730, y: 520 }, { x: 730, y: 460 }, { x: 520, y: 460 },
      { x: 520, y: 420, sneak: true }, { x: 480, y: 420, sneak: true },
      { x: 480, y: 380, sneak: true },
    ], { stopWhen: (w) => w.alarmed });
    let alarmedAt = walk.alarmedAt;
    if (!world.alarmed) {
      const wait = waitUntil(world, (w) => w.alarmed, 60, false);
      if (wait.alarmedAt !== null) alarmedAt = wait.alarmedAt;
    }
    standStill(world, 0.25, false);
    return { world, seconds: world.time, maxSuspicion: walk.maxSuspicion, alarmedAt };
  }
  if (kind === 'escape') {
    world.invulnerable = true;
    const walk = followWaypoints(world, ESCAPE_ROUTE.map(([x, y]) => ({ x, y })));
    return { world, seconds: world.time, maxSuspicion: walk.maxSuspicion, alarmedAt: walk.alarmedAt };
  }
  throw new Error(`unknown shot kind: ${kind}`);
}

export const SHOT_KINDS = ['cover', 'hide', 'alarm', 'escape'];
