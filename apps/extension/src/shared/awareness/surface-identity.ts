/**
 * Surface identity resolver.
 *
 * Each renderer surface (popup, workbench tab, DevTools panel, side
 * panel) builds a {@link PresenceIdentity} once at mount. The
 * descriptive `label` is bound to `document.title` so other surfaces
 * see exactly what the user sees on the browser tab strip — including
 * the existing `useWorkspaceTabTitle` ordinal prefix (`"#4 New Header
 * Rule — Open Headers"`). A `MutationObserver` keeps the label in
 * sync; explicit `setLabel()` overrides are still supported for
 * surfaces that don't drive document.title (popup / devpanel) or
 * want to publish a richer label.
 *
 * Why per-surface resolvers instead of one big switch:
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
 * The resolver runs at mount; surfaces never refresh `instanceId` or
 * `navigation` after the first call.
 */

import type {
  AppKind,
  BrowserContext,
  NavigationHandle,
  PresenceIdentity,
  SurfaceKind,
} from '@openheaders/core/protocol';
import { generateUid } from '@openheaders/core/utils';
import { isEdge, isFirefox, isSafari } from '@utils/browser-api';

const APP_ID: AppKind = 'extension';

function detectBrowser(): BrowserContext['browser'] {
  if (isFirefox) return 'firefox';
  if (isEdge) return 'edge';
  if (isSafari) return 'safari';
  // Chrome detection is best-effort — Brave, Vivaldi, and other
  // Chromium derivatives present as Chrome via UA. They behave
  // identically for our purposes.
  if (/Chrome/.test(navigator.userAgent)) return 'chrome';
  return 'other';
}

const BROWSER_CONTEXT: BrowserContext = { browser: detectBrowser() };

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

function defaultLabel(kind: SurfaceKind): string {
  switch (kind) {
    case 'workbench':
      return 'Workbench';
    case 'popup':
      return 'Popup';
    case 'devpanel':
      return 'DevTools panel';
    case 'sidepanel':
      return 'Side panel';
  }
}

export type LabelChangeListener = (label: string) => void;

export interface SurfaceIdentityHandle {
  /** The identity record passed to `useAwareness`. Returned reference
   *  changes whenever `label` or `navigation` updates so React
   *  state-comparison consumers see a new object. */
  current(): PresenceIdentity;
  /** Manually override the descriptive summary. Useful when the
   *  surface wants a richer label than `document.title` carries. */
  setLabel(label: string): PresenceIdentity;
  /** Observe label updates (`document.title` mutations or async
   *  inspected-tab refreshes). The awareness coordinator subscribes
   *  to this so a label change re-publishes the current claim. */
  onLabelChange(listener: LabelChangeListener): () => void;
  /** Tear down internal observers (MutationObserver, polling). */
  dispose(): void;
}

interface ResolveOptions {
  surfaceKind: SurfaceKind;
  /** Initial label seed before any live observation kicks in. */
  initialLabel?: string;
  /** Async navigation handle resolver. The identity is returned
   *  immediately with `navigation` undefined, then the handle is filled
   *  in once the lookup completes. Surfaces that publish before
   *  navigation lands will simply re-publish on the next heartbeat. */
  resolveNavigation?: () => Promise<NavigationHandle | null>;
  /** Wire a live-label source. Returns a teardown function. The
   *  callback is invoked whenever the label changes, including the
   *  initial value if it differs from the seed. */
  observeLabel?: (apply: (label: string) => void) => () => void;
}

function buildIdentity(opts: ResolveOptions): SurfaceIdentityHandle {
  const instanceId = `${opts.surfaceKind}-${generateUid()}`;
  let identity: PresenceIdentity = {
    instanceId,
    surfaceKind: opts.surfaceKind,
    appId: APP_ID,
    browserContext: BROWSER_CONTEXT,
    label: opts.initialLabel ?? defaultLabel(opts.surfaceKind),
  };
  const labelListeners = new Set<LabelChangeListener>();

  function applyLabel(label: string): void {
    const trimmed = label.trim();
    if (!trimmed || identity.label === trimmed) return;
    identity = { ...identity, label: trimmed };
    for (const l of labelListeners) {
      try {
        l(trimmed);
      } catch {
        /* listener errors must not break the source */
      }
    }
  }

  if (opts.resolveNavigation) {
    void opts
      .resolveNavigation()
      .then((nav) => {
        if (nav) identity = { ...identity, navigation: nav };
      })
      .catch(() => {
        /* navigation stays undefined — fine */
      });
  }

  const teardownLabel = opts.observeLabel?.((label) => applyLabel(label));

  return {
    current() {
      return identity;
    },
    setLabel(label) {
      applyLabel(label);
      return identity;
    },
    onLabelChange(listener) {
      labelListeners.add(listener);
      return () => {
        labelListeners.delete(listener);
      };
    },
    dispose() {
      teardownLabel?.();
      labelListeners.clear();
    },
  };
}

/** `document.title` source — used by surfaces whose own title is
 *  entity-aware (workbench `useWorkspaceTabTitle`, popup, sidepanel).
 *  Seeds with the current title and observes `<title>` mutations so
 *  the label tracks the browser tab strip exactly. */
function observeDocumentTitle(apply: (label: string) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  apply(document.title);
  const head = document.head ?? document.querySelector('head');
  if (!head) return () => {};
  // Observe mutations to `<title>` AND insertion/removal of the
  // element itself (some routers swap it out wholesale).
  const observer = new MutationObserver(() => apply(document.title));
  observer.observe(head, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
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
    surfaceKind: 'popup',
    initialLabel,
    observeLabel: observeDocumentTitle,
  });
}

/** Side panel identity — tracks document.title; re-openable via
 *  `chrome.sidePanel.open({ windowId })`. */
export function resolveSidePanelIdentity(initialLabel?: string): SurfaceIdentityHandle {
  return buildIdentity({
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
