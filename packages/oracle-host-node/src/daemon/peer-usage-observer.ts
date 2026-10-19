/**
 * Peer usage observer — a policy-free seam reporting that a peer
 * completed the sync handshake against this host's WebSocket server
 * (the twin of the MCP usage observer). Nothing is counted here and
 * the spine stays a pure server: a host shell that wants visibility
 * injects an observer (the desktop app maps an accepted extension
 * HELLO onto its anonymous usage counters — "this desktop is paired
 * with the browser extension"), and a deployment that never installs
 * one — the standalone daemon — reports nothing, by construction.
 *
 * Wiring (see the boot spine): the bind supervisor's `onServerChange`
 * drives {@link attachPeerUsageServer} so the subscription follows the
 * live server across rebinds.
 */

import type { OracleWsServer, PeerSummary } from '../host-runtime/ws-server';

export interface PeerUsageObserver {
  /** A peer passed the HELLO gate and is connected; `peer.role` says what kind. */
  peerConnected(peer: PeerSummary): void;
}

let observer: PeerUsageObserver | null = null;
let unsubscribe: (() => void) | null = null;

/** Install (or clear) the process-wide observer — host shells only. */
export function setPeerUsageObserver(next: PeerUsageObserver | null): void {
  observer = next;
}

/** Fire-and-forget by contract: a throwing observer never disturbs the handshake. */
export function notifyPeerConnected(peer: PeerSummary): void {
  try {
    observer?.peerConnected(peer);
  } catch {
    // best-effort by contract
  }
}

/** Follow the live server: subscribe to its peer changes, dropping the previous server's subscription. */
export function attachPeerUsageServer(server: OracleWsServer | null): void {
  unsubscribe?.();
  unsubscribe = null;
  if (!server) return;
  unsubscribe = server.subscribePeerChange((event) => {
    if (event.kind === 'connect') notifyPeerConnected(event.peer);
  });
}
