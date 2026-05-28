import { getHostStorage, OH } from '@openheaders/core/storage';
import { handleIncomingAwarenessFrame } from '../awareness-receiver';
import { handleIncomingMutationFrame } from '../sync-mutation-receiver';
import { registerInboundFrameHandler, subscribeOnWebSocketClose, subscribeOnWebSocketOpen } from '../websocket';
import type { SyncHandshakeHandles } from './sync-handshake';

interface InstallWsFrameRoutingOpts {
  handshake: SyncHandshakeHandles;
}

export function installWsFrameRouting({ handshake }: InstallWsFrameRoutingOpts): void {
  // Handshake initiator claims HELLO-flow frames first; mutation +
  // awareness receivers claim their own; anything else drops silently.
  registerInboundFrameHandler(async (frame) => {
    if (!handshake.initiator.handles(frame)) return false;
    await handshake.initiator.handle(frame);
    return true;
  });
  registerInboundFrameHandler(handleIncomingMutationFrame);
  registerInboundFrameHandler(handleIncomingAwarenessFrame);

  subscribeOnWebSocketOpen(() => {
    // A fresh transport socket is a fresh handshake session — reset
    // first so a prior socket's terminal state can't wedge this one.
    handshake.initiator.reset();
    void handshake.initiator.start();
  });
  subscribeOnWebSocketClose(() => {
    handshake.initiator.reset();
    void getHostStorage()
      ?.set(OH.backendReach, null)
      .catch(() => {
        /* best-effort — next WELCOME re-converges it */
      });
  });
}
