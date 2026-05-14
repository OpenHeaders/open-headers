/**
 * Surface identity resolvers — browser-extension host bindings.
 *
 * The host-neutral identity builder lives in
 * `@/shared/awareness/surface-identity`; this module supplies the
 * platform-specific half for each extension surface:
 *
 * - **Popup** can't be focused programmatically by another surface
 *   (popups dismiss on focus loss); navigation is omitted.
 * - **Workbench** runs in a regular browser tab. `chrome.tabs.getCurrent()`
 *   resolves the `(tabId, windowId)` peer-addressable pair, and
 *   `document.title` is the entity-aware tab title.
 * - **DevTools panel** runs inside the DevTools window with no `tabs`
 *   permission for itself; `chrome.devtools.inspectedWindow.tabId` is
 *   the tab it inspects, which is what the user wants to switch back
 *   to in order to bring this DevTools instance into view.
 * - **Side panel** has its own page realm and can be re-opened with
 *   `chrome.sidePanel.open({ windowId })`.
 *
 * Each host ships its own analogous resolver module — Electron resolves
 * navigation from its window manager, the web app from the browser
 * history API — and calls `buildIdentity` with the same contract.
 */

import {
  buildIdentity,
  observeDocumentTitle,
  type SurfaceIdentityHandle,
} from '@/shared/awareness/surface-identity';

/** Lookup of `chrome.tabs.getCurrent()` (workbench / sidepanel) wrapped
 *  to tolerate Firefox's promise-returning shape. */
function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    try {
      const api: typeof chrome.tabs | undefined = chrome.tabs;
      if (!api?.getCurrent) {
        resolve(null);
        return;
      }
      // Firefox returns a Promise; Chrome calls the callback. We invoke
      // with the callback in both shapes — Firefox's polyfill ignores
      // the callback when a promise is also returned, so handling both
      // arms is safe.
      const maybe = api.getCurrent((tab) => resolve(tab ?? null)) as
        | Promise<chrome.tabs.Tab | undefined>
        | undefined
        | void;
      if (maybe && typeof (maybe as Promise<chrome.tabs.Tab | undefined>).then === 'function') {
        (maybe as Promise<chrome.tabs.Tab | undefined>).then((tab) => resolve(tab ?? null)).catch(() => resolve(null));
      }
    } catch {
      resolve(null);
    }
  });
}

/** Inspected-tab source for DevTools panels — reads
 *  `chrome.tabs.get(inspectedTabId)` and re-reads on
 *  `chrome.tabs.onUpdated` events scoped to that tab so the label
 *  follows page navigations and title changes (e.g. SPAs that update
 *  document.title client-side). */
function observeInspectedTab(apply: (label: string) => void): () => void {
  const dev = (chrome as typeof chrome & { devtools?: { inspectedWindow?: { tabId: number } } }).devtools;
  const tabId = dev?.inspectedWindow?.tabId;
  if (typeof tabId !== 'number' || !chrome.tabs?.get) return () => {};

  const buildLabel = (tab: chrome.tabs.Tab | undefined): string => {
    if (!tab) return 'DevTools panel';
    if (tab.title && tab.title.trim().length > 0) return `DevTools — ${tab.title}`;
    if (tab.url) {
      try {
        return `DevTools — ${new URL(tab.url).hostname}`;
      } catch {
        /* fall through */
      }
    }
    return 'DevTools panel';
  };

  let disposed = false;
  const refresh = (): void => {
    try {
      chrome.tabs.get(tabId, (tab) => {
        // Reading lastError clears it; the tab may have closed.
        void chrome.runtime.lastError;
        if (disposed) return;
        apply(buildLabel(tab));
      });
    } catch {
      /* ignore — apply stays at last known value */
    }
  };
  refresh();

  const listener = (changedId: number, changeInfo: { title?: string; url?: string; status?: string }): void => {
    if (changedId !== tabId) return;
    if (changeInfo.title === undefined && changeInfo.url === undefined && changeInfo.status === undefined) return;
    refresh();
  };
  try {
    chrome.tabs.onUpdated?.addListener(listener);
  } catch {
    /* permissions may be missing in some packaging; fall back to one-shot */
  }

  return () => {
    disposed = true;
    try {
      chrome.tabs.onUpdated?.removeListener(listener);
    } catch {
      /* ignore */
    }
  };
}

/** Workbench tab identity — label tracks `document.title` so other
 *  surfaces see the same string the user sees on the browser tab strip
 *  (e.g. `"#4 New Header Rule — Open Headers"`). Peer-addressable by
 *  `(tabId, windowId)`. */
export function resolveWorkbenchIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
    appId: 'extension',
    surfaceKind: 'workbench',
    initialLabel,
    observeLabel: observeDocumentTitle,
    resolveNavigation: async () => {
      const tab = await getCurrentTab();
      if (!tab || tab.id === undefined || tab.windowId === undefined) return null;
      return {
        kind: 'chrome-tab',
        tabId: tab.id,
        windowId: tab.windowId,
        url: tab.url,
      };
    },
  });
}

/** Popup identity — tracks the popup's own document.title. Not
 *  peer-addressable; popups dismiss on focus loss. */
export function resolvePopupIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
    appId: 'extension',
    surfaceKind: 'popup',
    initialLabel,
    observeLabel: observeDocumentTitle,
  });
}

/** Side panel identity — tracks document.title; re-openable via
 *  `chrome.sidePanel.open({ windowId })`. */
export function resolveSidePanelIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
    appId: 'extension',
    surfaceKind: 'sidepanel',
    initialLabel,
    observeLabel: observeDocumentTitle,
    resolveNavigation: async () => {
      const tab = await getCurrentTab();
      if (!tab || tab.windowId === undefined) return null;
      return { kind: 'side-panel', windowId: tab.windowId, tabId: tab.id };
    },
  });
}

/** DevTools panel identity — label tracks the *inspected* tab's title
 *  (the page the user opened DevTools on), not the panel's own
 *  document.title. Peer-addressable indirectly via the inspected tab;
 *  switching to that tab brings the user adjacent to the DevTools
 *  window where this panel lives. */
export function resolveDevPanelIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
    appId: 'extension',
    surfaceKind: 'devpanel',
    initialLabel,
    observeLabel: observeInspectedTab,
    resolveNavigation: async () => {
      try {
        const dev = (chrome as typeof chrome & { devtools?: { inspectedWindow?: { tabId: number } } }).devtools;
        const tabId = dev?.inspectedWindow?.tabId;
        if (typeof tabId !== 'number') return null;
        return { kind: 'devtools-inspected-tab', inspectedTabId: tabId };
      } catch {
        return null;
      }
    },
  });
}
