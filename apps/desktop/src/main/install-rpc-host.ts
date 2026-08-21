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
 *   - `HostStorage`: file-backed (`<userData>/data/settings.json`) with Electron
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
 *   - Paths + lifecycle: `<userData>/data` as the data dir (the
 *     backup-worthy half of the layout in `bootstrap/app-paths`); the
 *     app lifecycle's quit teardown drives the spine's dispose.
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
import type { BridgeRpcResponse } from '@openheaders/core/bridge';
import type { ImportReport } from '@openheaders/core/import';
import { setHostLogger } from '@openheaders/core/logger';
import { CHROMIUM_EXTENSION_IDS, GECKO_EXTENSION_IDS } from '@openheaders/core/protocol';
import { OH } from '@openheaders/core/storage';
import { activatedPlanFromLicenseSnapshot, type TelemetryEvent } from '@openheaders/core/telemetry';
import {
  clearImportReports,
  findImportReportBySourceHash,
  listImportReports,
  recordImportReport,
} from '@openheaders/oracle/entity/import-reports-store';
import { forwardAwarenessToBackend } from '@openheaders/oracle/sync/client/awareness-forwarder';
import { forwardMutationToBackend } from '@openheaders/oracle/sync/client/mutation-forwarder';
import { reportBaselineSyncStatus } from '@openheaders/oracle/sync/client/sync-status-aggregate';
import { bootDaemonSpine, registerPeerRpcPlane } from '@openheaders/oracle-host-node/daemon';
import { registerH3HelperLocator } from '@openheaders/oracle-host-node/live/h3-helper/helper-binary';
import {
  broadcastMigrationPullToPeers,
  createMigrationPeerRpc,
  createMigrationPullRunner,
  detectInstalledTools,
  listPostmanWorkspaces,
  readInsomniaData,
  readPostmanBackupFile,
  scanToolData,
} from '@openheaders/oracle-host-node/migration';
import {
  loadOrCreateSealKeyFile,
  loadOrCreateWrappedSealKey,
  TRAFFIC_SEAL_KEY_FILE_DESKTOP,
  TRAFFIC_SEAL_WRAPPED_KEY_FILE,
  TRAFFIC_SESSIONS_DIR_NAME,
  trafficSealKeyConfigSegments,
} from '@openheaders/oracle-host-node/traffic';
import { clearStatus, getStatusSnapshot, report, subscribe } from '@openheaders/ui/shared/status/store';
import { app, BrowserWindow, dialog } from 'electron';
import { dataDir } from './bootstrap/app-paths';
import { revealAppSurface } from './bootstrap/app-reveal';
import { registerTeardown } from './bootstrap/lifecycle';
import { installLocaleSubscription, mainTranslator } from './bootstrap/locale';
import { createEngineHostLogger } from './bootstrap/logger';
import { relaunchApp } from './bootstrap/relaunch';
import { broadcastToAllRenderers } from './bootstrap/renderer-broadcast';
import { installUpdateMenuActions, updateMenusOnState } from './bootstrap/update-menus';
import { createCompanionRevealPeerRpc } from './companion-reveal-plane';
import { createElectronUpdaterPort, updateCapability } from './electron-updater-port';
import { h3HelperBinaryCandidates } from './h3-helper-install';
import { installBackendClient } from './install-backend-client';
import { installHostStorage } from './install-host-storage';
import { installLifelineServer } from './install-lifeline-server';
import { createManifestUpdaterPort } from './manifest-updater-port';
import {
  linuxNmManifestTargets,
  macosNmManifestTargets,
  nmHostBinaryCandidate,
  registerNmManifests,
  registerWindowsNmManifests,
  windowsHostBinarySigned,
  windowsNmManifestTargets,
} from './nm-host-install';
import { installProductTelemetry } from './product-telemetry';
import { installProductTelemetryMcpBeacons } from './product-telemetry-mcp-beacons';
import { installProductTelemetrySyncBeacons } from './product-telemetry-sync-beacons';
import { safeStorageCipher } from './safe-storage-cipher';
import { installScriptSandbox } from './script-sandbox';
import { describeOsProxy } from './system-proxy-describe';
import { installSystemProxyService } from './system-proxy-install';
import { createUpdateService, readUpdatePreferences } from './update-service';
import { fetchDesktopSeverity } from './versions-manifest';
import { readServeWebApp, webAppRootCandidate } from './web-app-root';
import { fetchWhatsNewEntryBody, fetchWhatsNewHistory } from './whats-new-history';

const SCOPE = 'install-rpc-host';

/** Deadline for the engine's quit-time dispose (lifecycle participant). */
const ENGINE_DISPOSE_DEADLINE_MS = 10_000;

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
  // spine re-installs the same adapter, which is a no-op. Electron-log
  // backed: engine rows reach main.log, not just the (invisible in
  // packaged builds) stdout.
  const engineLogger = createEngineHostLogger();
  setHostLogger(engineLogger);
  // Secrets-storage state (the "unlock secrets storage" surface): the
  // file-backed store observes cipher availability from sensitive-slot
  // traffic — never probing, so no keychain prompt fires for users who
  // hold no secrets. Every transition fans to open renderers (the vault
  // page + Notifications suggestion follow it live; late joiners hydrate
  // via `oh.secrets.getState` below) AND lands in the shared status
  // store, so the footer's System status pill carries the red `secrets`
  // row on every surface.
  const { backend: hostStorage } = installHostStorage({
    onCipherStatusChange: (status) => {
      broadcastToAllRenderers('secretsStorageState', { status, platform: process.platform });
      if (status === 'unavailable') {
        report({
          subsystem: 'secrets',
          state: 'red',
          message: 'Secrets storage locked — relaunch to unlock',
          context: { cipher: 'unavailable', platform: process.platform },
        });
      } else if (status === 'available') {
        report({ subsystem: 'secrets', state: 'green', message: 'Encrypted secrets storage available' });
      }
    },
  });
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
    engineLogger.info(SCOPE, `web bundle not found at ${webRoot}; the serve-web-app setting stays inert`);
  }
  // NM identity bootstrap (Phase 7): the shipped `oh-nm-host` binary is
  // the anchor of the daemon's caller verification, and its per-browser
  // manifests auto-register with idempotent repair on every boot. Both
  // stand down when the binary isn't shipped (a dev tree without
  // `pnpm --filter @openheaders/nm-host run pack:bun`) — the extension
  // then degrades to the device-flow pairing gesture.
  const nmHostBinaryPath = nmHostBinaryCandidate({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    platform: process.platform,
  });
  const nmPlatformSupported =
    process.platform === 'darwin' || process.platform === 'win32' || process.platform === 'linux';
  const nmHostPresent = nmPlatformSupported && existsSync(nmHostBinaryPath);
  if (nmHostPresent && process.platform === 'win32') {
    const registrations = await registerWindowsNmManifests({
      hostBinaryPath: nmHostBinaryPath,
      manifestDir: path.join(app.getPath('userData'), 'nm-host'),
      targets: windowsNmManifestTargets(
        process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'),
        process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'),
      ),
      allowedExtensionIds: CHROMIUM_EXTENSION_IDS,
      allowedGeckoIds: GECKO_EXTENSION_IDS,
    });
    for (const registration of registrations) {
      engineLogger.info(
        SCOPE,
        `NM manifest ${registration.action}: ${registration.browser} → ${registration.registryKey}`,
      );
    }
  } else if (nmHostPresent) {
    const registrations = registerNmManifests({
      hostBinaryPath: nmHostBinaryPath,
      targets:
        process.platform === 'linux' ? linuxNmManifestTargets(os.homedir()) : macosNmManifestTargets(os.homedir()),
      allowedExtensionIds: CHROMIUM_EXTENSION_IDS,
      allowedGeckoIds: GECKO_EXTENSION_IDS,
    });
    for (const registration of registrations) {
      engineLogger.info(
        SCOPE,
        `NM manifest ${registration.action}: ${registration.browser} → ${registration.manifestPath}`,
      );
    }
  } else {
    engineLogger.info(SCOPE, `NM host binary not found at ${nmHostBinaryPath}; identity bootstrap stays inert`);
  }

  // HTTP/3 helper (the request-engine H3-protocol design): register where
  // this install keeps the bundled `oh-h3-helper` so a `'3'` send can
  // spawn it. The resolver owns the env override and the honest
  // not-bundled failure; absence only costs this boot log line.
  const h3HelperCandidates = h3HelperBinaryCandidates({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    platform: process.platform,
    arch: process.arch,
  });
  registerH3HelperLocator(() => h3HelperCandidates.find((candidate) => existsSync(candidate)) ?? null);
  if (!h3HelperCandidates.some((candidate) => existsSync(candidate))) {
    engineLogger.info(
      SCOPE,
      `HTTP/3 helper not found at ${h3HelperCandidates[0]}; the '3' HTTP-version pin stays inert`,
    );
  }

  // System-plane proxy service (the request-engine proxy design):
  // inherit-mode sends follow this machine's proxy reality — Off /
  // System / Manual / PAC per the per-device settings, System by
  // default via Chromium's own resolver on a dedicated session
  // partition. An unmanaged machine resolves DIRECT and behaves
  // exactly as before. The service also answers the settings surface's
  // `oh.desktop.systemProxy.*` RPCs below.
  const systemProxyService = await installSystemProxyService(hostStorage);

  // Native-surface locale (tray / menus / dialogs) follows the same
  // settings blob — bound here because the menus install before this
  // storage backend exists.
  installLocaleSubscription(hostStorage);

  let serveWebApp = readServeWebApp((await hostStorage.get(OH.settingsUser)) ?? undefined);
  let updatePreferences = readUpdatePreferences((await hostStorage.get(OH.settingsUser)) ?? undefined);
  hostStorage.subscribe(OH.settingsUser, (next) => {
    serveWebApp = readServeWebApp(next);
    updatePreferences = readUpdatePreferences(next);
    updateService.preferencesChanged();
  });

  // Anonymous usage counting (the telemetry plan §7): the desktop host's
  // product-telemetry adapter. A host-shell concern the spine never
  // learns — the daemon distribution stays hard-off by construction.
  // The enabled gate rides the same storage the renderer writes:
  // `telemetry.enabled` in the settings blob.
  const productTelemetry = await installProductTelemetry({
    storage: hostStorage,
    appVersion: app.getVersion(),
    platform: process.platform,
    channel: app.isPackaged ? 'github-release' : 'dev',
    locale: () => mainTranslator().locale,
  });

  // Check-and-notify updates (the updates plan): the service only
  // ever checks and stages; installing takes the user's explicit
  // restart action (or the next natural quit applying a staged
  // download). deb/rpm installs run notify-only over the manifest port
  // (the package manager owns updates); dev builds get no service at
  // all, so a test harness never dials a feed. The port wrap keeps the
  // state machine host-free while a failed feed check beacons its
  // typed error code.
  const updateServiceCapability = updateCapability();
  const updaterPort =
    updateServiceCapability === 'notify'
      ? createManifestUpdaterPort(app.getVersion(), () => updatePreferences.channel)
      : createElectronUpdaterPort(() => updatePreferences.channel);
  const updateService = createUpdateService({
    updater: {
      ...updaterPort,
      check: async () => {
        try {
          return await updaterPort.check();
        } catch (err) {
          productTelemetry.track({ name: 'error_beacon', code: 'update-check-failed' });
          throw err;
        }
      },
    },
    fetchSeverity: fetchDesktopSeverity,
    currentVersion: app.getVersion(),
    capability: updateServiceCapability,
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
      info: (msg) => engineLogger.info(SCOPE, msg),
      warn: (msg, err) => engineLogger.warn(SCOPE, msg, err),
    },
  });
  updateService.start();

  // Hand the native menu items their three consent actions. `dispatchRpc`
  // answers every `oh.updates.*` type with the post-action state; the
  // fallback covers the type-level `undefined` branch it can't take here.
  installUpdateMenuActions({
    checkNow: async () => (await updateService.dispatchRpc('oh.updates.checkNow')) ?? updateService.state(),
    updateAndRestart: async () =>
      (await updateService.dispatchRpc('oh.updates.updateAndRestart')) ?? updateService.state(),
    install: async () => (await updateService.dispatchRpc('oh.updates.install')) ?? updateService.state(),
  });

  // Traffic-session seal key (the agent-traffic plan §9.5): a random
  // 32-byte key wrapped by the OS keychain via safeStorage — the
  // wrapped blob may live inside the data dir because it is ciphertext
  // under the keychain. When no keychain backend exists (Linux without
  // a keyring) the fallback is a 0600 key file OUTSIDE the data dir,
  // so a data-dir exfiltration alone never carries the key.
  const trafficSealKey =
    loadOrCreateWrappedSealKey(
      path.join(dataDir(), TRAFFIC_SESSIONS_DIR_NAME, TRAFFIC_SEAL_WRAPPED_KEY_FILE),
      safeStorageCipher,
    ) ??
    loadOrCreateSealKeyFile(
      path.join(
        ...trafficSealKeyConfigSegments(process.env, os.homedir(), process.platform),
        TRAFFIC_SEAL_KEY_FILE_DESKTOP,
      ),
    );

  const spine = await bootDaemonSpine({
    dataDir: dataDir(),
    appVersion: app.getVersion(),
    logger: engineLogger,
    trafficSealKey,
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
    // Desktop-as-client (the multi-backend plan §5): local commits are
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
    // Composed only when the host binary is shipped — the identity
    // chain has no anchor without it. Signature enforcement follows the
    // build posture: packaged macOS builds are signed; Windows derives
    // from the build's own channel (stable trains sign, beta ships
    // unsigned); Linux has no signing chain at all (the path check is
    // the whole posture there); dev artifacts aren't signed anywhere.
    nmBootstrap: nmHostPresent
      ? {
          hostBinaryPath: nmHostBinaryPath,
          requireHostSignature:
            app.isPackaged &&
            (process.platform === 'darwin' ||
              (process.platform === 'win32' && windowsHostBinarySigned(app.getVersion()))),
        }
      : undefined,
  });

  // `on-blur` commit cadence (the git-sync plan §3.2): the trigger is focus
  // leaving the APP, not a window losing focus to a sibling window —
  // check on the next tick, after Electron has settled which window
  // (if any) took focus. The spine no-ops for every other cadence.
  app.on('browser-window-blur', () => {
    setImmediate(() => {
      if (BrowserWindow.getFocusedWindow() === null) {
        void spine.dispatchRpc({ type: 'oh.workspaceTree.appBlur' }).catch(() => undefined);
      }
    });
  });

  // Focus returning to the app triggers a throttled background fetch
  // (the git-sync plan §3.2) so the ahead/behind affordance is fresh the
  // moment the user looks; the runtime's own throttle absorbs bursts.
  app.on('browser-window-focus', () => {
    void spine.dispatchRpc({ type: 'oh.workspaceTree.appFocus' }).catch(() => undefined);
  });

  // The outbound client role — the desktop joining daemon backends
  // through the same host-neutral plane the extension SW runs. Installed
  // after the spine so the persistence provider and workspace store the
  // plane composes over are live. The client plane's observability seams
  // feed the product-telemetry beacons, same mapping as the extension SW.
  const syncWiring = await installBackendClient({
    hostStorage,
    appVersion: app.getVersion(),
    trackProductTelemetry: (event) => productTelemetry.track(event),
  });
  installProductTelemetrySyncBeacons(syncWiring, (event) => productTelemetry.track(event));
  // Embedded MCP surface (MCP visibility slice): the `/mcp` module's
  // policy-free usage observer, mapped to typed events here — the
  // standalone daemon never installs one and stays silent.
  installProductTelemetryMcpBeacons((event) => productTelemetry.track(event));

  // Safe-mode script runtime: pre/post request scripts run in a hidden
  // sandboxed renderer; the capability makes the spine's executeRequest
  // + chain runner inject script runners on this host. Installed after
  // the spine so host RPCs read hydrated stores; the window itself
  // spawns lazily on the first scripted run.
  const scriptSandbox = installScriptSandbox();

  // Migration pull (the migration plan §3.3) — the desktop runs the
  // ladder, so the run orchestrator lives here beside the engine it
  // writes through. Progress fans as the ONE `migrationPullEvent`
  // broadcast to every open renderer AND to the operator's connected
  // WS peers (the extension mirrors the corner task live); the key
  // arrives in the start RPC, stays in the runner's closure for the
  // run, and is never persisted or logged. Late-joining peers hydrate
  // through the operator-gated `getState` peer plane.
  // `OH_POSTMAN_API_ORIGIN` redirects the pull at a stand-in Data API —
  // the e2e harness seam, same posture as `OH_DISABLE_UPDATE_CHECKS`.
  const migrationApiOrigin = process.env.OH_POSTMAN_API_ORIGIN;
  const migrationPullRunner = createMigrationPullRunner({
    broadcast: (type, payload) => {
      broadcastToAllRenderers(type, payload);
      broadcastMigrationPullToPeers(type, payload);
    },
    ...(migrationApiOrigin !== undefined && migrationApiOrigin !== '' ? { apiOrigin: migrationApiOrigin } : {}),
  });
  registerPeerRpcPlane(createMigrationPeerRpc({ getState: () => migrationPullRunner.getState() }));

  // Companion reveal — a same-device browser surface fronting this app
  // (the extension teasers' "Open in the desktop app"). The plane
  // loopback-gates and validates; the Electron leg fronts the window
  // and routes the target to the renderer's dock/settings mapping.
  registerPeerRpcPlane(createCompanionRevealPeerRpc({ reveal: revealAppSurface }));

  // Desktop-shell RPCs (`oh.updates.*`, `oh.migration.*`) answer ahead
  // of the engine dispatcher — they are host-shell concerns the spine
  // never learns.
  rpcDispatcher = async (raw) => {
    const message = (raw ?? {}) as Record<string, unknown>;
    const type = message.type;
    if (type === 'oh.migration.postmanPull.start') {
      const apiKey = typeof message.apiKey === 'string' ? message.apiKey.trim() : '';
      if (!apiKey) return { started: false, reason: 'An API key is required to start the pull.' };
      const workspaceIds = Array.isArray(message.workspaceIds)
        ? message.workspaceIds.filter((id): id is string => typeof id === 'string')
        : undefined;
      return migrationPullRunner.start(apiKey, workspaceIds);
    }
    // The selection step's preflight: names + item counts, so the user
    // picks which vendor workspaces to import before anything pulls.
    // The key rides this call's memory only — same law as the start RPC.
    if (type === 'oh.migration.postmanPull.listWorkspaces') {
      const apiKey = typeof message.apiKey === 'string' ? message.apiKey.trim() : '';
      if (!apiKey) return { ok: false, reason: 'An API key is required to list workspaces.' };
      return listPostmanWorkspaces({
        apiKey,
        ...(migrationApiOrigin !== undefined && migrationApiOrigin !== '' ? { apiOrigin: migrationApiOrigin } : {}),
      });
    }
    if (type === 'oh.migration.postmanPull.getState') {
      return migrationPullRunner.getState();
    }
    // Stop the in-flight pull — only the pull phase is stoppable; a
    // canceled pull never materializes, so nothing lands.
    if (type === 'oh.migration.postmanPull.stop') {
      return { stopped: migrationPullRunner.stop() };
    }
    // Ladder rungs 1–2 behind consent click 1 (the migration plan §5.1):
    // both run only when the renderer's migration surface asks, never on
    // a timer. `readBackup` re-validates against the scan allowlist
    // host-side, so a renderer-supplied path can't open anything else.
    // Secrets-storage surface: state reads the store's observed cipher
    // status (never probes — see installHostStorage above); relaunch is
    // the one honest remedy for a canceled keychain prompt (cached for
    // the process lifetime, so no in-process retry can succeed).
    // System-plane proxy settings surface — per-device egress
    // config; a set applies live (the resolver re-registers, no
    // restart). `resolve` serves both the sourced display's probe and
    // the per-URL resolution preview.
    if (type === 'oh.desktop.systemProxy.get') {
      return { settings: systemProxyService.getSettings() };
    }
    if (type === 'oh.desktop.systemProxy.set') {
      return systemProxyService.setSettings(message.settings);
    }
    if (type === 'oh.desktop.systemProxy.describe') {
      try {
        return { ok: true, snapshot: await describeOsProxy() };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.desktop.systemProxy.pickPacFile') {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'PAC files', extensions: ['pac', 'js', 'dat'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
      return { path: result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0] };
    }
    if (type === 'oh.desktop.systemProxy.resolve') {
      const url = typeof message.url === 'string' ? message.url.trim() : '';
      if (url === '') return { ok: false, error: 'A URL is required to preview resolution.' };
      const target = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) ? url : `https://${url}`;
      try {
        return { ok: true, resolution: await systemProxyService.resolve(target) };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.secrets.getState') {
      return { status: hostStorage.cipherStatus(), platform: process.platform };
    }
    if (type === 'oh.secrets.relaunch') {
      // Resolve before tearing the process down so the caller's await
      // settles; the relaunch proceeds on the next tick.
      setImmediate(() => relaunchApp());
      return { ok: true };
    }
    // Native directory picker for the workspace-tree Git card — a
    // desktop-shell concern (Electron dialog); the spine's own
    // `oh.workspaceTree.*` channels handle everything else.
    if (type === 'oh.workspaceTree.pickFolder') {
      const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
      return { path: result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0] };
    }
    if (type === 'oh.migration.detectTools') {
      return detectInstalledTools();
    }
    if (type === 'oh.migration.scanToolData') {
      return scanToolData();
    }
    if (type === 'oh.migration.readBackup') {
      const path = typeof message.path === 'string' ? message.path : '';
      return readPostmanBackupFile(path);
    }
    if (type === 'oh.migration.readInsomniaData') {
      const dir = typeof message.dir === 'string' ? message.dir : '';
      return readInsomniaData(dir);
    }
    // `license_activated` (the telemetry plan §3, S22): the one emit
    // point for user-initiated license installs — the spine handles the
    // install and stays telemetry-free; the refresh agent's silent file
    // swaps never pass through here. Desktop-renderer installs only by
    // construction (served-web admin reaches the spine over its own
    // gated peer plane, never this dispatcher). Plan derives from the
    // returned snapshot alone, never the license file.
    if (type === 'oh.daemon.license.install') {
      const result = (await spine.dispatchRpc(raw)) as BridgeRpcResponse<'oh.daemon.license.install'>;
      if (result.ok) {
        const plan = activatedPlanFromLicenseSnapshot(result.snapshot);
        if (plan) productTelemetry.track({ name: 'license_activated', plan });
      }
      return result;
    }
    // Product-telemetry seam (the telemetry plan §6/§7): UI surfaces
    // track through the bridge and the inspector row reads the session
    // log; the client itself never leaves this process.
    if (type === 'productTelemetryTrack') {
      productTelemetry.track(message.event as TelemetryEvent);
      return { success: true };
    }
    if (type === 'productTelemetryRead') {
      return productTelemetry.snapshot();
    }
    // Import-report ring (ARCHITECTURE §23) — the shared workbench UI
    // (report modal, re-import diff, settings Data page) drives these
    // through the host bridge; the extension SW answers the same
    // channels. Shell-side while boot-spine carries concurrent work —
    // lift into the spine's universal host-bridge section later so the
    // headless daemon's served workbench gets them too.
    if (type === 'recordImportReport') {
      try {
        await recordImportReport(message.report as ImportReport);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    if (type === 'listImportReports') {
      try {
        const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : undefined;
        return { reports: await listImportReports(workspaceId) };
      } catch {
        return { reports: [] };
      }
    }
    if (type === 'clearImportReports') {
      try {
        await clearImportReports();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    if (type === 'findImportReportBySourceHash') {
      try {
        const sourceHash = typeof message.sourceHash === 'string' ? message.sourceHash : '';
        return { report: await findImportReportBySourceHash(sourceHash) };
      } catch {
        return { report: null };
      }
    }
    // What's New online history (the changelog plan §4.3) — the
    // renderer's CSP can't dial the feed, so these two enhancement-only
    // static GETs run here. Null answers hide the section, never error.
    if (type === 'oh.whatsNew.history') {
      return { rows: await fetchWhatsNewHistory() };
    }
    if (type === 'oh.whatsNew.historyEntry') {
      const version = typeof message.version === 'string' ? message.version : '';
      return { body: await fetchWhatsNewEntryBody(version) };
    }
    const updateState = await updateService.dispatchRpc(type);
    return updateState !== undefined ? updateState : spine.dispatchRpc(raw);
  };

  // Quit-time teardown, as a lifecycle participant: the spine's dispose
  // flushes in-flight work (workspace-tree materializer, binding
  // chains, SQLite close), so the exit waits for it — else Electron
  // exits mid-flush and can cut a materialize or commit pass short on
  // disk. The lifecycle machine has already destroyed every renderer
  // window by the time this runs, so nulling the dispatcher can no
  // longer strand a live renderer.
  registerTeardown('engine', ENGINE_DISPOSE_DEADLINE_MS, async () => {
    rpcDispatcher = null;
    updateService.dispose();
    productTelemetry.dispose();
    scriptSandbox.dispose();
    await spine.dispose();
    engineLogger.info(SCOPE, 'engine disposed');
  });

  engineLogger.info(SCOPE, `engine boot complete (+${process.uptime().toFixed(2)}s)`);
}
