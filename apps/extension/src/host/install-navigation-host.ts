/**
 * Boot-time wiring: register the browser-extension's chrome adapter as
 * the global host-navigation implementation.
 *
 * The popup and side panel import this module once at startup so UI code
 * that reaches for `@openheaders/core/navigation`'s `hostNavigation`
 * proxy lands on the chrome-backed adapter:
 *
 *  - `switchViewMode` invokes the gesture-bound surface ops (Firefox
 *    sidebar open/close) synchronously inside the click handler, then
 *    dispatches a `switchViewMode` RPC carrying `{next, source}`. The
 *    SW controller handles persistence, toolbar re-binding, and the
 *    SW-callable surface ops (Chromium sidePanel + action.openPopup).
 *  - `currentWindowId` resolves the caller's window so the workspace
 *    navigator can prefer a same-window workspace tab.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module — the contract on the UI side is identical, and the
 * seam degrades to a graceful no-op when no host wires it.
 */

import { type ActiveTab, type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import type { InspectorHarEntry, ViewMode } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';
import { selectViewModeAdapter } from '@/background/view-mode/select-adapter';
import { getBrowserAPI } from '@/types/browser';
import { isFirefox } from '@/utils/browser-runtime';

/**
 * Renderer-side view-mode transition.
 *
 * The renderer owns gesture-bound surface ops (Firefox sidebar
 * open/close). The SW owns persistence, toolbar re-binding, and the
 * SW-callable surface ops (Chromium sidePanel + action.openPopup).
 *
 * Awaiting the RPC is source-dependent:
 *   - source === 'popup'      → safe to await; popup stays alive.
 *   - source === 'sidepanel'  → fire-and-forget; SW closing the sidebar
 *     (Chromium) or our own close-from-renderer (Firefox) tears down
 *     this JS context, so an awaited response can't arrive. The message
 *     is dispatched synchronously by `runtime.sendMessage`, so the SW
 *     still receives it.
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

  // 1. Kick off destination open in the gesture stack. Each adapter's
  //    openFromRenderer is the live path for its browser's gesture-bound
  //    surfaces (Chromium sidePanel.open + action.openPopup; Firefox
  //    sidebar.open). The async function's sync prefix gets us to the
  //    first internal await before control returns here.
  const openP = next !== source ? adapter.openFromRenderer(next) : null;

  // 2. Dispatch RPC synchronously so the SW can persist + bind in parallel.
  //    Survives even if our JS context dies before the response arrives.
  const rpc = call('switchViewMode', { next, source });

  // 3. Await open while the renderer is still alive. Source surface
  //    hasn't been closed yet — both popup and sidepanel sources are
  //    safe to use.
  let opened = false;
  if (openP) {
    try {
      opened = (await openP).opened;
    } catch (error) {
      logger.info('ViewMode', 'openFromRenderer failed:', (error as Error).message);
    }
  }

  // 4. Source close. For Firefox sidepanel-source this kills our JS
  //    context; the RPC was already dispatched in step 2 so the SW
  //    still gets it. For Chromium sidepanel-source the SW does the
  //    close via the RPC (closeFromRenderer is a no-op here). For
  //    popup source the caller (Header.tsx) calls window.close().
  if (source && source !== next) {
    try {
      await adapter.closeFromRenderer(source);
    } catch (error) {
      logger.info('ViewMode', 'closeFromRenderer failed:', (error as Error).message);
    }
  }

  // 5. Await the RPC only when our JS is sure to outlive it. Sidepanel-
  //    source either died in step 4 (Firefox) or will be closed by the
  //    SW (Chromium, mid-RPC) — either way an awaited response can't
  //    reach us, so we just observe its rejection if any.
  if (source === 'sidepanel') {
    rpc.catch((error: Error) => {
      logger.info('ViewMode', 'switchViewMode RPC rejected (sidebar source):', error.message);
    });
  } else {
    try {
      const r = await rpc;
      opened = opened || r.opened;
    } catch (error) {
      logger.info('ViewMode', 'switchViewMode RPC failed:', (error as Error).message);
    }
  }
  return { opened };
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
 * The host's own `chrome.devtools.network` HAR for the inspected tab — the
 * exact bytes its "Save all as HAR" writes. The HAR export reconciles its
 * CDP-synthesized entries against this (request-header order, which the
 * `chrome.debugger` transport key-sorts away, chief among the fields it
 * recovers). `getHAR` is callback-style; we promisify it. `null` outside a
 * DevTools context (`chrome.devtools` absent), on error, or when the feed
 * yields no entries — the export then keeps its synthesized entries.
 */
function getInspectedHar(): Promise<readonly InspectorHarEntry[] | null> {
  const getHAR = (
    chrome as unknown as {
      devtools?: { network?: { getHAR?: (cb: (harLog: { entries?: InspectorHarEntry[] }) => void) => void } };
    }
  ).devtools?.network?.getHAR;
  if (!getHAR) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      getHAR((harLog) => {
        const entries = harLog?.entries;
        resolve(Array.isArray(entries) && entries.length > 0 ? entries : null);
      });
    } catch {
      resolve(null);
    }
  });
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
  getInspectedHar,
  openResource,
};

setHostNavigation(chromeHostNavigation);
