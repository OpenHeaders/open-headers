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

  const source = { attach, detach, onDetach };
  const router = { route };
  const controller = new CdpAttachController({ source, router });

  return {
    controller,
    attach,
    detach,
    route,
    onDetach,
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
});
