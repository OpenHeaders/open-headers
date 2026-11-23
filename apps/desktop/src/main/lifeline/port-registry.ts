/**
 * Lifeline port registry — the host side of every renderer lifeline,
 * free of the IPC transport (`install-lifeline-server.ts` is the Electron
 * adapter around it).
 *
 * It owns the live ports, the acceptors' `onConnect` handlers, and the
 * door law: a port is admitted — handed to the acceptors — only once the
 * engine is ready. An open that arrives earlier is held with its frames
 * (`held-opens.ts`) and admitted in arrival order when the boot settles,
 * so a surface that mounted during boot ends up exactly where one that
 * mounted afterwards does. Without the hold the open would be
 * acknowledged with no acceptor listening and the surface would stay
 * deaf for the life of the window.
 *
 * Every operation is scoped by `(wcId, portId)`: the portId is minted by
 * the renderer, so a compromised or buggy renderer must not be able to
 * address a port another surface owns.
 */

import type { IncomingLifelinePort, LifelineServer } from '@openheaders/core/awareness';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { EngineReadiness } from '../bootstrap/engine-readiness';
import { createHeldOpens } from './held-opens';
import { ManagedIncomingPort } from './incoming-port';

const SCOPE = 'IpcLifelineServer';

export type LifelineOpenResult = { ok: true } | { ok: false; error: string };

export interface LifelinePortRegistryDeps {
  readonly readiness: EngineReadiness;
  /** Host→surface frame for one port. A surface that is gone is a silent no-op. */
  readonly postToSurface: (wcId: number, portId: string, message: unknown) => void;
}

export interface LifelinePortRegistry {
  /** The server acceptors register on. */
  readonly server: LifelineServer;
  /** A surface opens a port. Settles once the port is admitted or refused. */
  open(wcId: number, portId: string, name: string): Promise<LifelineOpenResult>;
  /** A surface streams a frame up one of its ports. */
  message(wcId: number, portId: string, message: unknown): void;
  /** A surface closes one of its ports. */
  close(wcId: number, portId: string): void;
  /** A surface went away: disconnect its ports, cancel its held opens. */
  dropSurface(wcId: number, info: { errorMessage?: string }): void;
}

interface PortEntry {
  readonly port: ManagedIncomingPort;
  readonly wcId: number;
}

export function createLifelinePortRegistry(deps: LifelinePortRegistryDeps): LifelinePortRegistry {
  const { readiness, postToSurface } = deps;
  const ports = new Map<string, PortEntry>();
  const heldOpens = createHeldOpens();
  const connectHandlers = new Set<(port: IncomingLifelinePort) => void>();

  /** Hand a port to the acceptors. Only ever called with the engine ready. */
  function admit(wcId: number, portId: string, name: string): ManagedIncomingPort {
    const port = new ManagedIncomingPort(name, (message) => postToSurface(wcId, portId, message));
    ports.set(portId, { port, wcId });
    for (const handler of connectHandlers) {
      try {
        handler(port);
      } catch (err) {
        logger.warn(SCOPE, `onConnect handler threw for port "${name}"`, err);
      }
    }
    return port;
  }

  function ownedPort(wcId: number, portId: string): PortEntry | undefined {
    const entry = ports.get(portId);
    return entry !== undefined && entry.wcId === wcId ? entry : undefined;
  }

  return {
    server: {
      onConnect(handler) {
        connectHandlers.add(handler);
        return () => {
          connectHandlers.delete(handler);
        };
      },
    },

    async open(wcId, portId, name) {
      // A collision cannot happen with the renderer's uuid, but a port
      // must never be handed out twice.
      if (ports.has(portId) || heldOpens.has(portId)) return { ok: false, error: 'portId already open' };
      if (readiness.isReady()) {
        admit(wcId, portId, name);
        return { ok: true };
      }
      const held = heldOpens.hold(wcId, portId);
      await readiness.whenReady();
      heldOpens.release(held);
      if (held.canceled) return { ok: false, error: 'closed before the engine was ready' };
      logger.info(SCOPE, `port "${name}" was opened during engine boot — admitted with ${held.frames.length} frame(s)`);
      const port = admit(wcId, portId, name);
      for (const frame of held.frames) port.fireMessage(frame);
      return { ok: true };
    },

    message(wcId, portId, message) {
      const entry = ownedPort(wcId, portId);
      if (entry !== undefined) {
        entry.port.fireMessage(message);
        return;
      }
      heldOpens.keepFrame(wcId, portId, message);
    },

    close(wcId, portId) {
      const entry = ownedPort(wcId, portId);
      if (entry !== undefined) {
        ports.delete(portId);
        entry.port.fireDisconnect({});
        return;
      }
      heldOpens.cancel(wcId, portId);
    },

    dropSurface(wcId, info) {
      for (const [portId, entry] of ports) {
        if (entry.wcId !== wcId) continue;
        ports.delete(portId);
        entry.port.fireDisconnect(info);
      }
      heldOpens.cancelSurface(wcId);
    },
  };
}
