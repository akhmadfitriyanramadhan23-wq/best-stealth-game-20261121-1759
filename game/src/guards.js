// guards.js — Guard: patrol / investigate / return / chase, vision cone,
// suspicion. Pure rules over the level; no drawing, no browser.

import { GUARD, SUSPICION } from './config.js';
import { inLamp, lineOfSight, moveCircle } from './level.js';

/** Smallest signed angle from a to b, in [-PI, PI]. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** A guard standing at the first waypoint of its loop, facing east. */
export function makeGuard(def, index) {
  const first = def.route[0];
  return {
    name: def.name,
    color: def.color,
    speed: def.speed,
    pause: def.pause,
    route: def.route,
    x: first.x,
    y: first.y,
    angle: 0,
    waitAngle: 0,
    mode: 'patrol', // patrol | investigate | search | return | chase
    targetIndex: 1, // next waypoint on the loop
    pauseTimer: 0,
    scanPhase: index * 1.7,
    suspicion: 0,
    sees: false,
    investigate: null, // {x, y} the guard is walking to look at
    searchTimer: 0,
    stuckTimer: 0,
    lastDist: Infinity,
  };
}

/** Whether the guard can see the player: inside the cone AND line of sight clear. */
export function guardSeesPlayer(guard, player, level) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > GUARD.coneRange) return false;
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, guard.angle)) > GUARD.halfAngle) return false;
  return lineOfSight(level, guard.x, guard.y, player.x, player.y);
}

/** Distance to a point. */
function distTo(guard, p) {
  return Math.hypot(p.x - guard.x, p.y - guard.y);
}

/** Walk toward a point at `speed`, sliding around cover: when the direct
 * move is blocked outright, sidestep perpendicular to the desired direction
 * (one side, then the other) instead of pushing at the obstacle forever. */
function walkToward(guard, level, target, speed, dt) {
  const dx = target.x - guard.x;
  const dy = target.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return 0;
  const step = Math.min(dist, speed * dt);
  const ux = dx / dist;
  const uy = dy / dist;
  const moved = moveCircle(level, guard.x, guard.y, ux * step, uy * step, GUARD.radius);
  let travelled = Math.hypot(moved.x - guard.x, moved.y - guard.y);
  if (travelled < step * 0.05) {
    // Blocked outright: try sidestepping perpendicular, one side then the other.
    const side1 = moveCircle(level, guard.x, guard.y, -uy * step, ux * step, GUARD.radius);
    const t1 = Math.hypot(side1.x - guard.x, side1.y - guard.y);
    if (t1 > travelled) {
      guard.x = side1.x;
      guard.y = side1.y;
      travelled = t1;
    } else {
      const side2 = moveCircle(level, guard.x, guard.y, uy * step, -ux * step, GUARD.radius);
      const t2 = Math.hypot(side2.x - guard.x, side2.y - guard.y);
      if (t2 > travelled) {
        guard.x = side2.x;
        guard.y = side2.y;
        travelled = t2;
      }
    }
  } else {
    guard.x = moved.x;
    guard.y = moved.y;
  }
  return travelled;
}

/** Index of the route waypoint nearest the guard. */
function nearestWaypoint(guard) {
  let best = 0;
  let bestDist = Infinity;
  guard.route.forEach((wp, i) => {
    const d = Math.hypot(wp.x - guard.x, wp.y - guard.y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

/** Send a guard to investigate a point (from patrol, return or search). */
export function sendToInvestigate(guard, point) {
  guard.mode = 'investigate';
  guard.investigate = { x: point.x, y: point.y };
  guard.stuckTimer = 0;
  guard.lastDist = Infinity;
}

/**
 * One fixed step for one guard.
 * ctx: { level, player, playerMoving, playerNoise, freshLures, time,
 *        alarmed, lastSeen, raiseAlarm }
 */
export function guardStep(guard, ctx, dt) {
  const { level, player } = ctx;

  // --- watching: suspicion rises in the cone, decays unseen ---------------
  const seen = guardSeesPlayer(guard, player, level);
  guard.sees = seen;
  if (seen) {
    const dist = Math.hypot(player.x - guard.x, player.y - guard.y);
    let rate = SUSPICION.base * Math.max(0.2, 1 - (dist / GUARD.coneRange) * 0.65);
    if (inLamp(level, player.x, player.y)) rate *= SUSPICION.lampMultiplier;
    if (player.sneak) rate *= SUSPICION.sneakMultiplier;
    guard.suspicion = Math.min(1.2, guard.suspicion + rate * dt);
    ctx.lastSeen.x = player.x;
    ctx.lastSeen.y = player.y;
    if (guard.suspicion >= SUSPICION.alarmAt) {
      ctx.raiseAlarm();
    } else if (guard.suspicion >= SUSPICION.investigateAt && guard.mode === 'patrol') {
      sendToInvestigate(guard, ctx.lastSeen);
    }
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - SUSPICION.decay * dt);
  }

  // --- hearing: footsteps and lure coins -----------------------------------
  if (!seen && guard.mode === 'patrol') {
    if (ctx.playerMoving) {
      const d = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (d < ctx.playerNoise) sendToInvestigate(guard, { x: player.x, y: player.y });
    }
    for (const lure of ctx.freshLures) {
      const d = Math.hypot(lure.x - guard.x, lure.y - guard.y);
      if (d < 140) {
        sendToInvestigate(guard, lure);
        break;
      }
    }
  }

  // --- movement by mode -----------------------------------------------------
  if (guard.mode === 'patrol') {
    if (guard.pauseTimer > 0) {
      guard.pauseTimer -= dt;
      guard.angle = guard.waitAngle + Math.sin(ctx.time * 2.2 + guard.scanPhase) * 0.7;
      if (guard.pauseTimer <= 0) guard.angle = guard.waitAngle;
      return;
    }
    const target = guard.route[guard.targetIndex];
    const before = distTo(guard, target);
    const travelled = walkToward(guard, level, target, guard.speed, dt);
    if (travelled > 0.01) {
      guard.angle = Math.atan2(target.y - guard.y, target.x - guard.x);
    }
    if (distTo(guard, target) < 2) {
      guard.pauseTimer = guard.pause;
      guard.waitAngle = guard.angle;
      guard.targetIndex = (guard.targetIndex + 1) % guard.route.length;
    } else if (before - distTo(guard, target) < 0.001 && travelled < 0.01) {
      // Pushed at an obstacle: nudge the patrol on (routes are clear lanes,
      // so this only fires if something unexpected blocks the way).
      guard.targetIndex = (guard.targetIndex + 1) % guard.route.length;
    }
  } else if (guard.mode === 'chase') {
    walkToward(guard, level, ctx.lastSeen, guard.speed * GUARD.chaseMultiplier, dt);
    if (distTo(guard, ctx.lastSeen) > 4) {
      guard.angle = Math.atan2(ctx.lastSeen.y - guard.y, ctx.lastSeen.x - guard.x);
    }
  } else if (guard.mode === 'investigate') {
    const target = guard.investigate;
    const d = distTo(guard, target);
    if (d < 6) {
      guard.mode = 'search';
      guard.searchTimer = SUSPICION.searchSeconds;
      guard.waitAngle = guard.angle;
      return;
    }
    // Stuck fix: no progress toward the point for 2 s -> search where we stand.
    if (d >= guard.lastDist - 0.01) {
      guard.stuckTimer += dt;
      if (guard.stuckTimer >= SUSPICION.stuckSeconds) {
        guard.mode = 'search';
        guard.searchTimer = SUSPICION.searchSeconds;
        guard.waitAngle = guard.angle;
        return;
      }
    } else {
      guard.stuckTimer = 0;
    }
    guard.lastDist = d;
    walkToward(guard, level, target, guard.speed, dt);
    if (distTo(guard, target) > 4) {
      guard.angle = Math.atan2(target.y - guard.y, target.x - guard.x);
    }
  } else if (guard.mode === 'search') {
    guard.searchTimer -= dt;
    guard.angle = guard.waitAngle + Math.sin(ctx.time * 2.2 + guard.scanPhase) * 0.9;
    if (guard.searchTimer <= 0) {
      guard.mode = 'return';
      guard.angle = guard.waitAngle;
    }
  } else if (guard.mode === 'return') {
    const nearest = nearestWaypoint(guard);
    const target = guard.route[nearest];
    walkToward(guard, level, target, guard.speed, dt);
    if (distTo(guard, target) < 2) {
      guard.mode = 'patrol';
      guard.targetIndex = (nearest + 1) % guard.route.length;
    }
  }
}
