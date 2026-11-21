// player.js — Sable the thief: movement, sneak, lure coins, pickups, exit.
// Rules only; no drawing, no browser.

import { PLAYER, SCORE } from './config.js';
import { circleFree, inExit, moveCircle } from './level.js';

/** A fresh player at the front door. */
export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    r: PLAYER.radius,
    sneak: false,
    lures: PLAYER.lures,
    facing: -Math.PI / 2,
    moving: false,
  };
}

/**
 * One fixed step for the player.
 * input: { x, y, sneak, lure } — x/y a -1..1 direction, lure a world point
 *        to throw a coin at (or null). Returns { noise, moved } for the
 *        guards to hear. Mutates world (pickups, exit, events) via ctx.
 * ctx: { world } — the world holds level, score, events, artefacts, gems.
 */
export function playerStep(player, input, ctx, dt) {
  const { world } = ctx;
  const level = world.level;
  player.sneak = !!input.sneak;

  // --- movement ------------------------------------------------------------
  let ix = input.x || 0;
  let iy = input.y || 0;
  const len = Math.hypot(ix, iy);
  if (len > 1) {
    ix /= len;
    iy /= len;
  }
  player.moving = len > 0.01;
  const speed = player.sneak ? PLAYER.sneak : PLAYER.walk;
  if (player.moving) {
    const moved = moveCircle(level, player.x, player.y, ix * speed * dt, iy * speed * dt, player.r);
    player.x = moved.x;
    player.y = moved.y;
    player.facing = Math.atan2(iy, ix);
  }

  // --- lure coin ------------------------------------------------------------
  if (input.lure && player.lures > 0) {
    const dx = input.lure.x - player.x;
    const dy = input.lure.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= PLAYER.lureRange && dist > 4) {
      const tx = input.lure.x;
      const ty = input.lure.y;
      if (circleFree(level, tx, ty, 4)) {
        player.lures--;
        world.floorLures.push({ x: tx, y: ty, age: 0 });
        world.freshLures.push({ x: tx, y: ty });
        world.events.push({ type: 'lure', x: tx, y: ty });
      }
    }
  }

  // --- pickups ---------------------------------------------------------------
  for (const a of level.artifacts) {
    if (!a.taken && Math.hypot(a.x - player.x, a.y - player.y) <= PLAYER.pickupRange) {
      a.taken = true;
      world.artefactsTaken++;
      world.score += SCORE.artefact;
      world.events.push({ type: 'artefact', name: a.name, x: a.x, y: a.y });
    }
  }
  for (const g of level.gems) {
    if (!g.taken && Math.hypot(g.x - player.x, g.y - player.y) <= PLAYER.pickupRange) {
      g.taken = true;
      world.gemsTaken++;
      world.score += SCORE.gem;
      world.events.push({ type: 'gem', x: g.x, y: g.y });
    }
  }

  // --- exit -------------------------------------------------------------------
  if (inExit(level, player.x, player.y)) {
    if (world.artefactsTaken >= 3) {
      const timeBonus = Math.max(0, Math.round((SCORE.timeBonusSeconds - world.time) * SCORE.timeBonusPerSecond));
      world.score += timeBonus;
      world.timeBonus = timeBonus;
      if (!world.everAlarmed) {
        world.score += SCORE.ghost;
        world.ghostBonus = SCORE.ghost;
      }
      // The night is over: the alarm dies with it, so the win screen is
      // not wearing the SPOTTED banner.
      world.alarmed = false;
      world.alarmTimer = 0;
      world.state = 'win';
      world.events.push({ type: 'win', score: world.score });
    } else if (world.time - world.lockedToastAt > 3) {
      world.lockedToastAt = world.time;
      world.events.push({ type: 'locked', have: world.artefactsTaken });
    }
  }

  const noise = player.moving ? (player.sneak ? PLAYER.noiseSneak : PLAYER.noiseWalk) : 0;
  return { noise, moved: player.moving };
}
