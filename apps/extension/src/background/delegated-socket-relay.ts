/**
 * Delegated socket relay — the service worker's face of a page realm's
 * delegated session (the Execution Place plan's socket family). The
 * page realm keeps the session's executor and opens its socket on a
 * place through this worker, which holds the backend wire: OPEN and
 * rider frames arrive as the `delegatedSocketCall` bridge RPC and go
 * out on the named backend; the place fans the socket's events to
 * this user's peers, and this relay claims those frames off the wire
 * and re-broadcasts them on the chrome-runtime `delegatedSocketEvent`
 * the page realm's delegating transport subscribes to — the
 * `grpc-stream-relay` twin, keyed by the socket id the page minted.
 * The worker's own delegated HTTP sends claim their frames first (the
 * oracle client's claim handler runs ahead of this one).
 */

import { DELEGATED_SOCKET_EVENT_FRAME, type DelegatedSocketEvent } from '@openheaders/core/protocol';
import { registerInboundFrameHandler } from '@openheaders/oracle/sync/client/backend-connection-manager';
import { broadcast } from '@utils/bridge';

/** Claim one inbound backend frame; a malformed frame of the type is
 *  ours to drop, anything else goes to the next handler. */
export function handleIncomingDelegatedSocketFrame(frame: unknown): boolean {
  if (!frame || typeof frame !== 'object' || (frame as { type?: unknown }).type !== DELEGATED_SOCKET_EVENT_FRAME) {
    return false;
  }
  const payload = (frame as { payload?: unknown }).payload;
  if (payload && typeof payload === 'object' && typeof (payload as { socketId?: unknown }).socketId === 'string') {
    broadcast('delegatedSocketEvent', payload as DelegatedSocketEvent);
  }
  return true;
}

let installed = false;

/** Idempotent — wired once from the SW boot spine. */
export function installDelegatedSocketRelay(): void {
  if (installed) return;
  installed = true;
  registerInboundFrameHandler(handleIncomingDelegatedSocketFrame);
}
