/**
 * Boot-time wiring: register the browser-extension's chrome adapter as
 * the global host-navigation implementation.
 *
 * The popup and side panel import this module once at startup so UI code
 * that reaches for `@openheaders/core/navigation`'s `hostNavigation`
 * proxy lands on the chrome-backed adapter:
 *
 *  - `switchViewMode` opens the destination surface in the user-gesture
 *    stack (mandatory on Firefox), persists the new mode directly to
 *    storage so the choice is durable even if the popup auto-closes,
 *    then hands off to the SW controller for toolbar re-bind + source
 *    surface close + (Chromium popup destination) action.openPopup.
 *  - `currentWindowId` resolves the caller's window so the workspace
 *    navigator can prefer a same-window workspace tab.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module — the contract on the UI side is identical, and the
 * seam degrades to a graceful no-op when no host wires it.
 */

import { type ActiveTab, type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import type { ViewMode } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { getBrowserAPI } from '@/types/browser';
import { isFirefox } from '@/utils/browser-runtime';
import { selectViewModeAdapter } from '@/background/view-mode/select-adapter';
import { setViewMode as persistViewMode } from './view-mode-storage';

/**
 * Renderer-side view-mode transition.
 *
 *   - popup → sidepanel: open the destination surface FIRST, synchronously
 *     in the user-gesture stack (this is mandatory on Firefox; Chromium
 *     tolerates an awaited query before its sidePanel.open, but we keep
 *     a single code path that works for both).
 *   - sidepanel → popup: hand off to the SW immediately — the controller
 *     closes the sidebar and (on Chromium) calls action.openPopup. On
 *     Firefox no popup-open API exists; the controller returns
 *     `opened: false` and the caller surfaces a hint pointing at the toolbar.
 *
 * The active-tab query is intentionally placed AFTER the gesture-critical
 * `openSurface('sidepanel')` call so persistence / lookup latency can't
 * eat the user gesture on Firefox.
 */
function getCurrentSurface(): ViewMode | null {
  if (typeof window === 'undefined') return null;
  const path = window.location?.pathname ?? '';
  if (path.endsWith('sidepanel.html')) return 'sidepanel';
  if (path.endsWith('popup.html')) return 'popup';
  return null;
}

async function switchViewMode(next: ViewMode): Promise<{ opened: boolean }> {
  const adapter = selectViewModeAdapter();
  const source = getCurrentSurface();

  // Gesture-critical synchronous kickoff. Calling these (not awaiting)
  // runs the adapter method's sync prefix — including the actual
  // sidebar.open()/.close() invocation — inside the click-handler stack,
  // before any await can consume the Firefox user gesture. We capture
  // the promise and await it later, after the gesture-sensitive work
  // is already in flight.
  let kickoff: Promise<{ opened: boolean } | void> | null = null;
  if (next === 'sidepanel') {
    kickoff = adapter.openSurface('sidepanel', {});
  } else if (source === 'sidepanel') {
    kickoff = adapter.closeSurface('sidepanel', {});
  }

  // Durability: persist while we still have a live renderer. On
  // popup→sidepanel the popup may auto-close on focus loss; on
  // sidepanel→popup the kickoff close will tear down this renderer
  // once it resolves. The storage write is dispatched synchronously
  // inside set(), so it lands even if our promise never resolves
  // because the page goes away.
  try {
    await persistViewMode(next);
  } catch (error) {
    logger.info('ViewMode', 'renderer-side persist failed:', (error as Error).message);
  }

  let openedInRenderer: boolean | undefined;
  if (kickoff && next === 'sidepanel') {
    try {
      const result = (await kickoff) as { opened: boolean };
      openedInRenderer = result.opened;
    } catch (error) {
      logger.info('ViewMode', 'open side panel failed:', (error as Error).message);
      openedInRenderer = false;
    }
  } else if (kickoff) {
    // closeSurface — ignore the void result, but let it settle so the
    // RPC below sees an already-closed sidebar.
    try {
      await kickoff;
    } catch (error) {
      logger.info('ViewMode', 'close side panel failed:', (error as Error).message);
    }
  }

  let windowId: number | undefined;
  let tabId: number | undefined;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    windowId = tab?.windowId;
    tabId = tab?.id;
  } catch {
    // Best-effort context resolution; the SW falls back to defaults.
  }

  try {
    const resp = await call('switchViewMode', { next, windowId, tabId });
    return { opened: openedInRenderer ?? resp.opened };
  } catch (error) {
    logger.info('ViewMode', 'switchViewMode RPC failed:', (error as Error).message);
    return { opened: openedInRenderer ?? false };
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

/**
 * Open the browser's extension-shortcut customization page. Chrome and
 * Edge expose `chrome://extensions/shortcuts`; Firefox routes shortcut
 * rebinding through `about:addons`. Fire-and-forget.
 */
function openShortcutSettings(): void {
  void chrome.tabs?.create?.({ url: isFirefox ? 'about:addons' : 'chrome://extensions/shortcuts' });
}

/**
 * Resolve the user's active browsing tab — id + URL + title. Returns
 * `null` when no active tab is resolvable, or it has no id (the caller
 * needs the id for tab-scoped RPCs).
 */
async function getActiveTab(): Promise<ActiveTab | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof tab?.id !== 'number') return null;
    return { id: tab.id, url: tab.url, title: tab.title };
  } catch {
    return null;
  }
}

/**
 * Wire the active-tab rule-context observers. A "this page" surface
 * should re-query when the active tab finishes loading or the user
 * switches tabs (`chrome.tabs`), and when stored rule state changes
 * (`chrome.storage`). Returns a disposer that removes every listener.
 */
function observeActiveTabContext(onChange: () => void): () => void {
  const browserAPI = getBrowserAPI();
  const handleTabUpdate = (_tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab): void => {
    if (changeInfo.status === 'complete' && tab.active) onChange();
  };
  browserAPI.tabs.onUpdated.addListener(handleTabUpdate);
  browserAPI.tabs.onActivated.addListener(onChange);
  browserAPI.storage.onChanged.addListener(onChange);
  return () => {
    browserAPI.tabs.onUpdated.removeListener(handleTabUpdate);
    browserAPI.tabs.onActivated.removeListener(onChange);
    browserAPI.storage.onChanged.removeListener(onChange);
  };
}

/**
 * The tab a DevTools panel is inspecting, read from
 * `chrome.devtools.inspectedWindow`. `null` outside a DevTools context
 * (popup, side panel, tests) — `chrome.devtools` is absent there, so the
 * panel-only hooks that scope to this id no-op cleanly.
 */
function inspectedTabId(): number | null {
  const devtools = (chrome as unknown as { devtools?: { inspectedWindow?: { tabId?: number } } }).devtools;
  const id = devtools?.inspectedWindow?.tabId;
  return typeof id === 'number' ? id : null;
}

/**
 * Reload the inspected page via `chrome.devtools.inspectedWindow.reload`.
 * No-ops outside a DevTools context — `chrome.devtools` is absent in the
 * popup, side panel, and tests.
 */
function reloadInspectedTab(): void {
  const devtools = (chrome as unknown as { devtools?: { inspectedWindow?: { reload?: () => void } } }).devtools;
  devtools?.inspectedWindow?.reload?.();
}

/**
 * Open `url` at the given line/column in the DevTools Sources panel via
 * `chrome.devtools.panels.openResource`. The Sources panel handles
 * source-map resolution for us, so a frame whose URL points at minified
 * JS still lands at the right original line when a map is available.
 * No-ops cleanly outside a DevTools context.
 */
function openResource(url: string, lineNumber?: number, columnNumber?: number): void {
  if (!url) return;
  const devtools = (
    chrome as unknown as {
      devtools?: {
        panels?: { openResource?: (url: string, line: number, column?: number, cb?: () => void) => void };
      };
    }
  ).devtools;
  const fn = devtools?.panels?.openResource;
  if (!fn) return;
  try {
    // openResource expects a line number (0-indexed in some Chrome versions).
    // Our frames carry the 0-indexed value from V8 stack traces, which is
    // what the API takes — no off-by-one adjustment.
    fn(url, lineNumber ?? 0, columnNumber);
  } catch {
    // The API throws when called with an unsupported URL scheme; swallow
    // since the click is best-effort.
  }
}

const chromeHostNavigation: HostNavigation = {
  switchViewMode,
  currentWindowId,
  activeTabUrl,
  openUrl,
  openShortcutSettings,
  getActiveTab,
  observeActiveTabContext,
  inspectedTabId,
  reloadInspectedTab,
  openResource,
};

setHostNavigation(chromeHostNavigation);
