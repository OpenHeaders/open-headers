/**
 * `cdp-tab-pin` — the registration seam the `setCdpTabPin` RPC drives.
 *
 * `pinCdpTab` / `unpinCdpTab` are born inside the lifecycle pipeline closure;
 * the message handler reaches them only through this module-level seam. The
 * tests prove the full chain end-to-end against the real
 * {@link CdpAttachController}: `setCdpTabPin(tabId, true)` → `notePinned` →
 * `controller.isPinned(tabId)` flips, and unpin reverses it. Plus the
 * before-register no-op (so a stray RPC on a CDP-less host can't throw).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CdpAttachController } from '@/background/correlator-host/cdp-attach-controller';
import {
  __resetCdpTabPinControlsForTests,
  registerCdpTabPinControls,
  setCdpTabPin,
} from '@/background/modules/tabs/cdp-tab-pin';

function makeController() {
  const source = {
    attach: vi.fn<(tabId: number) => Promise<void>>().mockResolvedValue(undefined),
    detach: vi.fn<(tabId: number) => Promise<void>>().mockResolvedValue(undefined),
    onDetach: vi.fn(() => () => {}),
  };
  const router = { route: vi.fn() };
  return new CdpAttachController({ source, router });
}

describe('cdp-tab-pin seam', () => {
  afterEach(() => {
    __resetCdpTabPinControlsForTests();
  });

  it('no-ops before the controls are registered (CDP-less host)', () => {
    expect(() => setCdpTabPin(7, true)).not.toThrow();
  });

  describe('wired to the real controller', () => {
    let controller: CdpAttachController;

    beforeEach(() => {
      controller = makeController();
      registerCdpTabPinControls({
        pin: (tabId) => controller.notePinned(tabId),
        unpin: (tabId) => controller.noteUnpinned(tabId),
      });
    });

    it('pins a tab → isPinned reflects it', () => {
      expect(controller.isPinned(3)).toBe(false);
      setCdpTabPin(3, true);
      expect(controller.isPinned(3)).toBe(true);
    });

    it('unpins a tab → isPinned clears', () => {
      setCdpTabPin(3, true);
      setCdpTabPin(3, false);
      expect(controller.isPinned(3)).toBe(false);
    });

    it('a pinned tab joins the desired set once the master switch is on', async () => {
      controller.setEnabled(true);
      setCdpTabPin(8, true);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(controller.getState().attachedTabs).toContain(8);
      expect(controller.isPinned(8)).toBe(true);
    });
  });
});
