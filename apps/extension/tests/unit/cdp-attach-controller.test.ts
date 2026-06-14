/**
 * `CdpAttachController` — the derived reconciler proving the locked
 * invariant
 *
 *     attached = ( drivers(scopeMode) ∪ pinned ) ∩ { master switch ON }
 *
 * across the scope-mode matrix (devtools / active / both), the explicit
 * per-tab pin overlay, and the handoff transitions (the
 * connect→disconnect-before-attach-resolves race, onDetach route-back, and
 * SW-wake re-attach).
 *
 * Spy source ({ attach, detach, onDetach }) + spy router ({ route }) — the
 * controller is effect-only over its injected inputs, so no chrome.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CdpAttachController } from '@/background/correlator-host/cdp-attach-controller';

/** Flush all pending microtasks (the per-tab attach op chain). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeHarness() {
  const attach = vi.fn<(tabId: number) => Promise<void>>().mockResolvedValue(undefined);
  const detach = vi.fn<(tabId: number) => Promise<void>>().mockResolvedValue(undefined);
  let detachListener: ((tabId: number, reason: string) => void) | null = null;
  const onDetach = vi.fn((listener: (tabId: number, reason: string) => void) => {
    detachListener = listener;
    return () => {
      detachListener = null;
    };
  });
  const route = vi.fn<(tabId: number, owner: 'heuristic' | 'cdp') => void>();
  const replayFn = vi.fn<(tabId: number) => void>();
  const release = vi.fn<(tabId: number) => void>();

  const source = { attach, detach, onDetach };
  const router = { route };
  const replay = { replay: replayFn, release };
  const controller = new CdpAttachController({ source, router, replay });

  return {
    controller,
    attach,
    detach,
    route,
    onDetach,
    replayFn,
    release,
    fireDetach: (tabId: number, reason: string) => detachListener?.(tabId, reason),
  };
}

describe('CdpAttachController', () => {
  let h: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    h = makeHarness();
  });

  it('port-connect while the flag is ON attaches + routes the tab to cdp (default devtools scope)', async () => {
    h.controller.setEnabled(true);
    h.controller.notePortConnected(5);
    await flush();

    expect(h.attach).toHaveBeenCalledWith(5);
    expect(h.route).toHaveBeenCalledWith(5, 'cdp');
  });

  it('port-connect while the flag is OFF attaches nothing', async () => {
    h.controller.notePortConnected(5);
    await flush();

    expect(h.attach).not.toHaveBeenCalled();
    expect(h.route).not.toHaveBeenCalled();
  });

  it('flag-ON while N ports are already live attaches all N', async () => {
    h.controller.notePortConnected(1);
    h.controller.notePortConnected(2);
    h.controller.notePortConnected(3);
    await flush();
    expect(h.attach).not.toHaveBeenCalled();

    h.controller.setEnabled(true);
    await flush();

    expect(h.attach.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2, 3]);
    expect(h.route).toHaveBeenCalledWith(1, 'cdp');
    expect(h.route).toHaveBeenCalledWith(2, 'cdp');
    expect(h.route).toHaveBeenCalledWith(3, 'cdp');
  });

  it('flag-OFF while N tabs are attached detaches all N back to heuristic', async () => {
    h.controller.setEnabled(true);
    h.controller.notePortConnected(1);
    h.controller.notePortConnected(2);
    h.controller.notePortConnected(3);
    await flush();
    expect(h.attach).toHaveBeenCalledTimes(3);

    h.controller.setEnabled(false);
    await flush();

    expect(h.detach.mock.calls.map((c) => c[0]).sort()).toEqual([1, 2, 3]);
    expect(h.route).toHaveBeenCalledWith(1, 'heuristic');
    expect(h.route).toHaveBeenCalledWith(2, 'heuristic');
    expect(h.route).toHaveBeenCalledWith(3, 'heuristic');
  });

  it('port-disconnect detaches that one tab and leaves the others attached', async () => {
    h.controller.setEnabled(true);
    h.controller.notePortConnected(1);
    h.controller.notePortConnected(2);
    await flush();

    h.controller.notePortDisconnected(1);
    await flush();

    expect(h.detach).toHaveBeenCalledTimes(1);
    expect(h.detach).toHaveBeenCalledWith(1);
    expect(h.route).toHaveBeenCalledWith(1, 'heuristic');
    // Tab 2 untouched — still cdp-owned, never detached.
    expect(h.detach).not.toHaveBeenCalledWith(2);
  });

  it.each([
    'canceled_by_user',
    'target_closed',
    'replaced_with_devtools',
  ])('onDetach(%s) routes the tab back to heuristic and drops it without reconciling', async (reason) => {
    h.controller.setEnabled(true);
    h.controller.notePortConnected(5);
    await flush();
    expect(h.attach).toHaveBeenCalledTimes(1);
    h.route.mockClear();

    h.fireDetach(5, reason);
    await flush();

    expect(h.route).toHaveBeenCalledWith(5, 'heuristic');
    // No reconcile: the port is still live + flag still ON, yet the tab is
    // NOT re-attached (which would fight a banner-Cancel).
    expect(h.attach).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — re-connecting an attached tab and double flag-ON never re-attach', async () => {
    h.controller.setEnabled(true);
    h.controller.notePortConnected(5);
    await flush();
    expect(h.attach).toHaveBeenCalledTimes(1);

    h.controller.notePortConnected(5);
    h.controller.setEnabled(true);
    await flush();

    expect(h.attach).toHaveBeenCalledTimes(1);
    expect(h.route).toHaveBeenCalledTimes(1);
  });

  it('SW-wake — dispose detaches the live set; a fresh controller re-attaches on port reconnect', async () => {
    h.controller.setEnabled(true);
    h.controller.notePortConnected(7);
    await flush();
    expect(h.attach).toHaveBeenCalledTimes(1);

    h.controller.dispose();
    await flush();
    expect(h.detach).toHaveBeenCalledWith(7);

    // SW wakes: a fresh controller, the devtools_page port lazy-reconnects.
    const woken = makeHarness();
    woken.controller.setEnabled(true);
    woken.controller.notePortConnected(7);
    await flush();

    expect(woken.attach).toHaveBeenCalledWith(7);
    expect(woken.route).toHaveBeenCalledWith(7, 'cdp');
  });

  it('connect→disconnect before attach resolves leaves the tab heuristic-owned, never cdp-attached', async () => {
    let resolveAttach: () => void = () => {};
    h.attach.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveAttach = resolve;
        }),
    );

    h.controller.setEnabled(true);
    h.controller.notePortConnected(9);
    await flush(); // applyTab runs, attach(9) is now in-flight (deferred)
    expect(h.attach).toHaveBeenCalledWith(9);

    h.controller.notePortDisconnected(9); // port gone mid-handshake
    resolveAttach(); // the attach handshake completes
    await flush();

    // The post-await re-check saw the port vanish → undo the handshake.
    expect(h.detach).toHaveBeenCalledWith(9);
    // The tab was NEVER routed to cdp — it stays at its heuristic default.
    expect(h.route).not.toHaveBeenCalledWith(9, 'cdp');
  });

  it('dispose unsubscribes onDetach', () => {
    const { controller, onDetach, fireDetach, route } = makeHarness();
    expect(onDetach).toHaveBeenCalledTimes(1);
    controller.dispose();
    // The captured listener was torn down — a late detach reaches nobody.
    fireDetach(1, 'target_closed');
    expect(route).not.toHaveBeenCalled();
  });

  describe('scope modes (which driver sets are live)', () => {
    it('devtools mode (default): the active tab is ignored — only ports attach', async () => {
      h.controller.setEnabled(true);
      h.controller.noteActiveTab(5);
      await flush();
      expect(h.attach).not.toHaveBeenCalled();

      h.controller.notePortConnected(6);
      await flush();
      expect(h.attach).toHaveBeenCalledWith(6);
      expect(h.attach).not.toHaveBeenCalledWith(5);
    });

    it('active mode: the active tab attaches and a port-live tab does not', async () => {
      h.controller.setScopeMode('active');
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      h.controller.noteActiveTab(6);
      await flush();

      expect(h.attach).toHaveBeenCalledWith(6);
      expect(h.attach).not.toHaveBeenCalledWith(5);
      expect(h.route).toHaveBeenCalledWith(6, 'cdp');
    });

    it('active mode follows focus: a new active tab detaches the old one and attaches the new', async () => {
      h.controller.setScopeMode('active');
      h.controller.setEnabled(true);
      h.controller.noteActiveTab(5);
      await flush();
      expect(h.attach).toHaveBeenCalledWith(5);

      h.controller.noteActiveTab(6);
      await flush();
      expect(h.detach).toHaveBeenCalledWith(5);
      expect(h.route).toHaveBeenCalledWith(5, 'heuristic');
      expect(h.attach).toHaveBeenCalledWith(6);
    });

    it('active mode: clearing the active tab (null) detaches it', async () => {
      h.controller.setScopeMode('active');
      h.controller.setEnabled(true);
      h.controller.noteActiveTab(5);
      await flush();
      expect(h.attach).toHaveBeenCalledWith(5);

      h.controller.noteActiveTab(null);
      await flush();
      expect(h.detach).toHaveBeenCalledWith(5);
    });

    it('both mode: a port-live tab AND the active tab both attach', async () => {
      h.controller.setScopeMode('both');
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      h.controller.noteActiveTab(6);
      await flush();

      expect(h.attach.mock.calls.map((c) => c[0]).sort()).toEqual([5, 6]);
    });

    it('switching devtools→active detaches a port-only tab and attaches the active tab', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      h.controller.noteActiveTab(6);
      await flush();
      // devtools mode: only the port tab attached.
      expect(h.attach).toHaveBeenCalledWith(5);
      expect(h.attach).not.toHaveBeenCalledWith(6);

      h.controller.setScopeMode('active');
      await flush();
      // active mode: port tab leaves the set, active tab joins.
      expect(h.detach).toHaveBeenCalledWith(5);
      expect(h.attach).toHaveBeenCalledWith(6);
    });

    it('a tab that is both port-live and active stays attached across a devtools→active switch', async () => {
      h.controller.setScopeMode('both');
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      h.controller.noteActiveTab(5);
      await flush();
      expect(h.attach).toHaveBeenCalledTimes(1);

      h.controller.setScopeMode('active');
      await flush();
      // Still desired via the active driver — never detached.
      expect(h.detach).not.toHaveBeenCalled();
    });
  });

  describe('pins (the explicit per-tab overlay)', () => {
    it('pinning a tab while the flag is ON attaches it regardless of mode', async () => {
      h.controller.setEnabled(true);
      h.controller.notePinned(5);
      await flush();

      expect(h.attach).toHaveBeenCalledWith(5);
      expect(h.route).toHaveBeenCalledWith(5, 'cdp');
    });

    it('pinning while the flag is OFF attaches nothing', async () => {
      h.controller.notePinned(5);
      await flush();
      expect(h.attach).not.toHaveBeenCalled();
    });

    it('a pinned tab stays attached when the active tab moves away (active mode)', async () => {
      h.controller.setScopeMode('active');
      h.controller.setEnabled(true);
      h.controller.noteActiveTab(5);
      h.controller.notePinned(5);
      await flush();
      expect(h.attach).toHaveBeenCalledTimes(1);

      // Focus moves to another tab → 5 is no longer active, but stays pinned.
      h.controller.noteActiveTab(6);
      await flush();
      expect(h.detach).not.toHaveBeenCalledWith(5);

      // Unpin too → now undesired, detaches.
      h.controller.noteUnpinned(5);
      await flush();
      expect(h.detach).toHaveBeenCalledWith(5);
    });

    it('unpinning a pin-only tab detaches it back to heuristic', async () => {
      h.controller.setEnabled(true);
      h.controller.notePinned(5);
      await flush();

      h.controller.noteUnpinned(5);
      await flush();
      expect(h.detach).toHaveBeenCalledWith(5);
      expect(h.route).toHaveBeenCalledWith(5, 'heuristic');
    });

    it('isPinned tracks the pin overlay; isInScope is true for any desired tab', () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      // Attached via its port (in scope under devtools mode) but NOT pinned.
      expect(h.controller.isPinned(5)).toBe(false);
      expect(h.controller.isInScope(5)).toBe(true);

      h.controller.notePinned(5);
      expect(h.controller.isPinned(5)).toBe(true);
      expect(h.controller.isInScope(5)).toBe(true);

      h.controller.noteUnpinned(5);
      expect(h.controller.isPinned(5)).toBe(false);
      // Still in scope via its live port.
      expect(h.controller.isInScope(5)).toBe(true);
    });

    it('isInScope is false when the master switch is OFF, even for a pinned tab', () => {
      h.controller.notePinned(5);
      expect(h.controller.isInScope(5)).toBe(false);
    });
  });

  describe('control-plane replay (§4.6 replay over persistence)', () => {
    it('replays the derived control state once on a clean attach', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1);
      expect(h.replayFn).toHaveBeenCalledWith(5);
    });

    it('releases the control state on a port-disconnect detach', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();

      h.controller.notePortDisconnected(5);
      await flush();
      expect(h.release).toHaveBeenCalledWith(5);
    });

    it('re-applies the control state on every re-attach — kill, then revive', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1);

      // Kill: the attachment dies underneath us (banner re-flash / SW wake /
      // tab close-and-reopen surfaces as onDetach). State is released and the
      // tab is NOT re-attached on its own (no reconcile fights the detach).
      h.fireDetach(5, 'target_closed');
      expect(h.release).toHaveBeenCalledWith(5);

      // Revive: a genuine input change (port reconnect) re-establishes the
      // attachment, and the control state is replayed afresh — recomputed,
      // never restored from anything cached across the detach.
      h.controller.notePortDisconnected(5);
      h.controller.notePortConnected(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(2);
    });

    it('pinning an already-attached (in-scope) tab does NOT re-apply — it is already controlled', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1); // the post-attach replay

      // A port-live tab is already in scope (full suite already applied);
      // there is no separate observe-vs-control gate for a pin to flip, so
      // pinning changes nothing and must not re-apply.
      h.controller.notePinned(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1);
    });

    it('unpinning a still-port-live tab does NOT re-apply — it stays in scope via its port', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      h.controller.notePinned(5);
      await flush();
      const before = h.replayFn.mock.calls.length;

      h.controller.noteUnpinned(5);
      await flush();
      expect(h.replayFn.mock.calls.length).toBe(before);
      expect(h.release).not.toHaveBeenCalledWith(5);
    });

    it('pinning a not-yet-attached tab replays once (post-attach), not twice', async () => {
      h.controller.setEnabled(true);
      h.controller.notePinned(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1);
    });

    it('unpinning a pin-only tab does not re-apply — it detaches and releases', async () => {
      h.controller.setEnabled(true);
      h.controller.notePinned(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1);

      h.controller.noteUnpinned(5);
      await flush();
      expect(h.replayFn).toHaveBeenCalledTimes(1);
      expect(h.release).toHaveBeenCalledWith(5);
    });

    it('does NOT replay when the attach is undone by a mid-handshake disconnect', async () => {
      let resolveAttach: () => void = () => {};
      h.attach.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveAttach = resolve;
          }),
      );

      h.controller.setEnabled(true);
      h.controller.notePortConnected(9);
      await flush();
      h.controller.notePortDisconnected(9); // port gone mid-handshake
      resolveAttach();
      await flush();

      // The attach was undone, so no control state was applied.
      expect(h.replayFn).not.toHaveBeenCalled();
    });
  });

  describe('observability (status pill)', () => {
    it('getState baseline is OFF, no tabs, no fault', () => {
      expect(h.controller.getState()).toEqual({ enabled: false, attachedTabs: [], pinnedTabs: [], lastFault: null });
    });

    it('a pin while OFF emits and surfaces in pinnedTabs (so the control reflects it pre-enable)', () => {
      const states: Array<{ enabled: boolean; pinnedTabs: readonly number[] }> = [];
      h.controller.onChange((s) => states.push({ enabled: s.enabled, pinnedTabs: s.pinnedTabs }));

      h.controller.notePinned(9);
      expect(states.at(-1)).toEqual({ enabled: false, pinnedTabs: [9] });
      expect(h.controller.getState().pinnedTabs).toEqual([9]);

      h.controller.noteUnpinned(9);
      expect(states.at(-1)).toEqual({ enabled: false, pinnedTabs: [] });
    });

    it('flag-ON emits On-with-no-tabs first, then On-with-1-tab once the attach commits', async () => {
      const states: Array<{ enabled: boolean; attachedTabs: readonly number[] }> = [];
      h.controller.onChange((s) => states.push({ enabled: s.enabled, attachedTabs: s.attachedTabs }));

      h.controller.notePortConnected(5);
      h.controller.setEnabled(true);
      // Synchronous: flag flipped, attach still in-flight → no tabs yet.
      expect(states).toEqual([{ enabled: true, attachedTabs: [] }]);

      await flush();
      // Attach committed → roster holds tab 5.
      expect(states.at(-1)).toEqual({ enabled: true, attachedTabs: [5] });
      expect(h.controller.getState().attachedTabs).toEqual([5]);
    });

    it('the roster tracks N concurrent tabs and drops on a single port-disconnect', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(1);
      h.controller.notePortConnected(2);
      await flush();
      expect([...h.controller.getState().attachedTabs].sort()).toEqual([1, 2]);

      h.controller.notePortDisconnected(1);
      await flush();
      expect(h.controller.getState().attachedTabs).toEqual([2]);
    });

    it('flag-OFF emits OFF exactly once, not per-tab during teardown', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(1);
      h.controller.notePortConnected(2);
      await flush();

      const states: Array<{ enabled: boolean }> = [];
      h.controller.onChange((s) => states.push({ enabled: s.enabled }));
      h.controller.setEnabled(false);
      await flush();

      // One synchronous OFF emit; the per-tab detaches don't re-emit
      // (the rendered state is already OFF).
      expect(states).toEqual([{ enabled: false }]);
      expect(h.controller.getState().attachedTabs).toEqual([]);
    });

    it('a real attach failure surfaces an attach-failed fault and leaves the tab heuristic-owned', async () => {
      h.attach.mockRejectedValueOnce(new Error('Cannot access a chrome:// URL'));
      const states: Array<ReturnType<typeof h.controller.getState>> = [];
      h.controller.onChange((s) => states.push(s));

      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();

      expect(h.controller.getState()).toEqual({
        enabled: true,
        attachedTabs: [],
        pinnedTabs: [],
        lastFault: { kind: 'attach-failed', tabId: 5 },
      });
      // Never marked cdp-owned — stays at its heuristic default.
      expect(h.route).not.toHaveBeenCalledWith(5, 'cdp');
      expect(states.at(-1)?.lastFault).toEqual({ kind: 'attach-failed', tabId: 5 });
    });

    it('banner Cancel (canceled_by_user) surfaces a fell-back fault; other detach reasons do not', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();

      h.fireDetach(5, 'canceled_by_user');
      expect(h.controller.getState()).toEqual({
        enabled: true,
        attachedTabs: [],
        pinnedTabs: [],
        lastFault: { kind: 'fell-back', tabId: 5 },
      });
    });

    it('a non-user detach (target_closed) drops the tab with no fault', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();

      h.fireDetach(5, 'target_closed');
      expect(h.controller.getState()).toEqual({ enabled: true, attachedTabs: [], pinnedTabs: [], lastFault: null });
    });

    it('a flag flip clears a stale fault', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();
      h.fireDetach(5, 'canceled_by_user');
      expect(h.controller.getState().lastFault).not.toBeNull();

      h.controller.setEnabled(false);
      expect(h.controller.getState().lastFault).toBeNull();
    });

    it('a clean attach supersedes a prior fault (last-event-wins)', async () => {
      h.attach.mockRejectedValueOnce(new Error('boom'));
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();
      expect(h.controller.getState().lastFault).toEqual({ kind: 'attach-failed', tabId: 5 });

      // A second port-connect reconciles all live ports: tab 5 retries
      // (now resolving) and tab 6 attaches — both clean attaches clear
      // the fault.
      h.controller.notePortConnected(6);
      await flush();
      expect(h.controller.getState().enabled).toBe(true);
      expect([...h.controller.getState().attachedTabs].sort()).toEqual([5, 6]);
      expect(h.controller.getState().lastFault).toBeNull();
    });

    it('onChange returns an unsubscribe handle', async () => {
      const listener = vi.fn();
      const off = h.controller.onChange(listener);
      off();
      h.controller.setEnabled(true);
      await flush();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
