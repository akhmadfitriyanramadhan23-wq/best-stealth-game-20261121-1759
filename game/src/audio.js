// audio.js — WebAudio-synthesised sounds, no audio files. A tiny synth:
// footsteps that tell you where a guard is, a soft coin chime, a low
// alarm swell, a pickup sparkle. Silent until the player first interacts
// (browsers require a gesture), and safe to call before that.

let ctx = null;
let master = null;
let muted = false;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.value = muted ? 0 : 0.35;
}

/** A short tone: frequency slide, gain envelope. */
function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || !master || muted) return;
  try {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

/** Footstep: a soft filtered thud. `pan` -1..1 places it left/right. */
export function playFootstep(pan) {
  if (!ctx || !master || muted) return;
  try {
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.09);
    gain.gain.setValueAtTime(0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    osc.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
      gain.connect(panner);
      panner.connect(master);
    } else {
      gain.connect(master);
    }
    osc.start(t0);
    osc.stop(t0 + 0.12);
  } catch {
    // Audio is decoration; never let it break the game.
  }
}

export function playCoin() {
  tone(1320, 0.18, 'sine', 0.15, 1760);
  setTimeout(() => tone(1760, 0.22, 'sine', 0.12, 2093), 60);
}

export function playPickup() {
  tone(880, 0.12, 'triangle', 0.14, 1174);
  setTimeout(() => tone(1174, 0.16, 'triangle', 0.12, 1568), 70);
}

export function playArtefact() {
  tone(523, 0.2, 'triangle', 0.16, 784);
  setTimeout(() => tone(784, 0.25, 'triangle', 0.14, 1046), 90);
  setTimeout(() => tone(1046, 0.35, 'sine', 0.12, 1318), 180);
}

export function playAlarm() {
  tone(220, 0.7, 'sawtooth', 0.1, 440);
  setTimeout(() => tone(330, 0.7, 'sawtooth', 0.08, 220), 200);
}

export function playCaught() {
  tone(392, 0.3, 'sawtooth', 0.12, 110);
}

export function playWin() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.14), i * 110));
}

export function playLocked() {
  tone(180, 0.15, 'square', 0.06, 140);
}
