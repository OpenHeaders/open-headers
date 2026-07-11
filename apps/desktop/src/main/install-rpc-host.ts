/**
 * Wire the desktop main-process side of the oracle host runtime.
 *
 * Architectural invariant: the app runs ≥99% of the time in the
 * background with no renderer window open. The engine boot here is
 * unconditional — main process owns workspaces, rules, sync state,
 * broadcasting, and the WS server. The renderer is a thin subscriber
 * that hydrates from main via `oh.sync.snapshot*` when its window
 * mounts. Broadcasts to absent renderers silently no-op; the engine
 * keeps running.
 *
 * The engine boot itself is the host-neutral daemon spine
 * (`@openheaders/oracle-host-node/daemon`) — the same core the
 * standalone daemon distribution runs. This module is the Electron
 * shell around it, owning exactly the desktop-specific edges:
 *
 *   - `HostStorage`: file-backed (`<userData>/storage.json`) with Electron
 *     `safeStorage` encrypting slots flagged `sensitive: true`. Renderers
 *     reach it via the `oh:storage:*` IPC channels (`installHostStorage`).
 *   - `LifelineServer`: IPC adapter (`installLifelineServer`) — each
 *     renderer surface holds one long-lived port; webContents destroy
 *     and renderer-initiated close both fan out as `onDisconnect` to
 *     oracle's `setupAwarenessLifelinePorts`.
 *   - Local broadcast: oracle events fan out to every open renderer via
 *     `webContents.send`; the spine forwards to WS peers itself.
 *   - Status store: the shared `@openheaders/ui` store both hosts and
 *     renderers read; handed to the spine through its status seam.
 *   - Paths + lifecycle: `<userData>` as the data dir; `before-quit`
 *     drives the spine's dispose.
 *
 * Inbound wires:
 *
 *   - `ipcMain.handle('oh:rpc', payload)` → the spine's `dispatchRpc`
 *     for the sync+awareness channels (renderer ↔ main).
 *   - The spine's bind supervisor on the user-controlled
 *     `backend.bindPort` (default `:8137`), bound to either `127.0.0.1`
 *     or `0.0.0.0` per the `backend.bindAddress` setting → connected
 *     extension SWs / future daemons / future remote surfaces.
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setHostLogger } from '@openheaders/core/logger';
import { OH } from '@openheaders/core/storage';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { forwardAwarenessToBackend } from '@openheaders/oracle/sync/client/awareness-forwarder';
import { forwardMutationToBackend } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { reportBaselineSyncStatus } from '@openheaders/oracle/sync/client/sync-status-aggregate';
import { bootDaemonSpine } from '@openheaders/oracle-host-node/daemon';
import { clearStatus, getStatusSnapshot, report, subscribe } from '@openheaders/ui/shared/status/store';
import { app } from 'electron';
import { broadcastToAllRenderers } from './bootstrap/renderer-broadcast';
import { installUpdateMenuActions, updateMenusOnState } from './bootstrap/update-menus';
import { createElectronUpdaterPort, updaterSupported } from './electron-updater-port';
import { installBackendClient } from './install-backend-client';
import { installHostStorage } from './install-host-storage';
import { installLifelineServer } from './install-lifeline-server';
import { createUpdateService, readUpdatePreferences } from './update-service';
import { readServeWebApp, webAppRootCandidate } from './web-app-root';

const SCOPE = 'install-rpc-host';

export type OhRpcDispatcher = (raw: unknown) => Promise<unknown>;

// Exposed via getter so `main.ts` can keep `ipcMain.handle('oh:rpc')`
// registered before the engine boots. Pre-engine renderer calls queue
// on the engine-ready promise; once `installRpcHost` populates this,
// they drain through the same dispatcher real RPCs use.
let rpcDispatcher: OhRpcDispatcher | null = null;

export function getOhRpcDispatcher(): OhRpcDispatcher | null {
  return rpcDispatcher;
}

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

/**
 * Best-effort machine name for the private home Org's descriptive
 * name on first boot. The trailing `.local` macOS appends is stripped so
 * a joined peer reads `Daniels-MacBook-Pro`, not `Daniels-MacBook-Pro.local`.
 * Falls back to `'Local'` when `os.hostname` throws or is empty.
 */
function safeOsHostname(): string {
  try {
    return os.hostname().replace(/\.local$/, '') || 'Local';
  } catch {
    return 'Local';
  }
}

/**
 * Wire the Electron edges + boot the daemon spine. Idempotent across
 * multiple calls within the same process (e.g. test harness), but
 * production should call once.
 */
export async function installRpcHost(): Promise<void> {
  // Logger first so the storage + lifeline installs below can log; the
  // spine re-installs the same adapter, which is a no-op.
  setHostLogger(consoleLogger);
  const { backend: hostStorage } = installHostStorage();
  installLifelineServer();

  // Web bundle serving (Phase 4) — the desktop-as-daemon hands out the
  // Workbench web app on its own bind when `backend.serveWebApp` is on.
  // The root is fixed at boot (extraResource / monorepo sibling); the
  // flag is a live gate the spine consults per request, so the settings
  // toggle takes effect without an app restart.
  const webRoot = webAppRootCandidate({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
  });
  const webRootPresent = existsSync(path.join(webRoot, 'index.html'));
  if (!webRootPresent) {
    consoleLogger.info(SCOPE, `web bundle not found at ${webRoot}; the serve-web-app setting stays inert`);
  }
  let serveWebApp = readServeWebApp((await hostStorage.get(OH.settingsUser)) ?? undefined);
  let updatePreferences = readUpdatePreferences((await hostStorage.get(OH.settingsUser)) ?? undefined);
  hostStorage.subscribe(OH.settingsUser, (next) => {
    serveWebApp = readServeWebApp(next);
    updatePreferences = readUpdatePreferences(next);
    updateService.preferencesChanged();
  });

  // Check-and-notify updates (docs/UPDATES_PLAN.md): the service only
  // ever checks and stages; installing takes the user's explicit
  // restart action (or the next natural quit applying a staged
  // download). Unsupported where no updater can run — dev builds,
  // deb/rpm — so it never dials a feed from a test harness.
  const updateService = createUpdateService({
    updater: createElectronUpdaterPort(),
    currentVersion: app.getVersion(),
    supported: updaterSupported(),
    getPreferences: () => updatePreferences,
    broadcast: (state) => {
      broadcastToAllRenderers('appUpdateState', state);
      // Native chrome (application menu, tray) mirrors the same state.
      updateMenusOnState(state);
    },
    now: Date.now,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle),
    log: {
      info: (msg) => consoleLogger.info(SCOPE, msg),
      warn: (msg, err) => consoleLogger.warn(SCOPE, msg, err),
    },
  });
  updateService.start();

  // Hand the native menu items their three consent actions. `dispatchRpc`
  // answers every `oh.updates.*` type with the post-action state; the
  // fallback covers the type-level `undefined` branch it can't take here.
  installUpdateMenuActions({
    checkNow: async () => (await updateService.dispatchRpc('oh.updates.checkNow')) ?? updateService.state(),
    download: async () => (await updateService.dispatchRpc('oh.updates.download')) ?? updateService.state(),
    install: async () => (await updateService.dispatchRpc('oh.updates.install')) ?? updateService.state(),
  });

  const spine = await bootDaemonSpine({
    dataDir: app.getPath('userData'),
    appVersion: app.getVersion(),
    identity: {
      // `hostKind: 'desktop'` + the machine name as the local-org name
      // make this host's Org distinguishable from a joined peer's.
      hostKind: 'desktop',
      displayName: safeOsUsername(),
      orgName: safeOsHostname(),
    },
    handshakeIdentity: {
      role: 'desktop',
      // HLC writer identity for the main process. Distinct from any
      // renderer's surfaceId; lives only for this process lifetime so
      // a per-boot UUID is sufficient. Phase D persists a stable
      // deviceId at the host-settings layer.
      nodeId: `desktop-${randomUUID()}`,
      agent: `@openheaders/desktop@${app.getVersion()}`,
    },
    localAppId: 'desktop',
    hostStorage,
    status: { report, getSnapshot: getStatusSnapshot, subscribe, clear: clearStatus },
    broadcastLocal: broadcastToAllRenderers,
    // Desktop-as-client (MULTI_BACKEND_PLAN.md §5): local commits are
    // also offered to the client plane's Org-routed forwarder — its own
    // gates decide whether anything leaves for a joined daemon.
    forwardMutationToBackends: forwardMutationToBackend,
    // Awareness sibling: presence emissions offered to the client
    // plane's forwarder, which filters to this host's own surfaces and
    // routes by the workspace's Org binding.
    forwardAwarenessToBackends: (event) => forwardAwarenessToBackend(event, 'desktop'),
    // Server slot of the composed `sync` pill: the spine's bind/peer
    // reporter feeds the client plane's baseline slot so it joins the
    // per-backend slots in one worst-of aggregate — the roll-up sink in
    // `install-backend-client.ts` is the subsystem's sole writer.
    reportSyncStatus: (entry) =>
      reportBaselineSyncStatus({ state: entry.state, message: entry.message, context: entry.context }),
    staticWeb: webRootPresent ? { rootDir: webRoot, enabled: () => serveWebApp } : undefined,
  });

  // The outbound client role — the desktop joining daemon backends
  // through the same host-neutral plane the extension SW runs. Installed
  // after the spine so the persistence provider and workspace store the
  // plane composes over are live.
  await installBackendClient({ hostStorage, appVersion: app.getVersion() });

  // Desktop-shell RPCs (`oh.updates.*`) answer ahead of the engine
  // dispatcher — they are Electron concerns the spine never learns.
  rpcDispatcher = async (raw) => {
    const type = ((raw ?? {}) as Record<string, unknown>).type;
    const updateState = await updateService.dispatchRpc(type);
    return updateState !== undefined ? updateState : spine.dispatchRpc(raw);
  };

  // Clean up engine-owned resources on app quit. The `oh:rpc` channel
  // is registered in `main.ts` (so it can queue pre-engine calls) and
  // is removed there.
  app.on('before-quit', () => {
    rpcDispatcher = null;
    updateService.dispose();
    void spine.dispose();
  });
}
