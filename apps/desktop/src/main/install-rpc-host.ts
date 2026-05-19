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
 *   - `BlobBackend`: filesystem-backed (`<userData>/blobs/<wsId>/<fileId>.bin`)
 *     with metadata living in the same `oracle.db` SQLite handle as the
 *     sync persistence layer.
 *
 * Inbound wires:
 *
 *   - `ipcMain.handle('oh:rpc', payload)` → `dispatchSyncRpc` for the 22
 *     sync+awareness channels (renderer ↔ main).
 *   - `startOracleWsServer` on `127.0.0.1:59210` → same `dispatchSyncRpc`
 *     for connected extension SWs / future daemons / future remote
 *     surfaces. Handshake validates protocol version against
 *     `@openheaders/core/protocol`'s `PROTOCOL_VERSION`.
 *
 * Outbound (oracle → world):
 *
 *   - Oracle broadcasts (`syncBroadcast`, `awarenessBroadcast`) fan out
 *     to every open renderer via `webContents.send` AND to every WS
 *     peer past handshake. One oracle event, two transports, same
 *     payload shape.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { setHostBridge } from '@openheaders/core/bridge';
import { SYNC_AWARENESS_PRESENCE_TYPE } from '@openheaders/core/protocol';
import type { AwarenessState } from '@openheaders/core/protocol';
import { ensureSyntheticIdentity } from '@openheaders/core/identity';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { setLockRuntime } from '@openheaders/oracle/coordination';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { type OracleWsServer, startOracleWsServer } from '@openheaders/oracle/host-runtime/ws-server';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  listWorkspaces,
  peekActiveWorkspaceId,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { hydrateActiveWorkspaceStores } from '@openheaders/oracle/workspace/workspace-coordinator';
import {
  setActivityMuteStore,
  setOracleHostHooks,
  subscribeActivityMuteChanges,
} from '@openheaders/oracle/sync';
import { setSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { createSqliteSyncPersistence } from '@openheaders/oracle/sync/sqlite-sync-persistence';
import { setBlobBackend } from '@openheaders/oracle/files';
// Node-only backend lives behind a deep import so the browser-facing
// barrel (`@openheaders/oracle/files`) stays free of `node:fs` / `node:path`.
import { FileSystemBlobBackend } from '@openheaders/oracle/files/fs-blob-backend';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { installHostStorage } from './install-host-storage';
import { installLifelineServer } from './install-lifeline-server';
import { singleProcessLockRuntime } from './single-process-lock-runtime';
import {
  forwardMutationToWsPeers,
  setMutationForwarderWsServer,
} from './sync-mutation-forwarder';
import {
  observeForActivityFeed,
  setActivityLog,
  subscribeActivityEntries,
} from './sync-activity-installer';
import { installActivityPruneScheduler } from './activity-prune-scheduler';

const RPC_CHANNEL = 'oh:rpc';
const BROADCAST_CHANNEL = 'oh:broadcast';

/**
 * Best-effort OS username for seeding the synthetic User's
 * `displayName` on first boot. Falls back to `'Local'` if `os.userInfo`
 * throws (rare; happens in some sandboxed CI environments).
 */
function safeOsUsername(): string {
  try {
    return os.userInfo().username || 'Local';
  } catch {
    return 'Local';
  }
}

// Captured at boot. The host-hook closures below fan to both renderers
// and connected WS peers; the WS server is null until `startOracleWsServer`
// resolves (early-fire broadcasts hit renderers only, which is harmless —
// no peer has handshook yet).
let wsServer: OracleWsServer | null = null;

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

function broadcastEverywhere(type: string, payload: unknown): void {
  broadcastToAllRenderers(type, payload);
  wsServer?.broadcast(type, payload);
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
  // U1.6 / U1.7 — materialize the synthetic identity-row tuple before
  // any privileged-path code runs (UNIFIED_ORACLE_MODEL.md §5.2 / §12
  // step 2). Idempotent across boots; first-boot mints the
  // host-install-id seed too. Display name seeds the synthetic User
  // row's `displayName` on first boot only — promotion (§5.4 step 1)
  // overwrites it without touching `User.id`.
  await ensureSyntheticIdentity({ displayName: safeOsUsername() });
  setLockRuntime(singleProcessLockRuntime);
  installLifelineServer();
  const syncPersistence = createSqliteSyncPersistence({
    dbPath: path.join(app.getPath('userData'), 'oracle.db'),
  });
  setSyncPersistenceProvider(syncPersistence);
  // Activity Feed log — workspace-wide, SQLite-backed. The installer
  // tolerates a missing log (counts drops) until this resolves, so
  // ordering here is for readability rather than correctness.
  const activityLog = syncPersistence.createActivityLog?.() ?? null;
  setActivityLog(activityLog);
  // F7 — auto-decay. Hourly setInterval prunes every resident workspace
  // down to the 7-day retention window. Listing workspaces lazily at
  // tick time picks up additions/removals without a re-install.
  const stopActivityPruneScheduler = installActivityPruneScheduler({
    getLog: () => activityLog,
    listWorkspaceIds: () => listWorkspaces().map((ws) => ws.id),
  });
  // F6.b — per-entity mute store. The cache module is the runtime
  // source of truth; the persisted store rehydrates it per workspace
  // lazily on first observation inside the installer.
  setActivityMuteStore(syncPersistence.createActivityMuteStore?.() ?? null);
  // F5 — live tail for the panel. Each classified entry the installer
  // produces is also pushed onto the renderer bridge so the panel can
  // prepend without re-fetching.
  subscribeActivityEntries((entry) => {
    broadcastToAllRenderers('activityEntry', entry);
  });
  // F6.b — fan out mute/unmute observations so every open renderer
  // surface keeps its muted-state badges in lockstep without polling.
  subscribeActivityMuteChanges((change) => {
    broadcastToAllRenderers('activityMuteChanged', change);
  });
  // Blob bytes live on the filesystem alongside the SQLite metadata so
  // large files don't bloat the DB and incremental backups stay
  // straightforward. The metadata table rides on the same handle as the
  // sync persistence — `oracle.db` already opens once at boot.
  setBlobBackend(
    new FileSystemBlobBackend({
      rootDir: path.join(app.getPath('userData'), 'blobs'),
      db: syncPersistence.db,
    }),
  );
  app.on('before-quit', () => {
    syncPersistence.close();
  });

  // 2. Oracle host hooks. Desktop has no DNR engine, no resolver-state
  //    runner, no rule-state-observer cache invalidation. All optional
  //    hooks the oracle calls degrade gracefully when absent.
  setOracleHostHooks({
    getActiveWorkspaceId,
    peekActiveWorkspaceId,
    broadcastSyncEvent: (event) => {
      // Renderers keep the legacy `syncBroadcast` IPC channel — they
      // consume the full `OracleSyncBroadcastEvent` (envelope +
      // outcome + per-entity post-states) to fold into mirrors.
      // Cross-host WS peers get the flat `oh.sync.mutation` wire
      // shape from the C10 forwarder (with echo-prevention via the
      // shared seen-set).
      broadcastToAllRenderers('syncBroadcast', event);
      forwardMutationToWsPeers(event);
      observeForActivityFeed(event);
    },
    broadcastAwareness: (event) => {
      // Renderers in this process: legacy IPC channel for the
      // existing awareness mirror (`packages/ui/src/context/
      // awareness-mirror.ts` subscribes to `awarenessBroadcast`).
      broadcastToAllRenderers('awarenessBroadcast', event);
      // Cross-host: forward only DESKTOP-originated presence onto the
      // wire. Peer-received states (e.g. extension surfaces folded into
      // the local store from an inbound frame) are filtered out by
      // `identity.appId` so the wire never loops.
      const localOnly = event.presence.filter((s: AwarenessState) => s.identity.appId === 'desktop');
      if (localOnly.length > 0 || event.presence.length === 0) {
        wsServer?.broadcastFrame({
          type: SYNC_AWARENESS_PRESENCE_TYPE,
          workspaceId: event.workspaceId,
          presence: localOnly,
        });
      }
    },
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

  // 6. WS server on 127.0.0.1:59210 — the extension-as-client pipe.
  //    The browser SW connects here on boot; same `dispatchSyncRpc`
  //    routes its messages, and oracle broadcasts fan out to every
  //    connected peer via `broadcastEverywhere`. Failure to bind
  //    (another instance running, port held by something else) is
  //    logged but not fatal; the IPC engine keeps serving the
  //    renderer.
  try {
    wsServer = await startOracleWsServer({
      handshakeIdentity: {
        role: 'desktop',
        // HLC writer identity for the main process. Distinct from any
        // renderer's surfaceId; lives only for this process lifetime so
        // a per-boot UUID is sufficient. Phase D persists a stable
        // deviceId at the host-settings layer.
        nodeId: `desktop-${randomUUID()}`,
        agent: `@openheaders/desktop@${app.getVersion()}`,
      },
    });
    setMutationForwarderWsServer(wsServer);
  } catch (err) {
    consoleLogger.error(
      'install-rpc-host',
      'WS server failed to start; continuing without the extension pipe',
      err,
    );
  }

  // 7. Clean up the renderer-bound dispatch + WS server on app quit so a
  //    reload cycle doesn't leak a stale ipcMain.handle registration or
  //    a half-open server socket.
  app.on('before-quit', () => {
    stopActivityPruneScheduler();
    ipcMain.removeHandler(RPC_CHANNEL);
    setMutationForwarderWsServer(null);
    setActivityLog(null);
    setActivityMuteStore(null);
    void wsServer?.close();
    wsServer = null;
  });
}
