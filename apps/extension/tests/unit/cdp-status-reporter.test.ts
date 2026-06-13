/**
 * `cdp-status-reporter` — the CDP attach state → `cdp` Status pill bridge.
 *
 * Three concerns:
 *   - {@link describeCdpStatus} — the pure mapper, one row per state of
 *     the plan's table (incl. the green-not-grey OFF invariant).
 *   - {@link installCdpStatusReporter} — baseline-on-install + transition
 *     forwarding over a fake controller surface.
 *   - {@link installLifecycleStatusReporters} — the host gate: no `cdp`
 *     report when `chrome.debugger` is absent (FF/Safari stay grey).
 */

import { __resetStatusForTests, getStatusSnapshot } from '@openheaders/ui/shared/status';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installLifecycleStatusReporters } from '@/background/bootstrap/lifecycle-status-reporters';
import { describeCdpStatus, installCdpStatusReporter } from '@/background/cdp-status-reporter';
import type { CdpAttachState } from '@/background/correlator-host/cdp-attach-controller';
import { getBrowserAPI } from '@/types/browser';

function state(overrides: Partial<CdpAttachState> = {}): CdpAttachState {
  return { enabled: false, attachedTabs: [], lastFault: null, ...overrides };
}

/** A fake of the controller's observable surface with a manual trigger. */
function fakeObservable(initial: CdpAttachState) {
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
});

describe('installCdpStatusReporter', () => {
  it('emits a baseline immediately at install', () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));

    installCdpStatusReporter({ report, getState: obs.getState, onChange: obs.onChange });

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({ state: 'green', message: 'Off', context: { enabled: false } });
  });

  it('forwards each controller change (enabled→true, then 0→2 attached)', () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));
    installCdpStatusReporter({ report, getState: obs.getState, onChange: obs.onChange });

    obs.push(state({ enabled: true, attachedTabs: [] }));
    obs.push(state({ enabled: true, attachedTabs: [1, 2] }));

    expect(report.mock.calls.map((c) => c[0].message)).toEqual(['Off', 'On · no tabs attached yet', 'On · 2 tabs']);
  });

  it('forwards a fell-back fault as yellow', () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: true, attachedTabs: [1] }));
    installCdpStatusReporter({ report, getState: obs.getState, onChange: obs.onChange });

    obs.push(state({ enabled: true, attachedTabs: [], lastFault: { kind: 'fell-back', tabId: 4 } }));

    expect(report).toHaveBeenLastCalledWith({
      state: 'yellow',
      message: 'Tab 4 fell back to heuristic',
      context: { enabled: true, attachedCount: 0, faultTabId: 4 },
    });
  });

  it('stops forwarding after dispose', () => {
    const report = vi.fn();
    const obs = fakeObservable(state({ enabled: false }));
    const handle = installCdpStatusReporter({ report, getState: obs.getState, onChange: obs.onChange });

    handle.dispose();
    obs.push(state({ enabled: true, attachedTabs: [1] }));

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

    installLifecycleStatusReporters({ cdpAttach: { getState: obs.getState, onChange: obs.onChange } });

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
      installLifecycleStatusReporters({ cdpAttach: { getState: obs.getState, onChange: obs.onChange } });
      expect(getStatusSnapshot().cdp).toBeUndefined();
    } finally {
      Reflect.set(api, 'debugger', original);
    }
  });
});
