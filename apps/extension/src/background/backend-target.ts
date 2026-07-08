/**
 * Backend-target classification — derived purely from the connection
 * registry, with no connection-module side effects (kept separate from
 * `websocket.ts` so the inbound mutation receiver can consult it
 * without dragging the WS layer's import-time wiring into its unit
 * surface).
 */

import { getPrimaryBackend, isLoopbackBackendUrl } from '@openheaders/core/backends';

/**
 * Is the configured backend reachable over the loopback interface — i.e.
 * the desktop app on this same machine? Drives the active-workspace
 * mirroring gate: a loopback desktop's active-workspace changes mirror
 * down to this browser's extension, but a LAN/WAN peer's never do (the
 * active pointer is a per-device operative-view preference, not synced
 * identity state). Derived from the primary record's URL — the URL the
 * extension itself dialed, so the network edge is known with certainty.
 *
 * No enabled backend means no wire at all; treated as loopback (the SW
 * is the backend, on this machine) though no inbound frames ever arrive.
 */
export function isLoopbackBackend(): boolean {
  const primary = getPrimaryBackend();
  if (!primary?.enabled) return true;
  return isLoopbackBackendUrl(primary.url);
}
