/**
 * Fractional indexing — keyBetween correctness.
 *
 * The convergence property test catches interleaving bugs end-to-end,
 * but a focused unit test makes "does keyBetween actually order?"
 * trivial to prove.
 */

import { describe, expect, it } from 'vitest';
import { keyBetween, seedKey } from '../../../src/sync';

describe('keyBetween', () => {
  it('mints the canonical seed when both bounds are null', () => {
    expect(keyBetween(null, null)).toBe(seedKey());
  });

  it('mints a key strictly less than `high` when `low` is null', () => {
    const k = keyBetween(null, 'm');
    expect(k < 'm').toBe(true);
  });

  it('mints a key strictly greater than `low` when `high` is null', () => {
    const k = keyBetween('m', null);
    expect(k > 'm').toBe(true);
  });

  it('mints a key strictly between adjacent codepoints', () => {
    const k = keyBetween('a', 'b');
    expect(k > 'a').toBe(true);
    expect(k < 'b').toBe(true);
  });

  it('mints a key strictly between deeply-prefixed bounds', () => {
    const k = keyBetween('mama', 'mamb');
    expect(k > 'mama').toBe(true);
    expect(k < 'mamb').toBe(true);
  });

  it('extends past all-z low bound', () => {
    const k = keyBetween('z', null);
    expect(k > 'z').toBe(true);
  });

  it('throws when `low >= high`', () => {
    expect(() => keyBetween('m', 'm')).toThrow();
    expect(() => keyBetween('z', 'a')).toThrow();
  });

  it('produces a totally-ordered sequence under repeated insertion at the front', () => {
    const keys: string[] = [];
    let high: string | null = null;
    for (let i = 0; i < 64; i += 1) {
      const k = keyBetween(null, high);
      keys.unshift(k);
      high = k;
    }
    for (let i = 1; i < keys.length; i += 1) {
      expect(keys[i - 1] < keys[i]).toBe(true);
    }
  });

  it('produces a totally-ordered sequence under repeated insertion in the middle', () => {
    let low = keyBetween(null, null);
    let high = keyBetween(low, null);
    for (let i = 0; i < 32; i += 1) {
      const mid = keyBetween(low, high);
      expect(low < mid).toBe(true);
      expect(mid < high).toBe(true);
      // Alternate which side we tighten.
      if (i % 2 === 0) high = mid;
      else low = mid;
    }
  });
});
