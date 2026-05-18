/**
 * Coverage for `deriveStickyChain` — the pure helper underneath the
 * `useStickyAncestors` hook. The hook itself reads DOM rects, but the
 * derivation is a pure function over `rowTops + chrome height` so we
 * test it directly.
 *
 * Correctness claim: the chain at any scroll position equals the
 * ancestor-key chain of the first row whose `bottom` crosses the
 * chrome boundary. No stack-height feedback — that's deliberate (see
 * `useStickyAncestors` docstring for why).
 */

import { describe, expect, it } from 'vitest';
import { deriveStickyChain } from '@openheaders/ui/shared/hooks/useStickyAncestors';

interface Row {
  key: string;
  parentKey: string | null;
}

function linearChain(depth: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < depth; i++) {
    rows.push({ key: `r${i}`, parentKey: i === 0 ? null : `r${i - 1}` });
  }
  return rows;
}

function computeRowTops(
  rows: readonly Row[],
  scrollOffset: number,
  rowHeight: number,
  chromeHeight: number,
): Map<string, number> {
  // Coordinate frame matches the pure helper: rows are positioned
  // relative to the scroll container's top. At scrollOffset=0, the
  // first row sits right below the sticky chrome (so r0.top = chromeH).
  // Scrolling shifts every row up by scrollOffset.
  const m = new Map<string, number>();
  rows.forEach((r, i) => m.set(r.key, chromeHeight + i * rowHeight - scrollOffset));
  return m;
}

describe('deriveStickyChain — linear ancestor chain', () => {
  const rows = linearChain(8);
  const ROW_H = 22;
  const CHROME_H = 54;
  const opts = {
    items: rows,
    keyOf: (r: Row) => r.key,
    parentKeyOf: (r: Row) => r.parentKey,
    rowHeight: ROW_H,
    chromeHeight: CHROME_H,
  };

  it('returns empty chain when nothing has scrolled past the chrome', () => {
    const chain = deriveStickyChain({ ...opts, rowTops: computeRowTops(rows, 0, ROW_H, CHROME_H) });
    expect(chain).toEqual([]);
  });

  it('grows chain as deeper rows scroll past the chrome', () => {
    // Scroll so r0 is fully behind the chrome and r1 is the row whose
    // bottom is the first to cross the threshold.
    //   chromeH=54, scroll=32 ⇒ r0.top=22, r0.bottom=44 (behind chrome)
    //                           r1.top=44, r1.bottom=66 (just past)
    const chain = deriveStickyChain({ ...opts, rowTops: computeRowTops(rows, 32, ROW_H, CHROME_H) });
    expect(chain).toEqual(['r0']);
  });

  it('reports chain length matching the depth of the topmost row', () => {
    // Scroll so r5 is the topmost row past the chrome.
    //   chromeH=54, scroll=5*22=110
    //   r4.top = 54 + 4*22 - 110 = 32 → r4.bottom = 54  (NOT > chromeH)
    //   r5.top = 54 + 5*22 - 110 = 54 → r5.bottom = 76  (past chromeH)
    // r5's ancestors = [r0..r4].
    const chain = deriveStickyChain({ ...opts, rowTops: computeRowTops(rows, 110, ROW_H, CHROME_H) });
    expect(chain).toEqual(['r0', 'r1', 'r2', 'r3', 'r4']);
  });

  it('chain is always a strict prefix and grows monotonically with scroll', () => {
    let prevLen = 0;
    for (let scroll = 0; scroll < rows.length * ROW_H; scroll += 5) {
      const chain = deriveStickyChain({ ...opts, rowTops: computeRowTops(rows, scroll, ROW_H, CHROME_H) });
      // Linear tree ⇒ chain is always r0..r_{n-1}.
      chain.forEach((k, i) => expect(k).toBe(`r${i}`));
      // Single-pass with monotonic scroll cannot shrink chain.
      expect(chain.length).toBeGreaterThanOrEqual(prevLen);
      prevLen = chain.length;
    }
  });
});

describe('deriveStickyChain — branching tree', () => {
  // Tree:
  //   A
  //   ├── B
  //   │   ├── C
  //   │   └── D
  //   └── E
  //
  // Flat render order (DFS): A, B, C, D, E
  const rows: Row[] = [
    { key: 'A', parentKey: null },
    { key: 'B', parentKey: 'A' },
    { key: 'C', parentKey: 'B' },
    { key: 'D', parentKey: 'B' },
    { key: 'E', parentKey: 'A' },
  ];
  const opts = {
    items: rows,
    keyOf: (r: Row) => r.key,
    parentKeyOf: (r: Row) => r.parentKey,
    rowHeight: 22,
    chromeHeight: 54,
  };

  it('reports correct ancestors for a deep-then-sibling layout', () => {
    // Scroll until C is the topmost visible row.
    //   chromeH=54, scroll=50, rowH=22
    //   A.top=4, A.bottom=26   (behind chrome)
    //   B.top=26, B.bottom=48  (behind chrome)
    //   C.top=48, C.bottom=70  (past threshold 54)
    // C's ancestors = [A, B].
    const chain = deriveStickyChain({ ...opts, rowTops: computeRowTops(rows, 50, 22, 54) });
    expect(chain).toEqual(['A', 'B']);
  });

  it('returns empty chain when scrolled at the very top (A visible)', () => {
    const chain = deriveStickyChain({ ...opts, rowTops: computeRowTops(rows, 0, 22, 54) });
    expect(chain).toEqual([]);
  });
});

describe('deriveStickyChain — empty / edge cases', () => {
  it('returns empty chain for empty input', () => {
    const chain = deriveStickyChain({
      items: [],
      keyOf: (r: Row) => r.key,
      parentKeyOf: (r: Row) => r.parentKey,
      rowTops: new Map(),
      rowHeight: 22,
      chromeHeight: 54,
    });
    expect(chain).toEqual([]);
  });

  it('returns empty chain when all rows are above the chrome (scrolled off the bottom)', () => {
    const rows = linearChain(3);
    // Scroll so far that every row is above the chrome boundary.
    const chain = deriveStickyChain({
      items: rows,
      keyOf: (r) => r.key,
      parentKeyOf: (r) => r.parentKey,
      rowTops: computeRowTops(rows, 1000, 22, 54),
      rowHeight: 22,
      chromeHeight: 54,
    });
    expect(chain).toEqual([]);
  });
});
