/**
 * Host-assets contract — the seam between UI code that needs a loadable
 * URL for a host-packaged static asset (logos, icons, the surface's own
 * HTML entry point) and the platform adapter that knows how to mint one.
 *
 * Each app installs its own implementation once at boot via
 * {@link setHostAssets}:
 *
 *   - **Browser extension** — `chrome.runtime.getURL(path)`, which
 *     resolves a manifest-relative path to a `chrome-extension://` /
 *     `moz-extension://` URL scoped to the installed copy.
 *   - **Electron desktop** — a `file://` / custom-protocol resolver
 *     over the packaged renderer assets (reserved).
 *   - **Web app** — the public asset base URL (reserved).
 *
 * The default degrades gracefully: an unwired host returns the path
 * unchanged, so a relative asset still resolves against the document
 * base URL in the common case and nothing throws — mirrors the
 * navigation / lifeline-transport seams.
 */

export interface HostAssets {
  /**
   * Resolve a host-packaged asset path to a URL the current surface can
   * load (`<img src>`, `fetch`, a link href). `path` is the
   * host-relative location the asset ships at (e.g.
   * `images/logo-pixel.svg`, `workbench.html`).
   */
  resolveUrl(path: string): string;
}

/**
 * Default assets adapter — returns the path unchanged. An unwired host
 * still renders: a relative path resolves against the document base
 * URL, which covers the common same-origin case.
 */
const IDENTITY_HOST_ASSETS: HostAssets = {
  resolveUrl(path) {
    return path;
  },
};

let installed: HostAssets = IDENTITY_HOST_ASSETS;

/**
 * Install (or replace) the host-assets adapter. Hosts call this once at
 * boot; tests use it to swap in a fake.
 */
export function setHostAssets(impl: HostAssets): void {
  installed = impl;
}

/** Returns the installed adapter (the identity default when unwired). */
export function getHostAssets(): HostAssets {
  return installed;
}

/**
 * Delegating proxy — every call forwards to the currently-installed
 * adapter. UI code imports this and uses it identically across platforms.
 */
export const hostAssets: HostAssets = new Proxy({} as HostAssets, {
  get(_target, prop): unknown {
    const value = (installed as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(installed) : value;
  },
});
