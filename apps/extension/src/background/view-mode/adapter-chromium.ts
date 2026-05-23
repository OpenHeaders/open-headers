/**
 * Chromium (Chrome / Edge / Safari) implementation of ViewModeAdapter.
 *
 * Chrome's `sidePanel.open()` does NOT survive a runtime.sendMessage
 * round-trip in practice — the gesture is effectively only usable
 * inside the renderer's own click handler. So sidepanel-destination
 * opens run renderer-side.
 *
 * Popup destination is the inverse: `action.openPopup()` from a
 * sidepanel renderer races the SW's `sidePanel.close()` and Chrome
 * dismisses the popup the moment the sidepanel closes (focus / layout
 * shift). The SW must own the popup-destination flow so it can run
 * close-then-open in a stable order: close the sidepanel first, THEN
 * call openPopup — by which point the layout is settled and nothing
 * dismisses the popup. Gesture activation transfers from the sidepanel
 * sender to the SW message handler for the duration of activation
 * (~5s), so `action.openPopup` from the SW after a few awaits is still
 * within the gesture window.
 *
 * Net ownership:
 *
 *   - openFromRenderer('sidepanel'): live (renderer-only path on Chrome)
 *   - openFromRenderer('popup'):      no-op  (SW handles it after close)
 *   - closeFromRenderer:              no-op  (SW closes sidepanel; popup
 *                                              tears via window.close)
 *   - openFromSW('sidepanel'):        no-op  (gesture wouldn't survive)
 *   - openFromSW('popup'):            live   (post-close, gesture-OK)
 *   - closeFromSW('sidepanel'):       live   (boot reconcile + transitions)
 *
 * Toolbar-button trick: when `action.setPopup({popup:''})` empties the
 * popup, the button fires `onClicked` instead — and
 * `sidePanel.setPanelBehavior({openPanelOnActionClick:true})` swallows
 * that click into a side-panel open. So we don't need an explicit
 * onClicked listener here; the native panel-behavior handles it.
 */

import type { ViewMode } from '@openheaders/core/types';
import type { OpenContext, OpenResult, Surface, ViewModeAdapter } from './adapter';

const POPUP_PATH = 'popup.html';

interface SidePanelLike {
  open?: (options: { windowId?: number; tabId?: number }) => Promise<void>;
  close?: (options: { windowId?: number; tabId?: number }) => Promise<void>;
  setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
  getOptions?: (options: { tabId?: number }) => Promise<{ enabled?: boolean; path?: string }>;
}

interface ActionOpenPopupLike {
  openPopup?: (options?: { windowId?: number }) => Promise<void>;
}

function getSidePanel(): SidePanelLike | null {
  const api = chrome as unknown as { sidePanel?: SidePanelLike };
  return api.sidePanel ?? null;
}

function getActionOpenPopup(): ActionOpenPopupLike {
  return chrome.action as unknown as ActionOpenPopupLike;
}

/** Renderer-side: resolve windowId from the active tab in the current window. */
async function resolveRendererWindowId(): Promise<number | undefined> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return typeof tab?.windowId === 'number' ? tab.windowId : undefined;
  } catch {
    return undefined;
  }
}

/** SW-side fallback when the RPC sender has no tab (popup/sidepanel senders). */
async function resolveLastFocusedWindowId(): Promise<number | undefined> {
  const api = chrome as unknown as {
    windows?: {
      getLastFocused?: (opts?: { populate?: boolean }) => Promise<chrome.windows.Window>;
    };
  };
  const getLastFocused = api.windows?.getLastFocused;
  if (!getLastFocused) return undefined;
  try {
    const win = await getLastFocused();
    return typeof win?.id === 'number' ? win.id : undefined;
  } catch {
    return undefined;
  }
}

export const chromiumViewModeAdapter: ViewModeAdapter = {
  async bindToolbarForMode(mode: ViewMode): Promise<void> {
    if (mode === 'popup') {
      await chrome.action.setPopup({ popup: POPUP_PATH });
      await getSidePanel()?.setPanelBehavior?.({ openPanelOnActionClick: false });
      return;
    }
    await chrome.action.setPopup({ popup: '' });
    await getSidePanel()?.setPanelBehavior?.({ openPanelOnActionClick: true });
  },

  async openFromRenderer(surface: Surface): Promise<OpenResult> {
    if (surface !== 'sidepanel') {
      // Popup destination is SW-owned (see file header — close-then-open
      // must run in the SW so the sidepanel close doesn't dismiss the
      // popup mid-open).
      return { opened: false };
    }
    const windowId = await resolveRendererWindowId();
    const sidePanel = getSidePanel();
    if (!sidePanel?.open || windowId == null) return { opened: false };
    try {
      await sidePanel.open({ windowId });
      return { opened: true };
    } catch {
      return { opened: false };
    }
  },

  async closeFromRenderer(_surface: Surface): Promise<void> {
    // Sidepanel close is SW-owned (closing from the sidepanel's own
    // renderer races its tear-down). Popup tears via window.close().
  },

  async openFromSW(surface: Surface, ctx: OpenContext): Promise<OpenResult> {
    if (surface !== 'popup') return { opened: false };
    const openPopup = getActionOpenPopup().openPopup;
    if (!openPopup) return { opened: false };
    const windowId = ctx.windowId ?? (await resolveLastFocusedWindowId());
    try {
      await openPopup(windowId != null ? { windowId } : undefined);
      return { opened: true };
    } catch {
      return { opened: false };
    }
  },

  async closeFromSW(surface: Surface, ctx: OpenContext): Promise<void> {
    if (surface !== 'sidepanel') return;
    const sidePanel = getSidePanel();
    if (!sidePanel?.close) return;
    // RPC senders from extension surfaces carry no `tab`. Fall back to
    // the last-focused window so the close lands on the panel the user
    // is staring at.
    const windowId = ctx.windowId ?? (await resolveLastFocusedWindowId());
    const attempts: { windowId?: number; tabId?: number }[] = [];
    if (windowId != null) attempts.push({ windowId });
    if (ctx.tabId != null) attempts.push({ tabId: ctx.tabId });
    for (const opts of attempts) {
      try {
        await sidePanel.close(opts);
        return;
      } catch {
        // try the next scope
      }
    }
  },

  async surfaceIsOpen(_surface: Surface, _ctx: OpenContext): Promise<boolean | null> {
    // Chromium's sidePanel has no isOpen query.
    return null;
  },
};
