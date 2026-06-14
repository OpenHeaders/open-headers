/**
 * `cdp-status-reporter` — the CDP attach state → `cdp` Status pill bridge.
 *
 * Four concerns:
 *   - {@link describeCdpStatus} — the pure mapper, one row per state of
 *     the plan's table (incl. the green-not-grey OFF invariant) plus the
 *     host-resolved roster riding in `context.tabs`.
 *   - {@link installCdpStatusReporter} — baseline-on-install + transition
 *     forwarding over a fake controller surface, with async per-tab roster
 *     resolution and the stale-resolution generation guard.
 *   - {@link installLifecycleStatusReporters} — the host gate: no `cdp`
 *     report when `chrome.debugger` is absent (FF/Safari stay grey).
 */

import { __resetStatusForTests, getStatusSnapshot } from '@openheaders/ui/shared/status';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installLifecycleStatusReporters } from '@/background/bootstrap/lifecycle-status-reporters';
import { type CdpTabInfo, describeCdpStatus, installCdpStatusReporter } from '@/background/cdp-status-reporter';
import type { CdpAttachState } from '@/background/correlator-host/cdp-attach-controller';
import { getBrowserAPI } from '@/types/browser';

/** Flush microtasks + the macrotask queue so the async roster resolution lands. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function state(overrides: Partial<CdpAttachState> = {}): CdpAttachState {
  return { enabled: false, attachedTabs: [], pinnedTabs: [], lastFault: null, ...overrides };
}

/** Default tab resolver — title/url/window keyed off the id. */
function resolveTabFake(): (tabId: number) => Promise<CdpTabInfo | null> {
  return vi.fn(async (tabId: number) => ({
    windowId: 100 + tabId,
    index: tabId,
    title: `Tab ${tabId}`,
    url: `https://openheaders.io/${tabId}`,
  }));
}

/** A fake of the controller's observable surface with a manual trigger. */
function fakeObservable(initial: CdpAttachState, pinned: ReadonlySet<number> = new Set()) {
  let current = initial;
  const listeners = new Set<(s: CdpAttachState) => void>();
  return {
    getState: () => current,
    onChange: (listener: (s: CdpAttachState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isPinned: (tabId: number) => pinned.has(tabId),
    push: (next: CdpAttachState) => {
      current = next;
      for (const l of [...listeners]) l(next);
    },
  };
}

describe('describeCdpStatus', () => {
  it.each([
    [state({ enabled: false }), { state: 'green', message: 'Off' }],
    [state({ enabled: true, attachedTabs: [] }), { state: 'green', message: 'On · no tabs attached yet' }],
    [state({ enabled: true, attachedTabs: [1] }), { state: 'green', message: 'On · 1 tab' }],
    [state({ enabled: true, attachedTabs: [1, 2, 3] }), { state: 'green', message: 'On · 3 tabs' }],
    [
      state({ enabled: true, lastFault: { kind: 'attach-failed', tabId: 5 } }),
      { state: 'red', message: 'Tab 5 attach failed' },
    ],
    [
      state({ enabled: true, attachedTabs: [1, 2], lastFault: { kind: 'fell-back', tabId: 7 } }),
      { state: 'yellow', message: 'Tab 7 fell back to heuristic' },
    ],
  ])('maps %o → %o', (input, expected) => {
    const entry = describeCdpStatus(input);
    expect(entry.state).toBe(expected.state);
    expect(entry.message).toBe(expected.message);
  });

  it('OFF is explicit green (never grey), even with a stale fault', () => {
    const entry = describeCdpStatus(state({ enabled: false, lastFault: { kind: 'attach-failed', tabId: 9 } }));
    expect(entry.state).toBe('green');
    expect(entry.message).toBe('Off');
  });

  it('carries the resolved roster in context.tabs for the attached case', () => {
    const roster = [
      { tabId: 2, windowId: 11, index: 0, title: 'Docs', url: 'https://openheaders.io/docs', pinned: true },
    ];
    const entry = describeCdpStatus(state({ enabled: true, attachedTabs: [2], pinnedTabs: [2] }), roster);
    expect(entry.context).toMatchObject({ enabled: true, attachedCount: 1, tabs: roster, pinnedTabs: [2] });
  });

  it('carries pinnedTabs even while OFF (so the control reflects the pin pre-enable)', () => {
    expect(describeCdpStatus(state({ enabled: false, pinnedTabs: [4] })).context).toEqual({
      enabled: false,
      tabs: [],
      pinnedTabs: [4],
    });
  });

  it('reports an empty roster for the off + no-tabs cases', () => {
    expect(describeCdpStatus(state({ enabled: false })).context).toEqual({
      enabled: false,
      tabs: [],
      pinnedTabs: [],
    });
    expect(describeCdpStatus(state({ enabled: true, attachedTabs: [] })).context).toEqual({
      enabled: true,
      attachedCount: 0,
      tabs: [],
      pinnedTabs: [],
    });
  });
});

describe('installCdpStatusReporter', () => {
  const baseDeps = () => ({ resolveTab: resolveTabFake(), isPinned: () => false });

  it('emits a baseline immediately at install (sync, empty roster)', () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));

    installCdpStatusReporter({ report, getState: obs.getState, onChange: obs.onChange, ...baseDeps() });

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({
      state: 'green',
      message: 'Off',
      context: { enabled: false, tabs: [], pinnedTabs: [] },
    });
  });

  it('forwards each controller change (enabled→true, then 0→2 attached)', async () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }), new Set([2]));
    installCdpStatusReporter({
      report,
      getState: obs.getState,
      onChange: obs.onChange,
      resolveTab: resolveTabFake(),
      isPinned: obs.isPinned,
    });

    obs.push(state({ enabled: true, attachedTabs: [] }));
    obs.push(state({ enabled: true, attachedTabs: [1, 2] }));
    await flush();

    expect(report.mock.calls.map((c) => c[0].message)).toEqual(['Off', 'On · no tabs attached yet', 'On · 2 tabs']);
  });

  it('resolves the roster SW-side and stamps the per-tab pinned flag', async () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }), new Set([2]));
    installCdpStatusReporter({
      report,
      getState: obs.getState,
      onChange: obs.onChange,
      resolveTab: resolveTabFake(),
      isPinned: obs.isPinned,
    });

    obs.push(state({ enabled: true, attachedTabs: [1, 2], pinnedTabs: [2] }));
    await flush();

    expect(report).toHaveBeenLastCalledWith({
      state: 'green',
      message: 'On · 2 tabs',
      context: {
        enabled: true,
        attachedCount: 2,
        pinnedTabs: [2],
        tabs: [
          { tabId: 1, windowId: 101, index: 1, title: 'Tab 1', url: 'https://openheaders.io/1', pinned: false },
          { tabId: 2, windowId: 102, index: 2, title: 'Tab 2', url: 'https://openheaders.io/2', pinned: true },
        ],
      },
    });
  });

  it('drops a tab that fails to resolve (closed mid-flight) from the roster', async () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));
    const resolveTab = vi.fn(async (tabId: number) =>
      tabId === 1 ? null : { windowId: 9, index: tabId, title: `Tab ${tabId}`, url: `https://openheaders.io/${tabId}` },
    );
    installCdpStatusReporter({
      report,
      getState: obs.getState,
      onChange: obs.onChange,
      resolveTab,
      isPinned: obs.isPinned,
    });

    obs.push(state({ enabled: true, attachedTabs: [1, 2] }));
    await flush();

    const lastTabs = report.mock.lastCall?.[0].context.tabs as { tabId: number }[];
    expect(lastTabs.map((t) => t.tabId)).toEqual([2]);
  });

  it('generation guard: a burst keeps only the latest roster', async () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));
    installCdpStatusReporter({
      report,
      getState: obs.getState,
      onChange: obs.onChange,
      resolveTab: resolveTabFake(),
      isPinned: obs.isPinned,
    });

    obs.push(state({ enabled: true, attachedTabs: [1] }));
    obs.push(state({ enabled: true, attachedTabs: [1, 2] }));
    obs.push(state({ enabled: true, attachedTabs: [1, 2, 3] }));
    await flush();

    // The two superseded resolutions are dropped — last report is the 3-tab roster.
    expect(report).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'On · 3 tabs', context: expect.objectContaining({ attachedCount: 3 }) }),
    );
    const lastTabs = report.mock.lastCall?.[0].context.tabs as { tabId: number }[];
    expect(lastTabs.map((t) => t.tabId)).toEqual([1, 2, 3]);
  });

  it('forwards a fell-back fault as yellow', async () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: true, attachedTabs: [1] }));
    installCdpStatusReporter({
      report,
      getState: obs.getState,
      onChange: obs.onChange,
      resolveTab: resolveTabFake(),
      isPinned: obs.isPinned,
    });

    obs.push(state({ enabled: true, attachedTabs: [], lastFault: { kind: 'fell-back', tabId: 4 } }));
    await flush();

    expect(report).toHaveBeenLastCalledWith({
      state: 'yellow',
      message: 'Tab 4 fell back to heuristic',
      context: { enabled: true, attachedCount: 0, faultTabId: 4, tabs: [], pinnedTabs: [] },
    });
  });

  it('stops forwarding after dispose', async () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));
    const handle = installCdpStatusReporter({
      report,
      getState: obs.getState,
      onChange: obs.onChange,
      resolveTab: resolveTabFake(),
      isPinned: obs.isPinned,
    });

    handle.dispose();
    obs.push(state({ enabled: true, attachedTabs: [1] }));
    await flush();

    expect(report).toHaveBeenCalledTimes(1); // baseline only
  });
});

describe('installLifecycleStatusReporters host gate', () => {
  afterEach(() => {
    __resetStatusForTests();
  });

  it('installs the cdp reporter (green Off baseline) when chrome.debugger exists', () => {
    __resetStatusForTests();
    const obs = fakeObservable(state({ enabled: false }));

    installLifecycleStatusReporters({
      cdpAttach: { getState: obs.getState, onChange: obs.onChange, isPinned: obs.isPinned },
    });

    const cdp = getStatusSnapshot().cdp;
    expect(cdp?.state).toBe('green');
    expect(cdp?.message).toBe('Off');
  });

  it('never registers the reporter when chrome.debugger is absent (FF/Safari → grey)', () => {
    __resetStatusForTests();
    const api = getBrowserAPI();
    const original = api.debugger;
    Reflect.deleteProperty(api, 'debugger');
    try {
      const obs = fakeObservable(state({ enabled: false }));
      installLifecycleStatusReporters({
        cdpAttach: { getState: obs.getState, onChange: obs.onChange, isPinned: obs.isPinned },
      });
      expect(getStatusSnapshot().cdp).toBeUndefined();
    } finally {
      Reflect.set(api, 'debugger', original);
    }
  });
});
