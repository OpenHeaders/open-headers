/**
 * Boot-time wiring: register the browser-extension's chrome adapters as
 * the global lifeline-transport and peer-navigator implementations.
 *
 * Every UI entry point (popup, workbench, devtools panel, side panel)
 * imports this module once at startup so awareness UI code that reaches
 * for `@openheaders/core/awareness`'s `lifelineTransport` / `peerNavigator`
 * proxies lands on the chrome-backed transport.
 *
 * Other hosts (Electron desktop, web app) ship their own analogous
 * install module wiring a different transport — the contract on the UI
 * side is identical, and both seams degrade to graceful no-ops when no
 * host wires them.
 */

import {
  type LifelinePort,
  type LifelineTransport,
  type PeerNavigator,
  setLifelineTransport,
  setPeerNavigator,
} from '@openheaders/core/awareness';
import type { NavigationHandle } from '@openheaders/core/protocol';
import { runtime } from '@/utils/browser-runtime';

/**
 * `chrome.runtime.Port`-backed lifeline transport. `connect` may throw
 * (no runtime API, manifest issue) — the renderer lifeline wraps the
 * call in its own try/catch and reconnects, so the adapter stays thin
 * and propagates raw failures.
 */
const chromeLifelineTransport: LifelineTransport = {
  connect(name: string): LifelinePort {
    const port = runtime.connect({ name });
    return {
      postMessage(message: unknown): void {
        port.postMessage(message);
      },
      onMessage(handler): void {
        port.onMessage.addListener(handler);
      },
      onDisconnect(handler): void {
        port.onDisconnect.addListener(() => {
          handler({ errorMessage: runtime.lastError?.message });
        });
      },
      disconnect(): void {
        port.disconnect();
      },
    };
  },
};

/** Activate a tab and, when known, focus its window. Best-effort. */
function activateTab(tabId: number, windowId?: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tabsApi = chrome.tabs;
      if (!tabsApi?.update) {
        resolve(false);
        return;
      }
      tabsApi.update(tabId, { active: true }, (updatedTab) => {
        const err = chrome.runtime.lastError;
        if (err || !updatedTab) {
          resolve(false);
          return;
        }
        if (windowId !== undefined && chrome.windows?.update) {
          chrome.windows.update(windowId, { focused: true }, () => {
            // ignore lastError — tab activation already succeeded
            void chrome.runtime.lastError;
            resolve(true);
          });
          return;
        }
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });
}

/** Re-open the side panel for a window. Best-effort. */
function openSidePanel(windowId: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const panel = (chrome as typeof chrome & { sidePanel?: { open?: (opts: { windowId: number }) => Promise<void> } })
        .sidePanel;
      if (!panel?.open) {
        resolve(false);
        return;
      }
      panel
        .open({ windowId })
        .then(() => resolve(true))
        .catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

/**
 * Chrome peer navigator — dispatches each {@link NavigationHandle} kind
 * to the appropriate browser API:
 *  - `chrome-tab` → activate the tab + focus its window.
 *  - `devtools-inspected-tab` → activate the tab the DevTools panel was
 *     inspecting; the DevTools window is adjacent to it.
 *  - `side-panel` → re-open the side panel for that window.
 *  - `desktop-window` → reserved for Mode 2/3 desktop transports.
 */
const chromePeerNavigator: PeerNavigator = {
  navigate(handle: NavigationHandle): Promise<boolean> {
    switch (handle.kind) {
      case 'chrome-tab':
        return activateTab(handle.tabId, handle.windowId);
      case 'devtools-inspected-tab':
        return activateTab(handle.inspectedTabId);
      case 'side-panel':
        return openSidePanel(handle.windowId);
      case 'desktop-window':
        // Desktop Mode 2/3 — reserved. Returning false here is the right
        // behavior in extension-only deployments; the desktop renderer
        // will register its own navigator when it lands.
        return Promise.resolve(false);
    }
  },
  canNavigate(handle: NavigationHandle | undefined): boolean {
    if (!handle) return false;
    switch (handle.kind) {
      case 'chrome-tab':
      case 'devtools-inspected-tab':
        return typeof chrome !== 'undefined' && !!chrome.tabs?.update;
      case 'side-panel':
        return (
          typeof chrome !== 'undefined' &&
          !!(chrome as typeof chrome & { sidePanel?: { open?: unknown } }).sidePanel?.open
        );
      case 'desktop-window':
        return false;
    }
  },
};

setLifelineTransport(chromeLifelineTransport);
setPeerNavigator(chromePeerNavigator);
