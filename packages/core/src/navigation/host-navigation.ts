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
