/**
 * IPC adapter for {@link LifelineServer} on the desktop main process.
 *
 * Each renderer surface calls `lifelineTransport.connect(name)` to open a
 * long-lived port; the host treats the port's disconnect as the canonical
 * "this surface is gone" signal (per
 * `packages/oracle/src/sync/awareness-lifeline.ts` — `removeByInstanceId`
 * + workspace-refcount release fire on disconnect).
 *
 * This module is the Electron edge only: it maps the wire below onto the
 * port registry (`lifeline/port-registry.ts`), which owns the ports, the
 * acceptors, and the door law — a port opened before the engine is ready
 * is held and admitted once it is. Installed at eval time beside the RPC
 * queue (`main.ts`), on the same engine-readiness gate, so the window
 * never finds the wire missing.
 *
 * Wire protocol:
 *
 *   - `oh:lifeline:open`          (invoke) — `{ portId, name }` →
 *     the registry admits an {@link IncomingLifelinePort} to every
 *     registered `onConnect` handler and answers `{ ok: true }`; before
 *     the engine is ready the answer waits with the open. `portId` is a
 *     renderer-side uuid; main scopes all subsequent traffic by
 *     `(webContents.id, portId)`.
 *   - `oh:lifeline:message`       (send)   — renderer → host frame
 *     `{ portId, message }`. Routed to the matching port's
 *     `onMessage` handlers; kept with the open while it is held.
 *   - `oh:lifeline:close`         (send)   — renderer voluntarily
 *     closes the port (`disconnect()` call). Fires `onDisconnect`
 *     with an empty info object; cancels the open while it is held.
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
 */

import { setLifelineServer } from '@openheaders/core/awareness';
import { ipcMain, type WebContents, webContents as webContentsApi } from 'electron';
import type { EngineReadiness } from './bootstrap/engine-readiness';
import { createLifelinePortRegistry } from './lifeline/port-registry';

const CHANNEL = {
  open: 'oh:lifeline:open',
  message: 'oh:lifeline:message',
  close: 'oh:lifeline:close',
  hostMessage: 'oh:lifeline:host-message',
  hostDisconnect: 'oh:lifeline:host-disconnect',
} as const;

export function installLifelineServer(readiness: EngineReadiness): void {
  const registry = createLifelinePortRegistry({
    readiness,
    postToSurface(wcId, portId, message) {
      const wc = webContentsApi.fromId(wcId);
      if (!wc || wc.isDestroyed()) return;
      wc.send(CHANNEL.hostMessage, { portId, message });
    },
  });
  const trackedWebContents = new Set<number>();

  function trackWebContents(wc: WebContents): void {
    const wcId = wc.id;
    if (trackedWebContents.has(wcId)) return;
    trackedWebContents.add(wcId);
    // Window close / app quit is normal lifeline teardown — disconnect
    // with no errorMessage so the awareness handler stays quiet.
    wc.once('destroyed', () => {
      trackedWebContents.delete(wcId);
      registry.dropSurface(wcId, {});
    });
    // A renderer crash is the abnormal case worth surfacing in logs.
    wc.once('render-process-gone', () => {
      trackedWebContents.delete(wcId);
      registry.dropSurface(wcId, { errorMessage: 'render process gone' });
    });
  }

  ipcMain.handle(CHANNEL.open, (event, raw: unknown) => {
    const { portId, name } = (raw ?? {}) as { portId?: string; name?: string };
    if (typeof portId !== 'string' || typeof name !== 'string') {
      return { ok: false, error: 'invalid open payload' };
    }
    // Tracked before the open can be held, so a surface that goes away
    // while it waits takes its held opens with it.
    trackWebContents(event.sender);
    return registry.open(event.sender.id, portId, name);
  });

  ipcMain.on(CHANNEL.message, (event, raw: unknown) => {
    const { portId, message } = (raw ?? {}) as { portId?: string; message?: unknown };
    if (typeof portId !== 'string') return;
    registry.message(event.sender.id, portId, message);
  });

  ipcMain.on(CHANNEL.close, (event, raw: unknown) => {
    const { portId } = (raw ?? {}) as { portId?: string };
    if (typeof portId !== 'string') return;
    registry.close(event.sender.id, portId);
  });

  setLifelineServer(registry.server);
}
