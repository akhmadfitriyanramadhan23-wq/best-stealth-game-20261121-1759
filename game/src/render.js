// render.js — all drawing: the night museum, cones, guards, Sable, HUD and
// the title / paused / caught / win / over screens. No rules live here.

import { FIELD, GUARD, SUSPICION } from './config.js';
import { inLamp } from './level.js';

const FONT = '600 13px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_BIG = '700 15px system-ui, -apple-system, "Segoe UI", sans-serif';
const FONT_TITLE = '800 44px Georgia, "Times New Roman", serif';
const FONT_SUB = '600 16px Georgia, "Times New Roman", serif';

/** Fit the 960x640 playfield into the canvas, letterboxed. Returns {scale, ox, oy}. */
export function fitView(canvas) {
  const scale = Math.min(canvas.width / FIELD.W, canvas.height / FIELD.H);
  const ox = (canvas.width - FIELD.W * scale) / 2;
  const oy = (canvas.height - FIELD.H * scale) / 2;
  return { scale, ox, oy };
}

/** Draw the whole frame for a world + UI state. */
export function drawWorld(ctx, canvas, world, ui) {
  const { scale, ox, oy } = fitView(canvas);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#060507';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  drawFloor(ctx, world);
  drawExit(ctx, world);
  drawArtifactsAndGems(ctx, world);
  drawLures(ctx, world);
  // Cones go UNDER the walls, so a wall hides the part behind it.
  drawCones(ctx, world);
  drawCover(ctx, world);
  drawWalls(ctx, world);
  drawLamps(ctx, world);
  drawGuards(ctx, world);
  drawPlayer(ctx, world);
  drawDarkness(ctx, world);

  ctx.restore();
  drawHud(ctx, canvas, world, ui);
  drawBanner(ctx, canvas, world);
  drawToasts(ctx, canvas, ui);
  drawScreen(ctx, canvas, world, ui);
}

function drawFloor(ctx, world) {
  const level = world.level;
  ctx.fillStyle = '#0b0a10';
  ctx.fillRect(0, 0, FIELD.W, FIELD.H);
  // Parquet: large, low-contrast tiles — quiet enough to read and to compress.
  const size = 80;
  for (let y = 0; y < FIELD.H / size; y++) {
    for (let x = 0; x < FIELD.W / size; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#241d16' : '#282017';
      ctx.fillRect(x * size, y * size, size, size);
    }
  }
  // Central carpet, deep red.
  ctx.fillStyle = 'rgba(74,47,53,0.55)';
  ctx.fillRect(210, 210, 540, 220);
  ctx.strokeStyle = 'rgba(201,162,39,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(216, 216, 528, 208);
  // North vault slate.
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(20, 20, 920, 160);
  // Entrance rug, purple.
  ctx.fillStyle = 'rgba(58,46,66,0.5)';
  ctx.fillRect(150, 520, 660, 100);
  ctx.strokeStyle = 'rgba(150,120,180,0.35)';
  ctx.strokeRect(156, 526, 648, 88);
  // Vault pedestal marks under the artefacts.
  ctx.fillStyle = 'rgba(201,162,39,0.25)';
  for (const a of level.artifacts) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, world) {
  const e = world.level.exit;
  const open = world.artefactsTaken >= 3;
  ctx.fillStyle = open ? '#1f7a3a' : '#7a1f1f';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#d8c690';
  ctx.font = FONT_BIG;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(open ? 'EXIT' : 'LOCKED', e.x + e.w / 2, e.y + e.h / 2);
}

function diamond(ctx, x, y, r, color, pulse) {
  const rr = r * (1 + 0.12 * Math.sin(pulse));
  ctx.beginPath();
  ctx.moveTo(x, y - rr);
  ctx.lineTo(x + rr * 0.7, y);
  ctx.lineTo(x, y + rr);
  ctx.lineTo(x - rr * 0.7, y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawArtifactsAndGems(ctx, world) {
  const t = world.time;
  for (const a of world.level.artifacts) {
    if (a.taken) continue;
    // Flat glow halo.
    ctx.beginPath();
    ctx.arc(a.x, a.y, 30, 0, Math.PI * 2);
    ctx.fillStyle = a.color + '44';
    ctx.fill();
    diamond(ctx, a.x, a.y, 13, a.color, t * 3 + a.x);
  }
  for (const gem of world.level.gems) {
    if (gem.taken) continue;
    diamond(ctx, gem.x, gem.y, 7, '#22d3ee', t * 4 + gem.x);
  }
}

function drawLures(ctx, world) {
  for (const lure of world.floorLures) {
    const ring = 6 + lure.age * 26;
    ctx.beginPath();
    ctx.arc(lure.x, lure.y, ring, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(232,168,58,${Math.max(0, 0.8 - lure.age * 0.4)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lure.x, lure.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#e8a83a';
    ctx.fill();
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawCones(ctx, world) {
  for (const guard of world.guards) {
    const suspicious = guard.suspicion >= SUSPICION.investigateAt;
    const alarmed = world.alarmed || guard.suspicion >= SUSPICION.alarmAt;
    const color = alarmed
      ? 'rgba(255,70,50,0.28)'
      : suspicious
        ? 'rgba(255,160,60,0.24)'
        : 'rgba(255,220,120,0.20)';
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.arc(guard.x, guard.y, GUARD.coneRange, guard.angle - GUARD.halfAngle, guard.angle + GUARD.halfAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function drawCover(ctx, world) {
  for (const c of world.level.cover) {
    if (c.kind === 'pillar') {
      ctx.fillStyle = '#6b6558';
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.fillStyle = '#8a8272';
      ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, 4);
      ctx.fillRect(c.x + 3, c.y + c.h - 7, c.w - 6, 4);
      continue;
    }
    // Display case: warm brown base, glass top, gold trim.
    ctx.fillStyle = '#4a3a22';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(157,184,200,0.5)';
    ctx.fillRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    // A glint inside the case.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(c.x + 8, c.y + 6, 10, 3);
  }
}

function drawWalls(ctx, world) {
  for (const w of world.level.walls) {
    ctx.fillStyle = '#3d3a4a';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#565270';
    if (w.h <= 20) ctx.fillRect(w.x, w.y, w.w, 4);
    else ctx.fillRect(w.x, w.y, 4, w.h);
  }
}

function drawLamps(ctx, world) {
  for (const lamp of world.level.lights) {
    // Stepped rings: a soft lamplight falloff built from flat fills, so the
    // frame keeps a small colour count and the screenshots stay small.
    const rings = [
      [1.0, 0.06], [0.83, 0.07], [0.67, 0.08], [0.5, 0.09], [0.33, 0.1], [0.17, 0.12],
    ];
    for (const [frac, alpha] of rings) {
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, lamp.r * frac, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,214,130,${alpha})`;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd682';
    ctx.fill();
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    // Facing tick.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
    ctx.stroke();
    // Navy body, brass buttons.
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fillStyle = guard.color;
    ctx.fill();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 4, 1.6, 0, Math.PI * 2);
    ctx.arc(guard.x, guard.y + 4, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Cap brim in the facing direction.
    ctx.beginPath();
    ctx.arc(guard.x + Math.cos(guard.angle) * 8, guard.y + Math.sin(guard.angle) * 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#1d2440';
    ctx.fill();
    // ? while suspicious, ! at full alarm.
    if (guard.suspicion >= SUSPICION.investigateAt || world.alarmed) {
      const mark = world.alarmed || guard.suspicion >= SUSPICION.alarmAt ? '!' : '?';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = mark === '!' ? '#ff5040' : '#ffb020';
      ctx.fillText(mark, guard.x, guard.y - GUARD.radius - 4);
    }
    // Suspicion arc above the guard.
    if (guard.suspicion > 0.02 && guard.suspicion < SUSPICION.alarmAt) {
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - GUARD.radius - 2, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (guard.suspicion / SUSPICION.alarmAt));
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  const r = p.sneak ? p.r * 0.85 : p.r;
  // Warm amber rim so the thief reads against the dark floor.
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 2.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#8a6a2a';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = p.sneak ? '#1a1a22' : '#23232e';
  ctx.fill();
  // Amber scarf dot, bright against the dark.
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(p.facing) * 4, p.y + Math.sin(p.facing) * 4, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#e8a83a';
  ctx.fill();
  // Suspicion eye arc above the player while any guard suspects.
  const maxSuspicion = Math.max(0, ...world.guards.map((g) => g.suspicion));
  if (maxSuspicion > 0.02) {
    ctx.beginPath();
    ctx.arc(p.x, p.y - r - 4, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, maxSuspicion));
    ctx.strokeStyle = maxSuspicion >= SUSPICION.alarmAt ? '#ff5040' : '#ffb020';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  // Noise ring while walking (quiet while sneaking).
  if (p.moving && !p.sneak) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20 + 4 * Math.sin(world.time * 10), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawDarkness(ctx, world) {
  // Night veil with light holes around the lamps, the player and the exit.
  // The veil lives on its own offscreen canvas: punching holes with
  // destination-out there erases only the veil, never the museum beneath.
  if (!veilCanvas) {
    veilCanvas = document.createElement('canvas');
    veilCanvas.width = FIELD.W;
    veilCanvas.height = FIELD.H;
  }
  const vctx = veilCanvas.getContext('2d');
  vctx.clearRect(0, 0, FIELD.W, FIELD.H);
  vctx.globalCompositeOperation = 'source-over';
  vctx.fillStyle = 'rgba(4,4,10,0.34)';
  vctx.fillRect(0, 0, FIELD.W, FIELD.H);
  vctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    // Stepped rings: the night lifts in steps toward the light, built from
    // flat erases so the frame keeps a small colour count.
    const rings = [
      [1.0, 0.35], [0.75, 0.4], [0.5, 0.45], [0.25, 0.5],
    ];
    for (const [frac, alpha] of rings) {
      vctx.beginPath();
      vctx.arc(x, y, r * frac, 0, Math.PI * 2);
      vctx.fillStyle = `rgba(0,0,0,${alpha})`;
      vctx.fill();
    }
  };
  for (const lamp of world.level.lights) hole(lamp.x, lamp.y, lamp.r);
  hole(world.player.x, world.player.y, 115);
  hole(world.level.exit.x + 30, world.level.exit.y + 16, 60);
  ctx.drawImage(veilCanvas, 0, 0);
}

// The night veil's offscreen canvas, created once in the browser.
let veilCanvas = null;

// --- HUD and screens (drawn in screen space, after the world) ----------------

function drawHud(ctx, canvas, world, ui) {
  const level = world.level;
  ctx.save();
  ctx.font = FONT;
  ctx.textBaseline = 'top';
  // Top-left: artefacts as coloured diamonds, score, gems, lures.
  let x = 14;
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(8, 8, 300, 30);
  for (const a of level.artifacts) {
    ctx.beginPath();
    const cx = x + 10;
    const cy = 23;
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 5, cy);
    ctx.lineTo(cx, cy + 7);
    ctx.lineTo(cx - 5, cy);
    ctx.closePath();
    ctx.fillStyle = a.taken ? a.color : 'rgba(255,255,255,0.25)';
    ctx.fill();
    x += 18;
  }
  ctx.fillStyle = '#f5e9c8';
  ctx.fillText(`${world.artefactsTaken}/3`, x + 2, 13);
  x += 44;
  ctx.fillStyle = '#22d3ee';
  ctx.fillText(`◆ ${world.gemsTaken}`, x, 13);
  x += 52;
  ctx.fillStyle = '#e8a83a';
  ctx.fillText(`● ${world.player.lures}`, x, 13);
  x += 52;
  ctx.fillStyle = '#f5e9c8';
  ctx.fillText(`Score ${world.score}`, x, 13);
  // Top-right: timer and lives.
  const mm = Math.floor(world.time / 60);
  const ss = Math.floor(world.time % 60).toString().padStart(2, '0');
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(canvas.width - 168, 8, 160, 30);
  ctx.fillStyle = '#f5e9c8';
  ctx.fillText(`${mm}:${ss}`, canvas.width - 78, 13);
  ctx.fillStyle = '#ff6b6b';
  ctx.fillText('♥'.repeat(Math.max(0, world.lives)), canvas.width - 14, 13);
  // Objective line at the bottom centre.
  const objective = world.artefactsTaken >= 3
    ? 'All three artefacts taken — slip out the front door!'
    : `Steal the artefacts (${world.artefactsTaken}/3) — stay out of the cones.`;
  ctx.font = FONT_BIG;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const w = ctx.measureText(objective).width + 24;
  ctx.fillRect((canvas.width - w) / 2, canvas.height - 34, w, 26);
  ctx.fillStyle = '#f5e9c8';
  ctx.fillText(objective, canvas.width / 2, canvas.height - 29);
  // Lamp hint: standing in lamplight is easier to spot (play only).
  if (world.state === 'play' && inLamp(level, world.player.x, world.player.y)) {
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd682';
    ctx.fillText('In the lamplight — easier to spot!', canvas.width / 2, 46);
  }
  ctx.restore();
}

function drawBanner(ctx, canvas, world) {
  if (!world.alarmed) return;
  ctx.save();
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = 'SPOTTED — RUN!';
  const w = ctx.measureText(text).width + 36;
  ctx.fillStyle = 'rgba(122,20,10,0.85)';
  ctx.fillRect((canvas.width - w) / 2, 52, w, 40);
  ctx.strokeStyle = '#ff5040';
  ctx.lineWidth = 2;
  ctx.strokeRect((canvas.width - w) / 2, 52, w, 40);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, canvas.width / 2, 73);
  ctx.restore();
}

function drawToasts(ctx, canvas, ui) {
  if (!ui.toasts || ui.toasts.length === 0) return;
  ctx.save();
  ctx.font = FONT_BIG;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = 100;
  for (const toast of ui.toasts) {
    const alpha = Math.max(0, Math.min(1, toast.life / 0.5));
    ctx.globalAlpha = alpha;
    const w = ctx.measureText(toast.text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((canvas.width - w) / 2, y, w, 26);
    ctx.fillStyle = '#f5e9c8';
    ctx.fillText(toast.text, canvas.width / 2, y + 5);
    y += 32;
  }
  ctx.restore();
}

/** A 0.55-alpha veil so the museum shows behind the title / win screens. */
function veil(ctx, canvas) {
  ctx.fillStyle = 'rgba(5,5,10,0.55)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function centreText(ctx, canvas, y, lines) {
  ctx.textAlign = 'center';
  for (const line of lines) {
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, canvas.width / 2, y);
    y += line.gap;
  }
}

function drawScreen(ctx, canvas, world, ui) {
  ctx.save();
  ctx.textBaseline = 'top';
  if (world.state === 'title') {
    veil(ctx, canvas);
    centreText(ctx, canvas, canvas.height * 0.2, [
      { text: 'THE AMBER HEIST', font: FONT_TITLE, color: '#e8a83a', gap: 62 },
      { text: 'A night in the museum. Three artefacts. Four guards. One way out.', font: FONT_SUB, color: '#f5e9c8', gap: 30 },
      { text: 'WASD / arrows to move · Shift to sneak · Click to toss a lure coin', font: FONT, color: '#cbbf9a', gap: 24 },
      { text: 'Lamp pools make you easy to spot. Steal all three, then slip out the front door.', font: FONT, color: '#cbbf9a', gap: 40 },
      { text: 'Press Enter or click to begin', font: FONT_BIG, color: '#ffd682', gap: 0 },
    ]);
  } else if (world.state === 'paused') {
    veil(ctx, canvas);
    centreText(ctx, canvas, canvas.height * 0.38, [
      { text: 'PAUSED', font: FONT_TITLE, color: '#f5e9c8', gap: 56 },
      { text: 'Press P to keep stealing', font: FONT_SUB, color: '#cbbf9a', gap: 0 },
    ]);
  } else if (world.state === 'caught') {
    veil(ctx, canvas);
    centreText(ctx, canvas, canvas.height * 0.36, [
      { text: 'CAUGHT!', font: FONT_TITLE, color: '#ff6b6b', gap: 56 },
      { text: `The guards drag you back to the door. ${world.lives} ${world.lives === 1 ? 'life' : 'lives'} left.`, font: FONT_SUB, color: '#f5e9c8', gap: 0 },
    ]);
  } else if (world.state === 'win') {
    veil(ctx, canvas);
    const lines = [
      { text: 'THE HEIST IS DONE', font: FONT_TITLE, color: '#e8a83a', gap: 62 },
      { text: `Sable slips into the night with all three artefacts. Score ${world.score}.`, font: FONT_SUB, color: '#f5e9c8', gap: 30 },
    ];
    if (world.ghostBonus > 0) {
      lines.push({ text: `Ghost bonus +${world.ghostBonus} — never once spotted.`, font: FONT, color: '#7ee2a8', gap: 24 });
    } else {
      lines.push({ text: 'The alarm rang once; the ghost bonus slipped away.', font: FONT, color: '#ffb020', gap: 24 });
    }
    lines.push({ text: `Time bonus +${world.timeBonus} · Gems ${world.gemsTaken} · Press Enter to play again`, font: FONT, color: '#cbbf9a', gap: 0 });
    centreText(ctx, canvas, canvas.height * 0.22, lines);
  } else if (world.state === 'over') {
    veil(ctx, canvas);
    centreText(ctx, canvas, canvas.height * 0.36, [
      { text: 'THE NIGHT ENDS', font: FONT_TITLE, color: '#ff6b6b', gap: 56 },
      { text: `Three strikes — the museum keeps its treasures. Score ${world.score}.`, font: FONT_SUB, color: '#f5e9c8', gap: 30 },
      { text: 'Press Enter to try again', font: FONT_BIG, color: '#ffd682', gap: 0 },
    ]);
  }
  ctx.restore();
}
