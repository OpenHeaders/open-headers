// @vitest-environment jsdom
/**
 * The known-heights row window's hook over a scroller whose numbers are
 * set by hand: the rows mounted follow the scroll position; a scroller
 * never laid out mounts the whole list; one that HAD a height and lost
 * it — a kept-alive list hidden behind another — keeps the window it
 * had, held to the rows there are, and is windowed again when it comes
 * back. And the scroll position that shows a row whole, moved the least.
 */

import { nearestScrollTopForRow, useVirtualRowWindow } from '@openheaders/ui/shared/virtual-window';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ROW = 20;

/** A scroller as an engine lays it out; `height.px` is changed by hand to hide and show it. */
function scroller(height: { px: number }, scrollTop = 0): HTMLDivElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => height.px });
  el.scrollTop = scrollTop;
  return el;
}

/** The observers the hook made, so a test resizes its scroller. */
let observers: { fire: () => void; disconnected: boolean }[] = [];
const resize = (): void =>
  act(() => {
    for (const entry of observers) if (!entry.disconnected) entry.fire();
  });

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

const heightsOf = (count: number): number[] => new Array<number>(count).fill(ROW);

const mount = (el: HTMLElement, count: number) =>
  renderHook(({ heights }: { heights: number[] }) => useVirtualRowWindow({ current: el }, heights, true), {
    initialProps: { heights: heightsOf(count) },
  });

describe('useVirtualRowWindow', () => {
  it('mounts the rows around the scroll position, with the rest as padding', () => {
    const { result } = mount(scroller({ px: 400 }, 10_000), 2_000);
    // Row 500 sits at the viewport's top: 600 px of rows are mounted above and below what shows.
    expect(result.current).toMatchObject({ start: 470, end: 550, topPadPx: 470 * ROW, bottomPadPx: 1_450 * ROW });
  });

  it('a scroller never laid out mounts the whole list', () => {
    const { result } = mount(scroller({ px: 0 }), 2_000);
    expect(result.current).toMatchObject({ start: 0, end: 2_000 });
  });

  it('a scroller that loses its height keeps the window it had — a hidden list never mounts whole', () => {
    const height = { px: 400 };
    const { result } = mount(scroller(height, 10_000), 2_000);
    height.px = 0;
    resize();
    expect(result.current).toMatchObject({ start: 470, end: 550 });
  });

  it('hidden, the window is held to the rows there are; shown again, it is placed by the scroller', () => {
    const height = { px: 400 };
    const el = scroller(height, 10_000);
    const { result, rerender } = mount(el, 2_000);
    height.px = 0;
    resize();
    rerender({ heights: heightsOf(500) });
    expect(result.current).toMatchObject({ start: 470, end: 500 });
    rerender({ heights: heightsOf(5_000) });
    expect(result.current).toMatchObject({ start: 470, end: 500 });
    height.px = 400;
    el.scrollTop = 20_000;
    resize();
    expect(result.current).toMatchObject({ start: 970, end: 1_050 });
  });
});

describe('nearestScrollTopForRow', () => {
  // Rows of 20, 30 and 50 px: tops at 0, 20, 50; the list is 100 px tall.
  const prefix = [0, 20, 50, 100];

  it('keeps the position where the row already shows whole', () => {
    expect(nearestScrollTopForRow(prefix, 1, 10, 60)).toBe(10);
  });

  it('brings a row above the viewport to its top edge', () => {
    expect(nearestScrollTopForRow(prefix, 0, 30, 60)).toBe(0);
  });

  it('brings a row below the viewport to its bottom edge', () => {
    expect(nearestScrollTopForRow(prefix, 2, 0, 60)).toBe(40);
  });
});
