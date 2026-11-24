/**
 * Lifeline port registry — the host side of every renderer lifeline,
 * free of the IPC transport (`install-lifeline-server.ts` is the Electron
 * adapter around it).
 *
 * It owns the live ports, the acceptors' `onConnect` handlers, and the
 * door law: a port is admitted — handed to the acceptors — only when
 * both hold:
 *
 *   - the engine is ready. An open that arrives earlier is held with its
 *     frames (`held-opens.ts`) and admitted in arrival order when the
 *     boot settles, so a surface that mounted during boot ends up exactly
 *     where one that mounted afterwards does. Without the hold the open
 *     would be acknowledged with no acceptor listening and the surface
 *     would stay deaf for the life of the window.
 *   - for a view channel (`view-channels.ts`), its surface is a viewer
 *     (`surface-viewers.ts`). A window closed to the tray keeps its
 *     renderer and every panel mounted; its view ports are disconnected
 *     the moment it closes, so the acceptors' last-reader rules silence
 *     the source, and the opens its renderer retries with wait at the
 *     door until the window is opened again. They are then admitted with
 *     their handshake, and each acceptor seeds them as it seeds any late
 *     viewer.
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
import type { SurfaceViewers } from './surface-viewers';
import { isViewChannel } from './view-channels';

const SCOPE = 'IpcLifelineServer';

export type LifelineOpenResult = { ok: true } | { ok: false; error: string };

export interface LifelinePortRegistryDeps {
  readonly readiness: EngineReadiness;
  readonly viewers: SurfaceViewers;
  /** Host→surface frame for one port. A surface that is gone is a silent no-op. */
  readonly postToSurface: (wcId: number, portId: string, message: unknown) => void;
  /** Tell a surface the host closed one of its ports. Same no-op when it is gone. */
  readonly disconnectToSurface: (wcId: number, portId: string) => void;
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
  const { readiness, viewers, postToSurface, disconnectToSurface } = deps;
  const ports = new Map<string, PortEntry>();
  const heldOpens = createHeldOpens();
  const connectHandlers = new Set<(port: IncomingLifelinePort) => void>();

  /** The surface's half of the door. The engine's half is the readiness gate. */
  function surfaceMayHold(wcId: number, name: string): boolean {
    return !isViewChannel(name) || viewers.isViewer(wcId);
  }

  /** Hand a port to the acceptors. Only ever called with the door open for it. */
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

  // A surface stopped being a viewer: its view ports end here, on both
  // sides — the acceptors see an ordinary disconnect, and the surface is
  // told, so its reconnect arrives as an open the door can hold.
  viewers.onLeft((wcId) => {
    let released = 0;
    for (const [portId, entry] of ports) {
      if (entry.wcId !== wcId || !isViewChannel(entry.port.name)) continue;
      ports.delete(portId);
      entry.port.fireDisconnect({});
      disconnectToSurface(wcId, portId);
      released++;
    }
    if (released > 0) logger.info(SCOPE, `window closed — released ${released} view port(s)`);
  });

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
      const booting = !readiness.isReady();
      if (!booting && surfaceMayHold(wcId, name)) {
        admit(wcId, portId, name);
        return { ok: true };
      }
      const held = heldOpens.hold(wcId, portId);
      // Awaited here, not behind a helper: the readiness gate releases
      // what it holds in registration order, and an extra hop would let
      // a later RPC overtake this open.
      await readiness.whenReady();
      while (!held.canceled && !surfaceMayHold(wcId, name)) await viewers.whenViewer(wcId);
      heldOpens.release(held);
      if (held.canceled) return { ok: false, error: 'closed while it was held at the door' };
      const why = booting ? 'during engine boot' : 'with its window closed';
      logger.info(SCOPE, `port "${name}" was opened ${why} — admitted with ${held.frames.length} frame(s)`);
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
