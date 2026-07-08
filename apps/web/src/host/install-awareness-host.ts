/**
 * Boot-time wiring: the web tab's awareness lifeline + peer navigation
 * seams.
 *
 * Lifeline: the host reactor runs IN the tab, so the transport and the
 * server are the two ends of an in-process loopback. `connect(name)`
 * synchronously announces an incoming port to every server-side
 * `onConnect` handler (the oracle's `setupAwarenessLifelinePorts`
 * registers its message/disconnect handlers inside that dispatch, so
 * the surface's `bind` message posted right after connect always finds
 * them); `disconnect()` fires the server-side disconnect, which is the
 * canonical "this surface is gone" signal driving workspace residency.
 *
 * Peer navigator: a plain tab can't focus other surfaces; every handle
 * answers `canNavigate: false`, which surfaces the awareness pill's
 * "open peer surface unsupported" affordance.
 */

import {
  type IncomingLifelinePort,
  type LifelinePort,
  type LifelineTransport,
  type PeerNavigator,
  setLifelineServer,
  setLifelineTransport,
  setPeerNavigator,
} from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'LoopbackLifeline';

type ConnectHandler = (port: IncomingLifelinePort) => void;
type MessageHandler = (message: unknown) => void;
type DisconnectHandler = (info: { errorMessage?: string }) => void;

const connectHandlers = new Set<ConnectHandler>();

setLifelineServer({
  onConnect(handler: ConnectHandler): () => void {
    connectHandlers.add(handler);
    return () => {
      connectHandlers.delete(handler);
    };
  },
});

const loopbackLifelineTransport: LifelineTransport = {
  connect(name: string): LifelinePort {
    const messageHandlers = new Set<MessageHandler>();
    const disconnectHandlers = new Set<DisconnectHandler>();
    // Messages posted before the server end registers its handler are
    // buffered and replayed on first registration — connect() below
    // dispatches onConnect synchronously so this only matters if a
    // server handler defers its onMessage registration.
    const pending: unknown[] = [];
    let closed = false;

    const incoming: IncomingLifelinePort = {
      name,
      onMessage<T = unknown>(handler: (message: T) => void): void {
        messageHandlers.add(handler as MessageHandler);
        if (pending.length > 0) {
          const replay = pending.splice(0, pending.length);
          for (const message of replay) {
            deliver(handler as MessageHandler, message);
          }
        }
      },
      onDisconnect(handler: DisconnectHandler): void {
        disconnectHandlers.add(handler);
        if (closed) handler({});
      },
    };

    for (const handler of [...connectHandlers]) {
      try {
        handler(incoming);
      } catch (err) {
        logger.warn(SCOPE, `onConnect handler threw for ${name}`, err);
      }
    }

    return {
      postMessage(message: unknown): void {
        if (closed) return;
        if (messageHandlers.size === 0) {
          pending.push(message);
          return;
        }
        for (const handler of [...messageHandlers]) {
          deliver(handler, message);
        }
      },
      onMessage(): void {
        // Host→surface streams don't exist on the loopback yet — no
        // in-tab consumer opens a data-bearing lifeline.
      },
      onDisconnect(): void {
        // The in-process host never drops a port; only the surface
        // side disconnects.
      },
      disconnect(): void {
        if (closed) return;
        closed = true;
        for (const handler of [...disconnectHandlers]) {
          try {
            handler({});
          } catch (err) {
            logger.warn(SCOPE, `onDisconnect handler threw for ${name}`, err);
          }
        }
      },
    };
  },
};

function deliver(handler: MessageHandler, message: unknown): void {
  try {
    handler(message);
  } catch (err) {
    logger.warn(SCOPE, 'onMessage handler threw', err);
  }
}

const webPeerNavigator: PeerNavigator = {
  navigate() {
    return Promise.resolve(false);
  },
  canNavigate() {
    return false;
  },
};

setLifelineTransport(loopbackLifelineTransport);
setPeerNavigator(webPeerNavigator);
