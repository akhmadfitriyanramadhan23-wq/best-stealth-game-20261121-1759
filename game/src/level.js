// level.js — rect / circle / segment geometry, line of sight, axis-separated
// circle movement, and the level builder. No drawing, no browser.

import { ARTIFACTS, COVER, EXIT, FIELD, GEMS, GUARD_ROUTES, LIGHTS, START, WALLS } from './config.js';

/** The level: walls and cover as rects, lamps, pickups, routes, exit, start. */
export function buildLevel() {
  return {
    field: FIELD,
    walls: WALLS.map(([x, y, w, h]) => ({ x, y, w, h })),
    cover: COVER.map(([x, y, w, h, kind]) => ({ x, y, w, h, kind })),
    lights: LIGHTS.map(([x, y, r]) => ({ x, y, r })),
    artifacts: ARTIFACTS.map((a) => ({ ...a, taken: false })),
    gems: GEMS.map((g) => ({ ...g, taken: false })),
    routes: GUARD_ROUTES.map((r) => ({
      name: r.name, color: r.color, speed: r.speed, pause: r.pause,
      route: r.route.map(([x, y]) => ({ x, y })),
    })),
    exit: { ...EXIT },
    start: { ...START },
  };
}

/** Every solid rect in the level: walls + cover. */
export function solidRects(level) {
  return level.walls.concat(level.cover);
}

/** Whether a circle at (x, y) with radius r touches any solid rect or leaves the field. */
export function circleHitsSolid(level, x, y, r) {
  if (x - r < 0 || y - r < 0 || x + r > level.field.W || y + r > level.field.H) return true;
  for (const rect of solidRects(level)) {
    const cx = Math.max(rect.x, Math.min(x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(y, rect.y + rect.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/** Whether a circle can stand at (x, y): no solid in the way. */
export function circleFree(level, x, y, r) {
  return !circleHitsSolid(level, x, y, r);
}

/** Whether a point is inside a rect (edges count). */
function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

/** Whether segment (x1,y1)-(x2,y2) hits a rect (slab test). */
function segmentHitsRect(x1, y1, x2, y2, rect) {
  if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  for (const [p, d, lo, hi] of [
    [x1, dx, rect.x, rect.x + rect.w],
    [y1, dy, rect.y, rect.y + rect.h],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (p < lo || p > hi) return false;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

/** Whether a segment is blocked by any wall or cover rect. */
export function segmentBlocked(level, x1, y1, x2, y2) {
  for (const rect of solidRects(level)) {
    if (segmentHitsRect(x1, y1, x2, y2, rect)) return true;
  }
  return false;
}

/** Clear line of sight between two points (walls + cover block sight). */
export function lineOfSight(level, x1, y1, x2, y2) {
  return !segmentBlocked(level, x1, y1, x2, y2);
}

/**
 * Move a circle by (dx, dy) with axis separation: try x, then y, so the
 * circle slides along walls instead of sticking on corners. Returns the
 * new position and how far it actually moved on each axis.
 */
export function moveCircle(level, x, y, dx, dy, r) {
  let nx = x;
  let ny = y;
  let movedX = 0;
  let movedY = 0;
  if (dx !== 0 && !circleHitsSolid(level, x + dx, y, r)) {
    nx = x + dx;
    movedX = dx;
  }
  if (dy !== 0 && !circleHitsSolid(level, nx, y + dy, r)) {
    ny = y + dy;
    movedY = dy;
  }
  // Clamp inside the field.
  nx = Math.max(r, Math.min(level.field.W - r, nx));
  ny = Math.max(r, Math.min(level.field.H - r, ny));
  return { x: nx, y: ny, movedX, movedY };
}

/** Whether a point is inside any lamp pool. */
export function inLamp(level, x, y) {
  return level.lights.some((lamp) => {
    const dx = x - lamp.x;
    const dy = y - lamp.y;
    return dx * dx + dy * dy <= lamp.r * lamp.r;
  });
}

/** Whether a point is inside the exit rect. */
export function inExit(level, x, y) {
  const e = level.exit;
  return x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h;
}
