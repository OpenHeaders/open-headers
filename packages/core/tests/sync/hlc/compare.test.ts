import { describe, expect, it } from 'vitest';
import type { HLC } from '../../../src/sync';
import { compareHlc, equalHlc, maxHlc } from '../../../src/sync';

const a: HLC = { physicalMs: 100, logical: 0, nodeId: 'a' };
const b: HLC = { physicalMs: 100, logical: 1, nodeId: 'a' };
const c: HLC = { physicalMs: 100, logical: 1, nodeId: 'b' };
const d: HLC = { physicalMs: 200, logical: 0, nodeId: 'a' };

describe('compareHlc', () => {
  it('orders by physical first', () => {
    expect(compareHlc(a, d)).toBeLessThan(0);
    expect(compareHlc(d, a)).toBeGreaterThan(0);
  });

  it('orders by logical when physical equal', () => {
    expect(compareHlc(a, b)).toBeLessThan(0);
  });

  it('orders by nodeId when physical+logical equal', () => {
    expect(compareHlc(b, c)).toBeLessThan(0);
    expect(compareHlc(c, b)).toBeGreaterThan(0);
  });

  it('returns 0 only on full equality', () => {
    expect(compareHlc(a, { ...a })).toBe(0);
    expect(compareHlc(a, b)).not.toBe(0);
  });

  it('induces a total order on a random sample', () => {
    const arr: HLC[] = [];
    for (let i = 0; i < 200; i += 1) {
      arr.push({
        physicalMs: Math.floor(Math.random() * 5),
        logical: Math.floor(Math.random() * 5),
        nodeId: ['a', 'b', 'c'][Math.floor(Math.random() * 3)],
      });
    }
    arr.sort(compareHlc);
    for (let i = 1; i < arr.length; i += 1) {
      expect(compareHlc(arr[i - 1], arr[i])).toBeLessThanOrEqual(0);
    }
  });
});

describe('equalHlc', () => {
  it('matches structural equality', () => {
    expect(equalHlc(a, { ...a })).toBe(true);
    expect(equalHlc(a, b)).toBe(false);
  });
});

describe('maxHlc', () => {
  it('returns the larger HLC under compareHlc', () => {
    expect(maxHlc(a, d)).toBe(d);
    expect(maxHlc(b, a)).toBe(b);
  });
});
