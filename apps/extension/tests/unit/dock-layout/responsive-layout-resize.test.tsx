// @vitest-environment jsdom
/**
 * useResponsiveLayout — sash-drag persistence stays OUT of the render
 * path. Allotment's onChange fires per pointer move during a divider
 * drag; each call must only update refs/timers. The state mirror (which
 * recomputes `sizes`) and the storage write ride the 500ms debounce —
 * a per-tick state update re-rendered the whole shell, every keep-alive
 * editor tab body included, making divider drags lag proportionally to
 * open-tab count.
 */

import { useResponsiveLayout } from '@openheaders/ui/workbench/hooks/useResponsiveLayout';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const applyLayoutSet = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock('@openheaders/ui/shared/sync/layout-state-write-client', () => ({ applyLayoutSet }));

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

afterEach(() => {
  vi.useRealTimers();
  applyLayoutSet.mockClear();
});

async function renderReadyHook() {
  const api = renderHook(() => useResponsiveLayout('ws-layout'));
  // Flush the async persisted-layout load (resolves to no saved record).
  await act(async () => {});
  expect(api.result.current.ready).toBe(true);
  return api;
}

describe('useResponsiveLayout — divider drag', () => {
  it('a burst of onPanelResize ticks causes no state update; sizes recompute once after the debounce', async () => {
    const api = await renderReadyHook();
    vi.useFakeTimers();
    const before = api.result.current.sizes;

    // A drag: Allotment onChange fires per pointer move.
    act(() => {
      for (let px = 300; px <= 400; px += 5) {
        api.result.current.onPanelResize([px, 900, 500]);
      }
    });
    // No re-render, no recompute — `sizes` is referentially unchanged.
    expect(api.result.current.sizes).toBe(before);
    expect(applyLayoutSet).not.toHaveBeenCalled();

    // Debounce elapses: one state mirror + one storage write, carrying
    // the LAST tick's ratios.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.result.current.sizes).not.toBe(before);
    expect(api.result.current.sizes.sidebar.preferred).toBe(400);
    expect(applyLayoutSet).toHaveBeenCalledTimes(1);
  });

  it('vertical drags debounce the same way', async () => {
    const api = await renderReadyHook();
    vi.useFakeTimers();
    const before = api.result.current.sizes;

    act(() => {
      for (let px = 250; px <= 300; px += 10) {
        api.result.current.onVerticalResize([600, px]);
      }
    });
    expect(api.result.current.sizes).toBe(before);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(api.result.current.sizes.bottom.preferred).toBe(300);
    expect(applyLayoutSet).toHaveBeenCalledTimes(1);
  });
});
