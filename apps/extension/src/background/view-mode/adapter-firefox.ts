/**
 * Firefox implementation of ViewModeAdapter.
 *
 * Firefox has no `chrome.sidePanel` and no `action.openPopup`. Instead:
 *   - `browser.sidebarAction.{open,close,isOpen}` drive the sidebar.
 *   - `sidebarAction.open()` is strictly gesture-bound. The renderer
 *     calls `openSurface('sidepanel')` synchronously inside its click
 *     handler — DO NOT await anything else first.
 *   - There is no native toggle equivalent of Chrome's
 *     `setPanelBehavior({openPanelOnActionClick:true})`. We attach an
 *     `action.onClicked` listener that mimics the toggle by acting on a
 *     locally-cached "is open?" guess (see `sidebarOpenGuess` below) —
 *     a workaround forced by Firefox's API not exposing a synchronous
 *     state query. We refresh the guess on bind, flip it ourselves on
 *     adapter open/close, and accept that the user opening/closing the
 *     sidebar via Firefox's own UI can briefly desync it (self-heals
 *     within ~1-2 toolbar clicks).
 *   - There is no API to open the popup programmatically. `openSurface
 *     ('popup')` returns `{ opened: false }`; the user clicks the
 *     toolbar themselves once the binding has been switched back.
 */

import type { ViewMode } from '@openheaders/core/types';
import type { OpenContext, OpenResult, Surface, ViewModeAdapter } from './adapter';

const POPUP_PATH = 'popup.html';

interface SidebarActionLike {
  open?: () => Promise<void>;
  close?: () => Promise<void>;
  isOpen?: (options: { windowId?: number }) => Promise<boolean>;
}

declare const browser: typeof chrome | undefined;

function getSidebarAction(): SidebarActionLike | null {
  const root = typeof browser !== 'undefined' ? browser : chrome;
  const api = root as unknown as { sidebarAction?: SidebarActionLike };
  return api.sidebarAction ?? null;
}

// SW-owned state for the toolbar binding.
let onClickedListener: ((tab: chrome.tabs.Tab) => void) | null = null;

// Cached "is the sidebar open right now?" guess. Firefox's
// `sidebarAction.open` is gesture-bound, so the onClicked handler can't
// `await sidebar.isOpen()` before deciding what to do — the await
// consumes the gesture. Instead we cache the state and act on it
// synchronously. The guess is kept honest by:
//   - refreshing from `sidebar.isOpen()` when we bind/initialize,
//   - flipping it ourselves whenever we open or close the sidebar,
//   - self-correcting within ~1-2 toolbar clicks if the user opens or
//     closes the sidebar via Firefox's own UI (a stale guess just
//     means one click is a no-op; the next click does the right thing).
let sidebarOpenGuess = false;

async function refreshSidebarOpenGuess(): Promise<void> {
  const sidebar = getSidebarAction();
  if (!sidebar?.isOpen) return;
  try {
    sidebarOpenGuess = await sidebar.isOpen({});
  } catch {
    // Leave guess as-is; next user click will self-correct.
  }
}

function attachToolbarClickToSidebar(): void {
  if (onClickedListener) return;
  // Sync the guess to reality before the user can click.
  void refreshSidebarOpenGuess();
  onClickedListener = (): void => {
    const sidebar = getSidebarAction();
    if (!sidebar) return;
    // Gesture-critical: act synchronously on the cached guess so the
    // first awaited API call after the gesture IS sidebar.open/close().
    if (sidebarOpenGuess) {
      sidebarOpenGuess = false;
      void sidebar.close?.();
    } else {
      sidebarOpenGuess = true;
      void sidebar.open?.();
    }
  };
  chrome.action.onClicked.addListener(onClickedListener);
}

function detachToolbarClickFromSidebar(): void {
  if (!onClickedListener) return;
  chrome.action.onClicked.removeListener(onClickedListener);
  onClickedListener = null;
}

export const firefoxViewModeAdapter: ViewModeAdapter = {
  async bindToolbarForMode(mode: ViewMode): Promise<void> {
    if (mode === 'popup') {
      await chrome.action.setPopup({ popup: POPUP_PATH });
      detachToolbarClickFromSidebar();
      return;
    }
    // sidepanel mode: empty popup so action.onClicked fires, and route
    // those clicks into sidebarAction.open().
    await chrome.action.setPopup({ popup: '' });
    attachToolbarClickToSidebar();
  },

  async openSurface(surface: Surface, _ctx: OpenContext): Promise<OpenResult> {
    if (surface !== 'sidepanel') {
      // No programmatic popup-open exists in Firefox.
      return { opened: false };
    }
    const sidebar = getSidebarAction();
    if (!sidebar?.open) return { opened: false };
    try {
      // Must be the first awaited call after the user gesture; the
      // caller is responsible for not awaiting anything else first.
      await sidebar.open();
      sidebarOpenGuess = true;
      return { opened: true };
    } catch {
      return { opened: false };
    }
  },

  async closeSurface(surface: Surface, _ctx: OpenContext): Promise<void> {
    if (surface !== 'sidepanel') return;
    const sidebar = getSidebarAction();
    if (!sidebar?.close) return;
    try {
      await sidebar.close();
      sidebarOpenGuess = false;
    } catch {
      // Closing an already-closed sidebar throws on some Firefox versions —
      // benign; the post-condition (sidebar closed) holds either way.
      sidebarOpenGuess = false;
    }
  },

  async surfaceIsOpen(surface: Surface, ctx: OpenContext): Promise<boolean | null> {
    if (surface !== 'sidepanel') return null;
    const sidebar = getSidebarAction();
    if (!sidebar?.isOpen) return null;
    try {
      return await sidebar.isOpen(ctx.windowId != null ? { windowId: ctx.windowId } : {});
    } catch {
      return null;
    }
  },
};
