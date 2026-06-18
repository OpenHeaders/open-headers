/**
 * CDP pin tab-close cleanup — the `TabLifecycleBus` subscription that drops
 * a closed tab from the attach controller's pin overlay.
 *
 * The controller's port and active-tab inputs self-clear on tab close, but
 * the explicit pin overlay has no such source. Without this wire a pinned
 * tab that is closed leaves its id in the pin set: it lingers in the footer
 * roster and the next reconcile re-derives it into the desired set, so the
 * controller tries to attach a dead tab and surfaces a spurious attach
 * fault. These probes lock the cleanup against that leak.
 */

import { TabLifecycleBus } from '@openheaders/oracle/tab-lifecycle-bus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CdpAttachController } from '@/background/correlator-host/cdp-attach-controller';
import { installCdpPinTabCleanup } from '@/background/correlator-host/cdp-pin-tab-cleanup';

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
  const controller = new CdpAttachController({
    source: { attach, detach, onDetach },
    router: { route },
  });

  const bus = new TabLifecycleBus();
  const dispose = installCdpPinTabCleanup({ bus, controller });

  return {
    controller,
    bus,
    dispose,
    attach,
    fireDetach: (tabId: number, reason: string) => detachListener?.(tabId, reason),
  };
}

describe('cdp-pin-tab-cleanup — TabLifecycleBus subscription', () => {
  let h: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    h = makeHarness();
  });

  it('drops a pinned tab from the overlay on tab-forgotten', () => {
    h.controller.notePinned(5);
    expect(h.controller.isPinned(5)).toBe(true);

    h.bus.notifyTabForgotten(5);

    expect(h.controller.isPinned(5)).toBe(false);
    expect(h.controller.getState().pinnedTabs).toEqual([]);
  });

  it('leaves other pinned tabs untouched on tab-forgotten', () => {
    h.controller.notePinned(5);
    h.controller.notePinned(6);

    h.bus.notifyTabForgotten(5);

    expect(h.controller.isPinned(5)).toBe(false);
    expect(h.controller.isPinned(6)).toBe(true);
  });

  it('forgotten on an unpinned tab is a no-op', () => {
    expect(() => h.bus.notifyTabForgotten(999)).not.toThrow();
    expect(h.controller.getState().pinnedTabs).toEqual([]);
  });

  it('a closed pinned tab does not leak its pin into a later reconcile (no spurious attach)', async () => {
    h.controller.setEnabled(true);
    h.controller.notePinned(5);
    await flush();
    expect(h.attach).toHaveBeenCalledWith(5);
    expect(h.attach.mock.calls.filter((c) => c[0] === 5)).toHaveLength(1);

    // The tab closes: chrome.debugger.onDetach (target_closed) drops it from
    // the attached set, and chrome.tabs.onRemoved fans tab-forgotten on the bus.
    h.fireDetach(5, 'target_closed');
    h.bus.notifyTabForgotten(5);

    // A later, unrelated reconcile (another tab's port connects) must not
    // re-derive the dead tab into the desired set and re-attach it.
    h.controller.notePortConnected(99);
    await flush();

    expect(h.attach.mock.calls.filter((c) => c[0] === 5)).toHaveLength(1);
    expect(h.controller.getState().pinnedTabs).toEqual([]);
    expect(h.controller.getState().lastFault).toBeNull();
  });

  it('dispose detaches the bus subscription', () => {
    h.controller.notePinned(5);

    h.dispose();
    h.bus.notifyTabForgotten(5);

    expect(h.controller.isPinned(5)).toBe(true);
  });
});
