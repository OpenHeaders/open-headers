/**
 * Seeded PRNG for reproducible scenario generation. mulberry32 — small,
 * 32-bit state, good distribution for our purposes (we are not doing
 * cryptography here, we are interleaving mutations).
 */

export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
  pick<T>(xs: readonly T[]): T;
  shuffle<T>(xs: T[]): T[];
  uid(prefix?: string): string;
}

export function makeRng(seed: number): Rng {
  let state = seed | 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
  const int = (max: number): number => Math.floor(next() * max);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)];
  const shuffle = <T>(xs: T[]): T[] => {
    const arr = xs.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  let counter = 0;
  const uid = (prefix = 'u'): string => {
    counter += 1;
    return `${prefix}-${counter.toString(36)}-${int(0xffffff).toString(36)}`;
  };
  return { next, int, pick, shuffle, uid };
}
