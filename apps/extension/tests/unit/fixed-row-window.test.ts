/**
 * The fixed-row window's math (`shared/virtual-window/fixed-rows`): the
 * rows to mount for a scroll position and where to draw them — a pixel
 * scrolled a pixel of rows while the list fits the engine's tallest
 * spacer, the scrollbar's travel standing for the whole list once it
 * does not — and the scroll position that brings a row into view.
 */

import {
  computeFixedRowWindow,
  type FixedRowGeometry,
  fixedRowSpacerPx,
  MAX_SPACER_PX,
  scrollTopForRow,
  visibleFixedRows,
} from '@openheaders/ui/shared/virtual-window';
import { describe, expect, it } from 'vitest';

const ROW = 26;
const VIEWPORT = 520;
const OVERSCAN = 600;

/** A list as the engine lays it out: its spacer as tall as asked, or as tall as the engine gives. */
const laidOut = (count: number, given: number = fixedRowSpacerPx(count, ROW)): FixedRowGeometry => ({
  count,
  rowPx: ROW,
  viewportPx: VIEWPORT,
  heightPx: given,
});

describe('the spacer asked of the engine', () => {
  it('is the list’s own height up to the tallest one asked', () => {
    expect(fixedRowSpacerPx(0, ROW)).toBe(0);
    expect(fixedRowSpacerPx(1_000_000, ROW)).toBe(26_000_000);
    expect(fixedRowSpacerPx(1_290_554, ROW)).toBe(33_554_404);
    expect(fixedRowSpacerPx(1_290_555, ROW)).toBe(MAX_SPACER_PX);
    expect(fixedRowSpacerPx(5_000_000, ROW)).toBe(MAX_SPACER_PX);
    expect(MAX_SPACER_PX).toBe(33_554_428);
  });
});

describe('a list that fits its spacer', () => {
  const list = laidOut(1_000_000);

  it('mounts nothing for an empty list', () => {
    expect(computeFixedRowWindow(laidOut(0), 0)).toEqual({ start: 0, end: 0, offsetPx: 0 });
    expect(visibleFixedRows(laidOut(0), 0)).toEqual({ first: 0, last: -1 });
  });

  it('starts at row 0 at the top and mounts through the viewport and the overscan, no further', () => {
    const { start, end, offsetPx } = computeFixedRowWindow(list, 0);
    expect([start, offsetPx]).toEqual([0, 0]);
    expect(end * ROW).toBeGreaterThanOrEqual(VIEWPORT + OVERSCAN);
    expect((end - 1) * ROW).toBeLessThan(VIEWPORT + OVERSCAN);
  });

  it('draws every mounted row at its own place: a pixel scrolled is a pixel of rows', () => {
    for (const scrollTop of [1, 599, 600, 601, 5_000, 12_999_987, 25_999_480]) {
      const { start, end, offsetPx } = computeFixedRowWindow(list, scrollTop);
      expect(offsetPx).toBe(start * ROW);
      expect(start * ROW).toBeLessThanOrEqual(Math.max(0, scrollTop - OVERSCAN));
      expect((start + 1) * ROW).toBeGreaterThan(scrollTop - OVERSCAN);
      expect(end).toBe(Math.min(1_000_000, Math.ceil((scrollTop + VIEWPORT + OVERSCAN) / ROW)));
    }
  });

  it('ends on the last row at the bottom, and holds a position past either end to it', () => {
    const bottom = 26_000_000 - VIEWPORT;
    expect(computeFixedRowWindow(list, bottom).end).toBe(1_000_000);
    expect(computeFixedRowWindow(list, bottom + 5_000)).toEqual(computeFixedRowWindow(list, bottom));
    expect(computeFixedRowWindow(list, -50)).toEqual(computeFixedRowWindow(list, 0));
  });

  it('names the rows the viewport itself shows', () => {
    expect(visibleFixedRows(list, 0)).toEqual({ first: 0, last: 19 });
    expect(visibleFixedRows(list, 13)).toEqual({ first: 0, last: 20 });
    expect(visibleFixedRows(list, 26_000_000 - VIEWPORT)).toEqual({ first: 999_980, last: 999_999 });
  });

  it('mounts a list shorter than its viewport whole and never scrolls it', () => {
    const short = laidOut(5);
    expect(computeFixedRowWindow(short, 0)).toEqual({ start: 0, end: 5, offsetPx: 0 });
    expect(computeFixedRowWindow(short, 400)).toEqual({ start: 0, end: 5, offsetPx: 0 });
    expect(scrollTopForRow(short, 4, 'center', 0)).toBe(0);
  });
});

describe('a spacer the engine gave no room to scroll', () => {
  it('mounts the first rows and stays put, whatever the list’s length', () => {
    for (const given of [0, VIEWPORT]) {
      const list = laidOut(1_000, given);
      expect(computeFixedRowWindow(list, 0)).toEqual({ start: 0, end: 44, offsetPx: 0 });
      expect(computeFixedRowWindow(list, 300)).toEqual({ start: 0, end: 44, offsetPx: 0 });
      expect(visibleFixedRows(list, 300)).toEqual({ first: 0, last: 19 });
      expect(scrollTopForRow(list, 900, 'center', 0)).toBe(0);
    }
  });
});

describe.each([
  ['the tallest spacer asked', MAX_SPACER_PX],
  ['an engine that gives less than asked', 17_895_697],
])('a list taller than its spacer — %s', (_name, given) => {
  const count = 5_000_000;
  const list = laidOut(count, given);
  const travel = given - VIEWPORT;

  it('shows the first rows at the top and the last at the bottom, the last one flush with the spacer’s end', () => {
    expect(computeFixedRowWindow(list, 0)).toMatchObject({ start: 0, offsetPx: 0 });
    const { start, end, offsetPx } = computeFixedRowWindow(list, travel);
    expect(end).toBe(count);
    expect(offsetPx + (end - start) * ROW).toBeCloseTo(given, 3);
    expect(visibleFixedRows(list, travel).last).toBe(count - 1);
  });

  it('lets the scrollbar’s travel stand for the whole list', () => {
    const half = visibleFixedRows(list, travel / 2);
    expect(Math.abs(half.first - count / 2)).toBeLessThan(40);
    let before = -1;
    for (let step = 0; step <= 1_000; step += 1) {
      const { first } = visibleFixedRows(list, (travel * step) / 1_000);
      expect(first).toBeGreaterThanOrEqual(before);
      before = first;
    }
  });

  it('draws the mounted rows where the viewport is, whole pixels of rows each', () => {
    for (const scrollTop of [10, 4_321, travel / 3, travel - 7]) {
      const { start, end, offsetPx } = computeFixedRowWindow(list, scrollTop);
      const { first, last } = visibleFixedRows(list, scrollTop);
      expect(start).toBeLessThanOrEqual(first);
      expect(end).toBeGreaterThan(last);
      // The first row the viewport shows straddles (or sits on) its top edge; the last, its bottom edge.
      const topOf = (row: number): number => offsetPx + (row - start) * ROW;
      expect(topOf(first)).toBeLessThanOrEqual(scrollTop + 0.001);
      expect(topOf(first) + ROW).toBeGreaterThan(scrollTop);
      expect(topOf(last)).toBeLessThan(scrollTop + VIEWPORT);
      expect(topOf(last) + ROW).toBeGreaterThanOrEqual(scrollTop + VIEWPORT - 0.001);
    }
  });

  it('reaches every row: a row asked for is brought into view', () => {
    for (const row of [0, 1, 12_345, 2_500_000, 4_999_998, 4_999_999]) {
      const centred = scrollTopForRow(list, row, 'center', 0);
      const shown = visibleFixedRows(list, centred);
      expect(row).toBeGreaterThanOrEqual(shown.first);
      expect(row).toBeLessThanOrEqual(shown.last);
      expect(centred).toBeGreaterThanOrEqual(0);
      expect(centred).toBeLessThanOrEqual(travel);
    }
  });
});

describe('the scroll position that brings a row into view', () => {
  const list = laidOut(10_000);

  it('centres the row, held to the list’s ends', () => {
    expect(scrollTopForRow(list, 5_000, 'center', 0)).toBe(5_000 * ROW - (VIEWPORT - ROW) / 2);
    expect(scrollTopForRow(list, 0, 'center', 9_999)).toBe(0);
    expect(scrollTopForRow(list, 9_999, 'center', 0)).toBe(10_000 * ROW - VIEWPORT);
    expect(scrollTopForRow(list, 50_000, 'center', 0)).toBe(10_000 * ROW - VIEWPORT);
    expect(scrollTopForRow(list, -3, 'center', 500)).toBe(0);
    expect(scrollTopForRow(list, 50_000, 'nearest', 0)).toBe(10_000 * ROW - VIEWPORT);
  });

  it('nearest: leaves a row that already shows whole where it is', () => {
    const scrollTop = 100 * ROW + 5;
    expect(scrollTopForRow(list, 101, 'nearest', scrollTop)).toBe(scrollTop);
    expect(scrollTopForRow(list, 119, 'nearest', scrollTop)).toBe(scrollTop);
  });

  it('nearest: moves the least that shows the row whole — to the top edge from above, to the bottom edge from below', () => {
    const scrollTop = 100 * ROW + 5;
    // Row 100 is cut by the top edge, row 120 by the bottom one.
    expect(scrollTopForRow(list, 100, 'nearest', scrollTop)).toBe(100 * ROW);
    expect(scrollTopForRow(list, 99, 'nearest', scrollTop)).toBe(99 * ROW);
    expect(scrollTopForRow(list, 120, 'nearest', scrollTop)).toBe(121 * ROW - VIEWPORT);
    expect(scrollTopForRow(list, 400, 'nearest', scrollTop)).toBe(401 * ROW - VIEWPORT);
  });
});
