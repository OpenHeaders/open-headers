/**
 * `TabSourceRouter` — the single owner of the per-tab invariant **exactly
 * one correlator feeds a tab** (Slice 3).
 *
 * Coverage:
 *   - default `attachTab` registers a tab at the heuristic owner only;
 *   - `route` to an owner attaches that correlator and detaches the other —
 *     a tab is never left on both;
 *   - `route` is idempotent (no-op when already that owner);
 *   - `detachTab` detaches the owning correlator and clears the entry;
 *   - routing/detaching an unknown tab is well-defined.
 */

import { describe, expect, it, vi } from 'vitest';

import { TabSourceRouter } from '@/background/correlator-host/tab-source-router';

const TAB = 7;

function makeRouter() {
  const heuristic = { attachTab: vi.fn(), detachTab: vi.fn() };
  const cdp = { attachTab: vi.fn(), detachTab: vi.fn() };
  const router = new TabSourceRouter({ heuristic, cdp });
  return { router, heuristic, cdp };
}

describe('TabSourceRouter — default ownership', () => {
  it('attachTab registers a tab at the heuristic owner only', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    expect(heuristic.attachTab).toHaveBeenCalledWith(TAB);
    expect(cdp.attachTab).not.toHaveBeenCalled();
    expect(cdp.detachTab).not.toHaveBeenCalled();
  });

  it('attachTab is idempotent — a second call does not re-attach', () => {
    const { router, heuristic } = makeRouter();
    router.attachTab(TAB);
    router.attachTab(TAB);
    expect(heuristic.attachTab).toHaveBeenCalledTimes(1);
  });

  it('attachTab does not clobber an existing CDP claim', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    router.route(TAB, 'cdp');
    cdp.attachTab.mockClear();
    heuristic.attachTab.mockClear();
    router.attachTab(TAB);
    expect(heuristic.attachTab).not.toHaveBeenCalled();
    expect(cdp.attachTab).not.toHaveBeenCalled();
  });
});

describe('TabSourceRouter — route never leaves a tab on two correlators', () => {
  it('route to cdp attaches cdp and detaches heuristic', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    heuristic.attachTab.mockClear();
    router.route(TAB, 'cdp');
    expect(cdp.attachTab).toHaveBeenCalledWith(TAB);
    expect(heuristic.detachTab).toHaveBeenCalledWith(TAB);
    expect(heuristic.attachTab).not.toHaveBeenCalled();
  });

  it('route back to heuristic attaches heuristic and detaches cdp', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    router.route(TAB, 'cdp');
    heuristic.attachTab.mockClear();
    cdp.detachTab.mockClear();
    router.route(TAB, 'heuristic');
    expect(heuristic.attachTab).toHaveBeenCalledWith(TAB);
    expect(cdp.detachTab).toHaveBeenCalledWith(TAB);
  });

  it('route is a no-op when the tab is already that owner', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    router.route(TAB, 'cdp');
    cdp.attachTab.mockClear();
    heuristic.detachTab.mockClear();
    router.route(TAB, 'cdp');
    expect(cdp.attachTab).not.toHaveBeenCalled();
    expect(heuristic.detachTab).not.toHaveBeenCalled();
  });

  it('routing an unknown tab to cdp is well-defined (attach cdp, detach heuristic)', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.route(TAB, 'cdp');
    expect(cdp.attachTab).toHaveBeenCalledWith(TAB);
    expect(heuristic.detachTab).toHaveBeenCalledWith(TAB);
  });
});

describe('TabSourceRouter — detachTab', () => {
  it('detaches the heuristic owner and clears the entry', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    router.detachTab(TAB);
    expect(heuristic.detachTab).toHaveBeenCalledWith(TAB);
    expect(cdp.detachTab).not.toHaveBeenCalled();
    // Cleared: a subsequent attachTab re-registers (re-attaches) the tab.
    heuristic.attachTab.mockClear();
    router.attachTab(TAB);
    expect(heuristic.attachTab).toHaveBeenCalledWith(TAB);
  });

  it('detaches the cdp owner when the tab was routed to cdp', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.attachTab(TAB);
    router.route(TAB, 'cdp');
    heuristic.detachTab.mockClear();
    router.detachTab(TAB);
    expect(cdp.detachTab).toHaveBeenCalledWith(TAB);
    expect(heuristic.detachTab).not.toHaveBeenCalled();
  });

  it('detaching an unknown tab is a no-op', () => {
    const { router, heuristic, cdp } = makeRouter();
    router.detachTab(TAB);
    expect(heuristic.detachTab).not.toHaveBeenCalled();
    expect(cdp.detachTab).not.toHaveBeenCalled();
  });
});
