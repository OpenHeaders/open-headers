/**
 * Peer-navigation helper — given a {@link NavigationHandle} from a
 * remote surface's identity, focus that surface for the user.
 *
 * Each tag dispatches to the appropriate browser API:
 *  - `chrome-tab` → activate the tab + focus its window.
 *  - `devtools-inspected-tab` → activate the tab the DevTools panel
 *     was inspecting; the DevTools window is adjacent to it.
 *  - `side-panel` → re-open the side panel for that window.
 *  - `desktop-window` → reserved for Mode 2/3 desktop transports.
 *
 * Best-effort: a stale tab id (the user closed the tab since the peer
 * surface published) returns false rather than throwing. Callers can
 * surface a small toast when navigation fails so the user understands
 * the peer surface has gone away.
 */

import type { NavigationHandle } from '@openheaders/core/protocol';

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

/** Returns true on successful focus, false when the peer surface can't
 *  be reached (stale tab, missing API, unsupported handle kind). */
export async function peerNavigate(handle: NavigationHandle): Promise<boolean> {
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
      // will register its own dispatcher when it lands.
      return false;
  }
}

/** True when the handle could be acted on in the current realm. UI
 *  uses this to decide whether to render the row as clickable. */
export function isPeerNavigable(handle: NavigationHandle | undefined): boolean {
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
}

/** Extract the browser tab id a navigation handle resolves to, when
 *  it has one. Used by `isHandleCoLocated` to decide whether two
 *  surfaces share a viewport. `side-panel` may carry an optional
 *  `tabId`; `chrome-tab` and `devtools-inspected-tab` always do. */
function extractTabId(handle: NavigationHandle | undefined): number | null {
  if (!handle) return null;
  switch (handle.kind) {
    case 'chrome-tab':
      return handle.tabId;
    case 'devtools-inspected-tab':
      return handle.inspectedTabId;
    case 'side-panel':
      return handle.tabId ?? null;
    case 'desktop-window':
      return null;
  }
}

/**
 * True when `peer` resolves to the same browser tab that `local`
 * inhabits. Surfaces that share a viewport — e.g. a workbench in tab
 * T1 and a devpanel inspecting T1, or two surfaces sharing the same
 * side panel — should not render a "switch to" affordance: the click
 * would activate a tab the user is already on.
 *
 * Returns false when either side has no addressable tab (popup,
 * desktop-window, missing handle), since absence of information is
 * not evidence of co-location.
 */
export function isHandleCoLocated(
  local: NavigationHandle | undefined,
  peer: NavigationHandle | undefined,
): boolean {
  const localTab = extractTabId(local);
  const peerTab = extractTabId(peer);
  if (localTab === null || peerTab === null) return false;
  return localTab === peerTab;
}
