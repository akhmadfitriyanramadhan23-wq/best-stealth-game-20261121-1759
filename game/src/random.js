// random.js — mulberry32, a small seeded RNG. `?seed=N` fixes the random
// source so runs are deterministic; the game uses it only for cosmetic
// jitter (dust motes, guard scan wander), never for rules.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
