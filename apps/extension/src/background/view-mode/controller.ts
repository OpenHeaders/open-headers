/**
 * View-mode controller. Lives in the SW. Owns:
 *
 *   1. Boot reconciliation — on SW startup, snap the live toolbar
 *      binding (and best-effort the visible surface) to stored state.
 *      Firefox's manifest-required `sidebar_action.default_panel` can
 *      auto-open the sidebar on temp/initial install; we reconcile
 *      that like any pre-controller drift.
 *
 *   2. The `switchViewMode` RPC handler — persist the new mode, re-bind
 *      the toolbar, close the source surface (SW-callable), and open
 *      the destination surface (SW-callable). Adapter methods that the
 *      browser can't satisfy from the SW are no-ops; the renderer
 *      handled them in its gesture context already.
 *
 * Storage subscriber: rebinds toolbar on stored-mode changes from other
 * pages (e.g. a second workspace tab on Chromium also touches viewMode).
 * Does NOT close any surface — that's the transition handler's job and
 * a reactive close would tear down a sidepanel mid-transition before
 * its UI feedback could render.
 */

import type { ViewMode } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { getViewMode, onViewModeChanged, setViewMode } from '@/host/view-mode-storage';
import type { OpenContext, ViewModeAdapter } from './adapter';
import { selectViewModeAdapter } from './select-adapter';

export class ViewModeController {
  private readonly adapter: ViewModeAdapter;
  private initialized = false;

  constructor(adapter: ViewModeAdapter) {
    this.adapter = adapter;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const mode = await getViewMode();
      await this.bootReconcile(mode);
      logger.info('ViewMode', `Reconciled to stored mode on startup: ${mode}`);
    } catch (error) {
      logger.info('ViewMode', 'initial reconcile failed:', (error as Error).message);
    }

    onViewModeChanged((next) => {
      void this.adapter.bindToolbarForMode(next).catch((error: Error) => {
        logger.info('ViewMode', 'rebind on storage change failed:', error.message);
      });
    });
  }

  /**
   * Boot-only reconciliation. Snaps the toolbar binding to stored state
   * and best-effort closes a sidebar that shouldn't be open.
   *
   * On Firefox the SW close attempt is a no-op (gesture-bound). The
   * actual Firefox close happens from
   * `apps/extension/src/sidepanel/self-close-if-popup-mode.ts`, which
   * runs inside the auto-opened sidebar page and closes itself when
   * stored mode is popup. This SW path is still useful on Chromium
   * for the rare case where a stale sidebar is open at boot.
   */
  private async bootReconcile(mode: ViewMode): Promise<void> {
    await this.adapter.bindToolbarForMode(mode);
    if (mode === 'popup') {
      const isOpen = await this.adapter.surfaceIsOpen('sidepanel', {});
      if (isOpen === true) {
        await this.adapter.closeFromSW('sidepanel', {});
      }
    }
  }

  async switchViewMode(next: ViewMode, source: ViewMode | null, ctx: OpenContext): Promise<{ opened: boolean }> {
    // Ordering rationale (Chromium sidepanel→popup):
    //   1. persist     — durable mode update
    //   2. close source — sidepanel.close BEFORE openPopup. If we opened
    //      the popup first, sidepanel.close would dismiss it (Chrome
    //      auto-dismisses popups on focus/layout shifts).
    //   3. bind        — setPopup configures action.openPopup's target;
    //      must run before openFromSW for popup destination.
    //   4. open dest   — action.openPopup with gesture-still-fresh from
    //      the sender's activation transfer (~5s window).
    //
    // For popup→sidepanel the renderer already opened the sidepanel
    // before the RPC fired; closeFromSW('popup') and openFromSW
    // ('sidepanel') are both no-ops on Chromium.
    //
    // Firefox: closeFromSW + openFromSW are both no-ops; the renderer
    // drove the gesture-bound ops itself. Bind is the only SW work.
    await setViewMode(next);

    if (source && source !== next) {
      try {
        await this.adapter.closeFromSW(source, ctx);
      } catch (error) {
        logger.info('ViewMode', 'closeFromSW failed:', (error as Error).message);
      }
    }

    await this.adapter.bindToolbarForMode(next);

    try {
      return await this.adapter.openFromSW(next, ctx);
    } catch (error) {
      logger.info('ViewMode', 'openFromSW failed:', (error as Error).message);
      return { opened: false };
    }
  }
}

let singleton: ViewModeController | null = null;

export function getViewModeController(): ViewModeController {
  if (!singleton) {
    singleton = new ViewModeController(selectViewModeAdapter());
  }
  return singleton;
}
