/**
 * In-process lifeline dialing — lets a host-side consumer open a
 * lifeline port against acceptors that only listen on the installed
 * {@link LifelineServer} (which real surfaces reach over IPC/WS).
 *
 * The browser-tab retention tap must be one more VIEWER of a relay
 * partition — its own port, its own relay-minted consumer id, its own
 * extension-side stream session (S0 finding 1) — and the relay's
 * acceptor is reachable only through `getLifelineServer().onConnect`.
 * Rather than teaching the relay a second attach API (the observability
 * epic owns that file), this module wraps the installed server with a
 * composite that can ALSO mint loopback connections:
 *
 *   - `onConnect` registrations are mirrored to the wrapped server, so
 *     real renderer/IPC lifelines keep flowing to every acceptor
 *     registered after the wrap;
 *   - `dial(name)` synthesizes a port pair and offers the incoming side
 *     to the handlers registered THROUGH the wrapper.
 *
 * Ordering law: install the dialer BEFORE the acceptors that must serve
 * loopback dials register (`boot-spine.ts` installs it just ahead of
 * the browser live-relay's `installLifeline()`). Acceptors registered
 * earlier still serve real surfaces — they are simply not dialable,
 * which is exactly the containment S1 wants.
 */

import {
  getLifelineServer,
  type IncomingLifelinePort,
  type LifelineServer,
  setLifelineServer,
} from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';

const SCOPE = 'LoopbackLifeline';

/** The consumer end of a loopback-dialed lifeline. */
export interface LoopbackLifelinePort {
  /** Stream a message to the acceptor (consumer→engine direction). */
  send(message: unknown): void;
  /** Receive the acceptor's pushes (engine→consumer direction). The
   *  transport delivers raw frames, so `T` is the caller's typed
   *  assertion about the stream — same contract as
   *  {@link IncomingLifelinePort.onMessage}. */
  onMessage<T = unknown>(handler: (message: T) => void): void;
  /** Close the lifeline; the acceptor's disconnect handlers fire. */
  disconnect(): void;
}

export interface LoopbackLifelineDialer {
  /** Open one loopback lifeline. `null` when no acceptor claimed the
   *  name — the caller treats it as a refused watch, not a throw. */
  dial(name: string): LoopbackLifelinePort | null;
}

interface LoopbackPair {
  incoming: IncomingLifelinePort;
  outgoing: LoopbackLifelinePort;
  wasClaimed(): boolean;
}

function createLoopbackPair(name: string): LoopbackPair {
  const acceptorMessageHandlers: Array<(message: unknown) => void> = [];
  const acceptorDisconnectHandlers: Array<(info: { errorMessage?: string }) => void> = [];
  const consumerMessageHandlers: Array<(message: unknown) => void> = [];
  let claimed = false;
  let disconnected = false;

  const incoming: IncomingLifelinePort = {
    name,
    postMessage(message) {
      if (disconnected) return;
      for (const handler of consumerMessageHandlers) {
        try {
          handler(message);
        } catch (err) {
          logger.warn(SCOPE, `loopback port "${name}": consumer handler threw`, err);
        }
      }
    },
    onMessage(handler) {
      claimed = true;
      acceptorMessageHandlers.push(handler as (message: unknown) => void);
    },
    onDisconnect(handler) {
      claimed = true;
      acceptorDisconnectHandlers.push(handler);
    },
  };

  const outgoing: LoopbackLifelinePort = {
    send(message) {
      if (disconnected) return;
      for (const handler of acceptorMessageHandlers) {
        try {
          handler(message);
        } catch (err) {
          logger.warn(SCOPE, `loopback port "${name}": acceptor handler threw`, err);
        }
      }
    },
    onMessage(handler) {
      consumerMessageHandlers.push(handler as (message: unknown) => void);
    },
    disconnect() {
      if (disconnected) return;
      disconnected = true;
      for (const handler of acceptorDisconnectHandlers) {
        try {
          handler({});
        } catch (err) {
          logger.warn(SCOPE, `loopback port "${name}": disconnect handler threw`, err);
        }
      }
    },
  };

  return { incoming, outgoing, wasClaimed: () => claimed };
}

/**
 * Wrap the currently-installed lifeline server with the dialable
 * composite and install the wrapper. Call once at spine boot, before
 * the acceptors that must be dialable register.
 */
export function installLoopbackLifelineDialer(): LoopbackLifelineDialer {
  const inner = getLifelineServer();
  const loopbackHandlers = new Set<(port: IncomingLifelinePort) => void>();

  const composite: LifelineServer = {
    onConnect(handler) {
      loopbackHandlers.add(handler);
      const unsubscribeInner = inner.onConnect(handler);
      return () => {
        loopbackHandlers.delete(handler);
        unsubscribeInner();
      };
    },
  };
  setLifelineServer(composite);

  return {
    dial(name) {
      const pair = createLoopbackPair(name);
      for (const handler of loopbackHandlers) {
        try {
          handler(pair.incoming);
        } catch (err) {
          logger.warn(SCOPE, `onConnect handler threw for loopback port "${name}"`, err);
        }
      }
      if (!pair.wasClaimed()) {
        logger.info(SCOPE, `no acceptor claimed loopback port "${name}"`);
        return null;
      }
      return pair.outgoing;
    },
  };
}
