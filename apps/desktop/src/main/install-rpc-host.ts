/**
 * Wire the desktop main-process side of the oracle host runtime.
 *
 * Architectural invariant: the app runs ≥99% of the time in the
 * background with no renderer window open. The engine boot here is
 * unconditional — main process owns workspaces, rules, sync state,
 * broadcasting, and (Stage 2 commit 10) the WS server. The renderer is
 * a thin subscriber that hydrates from main via `oh.sync.snapshot*`
 * when its window mounts. Broadcasts to absent renderers silently
 * no-op; the engine keeps running.
 *
 * Composes the four cross-host seams the oracle expects (host storage,
 * lock runtime, sync persistence, host logger) with the desktop's
 * interim in-memory backends, registers the `OracleHostHooks`, boots
 * the host runtime (bootstrap workspaces → hydrate stores → init sync
 * engine → bridges → coord runner), and registers the IPC RPC + broadcast
 * relay so the renderer's `HostBridge` can drive the engine.
 *
 * Backends installed here:
 *
 *   - `HostStorage`: file-backed (`<userData>/storage.json`) with Electron
 *     `safeStorage` encrypting slots flagged `sensitive: true`. Renderers
 *     reach it via the `oh:storage:*` IPC channels (`installHostStorage`).
 *   - `SyncPersistenceProvider`: SQLite-backed (`<userData>/oracle.db`),
 *     better-sqlite3 with WAL journal; per-scope `MutationLog` and
 *     `PendingIntents` share one database handle.
 *   - `LockRuntime`: single-process FIFO mutex (final shape for main).
 *   - `LifelineServer`: IPC adapter (`installLifelineServer`) — each
 *     renderer surface holds one long-lived port; webContents destroy
 *     and renderer-initiated close both fan out as `onDisconnect` to
 *     oracle's `setupAwarenessLifelinePorts`.
 *
 * Renderer ↔ main wire:
 *
 *   - `ipcMain.handle('oh:rpc', payload)` → `dispatchSyncRpc` for the 22
 *     sync+awareness channels. Non-sync RPCs reject with a clear error
 *     until a desktop-side dispatcher lands.
 *   - Oracle broadcasts (`syncBroadcast`, `awarenessBroadcast`) are
 *     fan'd out to every open renderer via `webContents.send`.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { setHostBridge } from '@openheaders/core/bridge';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { setLockRuntime } from '@openheaders/oracle/coordination';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  peekActiveWorkspaceId,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { hydrateActiveWorkspaceStores } from '@openheaders/oracle/workspace/workspace-coordinator';
import { setOracleHostHooks } from '@openheaders/oracle/sync';
import { setSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { createSqliteSyncPersistence } from '@openheaders/oracle/sync/sqlite-sync-persistence';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import * as path from 'node:path';
import { installHostStorage } from './install-host-storage';
import { installLifelineServer } from './install-lifeline-server';
import { singleProcessLockRuntime } from './single-process-lock-runtime';

const RPC_CHANNEL = 'oh:rpc';
const BROADCAST_CHANNEL = 'oh:broadcast';

function broadcastToAllRenderers(type: string, payload: unknown): void {
  // Fan out to every open BrowserWindow. Single-window desktop today;
  // safe-by-construction for multi-window down the line.
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    try {
      win.webContents.send(BROADCAST_CHANNEL, { type, payload });
    } catch {
      // Renderer probably navigated away mid-send — broadcast is
      // best-effort. Swallow.
    }
  }
}

/**
 * Wire seams + boot oracle. Idempotent across multiple calls within the
 * same process (e.g. test harness), but production should call once.
 */
export async function installRpcHost(): Promise<void> {
  // 1. Cross-host seams. Order: logger first (so subsequent installs
  //    can log), then storage (file-backed, safeStorage-encrypted for
  //    sensitive slots, IPC-served to the renderer), lock, persistence.
  setHostLogger(consoleLogger);
  const { backend: hostStorage } = installHostStorage();
  setHostStorage(hostStorage);
  setLockRuntime(singleProcessLockRuntime);
  installLifelineServer();
  const syncPersistence = createSqliteSyncPersistence({
    dbPath: path.join(app.getPath('userData'), 'oracle.db'),
  });
  setSyncPersistenceProvider(syncPersistence);
  app.on('before-quit', () => {
    syncPersistence.close();
  });

  // 2. Oracle host hooks. Desktop has no DNR engine, no resolver-state
  //    runner, no rule-state-observer cache invalidation. All optional
  //    hooks the oracle calls degrade gracefully when absent.
  setOracleHostHooks({
    getActiveWorkspaceId,
    peekActiveWorkspaceId,
    broadcastSyncEvent: (event) => broadcastToAllRenderers('syncBroadcast', event),
    broadcastAwareness: (event) => broadcastToAllRenderers('awarenessBroadcast', event),
  });

  // 3. The main process drives writes through the same `hostBridge`
  //    proxy the renderer uses — for now wire it to a no-op surface
  //    so any oracle code that reaches for `hostBridge.broadcast` in
  //    the main process doesn't crash. Renderer-bound broadcasts run
  //    through the host-hook wired above; this is just defensive.
  setHostBridge({
    call: () => Promise.reject(new Error('main-process hostBridge.call is not implemented')),
    broadcast: (type, ...args: unknown[]) => broadcastToAllRenderers(String(type), args[0]),
    subscribe: () => () => undefined,
    presence: () => () => undefined,
  });

  // 4. Boot sequence — workspace bootstrap, hydrate active workspace,
  //    init sync engine + bridges + coord runner + lifeline.
  await bootstrapWorkspaces();
  await hydrateActiveWorkspaceStores();
  await bootSyncEngine();

  // 5. IPC RPC dispatch.
  ipcMain.handle(RPC_CHANNEL, async (_event, raw: unknown) => {
    const message = (raw ?? {}) as Record<string, unknown>;
    const result = dispatchSyncRpc(message);
    if (result === null) {
      // Anything outside the 22 sync+awareness channels — chrome.tabs,
      // chrome.identity, etc. — has no desktop implementation yet.
      // Surface a clear error so the renderer can degrade with intent
      // rather than hang waiting for a response.
      return {
        __error: `desktop main: RPC '${String(message.type)}' is not implemented`,
      };
    }
    if (result.kind === 'sync') return result.response;
    return await result.promise;
  });

  // 6. Clean up the renderer-bound dispatch on app quit so a reload
  //    cycle doesn't leak a stale ipcMain.handle registration.
  app.on('before-quit', () => {
    ipcMain.removeHandler(RPC_CHANNEL);
  });
}
