import { describe, expect, it } from 'vitest';
import { getAtPath, hasPath, joinPath, parsePath, setAtPath, unsetAtPath } from '../../../src/sync';

describe('parsePath / joinPath', () => {
  it('round-trips', () => {
    const s = 'headerMods.0.value';
    expect(joinPath(parsePath(s))).toBe(s);
  });
  it('empty string parses to empty array', () => {
    expect(parsePath('')).toEqual([]);
  });
});

describe('getAtPath', () => {
  const root = { a: { b: [{ c: 'leaf' }] }, k: 1 };
  it('reads scalar leaf', () => {
    expect(getAtPath(root, parsePath('k'))).toBe(1);
  });
  it('reads through arrays via numeric segments', () => {
    expect(getAtPath(root, parsePath('a.b.0.c'))).toBe('leaf');
  });
  it('returns undefined on missing', () => {
    expect(getAtPath(root, parsePath('a.b.99.c'))).toBeUndefined();
    expect(getAtPath(root, parsePath('z'))).toBeUndefined();
  });
});

describe('setAtPath', () => {
  it('immutably writes a leaf and shares the rest', () => {
    const root = { a: { b: { c: 1, d: 2 } }, e: 3 };
    const next = setAtPath(root, parsePath('a.b.c'), 99);
    expect(next).not.toBe(root);
    expect(next.a).not.toBe(root.a);
    expect(next.a.b).not.toBe(root.a.b);
    expect(next.a.b.c).toBe(99);
    expect(next.a.b.d).toBe(2);
    expect(next.e).toBe(3);
    // original untouched
    expect(root.a.b.c).toBe(1);
  });

  it('writes into arrays at index', () => {
    const root = { xs: [{ v: 1 }, { v: 2 }, { v: 3 }] };
    const next = setAtPath(root, parsePath('xs.1.v'), 99);
    expect(next.xs[1].v).toBe(99);
    expect(next.xs[0]).toBe(root.xs[0]);
    expect(next.xs[2]).toBe(root.xs[2]);
    expect(root.xs[1].v).toBe(2);
  });

  it('appends one past the end of an array (push semantics)', () => {
    const root = { xs: [1, 2, 3] };
    const next = setAtPath(root, parsePath('xs.3'), 4);
    expect(next.xs).toEqual([1, 2, 3, 4]);
  });

  it('throws when descending into a non-container', () => {
    expect(() => setAtPath({ a: 1 }, parsePath('a.b'), 2)).toThrow();
  });
});

describe('unsetAtPath', () => {
  it('removes an object key', () => {
    const root = { a: 1, b: 2 };
    const next = unsetAtPath(root, parsePath('a'));
    expect(next).toEqual({ b: 2 });
    expect(root).toEqual({ a: 1, b: 2 });
  });

  it('splices an array index', () => {
    const root = { xs: [1, 2, 3] };
    const next = unsetAtPath(root, parsePath('xs.1'));
    expect(next.xs).toEqual([1, 3]);
  });

  it('no-op when path absent', () => {
    const root = { a: 1 };
    const next = unsetAtPath(root, parsePath('z'));
    expect(next).toEqual({ a: 1 });
  });
});

describe('hasPath', () => {
  it('returns true for existing leaf', () => {
    expect(hasPath({ a: { b: 1 } }, parsePath('a.b'))).toBe(true);
  });
  it('returns false for missing key', () => {
    expect(hasPath({ a: {} }, parsePath('a.b'))).toBe(false);
  });
  it('returns true for explicit-undefined keys', () => {
    expect(hasPath({ a: undefined } as Record<string, unknown>, parsePath('a'))).toBe(true);
  });
});
