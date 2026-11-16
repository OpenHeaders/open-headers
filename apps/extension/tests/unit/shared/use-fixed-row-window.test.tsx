// @vitest-environment jsdom
/**
 * The fixed-row window's hook over a scroller whose numbers are set by
 * hand: the rows to mount and the rows in view follow the scroll
 * position and the scroller's resize, a scroll is drawn inside its
 * event, the height the engine gave the spacer is read back, a
 * scroller with no height yet mounts the list's first rows, and a row
 * is brought into view from where the scroller stands.
 */

import { MAX_SPACER_PX, useFixedRowWindow } from '@openheaders/ui/shared/virtual-window';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ROW = 26;

/** A scroller as an engine lays it out: its height, its content's height, where it is scrolled. */
function scroller(viewportPx: number, contentPx: number, scrollTop = 0): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => viewportPx });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => contentPx });
  el.scrollTop = scrollTop;
  return el;
}

/** The observers the hook made, so a test resizes its scroller. */
let observers: { fire: () => void; disconnected: boolean }[] = [];

beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      private readonly entry: { fire: () => void; disconnected: boolean };
      constructor(callback: () => void) {
        this.entry = { fire: callback, disconnected: false };
        observers.push(this.entry);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {
        this.entry.disconnected = true;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = (el: HTMLElement | null, count: number) =>
  renderHook(({ rows }: { rows: number }) => useFixedRowWindow({ current: el }, rows, ROW), {
    initialProps: { rows: count },
  });

describe('useFixedRowWindow', () => {
  it('mounts the rows around the scroll position, drawn at their own place', () => {
    const el = scroller(520, 1_000 * ROW, 13_000);
    const { result } = mount(el, 1_000);
    // Row 500 sits at the viewport's top: 600 px of rows are mounted above and below what shows.
    expect(result.current).toMatchObject({ start: 476, end: 544, offsetPx: 476 * ROW, spacerPx: 26_000 });
  });

  it('follows the scroller as it scrolls', () => {
    const el = scroller(520, 10_000 * ROW);
    const { result } = mount(el, 10_000);
    expect(result.current).toMatchObject({ start: 0, end: 44, offsetPx: 0 });
    el.scrollTop = 2_600;
    act(() => result.current.onScroll());
    expect(result.current).toMatchObject({ start: 76, end: 144, offsetPx: 76 * ROW });
  });

  it('draws a scroll inside its event: the window stands before the handler returns', () => {
    const el = scroller(520, 10_000 * ROW);
    const { result } = mount(el, 10_000);
    el.scrollTop = 2_600;
    // No `act`: nothing but the handler itself is given the chance to draw.
    result.current.onScroll();
    expect(result.current).toMatchObject({ start: 76, end: 144, offsetPx: 76 * ROW });
  });

  it('reads a scroller moved by hand again, drawn with whatever moved it', () => {
    const el = scroller(520, 10_000 * ROW);
    const { result } = mount(el, 10_000);
    el.scrollTop = 2_600;
    act(() => result.current.remeasure());
    expect(result.current).toMatchObject({ start: 76, end: 144, offsetPx: 76 * ROW });
  });

  it('names the rows the viewport itself shows — none of the ones mounted beyond it', () => {
    const el = scroller(520, 10_000 * ROW, 13_000);
    const { result } = mount(el, 10_000);
    expect(result.current.inView).toEqual({ first: 500, last: 519 });
    // A pixel further and a pixel of row 520 shows.
    el.scrollTop = 13_001;
    act(() => result.current.onScroll());
    expect(result.current.inView).toEqual({ first: 500, last: 520 });
    expect(result.current).toMatchObject({ start: 476, end: 544 });
  });

  it('keeps a pixel scrolled a pixel of rows when the scroller holds more than its rows', () => {
    // A line under the last row makes the content taller than the list: the list's own height is what counts.
    const el = scroller(520, 10_000 * ROW + 40, 2_600);
    const { result } = mount(el, 10_000);
    expect(result.current).toMatchObject({ start: 76, end: 144, offsetPx: 76 * ROW });
  });

  it('follows the scroller’s resize, and lets its observer go with it', () => {
    let viewport = 520;
    const el = scroller(0, 10_000 * ROW);
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => viewport });
    const { result, unmount } = mount(el, 10_000);
    expect(result.current.end).toBe(44);
    expect(result.current.viewportPx).toBe(520);
    viewport = 1_040;
    act(() => observers[0].fire());
    expect(result.current.end).toBe(64);
    expect(result.current.viewportPx).toBe(1_040);
    // A pixel taller that mounts no other row and shows no other: the height is still told.
    viewport = 1_027;
    act(() => observers[0].fire());
    const { start, end, inView } = result.current;
    viewport = 1_028;
    act(() => observers[0].fire());
    expect(result.current).toMatchObject({ start, end, inView, viewportPx: 1_028 });
    unmount();
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
  });

  it('re-windows when the list’s length changes', () => {
    const el = scroller(520, 30 * ROW);
    const { result, rerender } = mount(el, 30);
    expect(result.current).toMatchObject({ start: 0, end: 30, spacerPx: 780 });
    rerender({ rows: 5 });
    expect(result.current).toMatchObject({ start: 0, end: 5, spacerPx: 130 });
  });

  it('mounts the list’s first rows while the scroller has no height', () => {
    const { result } = mount(scroller(0, 0), 1_000_000);
    expect(result.current).toMatchObject({
      start: 0,
      end: 200,
      offsetPx: 0,
      inView: { first: 0, last: 199 },
      viewportPx: 0,
    });
    expect(mount(scroller(0, 0), 12).result.current).toMatchObject({ end: 12, inView: { first: 0, last: 11 } });
  });

  it('mounts nothing with no scroller', () => {
    expect(mount(null, 1_000).result.current).toMatchObject({
      start: 0,
      end: 0,
      offsetPx: 0,
      inView: { first: 0, last: -1 },
    });
  });

  it('asks for the tallest spacer on a list past it, and reads back the height the engine gave', () => {
    const rows = 5_000_000;
    // An engine that clamps lower than the one asked for: half the travel stands for the whole list.
    const given = MAX_SPACER_PX / 2;
    const el = scroller(520, given, (given - 520) / 2);
    const { result } = mount(el, rows);
    expect(result.current.spacerPx).toBe(MAX_SPACER_PX);
    const middle = Math.floor((rows * ROW - 520) / 2 / ROW);
    expect(result.current.start).toBeLessThanOrEqual(middle);
    expect(result.current.end).toBeGreaterThan(middle);
    expect(result.current.end - result.current.start).toBeLessThan(80);
  });

  it('says where to scroll for a row from where the scroller stands', () => {
    const el = scroller(520, 10_000 * ROW, 2_600);
    const { result } = mount(el, 10_000);
    // Row 100 is the first one showing: it is in view already.
    expect(result.current.scrollTopFor(100, 'nearest')).toBe(2_600);
    expect(result.current.scrollTopFor(50, 'nearest')).toBe(50 * ROW);
    expect(result.current.scrollTopFor(500, 'nearest')).toBe(501 * ROW - 520);
    expect(result.current.scrollTopFor(500, 'center')).toBe(500 * ROW - (520 - ROW) / 2);
  });

  it('has no place to scroll to before the scroller is laid out', () => {
    expect(mount(scroller(0, 0), 1_000).result.current.scrollTopFor(10, 'center')).toBeNull();
    expect(mount(null, 1_000).result.current.scrollTopFor(10, 'center')).toBeNull();
  });
});
