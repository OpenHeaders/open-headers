/**
 * Per-browser seam for the action button's view-mode (popup vs sidepanel).
 *
 * The two browser families implement the same four operations against
 * very different native APIs:
 *
 *   - Chromium (chrome.sidePanel + setPanelBehavior + action.openPopup)
 *   - Firefox  (browser.sidebarAction.{open,close,isOpen} + action.onClicked)
 *
 * Higher layers (the controller + the renderer's transition stub) never
 * touch chrome.sidePanel or browser.sidebarAction directly — every
 * browser quirk lives behind this interface.
 *
 * Some methods have a context restriction:
 *   - `bindToolbarForMode` is SW-only (registers/removes action.onClicked).
 *   - `openSurface('sidepanel')` must be called from a user gesture
 *     (renderer click handler) — synchronously before any unrelated await.
 *   - `openSurface('popup')` is SW-side (action.openPopup); no-op on Firefox.
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
  openSurface(surface: Surface, ctx: OpenContext): Promise<OpenResult>;
  closeSurface(surface: Surface, ctx: OpenContext): Promise<void>;
  /** Returns null when the browser can't report the answer. */
  surfaceIsOpen(surface: Surface, ctx: OpenContext): Promise<boolean | null>;
}
