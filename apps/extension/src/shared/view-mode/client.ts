/**
 * UI-side helpers for switching view mode. Called from the popup or
 * side panel's "Switch view" button.
 *
 *   1. Persist the new mode (background's storage listener will reapply
 *      `chrome.action.setPopup` + `setPanelBehavior` automatically).
 *   2. Open the destination surface in the SAME user gesture so the
 *      transition feels instant. `sidePanel.open()` requires a user
 *      gesture; calling it from a click handler counts.
 *   3. Close the source surface.
 *
 * Direction notes:
 *   - popup → sidepanel: open the panel from the popup's click handler
 *     (user gesture required), then the caller runs `window.close()`.
 *     Opening the sidepanel doesn't blur the popup, so this direction
 *     has no race.
 *   - sidepanel → popup: delegated to the SW. Closing the sidepanel
 *     causes Chrome to restore focus to the main window when the
 *     animation completes, which blurs (and auto-closes) any popup
 *     opened beforehand. The SW sequences `sidePanel.close()` →
 *     `action.openPopup()` so the popup opens after focus has settled.
 *
 * Firefox: `sidePanel` doesn't exist; fall back to `sidebarAction.open()`
 * / `sidebarAction.close()`. `chrome.action.openPopup()` is supported on
 * Firefox 149+ so popup-target works there too.
 */

import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { setViewMode as persistViewMode } from './storage';
import type { ViewMode } from './types';

interface SidePanelOpenOptions {
  windowId?: number;
  tabId?: number;
}

interface SidePanelLike {
  open?: (options: SidePanelOpenOptions) => Promise<void>;
}

interface SidebarActionLike {
  open?: () => Promise<void>;
  close?: () => Promise<void>;
}

function getSidePanel(): SidePanelLike | null {
  const api = chrome as unknown as { sidePanel?: SidePanelLike };
  return api.sidePanel ?? null;
}

function getSidebarAction(): SidebarActionLike | null {
  const api = chrome as unknown as { sidebarAction?: SidebarActionLike };
  return api.sidebarAction ?? null;
}

async function openSidePanelForCurrentTab(): Promise<void> {
  const sidePanel = getSidePanel();
  if (sidePanel?.open) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId != null) {
      await sidePanel.open({ windowId: tab.windowId });
      return;
    }
  }
  const sidebar = getSidebarAction();
  if (sidebar?.open) {
    await sidebar.open();
  }
}

/**
 * Persist the new mode and open the destination surface.
 *
 * Returns whether the destination opened so the caller can show a
 * fallback hint (e.g. "click the toolbar icon" if popup didn't
 * auto-open because the extension isn't pinned).
 */
export async function switchViewMode(next: ViewMode): Promise<{ opened: boolean }> {
  await persistViewMode(next);

  if (next === 'sidepanel') {
    try {
      await openSidePanelForCurrentTab();
      return { opened: true };
    } catch (error) {
      logger.info('ViewMode', 'open side panel failed:', (error as Error).message);
      return { opened: false };
    }
  }

  // next === 'popup'. Delegate to the SW so the sidepanel close
  // completes (and Chrome's focus restore lands) before the popup
  // opens. Doing this from here would race — see file header.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const resp = await call('sidepanelToPopup', {
      windowId: tab?.windowId,
      tabId: tab?.id,
    });
    return { opened: resp.opened };
  } catch (error) {
    // Our page is likely being torn down by the SW-side close; RPC
    // failure is expected and benign in that case.
    logger.info('ViewMode', 'sidepanelToPopup RPC failed:', (error as Error).message);
    return { opened: false };
  }
}
