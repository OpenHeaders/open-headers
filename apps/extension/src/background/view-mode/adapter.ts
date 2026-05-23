/**
 * Per-browser seam for the action button's view-mode (popup vs sidepanel).
 *
 * Each browser owns a different set of the open/close operations:
 *
 *  - Chromium (`chrome.sidePanel`, `action.openPopup`): both open+close
 *    are SW-callable; gesture flows across `runtime.sendMessage` so the
 *    SW can act on a click-originated RPC.
 *  - Firefox (`browser.sidebarAction`): `open()` and `close()` are
 *    gesture-bound and only runnable in the click-originating renderer.
 *    The SW has no working gesture context.
 *
 * The interface splits open/close into renderer-side and SW-side methods
 * so each adapter declares which context it owns the call from. The
 * "wrong" context returns `{opened:false}` / no-ops cleanly — orchestration
 * code calls both pairs and trusts the right one to be the live path.
 *
 *   - `openFromRenderer` MUST be invoked synchronously inside the click
 *     handler (sync prefix invokes the gesture-bound API before any
 *     await can consume the gesture).
 *   - `closeFromRenderer` is the only legal close for Firefox sidebar
 *     when the click originated outside the sidebar (sidebar self-close
 *     is allowed; SW close is not).
 *   - `openFromSW` / `closeFromSW` handle Chromium's SW-owned ops and
 *     are no-ops on Firefox.
 *   - `bindToolbarForMode` is always SW-only.
 */

import type { ViewMode } from '@openheaders/core/types';

export type Surface = ViewMode;

export interface OpenContext {
  windowId?: number;
  tabId?: number;
}

export interface OpenResult {
  opened: boolean;
}

export interface ViewModeAdapter {
  bindToolbarForMode(mode: ViewMode): Promise<void>;

  /** Renderer-side, gesture-critical. No-op when the SW owns this surface. */
  openFromRenderer(surface: Surface): Promise<OpenResult>;
  /** Renderer-side, gesture-critical. No-op when the SW owns this surface. */
  closeFromRenderer(surface: Surface): Promise<void>;

  /** SW-side. No-op when only the renderer can drive this surface. */
  openFromSW(surface: Surface, ctx: OpenContext): Promise<OpenResult>;
  /** SW-side. No-op when only the renderer can drive this surface. */
  closeFromSW(surface: Surface, ctx: OpenContext): Promise<void>;

  /** Returns null when the browser can't report the answer. */
  surfaceIsOpen(surface: Surface, ctx: OpenContext): Promise<boolean | null>;
}
