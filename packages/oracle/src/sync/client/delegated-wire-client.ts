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
import type { DelegatedRequestFrame, DelegatedRequestResult } from '../../live/request-exec/delegated-wire';
import type { DelegatedWire } from '../../live/request-exec/delegating-transport';
import { registerInboundFrameHandler } from './backend-connection-manager';
import { wsRequest } from './wire-request';

interface FrameClaim {
  backendId: string;
  onFrame: (event: RequestStreamEventWire) => void;
}

const claimsBySendId = new Map<string, FrameClaim>();
let claimHandlerInstalled = false;

function ensureClaimHandler(): void {
  if (claimHandlerInstalled) return;
  claimHandlerInstalled = true;
  registerInboundFrameHandler((frame, wire) => {
    if (!frame || typeof frame !== 'object') return false;
    const { type, payload } = frame as { type?: unknown; payload?: unknown };
    if (type !== 'requestStreamEvent' || !payload || typeof payload !== 'object') return false;
    const event = payload as RequestStreamEventWire;
    if (typeof event.sendId !== 'string') return false;
    const claim = claimsBySendId.get(event.sendId);
    if (claim === undefined || claim.backendId !== wire.backendId) return false;
    claim.onFrame(event);
    return true;
  });
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
  claimHandlerInstalled = false;
}
