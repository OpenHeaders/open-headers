/**
 * Chromium (Chrome / Edge / Safari) implementation of ViewModeAdapter.
 *
 * Toolbar-button trick: when `action.setPopup({popup:''})` empties the
 * popup, the button fires `onClicked` instead — and Chrome's
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

  async openSurface(surface: Surface, ctx: OpenContext): Promise<OpenResult> {
    if (surface === 'sidepanel') {
      const sidePanel = getSidePanel();
      if (!sidePanel?.open) return { opened: false };
      try {
        // `sidePanel.open` accepts {windowId} or {tabId}. The renderer
        // resolves the active tab's window before calling us; ctx.windowId
        // is the gesture-friendly path on Chromium.
        if (ctx.windowId != null) {
          await sidePanel.open({ windowId: ctx.windowId });
        } else if (ctx.tabId != null) {
          await sidePanel.open({ tabId: ctx.tabId });
        } else {
          return { opened: false };
        }
        return { opened: true };
      } catch {
        return { opened: false };
      }
    }
    // popup
    const openPopup = getActionOpenPopup().openPopup;
    if (!openPopup) return { opened: false };
    try {
      await openPopup(ctx.windowId != null ? { windowId: ctx.windowId } : undefined);
      return { opened: true };
    } catch {
      return { opened: false };
    }
  },

  async closeSurface(surface: Surface, ctx: OpenContext): Promise<void> {
    if (surface !== 'sidepanel') return;
    const sidePanel = getSidePanel();
    if (!sidePanel?.close) return;
    // Try the most specific scope first, then fall back. Either succeeding
    // is enough — extra attempts after a successful close throw harmlessly.
    const attempts: { windowId?: number; tabId?: number }[] = [];
    if (ctx.windowId != null) attempts.push({ windowId: ctx.windowId });
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
    // Chromium's sidePanel has no isOpen query. We can only check whether
    // it's *enabled* for a tab, not whether the user has it visible.
    // Returning null tells the controller "don't reconcile based on this."
    return null;
  },
};
