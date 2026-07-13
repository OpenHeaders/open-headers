/**
 * Console row-window math — prefix-sum windowing over pinned heights.
 * The DOM-level behavior (jsdom's zero viewport renders the full list)
 * is covered by console-view.test.tsx exercising every row; this pins
 * the pure computation the real browser path runs.
 */

import {
  CONSOLE_ROW_PX,
  computeConsoleWindow,
  consoleStackPx,
} from '@openheaders/ui/panel/components/use-console-row-window';
import { describe, expect, it } from 'vitest';

function prefixOf(heights: readonly number[]): number[] {
  const out = [0];
  for (const h of heights) out.push(out[out.length - 1] + h);
  return out;
}

const uniform = (n: number): number[] => prefixOf(new Array(n).fill(CONSOLE_ROW_PX));

describe('consoleStackPx', () => {
  it('is zero for no frames and 14·n+4 otherwise', () => {
    expect(consoleStackPx(0)).toBe(0);
    expect(consoleStackPx(1)).toBe(18);
    expect(consoleStackPx(3)).toBe(46);
  });
});

describe('computeConsoleWindow', () => {
  it('returns an empty window for an empty list', () => {
    expect(computeConsoleWindow(prefixOf([]), 0, 400)).toEqual({ start: 0, end: 0 });
  });

  it('starts at 0 when parked at the top and bounds the slice by viewport + overscan', () => {
    const prefix = uniform(1000);
    const { start, end } = computeConsoleWindow(prefix, 0, 340);
    expect(start).toBe(0);
    // Rows through scrollTop + viewport + 600px overscan, and no further.
    expect(prefix[end]).toBeGreaterThanOrEqual(340 + 600);
    expect(prefix[end - 1]).toBeLessThan(340 + 600);
    expect(end).toBeLessThan(200);
  });

  it('windows a mid-scroll position with overscan on both sides', () => {
    const prefix = uniform(1000);
    const scrollTop = 5000;
    const viewport = 340;
    const { start, end } = computeConsoleWindow(prefix, scrollTop, viewport);
    // The row containing the overscanned top edge is mounted…
    expect(prefix[start]).toBeLessThanOrEqual(scrollTop - 600);
    expect(prefix[start + 1]).toBeGreaterThan(scrollTop - 600);
    // …through the overscanned bottom edge.
    expect(prefix[end]).toBeGreaterThanOrEqual(scrollTop + viewport + 600);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeLessThan(1000);
  });

  it('clamps to the tail when scrolled to the bottom', () => {
    const prefix = uniform(500);
    const total = prefix[prefix.length - 1];
    const viewport = 340;
    const { end } = computeConsoleWindow(prefix, total - viewport, viewport);
    expect(end).toBe(500);
  });

  it('accounts for expanded-stack heights in the offsets', () => {
    // 100 rows; row 10 is expanded with a 5-frame ladder.
    const heights = new Array<number>(100).fill(CONSOLE_ROW_PX);
    heights[10] = CONSOLE_ROW_PX + consoleStackPx(5);
    const prefix = prefixOf(heights);
    // A scroll position past the ladder still resolves start/end without
    // drift: the pixel edges land inside the rows the math names.
    const { start } = computeConsoleWindow(prefix, 900, 340);
    expect(prefix[start]).toBeLessThanOrEqual(900 - 600);
    expect(prefix[start + 1]).toBeGreaterThan(900 - 600);
  });
});
