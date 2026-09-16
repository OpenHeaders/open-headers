/**
 * The wire for a delegated send over the backend client plane — the
 * delegating transport's {@link DelegatedWire} for every host that
 * joins backends through the connection manager (the extension's
 * service worker toward the desktop app or a server, the desktop
 * app's main process toward a server). One wire per EXPLICIT backend
 * id (the place the reader resolved — never the default wire, which
 * falls back to the first connected backend of any kind): the
 * `delegateRequest` frame rides `wsRequest` deadline-free (the
 * request's own ceiling rides inside the frame and the place enforces
 * it; the wire's close flush rejects a dead connection), Stop rides
 * `abortRequestSend` on the same wire, and the place's live
 * `requestStreamEvent` frames are CLAIMED here by their
 * transport-minted send id — consumed before any relay could mistake
 * them for a local send's — and handed to the subscribed transport.
 * Unknown ids are left for whoever else listens.
 */

import type { RequestStreamEventWire } from '@openheaders/core/bridge';
import { DELEGATED_SOCKET_EVENT_FRAME, type DelegatedSocketEvent } from '@openheaders/core/protocol';
import type { DelegatedSocketWire } from '../../live/delegated-socket/wire';
import type { DelegatedRequestFrame, DelegatedRequestResult } from '../../live/request-exec/delegated-wire';
import type { DelegatedWire } from '../../live/request-exec/delegating-transport';
import { registerInboundFrameHandler } from './backend-connection-manager';
import { wsRequest } from './wire-request';

interface FrameClaim<E> {
  backendId: string;
  onFrame: (event: E) => void;
}

const claimsBySendId = new Map<string, FrameClaim<RequestStreamEventWire>>();
const claimsBySocketId = new Map<string, FrameClaim<DelegatedSocketEvent>>();
let claimHandlerInstalled = false;

/** Claim one inbound frame for a subscribed id on the same wire —
 *  `requestStreamEvent` by the send id, `delegatedSocketEvent` by the
 *  socket id; anything unsubscribed is left for whoever else listens. */
function claimFrame(frame: unknown, backendId: string): boolean {
  if (!frame || typeof frame !== 'object') return false;
  const { type, payload } = frame as { type?: unknown; payload?: unknown };
  if (!payload || typeof payload !== 'object') return false;
  if (type === 'requestStreamEvent') {
    const event = payload as RequestStreamEventWire;
    const claim = typeof event.sendId === 'string' ? claimsBySendId.get(event.sendId) : undefined;
    if (claim === undefined || claim.backendId !== backendId) return false;
    claim.onFrame(event);
    return true;
  }
  if (type === DELEGATED_SOCKET_EVENT_FRAME) {
    const event = payload as DelegatedSocketEvent;
    const claim = typeof event.socketId === 'string' ? claimsBySocketId.get(event.socketId) : undefined;
    if (claim === undefined || claim.backendId !== backendId) return false;
    claim.onFrame(event);
    return true;
  }
  return false;
}

function ensureClaimHandler(): void {
  if (claimHandlerInstalled) return;
  claimHandlerInstalled = true;
  registerInboundFrameHandler((frame, wire) => claimFrame(frame, wire.backendId));
}

/** The riders' wait — a rider answers as soon as the place wrote. */
const RIDER_TIMEOUT_MS = 15_000;

/** The socket wire toward one place, by its backend id — the
 *  delegating session transports' seam over the backend client plane. */
export function delegatedSocketWireFor(backendId: string): DelegatedSocketWire {
  ensureClaimHandler();
  return {
    call: (frame) => wsRequest<unknown>(frame, { backendId, timeoutMs: RIDER_TIMEOUT_MS }),
    subscribe: (socketId, onEvent) => {
      claimsBySocketId.set(socketId, { backendId, onFrame: onEvent });
      return () => {
        claimsBySocketId.delete(socketId);
      };
    },
  };
}

/** The wire toward one place, by its backend id. */
export function delegatedWireFor(backendId: string): DelegatedWire {
  ensureClaimHandler();
  return {
    call: (frame: DelegatedRequestFrame) => wsRequest<DelegatedRequestResult>(frame, { backendId, timeoutMs: 0 }),
    abort: (sendId) => {
      wsRequest<{ success: boolean }>({ type: 'abortRequestSend', sendId }, { backendId }).catch(() => {});
    },
    subscribeFrames: (sendId, onFrame) => {
      claimsBySendId.set(sendId, { backendId, onFrame });
      return () => {
        claimsBySendId.delete(sendId);
      };
    },
  };
}

/** Test-only: drop every frame claim so unit tests start clean. */
export function __resetDelegatedWireForTests(): void {
  claimsBySendId.clear();
  claimsBySocketId.clear();
  claimHandlerInstalled = false;
}
