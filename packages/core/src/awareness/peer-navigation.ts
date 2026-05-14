/**
 * Peer-navigation contract — the seam between awareness UI code that
 * offers a "switch to that surface" affordance and the platform-specific
 * navigator that actually focuses the peer.
 *
 * Given a {@link NavigationHandle} from a remote surface's identity, the
 * host navigator focuses that surface (activate its tab + window, re-open
 * its side panel, …). Each app installs its own implementation once at
 * boot via {@link setPeerNavigator}:
 *
 *   - **Browser extension** — `chrome.tabs` / `chrome.windows` /
 *     `chrome.sidePanel`.
 *   - **Electron desktop** — window focus over IPC (reserved).
 *
 * Like the lifeline-transport seam this one degrades gracefully: the
 * default navigator can't reach anything, so an unwired host simply
 * renders peer rows as non-clickable. No test wiring required.
 */

import type { NavigationHandle } from '../protocol';

export interface PeerNavigator {
  /**
   * Focus the surface the handle points at. Resolves `true` on success,
   * `false` when the peer can't be reached (stale tab, missing API,
   * unsupported handle kind). Never throws.
   */
  navigate(handle: NavigationHandle): Promise<boolean>;
  /**
   * True when the handle could be acted on in the current realm. UI uses
   * this to decide whether to render the peer row as clickable.
   */
  canNavigate(handle: NavigationHandle | undefined): boolean;
}

/**
 * Default navigator — can't reach any surface. Hosts that don't wire a
 * real navigator render every peer row as non-clickable.
 */
const NULL_PEER_NAVIGATOR: PeerNavigator = {
  navigate() {
    return Promise.resolve(false);
  },
  canNavigate() {
    return false;
  },
};

let installed: PeerNavigator = NULL_PEER_NAVIGATOR;

/**
 * Install (or replace) the peer navigator. Hosts call this once at boot;
 * tests use it to swap in a fake.
 */
export function setPeerNavigator(impl: PeerNavigator): void {
  installed = impl;
}

/** Returns the installed navigator (the no-op default when unwired). */
export function getPeerNavigator(): PeerNavigator {
  return installed;
}

/**
 * Delegating proxy — every call forwards to the currently-installed
 * navigator. Awareness UI code imports this and uses it identically
 * across platforms.
 */
export const peerNavigator: PeerNavigator = new Proxy({} as PeerNavigator, {
  get(_target, prop): unknown {
    const value = (installed as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(installed) : value;
  },
});
