/**
 * Daemon boot spine — the host-neutral core every Node distribution of
 * the back-end boots: the desktop main process (behind its Electron
 * shell) and the standalone daemon (headless). One spine, two
 * distributions; nothing engine-shaped forks.
 *
 * Composes the cross-host seams the oracle expects (host storage, lock
 * runtime, sync persistence, host logger), registers the
 * `OracleHostHooks`, boots the host runtime (bootstrap workspaces →
 * hydrate stores → init sync engine → bridges → coord runner), starts
 * the live-workflow runner, and stands up the composed network surface:
 * the WS sync server under the bind supervisor, with the pairing and
 * `/mcp` HTTP handlers riding the same bound socket.
 *
 * Backends installed here:
 *
 *   - `SyncPersistenceProvider`: SQLite-backed (`<dataDir>/oracle.db`),
 *     better-sqlite3 with WAL journal; per-scope `MutationLog` and
 *     `PendingIntents` share one database handle.
 *   - `LockRuntime`: single-process FIFO mutex.
 *   - `BlobBackend`: filesystem-backed (`<dataDir>/blobs/<wsId>/<fileId>.bin`)
 *     with metadata living in the same `oracle.db` SQLite handle as the
 *     sync persistence layer.
 *
 * What stays host-side, injected through {@link DaemonSpineConfig}:
 *
 *   - `HostStorage` — the desktop wraps the file backend with Electron
 *     `safeStorage` encryption and serves it to renderers over IPC; the
 *     headless daemon installs the plain file backend.
 *   - `broadcastLocal` — fan-out to the host's local surfaces (desktop:
 *     every open renderer window; headless daemon: no-op until the web
 *     app ships). Cross-host WS peers are the spine's own concern via
 *     the mutation forwarder + awareness frames.
 *   - the status store — lives beside the UI package so renderers share
 *     the vocabulary; the spine writes through {@link SpineStatusStore}.
 *   - lifeline transport — a host with local surfaces installs its
 *     `LifelineServer` before booting the spine; a headless host skips it.
 *
 * Outbound (oracle → world): oracle broadcasts (`syncBroadcast`,
 * `awarenessBroadcast`) fan out to the host's local surfaces via
 * `broadcastLocal` AND to every WS peer past handshake. One oracle
 * event, two transports, same payload shape.
 */

import * as path from 'node:path';
import { setHostBridge } from '@openheaders/core/bridge';
import {
  createDaemonPairingService,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  getIdentitySnapshot,
  mintDaemonAuthToken,
  refreshIdentitySnapshotFromHostStorage,
  revokeDaemonAuthToken,
} from '@openheaders/core/identity';
import { setHostLogger } from '@openheaders/core/logger';
import type { AwarenessState } from '@openheaders/core/protocol';
import { SYNC_AWARENESS_PRESENCE_TYPE, WS_PORT } from '@openheaders/core/protocol';
import type { HostStorage } from '@openheaders/core/storage';
import { setHostStorage } from '@openheaders/core/storage';
import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  invalidateAllWorkspaceOrgCache,
  setWorkspaceOrgResolver,
} from '@openheaders/core/sync';
import type { HostKind } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { setLockRuntime } from '@openheaders/oracle/coordination';
import { setBlobBackend } from '@openheaders/oracle/files';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import { setActivityMuteStore, setOracleHostHooks, subscribeActivityMuteChanges } from '@openheaders/oracle/sync';
import { setSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
  onWorkspaceStoreChange,
  peekActiveWorkspaceId,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { hydrateActiveWorkspaceStores } from '@openheaders/oracle/workspace/workspace-coordinator';
import { FileSystemBlobBackend } from '../files/fs-blob-backend';
import { createPairingHttpHandler } from '../host-runtime/pairing-http';
import type { OracleWsServer, OracleWsServerOptions } from '../host-runtime/ws-server';
import { createSqliteSyncPersistence } from '../sync/sqlite-sync-persistence';
import { observeForActivityFeed, setActivityLog, subscribeActivityEntries } from './activity-installer';
import { installActivityPruneScheduler } from './activity-prune-scheduler';
import { type DaemonBindSupervisor, startDaemonBindSupervisor } from './bind-supervisor';
import { createHealthzHandler } from './healthz';
import { listLanIpv4Addresses } from './lan-addresses';
import { startLiveRunner, stopLiveRunner } from './live/live-refresh-scheduler';
import { installMcpServer } from './mcp-install';
import { forwardMutationToWsPeers, setMutationForwarderWsServer } from './mutation-forwarder';
import { installObservabilityLog, type ObservabilityLogHandle } from './observability-log';
import { singleProcessLockRuntime } from './single-process-lock-runtime';
import type { SpineStatusStore } from './status-seam';
import { installSyncStatusReporter, type SyncStatusReporter } from './sync-status-reporter';

const SCOPE = 'boot-spine';

export interface DaemonSpineConfig {
  /** Root of everything the spine persists: `oracle.db`, `blobs/`. */
  dataDir: string;
  /** Host app version — MCP `initialize` result + observability stamps. */
  appVersion: string;
  /** Synthetic-identity seed for first boot (U1.6/U1.7). Idempotent across boots. */
  identity: {
    hostKind: HostKind;
    /** Seeds the synthetic User row's `displayName` on first boot only. */
    displayName: string;
    /** The private home Org's descriptive name on first boot. */
    orgName: string;
  };
  /** Identity announced in WELCOME frames; passes through to the WS server. */
  handshakeIdentity: OracleWsServerOptions['handshakeIdentity'];
  /**
   * This host's `identity.appId` on awareness states — only presence
   * originated by this host's own surfaces is forwarded onto the wire,
   * so peer-received states never loop back out.
   */
  localAppId: string;
  /** Already-composed host storage backend; the spine installs it as the process-wide seam. */
  hostStorage: HostStorage;
  /** The host's status store (see `status-seam.ts`). */
  status: SpineStatusStore;
  /**
   * Fan-out to the host's local, same-process surfaces (desktop renderer
   * windows). Best-effort; a headless host passes a no-op. WS peers are
   * NOT the caller's concern — the spine forwards to them itself.
   */
  broadcastLocal: (type: string, payload: unknown) => void;
}

export interface DaemonSpineHandle {
  /**
   * The composed RPC dispatcher local surfaces drive the engine with:
   * pairing/token admin routes + universal host RPCs ahead of
   * `dispatchSyncRpc` for the sync+awareness channels.
   */
  dispatchRpc(raw: unknown): Promise<unknown>;
  /** Tear down everything the spine started. Idempotent. */
  dispose(): Promise<void>;
}

/**
 * Wire seams + boot oracle + stand up the composed network surface.
 * Idempotent across multiple calls within the same process (e.g. test
 * harness), but production hosts call it once.
 */
export async function bootDaemonSpine(config: DaemonSpineConfig): Promise<DaemonSpineHandle> {
  const { status, broadcastLocal } = config;

  // Captured at boot. The host-hook closures below fan to both local
  // surfaces and connected WS peers; the WS server is null until the
  // bind supervisor's first bind resolves (early-fire broadcasts hit
  // local surfaces only, which is harmless — no peer has handshook yet).
  let wsServer: OracleWsServer | null = null;

  // The port the WS server is actually bound on right now — driven by
  // the supervisor's bind lifecycle (`backend.bindPort`, default
  // WS_PORT). The pairing surface reads this so the codes it hands out
  // point at the live port, not the hardcoded default, after the user
  // moves the daemon.
  let boundPort: number = WS_PORT;

  // 1. Cross-host seams. Order: logger first (so subsequent installs
  //    can log), then storage, lock, persistence.
  setHostLogger(consoleLogger);
  setHostStorage(config.hostStorage);
  // U1.6 / U1.7 — materialize the synthetic identity-row tuple before
  // any privileged-path code runs (UNIFIED_ORACLE_MODEL.md §5.2 / §12
  // step 2). Idempotent across boots; first-boot mints the
  // host-install-id seed too. Failures are logged, not fatal: a hard
  // throw here would abort the whole host install (no oracle, no WS
  // server). The resolver denies privileged sync actions while the
  // snapshot is absent; the next boot re-runs this idempotently.
  await ensureSyntheticIdentity(config.identity).catch((err: unknown) => {
    consoleLogger.warn(SCOPE, 'ensureSyntheticIdentity failed', err);
  });
  setLockRuntime(singleProcessLockRuntime);
  const syncPersistence = createSqliteSyncPersistence({
    dbPath: path.join(config.dataDir, 'oracle.db'),
  });
  setSyncPersistenceProvider(syncPersistence);
  // Structured observability log — rides the same SQLite handle so a bug
  // report filed days after the event still contains the triage context.
  // Subsystem call sites land in their own slices; this is the seam.
  const observabilityLog: ObservabilityLogHandle = installObservabilityLog({
    db: syncPersistence.db,
    appVersion: config.appVersion,
    broadcast: (type, payload) => broadcastLocal(type, payload),
  });
  // Status snapshot — the host store is the single vocabulary for the
  // host and its surfaces. The spine owns the writes; surfaces mirror
  // via the `statusUpdated` broadcast.
  const unsubscribeStatus = status.subscribe((snapshot) => {
    broadcastLocal('statusUpdated', snapshot);
  });
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
  // produces is also pushed onto the local bridge so the panel can
  // prepend without re-fetching.
  const unsubscribeActivityEntries = subscribeActivityEntries((entry) => {
    broadcastLocal('activityEntry', entry);
  });
  // F6.b — fan out mute/unmute observations so every open local surface
  // keeps its muted-state badges in lockstep without polling.
  const unsubscribeMuteChanges = subscribeActivityMuteChanges((change) => {
    broadcastLocal('activityMuteChanged', change);
  });
  // Blob bytes live on the filesystem alongside the SQLite metadata so
  // large files don't bloat the DB and incremental backups stay
  // straightforward. The metadata table rides on the same handle as the
  // sync persistence — `oracle.db` already opens once at boot.
  setBlobBackend(
    new FileSystemBlobBackend({
      rootDir: path.join(config.dataDir, 'blobs'),
      db: syncPersistence.db,
    }),
  );

  // 2. Oracle host hooks. Node hosts have no DNR engine, no
  //    resolver-state runner, no rule-state-observer cache invalidation.
  //    All optional hooks the oracle calls degrade gracefully when absent.
  setOracleHostHooks({
    getActiveWorkspaceId,
    peekActiveWorkspaceId,
    broadcastSyncEvent: (event) => {
      // Local surfaces keep the legacy `syncBroadcast` channel — they
      // consume the full `OracleSyncBroadcastEvent` (envelope +
      // outcome + per-entity post-states) to fold into mirrors.
      // Cross-host WS peers get the flat `oh.sync.mutation` wire
      // shape from the C10 forwarder (with echo-prevention via the
      // shared seen-set).
      broadcastLocal('syncBroadcast', event);
      forwardMutationToWsPeers(event);
      observeForActivityFeed(event);
    },
    broadcastAwareness: (event) => {
      // Local surfaces in this process: legacy channel for the
      // existing awareness mirror (`packages/ui/src/context/
      // awareness-mirror.ts` subscribes to `awarenessBroadcast`).
      broadcastLocal('awarenessBroadcast', event);
      // Cross-host: forward only presence THIS host originated onto the
      // wire. Peer-received states (e.g. extension surfaces folded into
      // the local store from an inbound frame) are filtered out by
      // `identity.appId` so the wire never loops.
      const localOnly = event.presence.filter((s: AwarenessState) => s.identity.appId === config.localAppId);
      if (localOnly.length > 0 || event.presence.length === 0) {
        wsServer?.broadcastFrame({
          type: SYNC_AWARENESS_PRESENCE_TYPE,
          workspaceId: event.workspaceId,
          presence: localOnly,
        });
      }
    },
  });

  // 3. The host process drives writes through the same `hostBridge`
  //    proxy local surfaces use — for now wire it to a no-op surface
  //    so any oracle code that reaches for `hostBridge.broadcast` in
  //    the host process doesn't crash. Surface-bound broadcasts run
  //    through the host-hook wired above; this is just defensive.
  setHostBridge({
    call: () => Promise.reject(new Error('host-process hostBridge.call is not implemented')),
    broadcast: (type, ...args: unknown[]) => broadcastLocal(String(type), args[0]),
    subscribe: () => () => undefined,
    presence: () => () => undefined,
  });

  // 4. Boot sequence — workspace bootstrap, hydrate active workspace,
  //    init sync engine + bridges + coord runner + lifeline.
  await bootstrapWorkspaces();
  // U1.8 — every workspace owns an owner-role WRA for the synthetic
  // principal. Reconcile once after `bootstrapWorkspaces` resolves
  // the list; the subscription below covers creates / deletes during
  // the process lifetime. Errors are logged but non-fatal — the next
  // mutation re-fires the reconcile.
  await ensureWorkspaceRoleAssignments(listWorkspaces().map((ws) => ws.id)).catch((err: unknown) => {
    consoleLogger.warn(SCOPE, 'ensureWorkspaceRoleAssignments failed', err);
  });
  // U2.1 — hydrate the in-memory identity snapshot the resolver reads
  // from. One refresh after both ensure-* runs is sufficient at boot;
  // the workspace-store listener below repeats it on changes.
  await refreshIdentitySnapshotFromHostStorage().catch((err: unknown) => {
    consoleLogger.warn(SCOPE, 'refreshIdentitySnapshotFromHostStorage failed', err);
  });
  // U2.6 — install the workspaceId → orgId resolver consulted by every
  // envelope mint site (UNIFIED_ORACLE_MODEL.md §6.1). Per-workspace
  // mutations resolve through `workspace.orgId`; global-scope metadata
  // mutations ride the user's home-org channel per §6.5. The resolver
  // is invalidated on every workspace-store change.
  setWorkspaceOrgResolver((workspaceId) => {
    const snapshot = getIdentitySnapshot();
    if (workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
      return snapshot?.user.homeOrgId;
    }
    return getWorkspace(workspaceId)?.orgId ?? snapshot?.user.homeOrgId;
  });
  const unsubscribeWorkspaceStore = onWorkspaceStoreChange(() => {
    void ensureWorkspaceRoleAssignments(listWorkspaces().map((ws) => ws.id))
      .then(() => refreshIdentitySnapshotFromHostStorage())
      .catch((err: unknown) => {
        consoleLogger.warn(SCOPE, 'ensureWorkspaceRoleAssignments reconcile failed', err);
      });
    invalidateAllWorkspaceOrgCache();
  });
  await hydrateActiveWorkspaceStores();
  await bootSyncEngine();

  // 4a. WS-C C3/C4 — live runner. With the active workspace's stores
  //     hydrated and the sync engine up, start the cadence scheduler: a
  //     `setTimeout` map keyed by (workspace, workflow, env) that warms
  //     THIS host's own live-workflow cache on a timer — reusing the C1
  //     host-neutral resolve→execute core over the Node transport — and
  //     reconciles off the oracle store-change events. Lights real data
  //     into the host's `live` status pill (C5). Torn down in dispose.
  startLiveRunner({ reportStatus: status.report });

  // 4b. Daemon device-flow pairing surface (U3.3). One service instance
  //     per process; the HTTP handler is rebuilt with that service and
  //     handed to every bind the supervisor opens. Polling-only local
  //     contract — see `BridgeRpcContract['oh.daemon.pairing.*']`.
  const pairingService = createDaemonPairingService();
  const pairingHttpHandler = createPairingHttpHandler({ pairing: pairingService });

  // 4b'. `/healthz` — unauthenticated, data-free liveness for ops
  //      probes (DAEMON_PLAN.md §3). First in the composition below so a
  //      probe never touches the pairing/MCP routing.
  const healthzHandler = createHealthzHandler();

  // 4c. MCP endpoint (`/mcp`, MCP_SERVER_PLAN.md Phase 1). Read-tier
  //     tools over stateless streamable HTTP, gated by the `mcp.enabled`
  //     setting (default off) + a paired daemon token per request. Rides
  //     the same bound socket as pairing via handler composition below.
  const mcpInstall = await installMcpServer({ serverVersion: config.appVersion });

  // 5. RPC dispatch for local surfaces. Pairing channels are intercepted
  //    ahead of `dispatchSyncRpc` — they're admin-only surface RPCs, not
  //    part of the sync+awareness channels, so we don't pollute the
  //    sync dispatcher with surface-specific routes.
  const dispatchRpc = async (raw: unknown): Promise<unknown> => {
    const message = (raw ?? {}) as Record<string, unknown>;
    const type = message.type;
    // Host-neutral capability backing — shared `@openheaders/ui` calls
    // this from `eagerInitRendererMirrors`. Returns the runtime-active
    // workspace id (or null on a fresh install).
    if (type === 'getActiveWorkspaceId') {
      return { activeWorkspaceId: getActiveWorkspaceId() ?? null };
    }
    // Universal host-bridge RPCs — every Node host genuinely has these,
    // so they ride the same seam as the extension SW (no capability
    // gating).
    if (type === 'getStatusSnapshot') {
      return { snapshot: status.getSnapshot() };
    }
    if (type === 'getObservabilityLog') {
      return { entries: observabilityLog.getAll() };
    }
    if (type === 'clearObservabilityLog') {
      observabilityLog.clear();
      return { success: true };
    }
    if (type === 'oh.daemon.pairing.start') {
      try {
        const deviceLabel =
          typeof message.deviceLabel === 'string' ? message.deviceLabel.trim() || undefined : undefined;
        const { code, expiresAt } = pairingService.startPair({ deviceLabel });
        const addresses = listLanIpv4Addresses();
        const pairingUrls = [
          { host: '127.0.0.1', url: `http://127.0.0.1:${boundPort}/pair/${code}` },
          ...addresses.map((a) => ({
            host: a.host,
            iface: a.iface,
            url: `http://${a.host}:${boundPort}/pair/${code}`,
          })),
        ];
        return { ok: true, code, expiresAt, port: boundPort, pairingUrls };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.daemon.pairing.list') {
      return {
        pairs: pairingService.list().map((p) => ({
          code: p.code,
          deviceLabel: p.deviceLabel,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
          status: p.status,
        })),
      };
    }
    if (type === 'oh.daemon.pairing.cancel') {
      const code = typeof message.code === 'string' ? message.code : '';
      if (code) pairingService.cancel(code);
      return { ok: true };
    }
    if (type === 'oh.daemon.tokens.connected') {
      // Live ws-server state, not hostStorage — projected for the
      // "Known devices" admin surface (U3.4). Empty while loopback-only
      // (`wsServer` non-null but no LAN peers) or mid-rebind (null).
      const ids = wsServer?.connectedTokenIds();
      return { tokenIds: ids ? [...ids] : [] };
    }
    if (type === 'oh.daemon.tokens.mint') {
      // Mint in the host process so the persist shares this realm's
      // token-store mutex with HELLO validation (a surface's separate
      // mutex can't).
      try {
        const label = typeof message.label === 'string' ? message.label.trim() || undefined : undefined;
        const minted = await mintDaemonAuthToken({ label });
        return { ok: true, tokenId: minted.record.id, secret: minted.secret };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.daemon.tokens.revoke') {
      const tokenId = typeof message.tokenId === 'string' ? message.tokenId : '';
      if (!tokenId) return { ok: false, error: 'missing tokenId' };
      try {
        // Persist the revoke BEFORE evicting the live socket: a peer that
        // reconnects in the eviction window then re-validates against the
        // already-revoked ledger and is rejected, rather than slipping a
        // fresh connection past a not-yet-written revoke.
        await revokeDaemonAuthToken(tokenId);
        wsServer?.closePeersByTokenId(tokenId);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    const result = dispatchSyncRpc(message);
    if (result === null) {
      // Anything outside the sync+awareness channels — chrome.tabs,
      // chrome.identity, etc. — has no Node-host implementation.
      // Surface a clear error so the caller can degrade with intent
      // rather than hang waiting for a response.
      return {
        __error: `host: RPC '${String(message.type)}' is not implemented`,
      };
    }
    if (result.kind === 'sync') return result.response;
    return await result.promise;
  };

  // 6. WS server — the peers-as-clients pipe. The supervisor owns the
  //    bind lifecycle so the user-controlled `backend.bindAddress`
  //    setting can flip between loopback and LAN at runtime without a
  //    host restart (U3.1, `UNIFIED_ORACLE_MODEL.md` §4.2). Peers
  //    connect here on boot; the same `dispatchSyncRpc` routes their
  //    messages, and oracle broadcasts fan out to every connected peer.
  //    Failure to bind (another instance running, port held by something
  //    else) is logged but not fatal; the engine keeps serving local
  //    surfaces, and the supervisor retries on the next setting change.
  let bindSupervisor: DaemonBindSupervisor | null = null;
  // One long-lived reporter for the whole boot. It folds the supervisor's
  // bind lifecycle (binding / bound / failed) and the active server's peer
  // set into a single `sync` status entry, so a failed bind shows RED and
  // a healthy rebind shows a transient YELLOW rather than going silent.
  const syncStatusReporter: SyncStatusReporter = installSyncStatusReporter(status.report);
  try {
    bindSupervisor = await startDaemonBindSupervisor({
      handshakeIdentity: config.handshakeIdentity,
      httpRequestHandler: (req, res) =>
        healthzHandler(req, res) || pairingHttpHandler(req, res) || mcpInstall.handler(req, res),
      onServerChange: (next) => {
        wsServer = next;
        setMutationForwarderWsServer(next);
        if (next) syncStatusReporter.attachServer(next);
        else syncStatusReporter.detachServer();
      },
      onBindStateChange: (state) => {
        // Track the live port so the pairing surface hands out codes for
        // wherever the daemon is actually listening, not the default.
        if (state.kind === 'bound') boundPort = state.port;
        syncStatusReporter.setBindState(state);
      },
    });
  } catch (err) {
    consoleLogger.error(SCOPE, 'WS supervisor failed to start; continuing without the peer pipe', err);
  }

  // 7. Teardown — the host wires this to its shutdown signal (desktop:
  //    `before-quit`; headless daemon: SIGTERM).
  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    stopLiveRunner();
    stopActivityPruneScheduler();
    unsubscribeStatus();
    unsubscribeActivityEntries();
    unsubscribeMuteChanges();
    unsubscribeWorkspaceStore();
    status.clear();
    setMutationForwarderWsServer(null);
    setActivityLog(null);
    setActivityMuteStore(null);
    pairingService.dispose();
    mcpInstall.dispose();
    syncStatusReporter.dispose();
    await bindSupervisor?.dispose();
    bindSupervisor = null;
    wsServer = null;
    syncPersistence.close();
  };

  return { dispatchRpc, dispose };
}
