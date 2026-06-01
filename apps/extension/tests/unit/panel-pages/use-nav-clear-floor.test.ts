/**
 * `useNavClearFloor` — the "Preserve log" boundary as a monotonic per-tab
 * clear floor. Asserts the browser-parity behavior the reversible display
 * filter got wrong: re-enabling Preserve log records from that point
 * forward and never resurrects the past.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useNavClearFloor } from '@openheaders/ui/panel/data/use-nav-clear-floor';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function lc(requestId: string, resourceType: string, startedAtMs: number): RequestLifecycle {
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
  };
}

const nav = (startedAtMs: number) => lc(`nav-${startedAtMs}`, 'main_frame', startedAtMs);
const xhr = (startedAtMs: number) => lc(`xhr-${startedAtMs}`, 'xmlhttprequest', startedAtMs);

describe('useNavClearFloor', () => {
  it('stays at -1 (no floor) while Preserve log is on, across navigations', () => {
    const { result, rerender } = renderHook(({ l, p }) => useNavClearFloor(l, p), {
      initialProps: { l: [nav(1000)], p: true },
    });
    expect(result.current).toBe(-1);
    rerender({ l: [nav(1000), nav(2000)], p: true });
    expect(result.current).toBe(-1);
  });

  it('advances to a navigation that commits while Preserve log is off', () => {
    const { result, rerender } = renderHook(({ l, p }) => useNavClearFloor(l, p), {
      initialProps: { l: [] as RequestLifecycle[], p: false },
    });
    expect(result.current).toBe(-1);
    rerender({ l: [nav(2000)], p: false });
    expect(result.current).toBe(2000);
  });

  it('freezes when Preserve log is re-enabled — never resurrects the past', () => {
    // The reported bug: on → off + navigate (clears) → on again must keep
    // the past scoped out and preserve everything from that point forward.
    const { result, rerender } = renderHook(({ l, p }) => useNavClearFloor(l, p), {
      initialProps: { l: [nav(1000)], p: true },
    });
    expect(result.current).toBe(-1);

    // Turn off, navigate → the prior page is cleared (floor advances).
    rerender({ l: [nav(1000), nav(2000)], p: false });
    expect(result.current).toBe(2000);

    // Turn back on, navigate again → floor frozen at 2000: nav(1000) stays
    // hidden, nav(3000) accumulates.
    rerender({ l: [nav(1000), nav(2000), nav(3000)], p: true });
    expect(result.current).toBe(2000);
  });

  it('stays at -1 when no top-level navigation has been observed', () => {
    const { result } = renderHook(() => useNavClearFloor([xhr(100), xhr(200)], false));
    expect(result.current).toBe(-1);
  });

  it('toggling Preserve log without a navigation does not move the floor', () => {
    const lifecycles = [nav(1000)];
    const { result, rerender } = renderHook(({ p }) => useNavClearFloor(lifecycles, p), {
      initialProps: { p: true },
    });
    expect(result.current).toBe(-1);
    // Same lifecycles, only the toggle flips → floor unchanged (it advances
    // on navigation, not on the toggle).
    rerender({ p: false });
    expect(result.current).toBe(-1);
  });
});
