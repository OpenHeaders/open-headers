/**
 * `CdpAttachController` — the derived reconciler proving the locked
 * invariant **attached = { live DevTools ports } ∩ { master switch ON }**
 * across the full state matrix, plus the handoff transitions (the
 * connect→disconnect-before-attach-resolves race, onDetach route-back, and
 * SW-wake re-attach).
 *
 * Spy source ({ attach, detach, onDetach }) + spy router ({ route }) — the
 * controller is effect-only over its two injected inputs, so no chrome.
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

  it('port-connect while the flag is ON attaches + routes the tab to cdp', async () => {
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

  describe('arming (Option C — explicit per-tab debug control plane)', () => {
    it('arming a tab while the flag is ON attaches it like a live port', async () => {
      h.controller.setEnabled(true);
      h.controller.noteArmed(5);
      await flush();

      expect(h.attach).toHaveBeenCalledWith(5);
      expect(h.route).toHaveBeenCalledWith(5, 'cdp');
    });

    it('arming while the flag is OFF attaches nothing', async () => {
      h.controller.noteArmed(5);
      await flush();
      expect(h.attach).not.toHaveBeenCalled();
    });

    it('a tab armed AND port-live stays attached until BOTH inputs drop', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      h.controller.noteArmed(5);
      await flush();
      expect(h.attach).toHaveBeenCalledTimes(1);

      // Port closes but the tab is still armed → stays attached.
      h.controller.notePortDisconnected(5);
      await flush();
      expect(h.detach).not.toHaveBeenCalled();

      // Disarm too → now undesired, detaches.
      h.controller.noteDisarmed(5);
      await flush();
      expect(h.detach).toHaveBeenCalledWith(5);
    });

    it('disarming an armed-only tab detaches it back to heuristic', async () => {
      h.controller.setEnabled(true);
      h.controller.noteArmed(5);
      await flush();

      h.controller.noteDisarmed(5);
      await flush();
      expect(h.detach).toHaveBeenCalledWith(5);
      expect(h.route).toHaveBeenCalledWith(5, 'heuristic');
    });

    it('isArmed tracks the armed set and is false for a port-live-but-unarmed tab', () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      // Attached via its port, but NOT armed → debug-tier control must be inert.
      expect(h.controller.isArmed(5)).toBe(false);

      h.controller.noteArmed(5);
      expect(h.controller.isArmed(5)).toBe(true);

      h.controller.noteDisarmed(5);
      expect(h.controller.isArmed(5)).toBe(false);
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
      expect(h.controller.getState()).toEqual({ enabled: false, attachedCount: 0, lastFault: null });
    });

    it('flag-ON emits On-with-no-tabs first, then On-with-1-tab once the attach commits', async () => {
      const states: Array<{ enabled: boolean; attachedCount: number }> = [];
      h.controller.onChange((s) => states.push({ enabled: s.enabled, attachedCount: s.attachedCount }));

      h.controller.notePortConnected(5);
      h.controller.setEnabled(true);
      // Synchronous: flag flipped, attach still in-flight → count 0.
      expect(states).toEqual([{ enabled: true, attachedCount: 0 }]);

      await flush();
      // Attach committed → count 1.
      expect(states.at(-1)).toEqual({ enabled: true, attachedCount: 1 });
      expect(h.controller.getState().attachedCount).toBe(1);
    });

    it('attachedCount tracks N concurrent tabs and drops on a single port-disconnect', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(1);
      h.controller.notePortConnected(2);
      await flush();
      expect(h.controller.getState().attachedCount).toBe(2);

      h.controller.notePortDisconnected(1);
      await flush();
      expect(h.controller.getState().attachedCount).toBe(1);
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
      expect(h.controller.getState().attachedCount).toBe(0);
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
        attachedCount: 0,
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
        attachedCount: 0,
        lastFault: { kind: 'fell-back', tabId: 5 },
      });
    });

    it('a non-user detach (target_closed) drops the count with no fault', async () => {
      h.controller.setEnabled(true);
      h.controller.notePortConnected(5);
      await flush();

      h.fireDetach(5, 'target_closed');
      expect(h.controller.getState()).toEqual({ enabled: true, attachedCount: 0, lastFault: null });
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
      expect(h.controller.getState()).toEqual({ enabled: true, attachedCount: 2, lastFault: null });
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
