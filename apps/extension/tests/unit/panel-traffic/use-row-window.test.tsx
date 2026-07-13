/**
 * `useRowWindow` tail-follow — the stick-to-bottom contract under batched
 * bursts. Regression coverage for the bug where a single burst of many rows
 * (rAF-coalesced ingestion) released the pin and the table stopped following
 * new traffic.
 *
 * The hook reads layout geometry off its scroll element (`clientHeight`,
 * `scrollHeight`, `scrollTop`), which jsdom does not compute. A real `<div>`
 * with those three properties mocked stands in: `scrollTop` is a clamped
 * read/write cell and `scrollHeight` tracks a content height the test grows
 * to mirror rows streaming in. The pin decision is pure JS over those
 * values, so this exercises exactly the logic that decides follow-vs-release
 * (the CSS `overflow-anchor: none` half of the fix is a real-browser
 * concern jsdom cannot reproduce).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useRowWindow } from '@openheaders/ui/panel/components/traffic/use-row-window';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { projectPanelData } from '@openheaders/ui/panel/data/panel-data-projection';
import { setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { act, renderHook } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ROW_HEIGHT_PX = 20;
const VIEWPORT_PX = 400;

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

function makeLifecycle(index: number): RequestLifecycle {
  return {
    tabId: 1,
    requestId: `r${index}`,
    url: `https://openheaders.io/${index}`,
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'pending',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 100 + index,
    hopStartedAtMs: 100 + index,
    har: [],
    harBodyByHop: [],
  };
}

/** `n` real rows via the production projection — one row per lifecycle. */
function makeRows(n: number): readonly InspectorRowWithFires[] {
  const byRequestId = new Map<string, RequestLifecycle>();
  const ordered: RequestLifecycle[] = [];
  for (let i = 0; i < n; i++) {
    const lc = makeLifecycle(i);
    byRequestId.set(lc.requestId, lc);
    ordered.push(lc);
  }
  return projectPanelData({
    lifecycle: { byRequestId, ordered },
    page: { pages: [] },
    fire: { fires: [] },
    opts: { consolidateRetries: false },
  }).rows;
}

/**
 * A real div whose scroll geometry is controllable. `scrollTop` clamps to
 * `[0, scrollHeight - clientHeight]` like a browser; `setRowCount` grows the
 * scroll height the way layout would once `n` fixed-height rows are mounted.
 */
function makeScrollEl(): { el: HTMLDivElement; setRowCount: (n: number) => void; bottomFor: (n: number) => number } {
  const el = document.createElement('div');
  let contentHeight = 0;
  let scrollTopValue = 0;
  const maxScroll = (): number => Math.max(0, contentHeight - VIEWPORT_PX);
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => VIEWPORT_PX });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => contentHeight });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => scrollTopValue,
    set: (v: number) => {
      scrollTopValue = Math.max(0, Math.min(v, maxScroll()));
    },
  });
  return {
    el,
    // The column header lives outside the scroller (.dt-table-headwrap),
    // so the content height is rows only.
    setRowCount: (n) => {
      contentHeight = n * ROW_HEIGHT_PX;
    },
    bottomFor: (n) => Math.max(0, n * ROW_HEIGHT_PX - VIEWPORT_PX),
  };
}

describe('useRowWindow — tail-follow under bursts', () => {
  let scroll: ReturnType<typeof makeScrollEl>;
  let api: ReturnType<typeof renderHook<ReturnType<typeof useRowWindow>, { rows: readonly InspectorRowWithFires[] }>>;

  // Render with N rows, after first growing the mocked scroll height so the
  // hook's post-commit effects read the layout a real browser would.
  const stream = (rows: readonly InspectorRowWithFires[]): void => {
    scroll.setRowCount(rows.length);
    act(() => api.rerender({ rows }));
  };

  // Simulate a browser scroll event after moving (or not moving) scrollTop.
  const scrollTo = (top: number): void => {
    scroll.el.scrollTop = top;
    act(() => api.result.current.onScroll());
  };

  beforeEach(() => {
    scroll = makeScrollEl();
    api = renderHook(
      (props: { rows: readonly InspectorRowWithFires[] }) => useRowWindow(props.rows, props.rows.length > 0),
      {
        initialProps: { rows: [] as readonly InspectorRowWithFires[] },
      },
    );
    // Attach the mocked element the way React would attach the real one.
    api.result.current.tableRef.current = scroll.el;
  });

  it('snaps to the bottom when a burst of rows arrives while parked there', () => {
    stream(makeRows(50));
    expect(scroll.el.scrollTop).toBe(scroll.bottomFor(50));
  });

  it('stays pinned when content growth fires a scroll event without an upward move', () => {
    stream(makeRows(50));
    scrollTo(scroll.bottomFor(50)); // settle at the tail

    // A burst grows the scroll height; the scroll event that the browser may
    // emit reads the *same* scrollTop against the taller content. The old
    // distance check read this as "far from bottom" and released the pin.
    scroll.setRowCount(100);
    act(() => api.result.current.onScroll());

    stream(makeRows(100));
    expect(scroll.el.scrollTop).toBe(scroll.bottomFor(100));
  });

  it('releases the pin when the user scrolls up, and stops following', () => {
    stream(makeRows(100));
    scrollTo(scroll.bottomFor(100));

    scrollTo(300); // user scrolls up, away from the tail

    stream(makeRows(150));
    expect(scroll.el.scrollTop).toBe(300); // did not snap
  });

  it('holds notify flushes on user scrolls but not on tail-follow auto-scrolls', () => {
    const holdFor = vi.fn();
    setNotifyScheduler({ schedule: (flush) => flush(), flushNow() {}, holdFor });
    try {
      // The pin effect's own scrollTop write fires an async scroll event —
      // simulated here by the bare onScroll — which must NOT hold flushes,
      // or a pinned live capture would throttle its own update cadence.
      stream(makeRows(50));
      act(() => api.result.current.onScroll());
      expect(holdFor).not.toHaveBeenCalled();

      // A genuine user scroll holds the flushes for the trailing beat.
      scrollTo(300);
      expect(holdFor).toHaveBeenCalledWith(150);
    } finally {
      setNotifyScheduler(null);
    }
  });

  it('re-pins once the user scrolls back to the tail', () => {
    stream(makeRows(100));
    scrollTo(scroll.bottomFor(100)); // settle at the tail (the auto-scroll's own event)
    scrollTo(300); // user scrolls up → released
    stream(makeRows(150));
    expect(scroll.el.scrollTop).toBe(300);

    scrollTo(scroll.bottomFor(150)); // back at the tail → re-pin

    stream(makeRows(200));
    expect(scroll.el.scrollTop).toBe(scroll.bottomFor(200));
  });
});
