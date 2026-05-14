/**
 * Peer-navigation helpers — given a {@link NavigationHandle} from a
 * remote surface's identity, focus that surface for the user.
 *
 * `peerNavigate` / `isPeerNavigable` are thin delegators over the
 * host-agnostic {@link peerNavigator} seam — the host installs whichever
 * navigator can actually reach its surfaces (chrome tabs/windows in the
 * extension, window IPC on desktop). An unwired host degrades to "no
 * peer is reachable", which renders every peer row as non-clickable.
 *
 * `isHandleCoLocated` / `extractTabId` are pure handle inspection — no
 * platform coupling — so they stay here regardless of host.
 */

import { peerNavigator } from '@openheaders/core/awareness';
import type { NavigationHandle } from '@openheaders/core/protocol';

/** Returns true on successful focus, false when the peer surface can't
 *  be reached (stale tab, missing API, unsupported handle kind). */
export function peerNavigate(handle: NavigationHandle): Promise<boolean> {
  return peerNavigator.navigate(handle);
}

/** True when the handle could be acted on in the current realm. UI
 *  uses this to decide whether to render the row as clickable. */
export function isPeerNavigable(handle: NavigationHandle | undefined): boolean {
  return peerNavigator.canNavigate(handle);
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
