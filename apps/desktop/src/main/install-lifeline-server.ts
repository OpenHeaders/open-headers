/**
 * IPC adapter for {@link LifelineServer} on the desktop main process.
 *
 * Each renderer surface calls `lifelineTransport.connect(name)` to open a
 * long-lived port; the host treats the port's disconnect as the canonical
 * "this surface is gone" signal (per
 * `packages/oracle/src/sync/awareness-lifeline.ts` — `removeByInstanceId`
 * + workspace-refcount release fire on disconnect).
 *
 * Wire protocol:
 *
 *   - `oh:lifeline:open`          (invoke) — `{ portId, name }` →
 *     main allocates an {@link IncomingLifelinePort}, fires every
 *     registered `onConnect` handler, and returns `{ ok: true }`.
 *     `portId` is a renderer-side uuid; main scopes all subsequent
 *     traffic by `(webContents.id, portId)`.
 *   - `oh:lifeline:message`       (send)   — renderer → host frame
 *     `{ portId, message }`. Routed to the matching port's
 *     `onMessage` handlers.
 *   - `oh:lifeline:close`         (send)   — renderer voluntarily
 *     closes the port (`disconnect()` call). Fires `onDisconnect`
 *     with an empty info object.
 *   - `oh:lifeline:host-message`  (push) — host → renderer frame
 *     `{ portId, message }`; the data-bearing lifelines (the proxy
 *     capture source's `oh-lifecycle:` pipe) stream down this channel
 *     via `IncomingLifelinePort.postMessage`. The awareness lifeline
 *     never sends host→renderer.
 *   - `oh:lifeline:host-disconnect` (push) — host-initiated disconnect.
 *
 * Disconnect cascades:
 *
 *   - Renderer `disconnect()` → `oh:lifeline:close` → onDisconnect fires.
 *   - `webContents.destroyed` (window close, app quit) → every port owned
 *     by that webContents fires onDisconnect with an empty info object —
 *     normal teardown, indistinguishable from a voluntary close.
 *   - `render-process-gone` (renderer crash) → same sweep, but with
 *     `errorMessage: 'render process gone'` so it surfaces in logs.
 *   - App quit — `before-quit` removes all IPC handlers; ports are
 *     dropped without further notice (the renderer is also tearing down).
 */

import { ipcMain, webContents as webContentsApi } from 'electron';
import { hostLogger as logger } from '@openheaders/core/logger';
import { type IncomingLifelinePort, type LifelineServer, setLifelineServer } from '@openheaders/core/awareness';

const SCOPE = 'IpcLifelineServer';

const CHANNEL = {
  open: 'oh:lifeline:open',
  message: 'oh:lifeline:message',
  close: 'oh:lifeline:close',
  hostMessage: 'oh:lifeline:host-message',
  hostDisconnect: 'oh:lifeline:host-disconnect',
} as const;

type MessageHandler = (message: unknown) => void;
type DisconnectHandler = (info: { errorMessage?: string }) => void;

class ManagedIncomingPort implements IncomingLifelinePort {
  readonly name: string;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly disconnectHandlers = new Set<DisconnectHandler>();
  private disconnected = false;

  constructor(
    name: string,
    private readonly portId: string,
    private readonly wcId: number,
  ) {
    this.name = name;
  }

  /** Host→renderer frame on the reserved `host-message` channel. */
  postMessage(message: unknown): void {
    if (this.disconnected) return;
    const wc = webContentsApi.fromId(this.wcId);
    if (!wc || wc.isDestroyed()) return;
    wc.send(CHANNEL.hostMessage, { portId: this.portId, message });
  }

  onMessage<T = unknown>(handler: (message: T) => void): void {
    this.messageHandlers.add(handler as MessageHandler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.disconnectHandlers.add(handler);
  }

  /** Internal: deliver a renderer-streamed message. */
  fireMessage(message: unknown): void {
    if (this.disconnected) return;
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (err) {
        logger.warn(SCOPE, `port "${this.name}": onMessage handler threw`, err);
      }
    }
  }

  /** Internal: deliver a disconnect; idempotent. */
  fireDisconnect(info: { errorMessage?: string }): void {
    if (this.disconnected) return;
    this.disconnected = true;
    for (const handler of this.disconnectHandlers) {
      try {
        handler(info);
      } catch (err) {
        logger.warn(SCOPE, `port "${this.name}": onDisconnect handler threw`, err);
      }
    }
  }
}

interface PortEntry {
  port: ManagedIncomingPort;
  wcId: number;
}

export function installLifelineServer(): void {
  // portId is unique across renderers — generated client-side. We scope
  // operations by both the portId AND the sender webContents.id so a
  // compromised/buggy renderer can't address ports belonging to another.
  const ports = new Map<string, PortEntry>();
  const connectHandlers = new Set<(port: IncomingLifelinePort) => void>();
  const trackedWebContents = new Set<number>();

  function dropPortsForWebContents(wcId: number, info: { errorMessage?: string }): void {
    for (const [portId, entry] of ports) {
      if (entry.wcId !== wcId) continue;
      ports.delete(portId);
      entry.port.fireDisconnect(info);
    }
  }

  function trackWebContents(wcId: number): void {
    if (trackedWebContents.has(wcId)) return;
    trackedWebContents.add(wcId);
    const wc = webContentsApi.fromId(wcId);
    if (!wc) return;
    // Window close / app quit is normal lifeline teardown — disconnect
    // with no errorMessage so the awareness handler stays quiet.
    wc.once('destroyed', () => {
      trackedWebContents.delete(wcId);
      dropPortsForWebContents(wcId, {});
    });
    // A renderer crash is the abnormal case worth surfacing in logs.
    wc.once('render-process-gone', () => {
      trackedWebContents.delete(wcId);
      dropPortsForWebContents(wcId, { errorMessage: 'render process gone' });
    });
  }

  ipcMain.handle(CHANNEL.open, async (event, raw: unknown) => {
    const { portId, name } = (raw ?? {}) as { portId?: string; name?: string };
    if (typeof portId !== 'string' || typeof name !== 'string') {
      return { ok: false, error: 'invalid open payload' };
    }
    if (ports.has(portId)) {
      // portId collision — shouldn't happen with uuid v4 from the
      // renderer, but be defensive.
      return { ok: false, error: 'portId already open' };
    }
    const port = new ManagedIncomingPort(name, portId, event.sender.id);
    ports.set(portId, { port, wcId: event.sender.id });
    trackWebContents(event.sender.id);
    for (const handler of connectHandlers) {
      try {
        handler(port);
      } catch (err) {
        logger.warn(SCOPE, `onConnect handler threw for port "${name}"`, err);
      }
    }
    return { ok: true };
  });

  ipcMain.on(CHANNEL.message, (event, raw: unknown) => {
    const { portId, message } = (raw ?? {}) as { portId?: string; message?: unknown };
    if (typeof portId !== 'string') return;
    const entry = ports.get(portId);
    if (!entry || entry.wcId !== event.sender.id) return;
    entry.port.fireMessage(message);
  });

  ipcMain.on(CHANNEL.close, (event, raw: unknown) => {
    const { portId } = (raw ?? {}) as { portId?: string };
    if (typeof portId !== 'string') return;
    const entry = ports.get(portId);
    if (!entry || entry.wcId !== event.sender.id) return;
    ports.delete(portId);
    entry.port.fireDisconnect({});
  });

  const server: LifelineServer = {
    onConnect(handler) {
      connectHandlers.add(handler);
      return () => {
        connectHandlers.delete(handler);
      };
    },
  };

  setLifelineServer(server);
}
