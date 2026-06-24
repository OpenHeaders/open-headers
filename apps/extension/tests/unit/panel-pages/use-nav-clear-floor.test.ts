/**
 * `useNavClearFloor` — the "Preserve log" boundary as a monotonic per-tab
 * clear floor. Asserts the browser-parity behavior the reversible display
 * filter got wrong: re-enabling Preserve log records from that point
 * forward and never resurrects the past.
 *
 * Also covers the CDP (debug-mode) vocabulary: navigations are tagged
 * `document`, so the main-frame one is recognized by its loader id binding
 * to an observed page — without which a debug-mode tab's floor never moves.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useNavClearFloor } from '@openheaders/ui/panel/data/use-nav-clear-floor';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function lc(
  requestId: string,
  resourceType: string,
  startedAtMs: number,
  extra: Partial<RequestLifecycle> = {},
): RequestLifecycle {
  return {
    tabId: 1,
    requestId,
    url: `https://openheaders.io/${requestId}`,
    method: 'GET',
    resourceType,
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    completedAtMs: startedAtMs + 100,
    har: [],
    harBodyByHop: [],
    ...extra,
  };
}

function page(id: string, startedAtMs: number, loaderId?: string): Page {
  return { id, startedAtMs, url: `https://openheaders.io/${id}`, ...(loaderId ? { loaderId } : {}) };
}

const nav = (startedAtMs: number) => lc(`nav-${startedAtMs}`, 'main_frame', startedAtMs);
const xhr = (startedAtMs: number) => lc(`xhr-${startedAtMs}`, 'xmlhttprequest', startedAtMs);
const NO_PAGES: readonly Page[] = [];

describe('useNavClearFloor', () => {
  it('stays at -1 (no floor) while Preserve log is on, across navigations', () => {
    const { result, rerender } = renderHook(({ l, pg, p }) => useNavClearFloor(l, pg, p), {
      initialProps: { l: [nav(1000)], pg: NO_PAGES, p: true },
    });
    expect(result.current).toBe(-1);
    rerender({ l: [nav(1000), nav(2000)], pg: NO_PAGES, p: true });
    expect(result.current).toBe(-1);
  });

  it('advances to a navigation that commits while Preserve log is off', () => {
    const { result, rerender } = renderHook(({ l, pg, p }) => useNavClearFloor(l, pg, p), {
      initialProps: { l: [] as RequestLifecycle[], pg: NO_PAGES, p: false },
    });
    expect(result.current).toBe(-1);
    rerender({ l: [nav(2000)], pg: NO_PAGES, p: false });
    expect(result.current).toBe(2000);
  });

  it('freezes when Preserve log is re-enabled — never resurrects the past', () => {
    // The reported bug: on → off + navigate (clears) → on again must keep
    // the past scoped out and preserve everything from that point forward.
    const { result, rerender } = renderHook(({ l, pg, p }) => useNavClearFloor(l, pg, p), {
      initialProps: { l: [nav(1000)], pg: NO_PAGES, p: true },
    });
    expect(result.current).toBe(-1);

    // Turn off, navigate → the prior page is cleared (floor advances).
    rerender({ l: [nav(1000), nav(2000)], pg: NO_PAGES, p: false });
    expect(result.current).toBe(2000);

    // Turn back on, navigate again → floor frozen at 2000: nav(1000) stays
    // hidden, nav(3000) accumulates.
    rerender({ l: [nav(1000), nav(2000), nav(3000)], pg: NO_PAGES, p: true });
    expect(result.current).toBe(2000);
  });

  it('stays at -1 when no top-level navigation has been observed', () => {
    const { result } = renderHook(() => useNavClearFloor([xhr(100), xhr(200)], NO_PAGES, false));
    expect(result.current).toBe(-1);
  });

  it('toggling Preserve log without a navigation does not move the floor', () => {
    const lifecycles = [nav(1000)];
    const { result, rerender } = renderHook(({ p }) => useNavClearFloor(lifecycles, NO_PAGES, p), {
      initialProps: { p: true },
    });
    expect(result.current).toBe(-1);
    // Same lifecycles, only the toggle flips → floor unchanged (it advances
    // on navigation, not on the toggle).
    rerender({ p: false });
    expect(result.current).toBe(-1);
  });

  it('advances on a CDP document navigation whose loader id binds to a page', () => {
    const doc = lc('cdp-nav', 'document', 2000, { loaderId: 'loader-A' });
    const { result } = renderHook(() => useNavClearFloor([doc], [page('page_1', 2000, 'loader-A')], false));
    expect(result.current).toBe(2000);
  });

  it('ignores a CDP iframe document whose loader id is not a page (no false floor)', () => {
    // The iframe carries its OWN loader id, never the page's main-frame one.
    const iframe = lc('cdp-iframe', 'document', 2000, { loaderId: 'loader-iframe' });
    const { result } = renderHook(() => useNavClearFloor([iframe], [page('page_1', 1000, 'loader-A')], false));
    expect(result.current).toBe(-1);
  });

  it('recognizes the CDP navigation only once its page lands (loader bind trails)', () => {
    const doc = lc('cdp-nav', 'document', 2000, { loaderId: 'loader-A' });
    const { result, rerender } = renderHook(({ l, pg, p }) => useNavClearFloor(l, pg, p), {
      // Document seen before the page is observed → not yet recognized.
      initialProps: { l: [doc], pg: NO_PAGES, p: false },
    });
    expect(result.current).toBe(-1);
    // Page lands → loader id binds → floor advances.
    rerender({ l: [doc], pg: [page('page_1', 2000, 'loader-A')], p: false });
    expect(result.current).toBe(2000);
  });
});
