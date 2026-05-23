/**
 * View-mode controller. Lives in the SW. Owns:
 *
 *   1. Boot reconciliation — on SW startup, snap the live toolbar binding
 *      and sidebar visibility to whatever stored state says. Firefox's
 *      manifest `sidebar_action.default_panel` causes the sidebar to
 *      auto-appear on temp install; we don't patch that, we reconcile
 *      it like any other pre-controller drift (e.g. user opened the
 *      sidebar via Firefox's menu while the SW was suspended).
 *
 *   2. The `switchViewMode` RPC handler — persist the new mode, re-bind
 *      the toolbar, close the source surface, and (Chromium popup
 *      destination) call action.openPopup. Sidepanel-destination opens
 *      happen in the renderer's gesture context, before this RPC fires.
 */

import { logger } from '@utils/logger';
import { getViewMode, onViewModeChanged, setViewMode } from '@/host/view-mode-storage';
import type { ViewMode } from '@openheaders/core/types';
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

    // Storage subscriber: rebind the toolbar to track stored mode, but
    // do NOT close the sidebar here. Closing is the transition handler's
    // job — closing reactively from a storage event would tear down the
    // sidepanel page mid-transition before its UI feedback (e.g. the
    // Firefox "click the toolbar" toast) can render.
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
   * On Firefox the close attempt from the SW will fail because
   * `sidebarAction.close()` requires a user gesture OR the sidebar's
   * own script context — the SW has neither. The actual Firefox close
   * happens from `apps/extension/src/sidepanel/self-close-if-popup-mode.ts`
   * which runs inside the auto-opened sidebar page and closes itself
   * when stored mode is popup. This SW path is still useful on Chromium
   * for the rare case where a stale sidebar is open at boot.
   */
  private async bootReconcile(mode: ViewMode): Promise<void> {
    await this.adapter.bindToolbarForMode(mode);
    if (mode === 'popup') {
      const isOpen = await this.adapter.surfaceIsOpen('sidepanel', {});
      if (isOpen === true) {
        await this.adapter.closeSurface('sidepanel', {});
      }
    }
  }

  async switchViewMode(next: ViewMode, ctx: OpenContext): Promise<{ opened: boolean }> {
    // Persist + rebind. setViewMode triggers the storage subscriber which
    // also rebinds — both writes/binds are idempotent. We don't rely on
    // the subscriber, so the explicit bind below guarantees the toolbar
    // is correct by the time the RPC resolves.
    await setViewMode(next);
    await this.adapter.bindToolbarForMode(next);

    if (next === 'popup') {
      // The renderer already closed the sidebar from its own gesture/
      // own-script context — the SW can't satisfy Firefox's "close needs
      // a gesture" rule. This call is a belt-and-braces no-op on the
      // path where the renderer succeeded; it still runs in case the
      // renderer wasn't a sidebar surface (e.g. an external surface
      // forcing a mode change in the future).
      await this.adapter.closeSurface('sidepanel', ctx);
      // Chromium: action.openPopup. Firefox: no-op (no API); the user
      // clicks the toolbar themselves once the binding has been switched.
      return this.adapter.openSurface('popup', ctx);
    }
    // sidepanel destination: the renderer opened the sidebar from its
    // gesture context before this RPC fired. The popup source surface
    // self-closes (popups blur on focus change); no closeSurface needed.
    return { opened: true };
  }
}

let singleton: ViewModeController | null = null;

export function getViewModeController(): ViewModeController {
  if (!singleton) {
    singleton = new ViewModeController(selectViewModeAdapter());
  }
  return singleton;
}
