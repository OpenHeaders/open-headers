/**
 * Host-navigation contract — the seam between UI code that drives
 * surface-level navigation (switch the extension UI between popup and
 * side-panel mode, resolve which browser window the caller sits in) and
 * the platform-specific adapter that actually performs it.
 *
 * Each app installs its own implementation once at boot via
 * {@link setHostNavigation}:
 *
 *   - **Browser extension** — `chrome.action.setPopup`, `chrome.sidePanel`,
 *     `chrome.windows`, `chrome.tabs`.
 *   - **Electron desktop** — window manager over IPC (reserved). Desktop
 *     has no popup/side-panel duality, so `switchViewMode` stays a no-op
 *     there; `currentWindowId` maps to the focused BrowserWindow id.
 *   - **Web app** — no surface duality; both methods no-op.
 *
 * Every method degrades gracefully: an unwired host (or one without the
 * concept) loses the surface-switch affordance, the same-window
 * workspace-tab optimization, and the active-page scope, but nothing
 * throws — mirrors the lifeline-transport / peer-navigation seams.
 */

import type { ViewMode } from '../types';

/**
 * The user's active browsing tab — the subset a surface needs to scope
 * a view to "this page" and issue tab-scoped host RPCs.
 */
export interface ActiveTab {
  /** Tab id — required for tab-scoped host RPCs. */
  id: number;
  /** Current URL, when the tab exposes one. */
  url?: string;
  /** Tab title, when available. */
  title?: string;
}

export interface HostNavigation {
  /**
   * Switch the extension UI between its `popup` and `sidepanel`
   * surfaces, persisting the choice and opening the destination in the
   * same user gesture. Resolves `{ opened }` so the caller can surface a
   * fallback hint when the destination couldn't auto-open (e.g. the
   * extension isn't pinned). Hosts without a view-mode concept resolve
   * `{ opened: false }`.
   */
  switchViewMode(mode: ViewMode): Promise<{ opened: boolean }>;
  /**
   * The browser window the caller currently sits in, when resolvable.
   * Lets the workspace navigator prefer a same-window workspace tab;
   * `undefined` is a safe answer — the navigator falls back to any
   * candidate tab.
   */
  currentWindowId(): Promise<number | undefined>;
  /**
   * URL of the user's currently-active browsing tab, when resolvable and
   * meaningful — the host filters out its own UI surfaces and
   * browser-internal pages, returning `undefined` for those. Lets a
   * surface scope a view to "this page" without reaching for tab APIs.
   * `undefined` is a safe answer — callers fall back to a host-neutral
   * scope.
   */
  activeTabUrl(): Promise<string | undefined>;
  /**
   * Open `url` in a new browser tab — for external links (the project
   * site, docs) a surface wants to send the user to. Fire-and-forget:
   * opening a tab has no UI-relevant result. Hosts without a tab
   * concept (or that route links differently) no-op.
   */
  openUrl(url: string): void;
  /**
   * Open the host's keyboard-shortcut customization affordance — the
   * browser's extension-shortcuts page on an extension host, a settings
   * pane elsewhere. Fire-and-forget. Hosts without a rebindable-shortcut
   * concept no-op.
   */
  openShortcutSettings(): void;
  /**
   * The user's currently-active browsing tab — id, URL, title — or
   * `null` when none is resolvable. Unlike {@link activeTabUrl} this
   * returns the raw tab with no internal-page filtering; callers that
   * only want a meaningful URL should use `activeTabUrl`. Hosts without
   * a tab concept resolve `null`.
   */
  getActiveTab(): Promise<ActiveTab | null>;
  /**
   * Observe the active-tab rule context. `onChange` fires whenever the
   * active tab navigates or the user switches tabs, or host state that
   * affects which rules apply to it changes — the cue for a "this page"
   * surface to re-query. Returns an unsubscribe function; hosts without
   * the concept return a no-op disposer.
   */
  observeActiveTabContext(onChange: () => void): () => void;
  /**
   * The id of the tab this surface is inspecting — set when the surface
   * is a DevTools-style panel attached to a specific tab, `null`
   * otherwise. The panel scopes its request feed and per-tab toggles to
   * this id; non-DevTools hosts (popup, side panel, web app) return
   * `null` and those panel-only features no-op.
   */
  inspectedTabId(): number | null;
  /**
   * Reload the page in the tab this surface is inspecting — the DevTools
   * panel's "reload page" affordance. Fire-and-forget. Hosts that aren't
   * a DevTools-style panel (popup, side panel, web app) no-op.
   */
  reloadInspectedTab(): void;
}

/**
 * Default navigation — no surface switching, no window context. Hosts
 * that don't wire a real adapter still render fine; they just lose the
 * view-mode toggle's effect and the same-window tab preference.
 */
const NULL_HOST_NAVIGATION: HostNavigation = {
  switchViewMode() {
    return Promise.resolve({ opened: false });
  },
  currentWindowId() {
    return Promise.resolve(undefined);
  },
  activeTabUrl() {
    return Promise.resolve(undefined);
  },
  openUrl() {},
  openShortcutSettings() {},
  getActiveTab() {
    return Promise.resolve(null);
  },
  observeActiveTabContext() {
    return () => {};
  },
  inspectedTabId() {
    return null;
  },
  reloadInspectedTab() {},
};

let installed: HostNavigation = NULL_HOST_NAVIGATION;

/**
 * Install (or replace) the host-navigation adapter. Hosts call this once
 * at boot; tests use it to swap in a fake.
 */
export function setHostNavigation(impl: HostNavigation): void {
  installed = impl;
}

/** Returns the installed adapter (the no-op default when unwired). */
export function getHostNavigation(): HostNavigation {
  return installed;
}

/**
 * Delegating proxy — every call forwards to the currently-installed
 * adapter. UI code imports this and uses it identically across platforms.
 */
export const hostNavigation: HostNavigation = new Proxy({} as HostNavigation, {
  get(_target, prop): unknown {
    const value = (installed as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(installed) : value;
  },
});
