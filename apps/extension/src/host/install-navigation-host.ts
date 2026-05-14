/**
 * Boot-time wiring: register the browser-extension's chrome adapter as
 * the global host-navigation implementation.
 *
 * The popup and side panel import this module once at startup so UI code
 * that reaches for `@openheaders/core/navigation`'s `hostNavigation`
 * proxy lands on the chrome-backed adapter:
 *
 *  - `switchViewMode` persists the mode (background's storage listener
 *    reapplies `chrome.action.setPopup` + `setPanelBehavior`) and opens
 *    the destination surface in the same user gesture.
 *  - `currentWindowId` resolves the caller's window so the workspace
 *    navigator can prefer a same-window workspace tab.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module — the contract on the UI side is identical, and the
 * seam degrades to a graceful no-op when no host wires it.
 */

import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import type { ViewMode } from '@openheaders/core/types';
import { setViewMode as persistViewMode } from '@openheaders/oracle/view-mode';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';

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

/**
 * Open the side panel for the active tab's window. `sidePanel.open()`
 * requires a user gesture; calling it from a click handler counts.
 * Firefox lacks `sidePanel` — fall back to `sidebarAction.open()`.
 */
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
 * Persist the new view mode and open the destination surface.
 *
 *  - popup → sidepanel: open the panel from the popup's click handler
 *    (user gesture required). Opening the side panel doesn't blur the
 *    popup, so the caller closes the popup afterwards with no race.
 *  - sidepanel → popup: delegated to the SW (`sidepanelToPopup`).
 *    Closing the side panel restores focus to the main window, which
 *    blurs (and auto-closes) any popup opened beforehand — the SW
 *    sequences `sidePanel.close()` → `action.openPopup()` so the popup
 *    opens after focus has settled. RPC failure mid-teardown is benign.
 */
async function switchViewMode(next: ViewMode): Promise<{ opened: boolean }> {
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

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const resp = await call('sidepanelToPopup', {
      windowId: tab?.windowId,
      tabId: tab?.id,
    });
    return { opened: resp.opened };
  } catch (error) {
    logger.info('ViewMode', 'sidepanelToPopup RPC failed:', (error as Error).message);
    return { opened: false };
  }
}

/**
 * Resolve the caller's window id via `chrome.windows.getCurrent`. Returns
 * `undefined` where unavailable (popup on Firefox, DevTools panel
 * contexts where the hosting window isn't directly queryable) — the
 * workspace navigator's fallback path handles that.
 */
async function currentWindowId(): Promise<number | undefined> {
  const api = getBrowserAPI() as unknown as {
    windows?: {
      // biome-ignore lint/suspicious/noConfusingVoidType: Chrome API returns void in callback-style; runtime branches on Promise.
      getCurrent?: (opts?: { populate?: boolean }) => Promise<chrome.windows.Window> | void;
    };
  };
  const getCurrent = api.windows?.getCurrent;
  if (!getCurrent) return undefined;
  try {
    const win = await getCurrent();
    return typeof win?.id === 'number' ? win.id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the user's active browsing tab URL via `chrome.tabs.query`.
 * Filters out the extension's own UI surfaces and browser-internal pages
 * (`chrome-extension://`, `chrome://`) — when the active tab is one of
 * those, "this page" has no meaningful target, so the answer is
 * `undefined`. Also `undefined` where the API is unavailable or rejects.
 */
async function activeTabUrl(): Promise<string | undefined> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url ?? '';
    if (!url || url.startsWith('chrome-extension://') || url.startsWith('chrome://')) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Open `url` in a new browser tab. Fire-and-forget — the popup's link
 * affordances don't act on the result. Optional-chains `chrome.tabs` so
 * a context without the API simply no-ops.
 */
function openUrl(url: string): void {
  void chrome.tabs?.create?.({ url });
}

const chromeHostNavigation: HostNavigation = {
  switchViewMode,
  currentWindowId,
  activeTabUrl,
  openUrl,
};

setHostNavigation(chromeHostNavigation);
