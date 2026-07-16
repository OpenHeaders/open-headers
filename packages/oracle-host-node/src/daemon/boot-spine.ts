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
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  setAuditSink,
} from '@openheaders/core/identity';
import { setLicenseSnapshotProvider, setPersonalSeatRedemptionProvider } from '@openheaders/core/licensing';
import { setHostLogger } from '@openheaders/core/logger';
import type { AwarenessState } from '@openheaders/core/protocol';
import { WS_PORT } from '@openheaders/core/protocol';
import type { HostStorage } from '@openheaders/core/storage';
import { setHostStorage } from '@openheaders/core/storage';
import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  invalidateAllWorkspaceOrgCache,
  setWorkspaceOrgResolver,
} from '@openheaders/core/sync';
import type { HostKind } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  buildWorkspaceExport,
  type EncryptVaultBlockResult,
  encryptVaultBlock,
  serializeWorkspaceExport,
} from '@openheaders/core/workspace-export';
import { setLockRuntime } from '@openheaders/oracle/coordination';
import {
  clearPendingScriptsReview,
  getPendingScriptsReview,
} from '@openheaders/oracle/entity/request-scripts-review-store';
import { setBlobBackend } from '@openheaders/oracle/files';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { stopActiveSend } from '@openheaders/oracle/live/request-exec/send-stream';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import {
  type OracleAwarenessBroadcast,
  type OracleSyncBroadcastEvent,
  setActivityMuteStore,
  setOracleHostHooks,
  subscribeActivityMuteChanges,
} from '@openheaders/oracle/sync';
import { setSyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';
import { type ExportGatherScope, gatherWorkspaceExport } from '@openheaders/oracle/workspace/export-gatherer';
import {
  bootstrap as bootstrapWorkspaces,
  getActiveWorkspaceId,
  getWorkspace,
  listWorkspaces,
  onWorkspaceStoreChange,
  peekActiveWorkspaceId,
} from '@openheaders/oracle/workspace/extension-workspace-store';
import { findExportImportMatches } from '@openheaders/oracle/workspace/import-dedup';
import {
  type ImportWorkspaceArgs,
  importWorkspace,
  previewWorkspaceImport,
} from '@openheaders/oracle/workspace/import-orchestrator';
import { hydrateActiveWorkspaceStores } from '@openheaders/oracle/workspace/workspace-coordinator';
import { evictConsumedWorkspace } from '@openheaders/oracle/workspace/workspace-eviction';
import { FileSystemBlobBackend } from '../files/fs-blob-backend';
import { createPairingHttpHandler } from '../host-runtime/pairing-http';
import type { OracleWsServer, OracleWsServerOptions } from '../host-runtime/ws-server';
import { peekCookieJar } from '../live/cookie-jar';
import { queryAuditEntries, SqliteAuditLog } from '../sync/sqlite-audit-log';
import { createSqliteSyncPersistence } from '../sync/sqlite-sync-persistence';
import { observeForActivityFeed, setActivityLog, subscribeActivityEntries } from './activity-installer';
import { installActivityPruneScheduler } from './activity-prune-scheduler';
import { createAdminChannelHandlers } from './admin-channels';
import { createAdmissionControl } from './admission-control';
import { type DaemonAuditForwardingConfig, installAuditForwarder } from './audit-forwarder';
import { installAuditPruneScheduler } from './audit-prune-scheduler';
import { createAwarenessPeerFanOut } from './awareness-fan-out';
import { type DaemonBindState, type DaemonBindSupervisor, startDaemonBindSupervisor } from './bind-supervisor';
import { composePeerRpc } from './compose-peer-rpc';
import { handleExecuteGrpcRequestRpc } from './execute-grpc-request-rpc';
import { handleExecuteRequestRpc } from './execute-request-rpc';
import { offerWorkspaceRowsToUserPeers } from './grant-workspace-offer';
import { createHealthzHandler } from './healthz';
import { detectNodeHostOs } from './host-os';
import { installLicenseRefreshAgent } from './license-refresh-agent';
import { installLicenseSlot } from './license-slot';
import { startLiveRunner, stopLiveRunner } from './live/live-refresh-scheduler';
import { installMcpServer } from './mcp-install';
import { createMdnsAdvertiser } from './mdns/mdns-advertiser';
import { createMetricsProvider } from './metrics';
import { createMetricsHttpHandler } from './metrics-http';
import { forwardMutationToWsPeers, setMutationForwarderWsServer } from './mutation-forwarder';
import { installObservabilityLog, type ObservabilityLogHandle } from './observability-log';
import type { DaemonOidcConfig } from './oidc/oidc-config';
import { createOidcHttpHandler } from './oidc/oidc-http';
import { createDaemonOidcService, type DaemonOidcService } from './oidc/oidc-service';
import { createPasswordHttpHandler } from './password/password-http';
import { createDaemonPasswordLoginService } from './password/password-login-service';
import { createPeerAdminRpc } from './peer-admin-rpc';
import { createPeerRequestsRpc } from './peer-requests-rpc';
import { singleProcessLockRuntime } from './single-process-lock-runtime';
import { createStaticWebHandler } from './static-web';
import type { SpineStatusReporter, SpineStatusStore } from './status-seam';
import { installSyncStatusReporter, type SyncStatusReporter } from './sync-status-reporter';

const SCOPE = 'boot-spine';

// Pairing service's global unknown-code budget when a trusted proxy
// fronts the daemon (S30 finding d) — sized so it only trips on a
// distributed sweep that outruns admission's strict per-peer pairing
// tier, not on a handful of rotating WAN addresses. Default (50)
// applies on loopback/LAN where the global-by-design rationale holds.
const TRUSTED_PROXY_PAIRING_GLOBAL_BUDGET = 250;

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
  /**
   * Optional outbound seam for a host that is ALSO a client of daemon
   * backends (MULTI_BACKEND_PLAN.md §5): every committed envelope is
   * offered to the client plane's forwarder, whose own gates (echo,
   * consumed-Org tenancy, Org→backend routing) decide whether anything
   * leaves. The desktop passes the shared mutation forwarder; the
   * headless daemon omits it.
   */
  forwardMutationToBackends?: (event: OracleSyncBroadcastEvent) => void;
  /**
   * Optional awareness sibling of `forwardMutationToBackends`: every
   * awareness emission is offered to the client plane's forwarder,
   * whose own appId filter and Org→backend routing decide whether a
   * presence frame leaves for a joined daemon. The desktop passes the
   * shared awareness forwarder; the headless daemon omits it.
   */
  forwardAwarenessToBackends?: (event: OracleAwarenessBroadcast) => void;
  /**
   * Optional sink for the spine's server-side `sync` reporter (bind
   * lifecycle + peer set). Defaults to `status.report`. A host that is
   * ALSO a client of daemon backends routes this into the client
   * plane's baseline slot (`reportBaselineSyncStatus`) so the server
   * entry and the per-backend client slots compose worst-of in one
   * aggregate instead of racing the subsystem latest-wins.
   */
  reportSyncStatus?: SpineStatusReporter;
  /**
   * WAN-hardening posture (Phase 3). Absent = defaults: no trusted
   * proxy, no extra allowed hosts — the matrix still admits IP
   * literals, `localhost`, and `*.local`, which covers every direct
   * loopback/LAN deployment (the desktop host passes nothing).
   */
  admission?: {
    /** A trusted reverse proxy fronts the bind — peer identity comes from `X-Forwarded-For`. */
    trustedProxy?: boolean;
    /** Hostnames the daemon answers as (a reverse-proxy domain, an intranet name). */
    allowedHosts?: readonly string[];
  };
  /**
   * Serve the Workbench web bundle from this directory on the composed
   * bind (Phase 4a) — `/` + assets, composed after every claimed route.
   * Absent = no static route; unclaimed paths keep the 400 fallback.
   */
  /**
   * OIDC/SSO login (Phase 5 slice 3). Absent = no `/auth/oidc/*` routes;
   * the token/pairing paths are unaffected either way — SSO is only an
   * additional way to mint a session credential.
   */
  oidc?: DaemonOidcConfig;
  /**
   * Audit-log retention window in days (UNIFIED_ORACLE_MODEL.md §9.1).
   * Absent = 90. One knob for every entry regardless of actor type.
   */
  auditRetentionDays?: number;
  /**
   * Audit→SIEM streaming (enterprise Phase 4d). Absent = the daemon's
   * zero-outbound posture holds unchanged; configured = the process's
   * ONE deliberate outbound plane, a durable-cursor forwarder POSTing
   * audit rows to the operator's collector.
   */
  auditForwarding?: DaemonAuditForwardingConfig;
  /**
   * License file location override (LICENSING_PLAN.md §3.3). Absent =
   * `<dataDir>/license.key`, which covers the desktop (userData) and
   * the default daemon deployment; the daemon's `OH_LICENSE_FILE` /
   * `licenseFile` config lands here. The trust ring is deliberately
   * NOT configurable — it is compiled into `@openheaders/core/licensing`.
   */
  licenseFilePath?: string;
  /**
   * Self-serve renewal loop (LICENSING_PLAN.md §3.2). `false` disables
   * the refresh agent entirely (air-gapped posture by config); absent =
   * enabled — the agent still stands down on its own when no license is
   * installed or the artifact carries `offline: true`.
   */
  licenseRefresh?: boolean;
  /**
   * Personal-seat redemption knob (procurement control): `false`
   * refuses personal licenses at the seat gate with a typed reason;
   * absent = allowed. Desktop passes nothing — the operator is the
   * admin, so redemption stays open there.
   */
  personalSeats?: boolean;
  staticWeb?: {
    rootDir: string;
    /**
     * Live serving gate, consulted per request alongside the admission
     * matrix's `web` posture. Absent = always on (the standalone
     * daemon's static config). The desktop passes its
     * `backend.serveWebApp` setting here so the toggle takes effect
     * without an app restart, exactly like the bind settings.
     */
    enabled?: () => boolean;
  };
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
  const bootedAtMs = Date.now();

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

  // Last bind lifecycle event — the metrics surface reports it verbatim
  // (binding / bound / failed) alongside the live peer counts.
  let lastBindState: DaemonBindState | null = null;

  // Same-user awareness fan-out (Phase 5 slice 2) — per-peer tailored
  // frames under the §9 law, same queue discipline as the mutation
  // forwarder's, against the same live server slot.
  const awarenessFanOut = createAwarenessPeerFanOut(() => wsServer);

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
  // `hostOs` re-stamps on every boot (machine-derived); it rides the
  // home Org row into WELCOME so joiners render this server's OS mark.
  await ensureSyntheticIdentity({ ...config.identity, hostOs: detectNodeHostOs() }).catch((err: unknown) => {
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
  // Durable audit sink — every capability decision the resolver emits
  // (WS gates, MCP policy, outbound filter) lands as a queryable
  // `audit_log` row on the same handle. Append is fire-and-forget so
  // gate latency never waits on SQLite; a failed write is logged, and
  // the decision itself is unaffected either way.
  const auditLog = new SqliteAuditLog(syncPersistence.db);
  // Phase 4d SIEM streaming — the one deliberate outbound plane, and
  // only when the operator configured a collector. The sink nudges it
  // after each committed row so delivery is near-real-time; the
  // forwarder's own heartbeat covers retries and boot backlog.
  const auditForwarder = config.auditForwarding
    ? installAuditForwarder({ db: syncPersistence.db, config: config.auditForwarding })
    : null;
  setAuditSink((entry) => {
    void auditLog
      .append(entry)
      .then(() => auditForwarder?.wake())
      .catch((err: unknown) => {
        consoleLogger.warn(SCOPE, 'audit log append failed', err);
      });
  });
  // §9.1 retention — hourly sweep drops rows older than the window.
  const stopAuditPruneScheduler = installAuditPruneScheduler({
    db: syncPersistence.db,
    ...(config.auditRetentionDays !== undefined ? { retentionDays: config.auditRetentionDays } : {}),
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
      config.forwardMutationToBackends?.(event);
      observeForActivityFeed(event);
    },
    broadcastAwareness: (event) => {
      // Local surfaces in this process: legacy channel for the
      // existing awareness mirror (`packages/ui/src/context/
      // awareness-mirror.ts` subscribes to `awarenessBroadcast`).
      broadcastLocal('awarenessBroadcast', event);
      // Cross-host: the whole canonical set goes to the same-user
      // fan-out, which tailors it per recipient (§9 law) — this is
      // what relays one user's presence between their devices. The
      // host's own surfaces belong to the operator, so they are
      // stamped with the operator's userId here; peer-received states
      // were stamped at ingest and pass through. States never gain a
      // `deviceId` on this path — only ingest stamps it — so the
      // fan-out's echo exclusion cannot misfire on host-own rows. The
      // event other consumers see is never mutated.
      const operatorUserId = getIdentitySnapshot()?.user.id;
      const stampedPresence = event.presence.map((s: AwarenessState) =>
        s.identity.appId === config.localAppId && s.identity.userId === undefined && operatorUserId !== undefined
          ? { ...s, identity: { ...s.identity, userId: operatorUserId } }
          : s,
      );
      awarenessFanOut.enqueue(event.workspaceId, stampedPresence);
      // Client role (MULTI_BACKEND_PLAN.md §5): the same emission is
      // offered to the backend forwarder, which applies its own appId
      // filter and routes by the workspace's Org binding.
      config.forwardAwarenessToBackends?.(event);
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

  // 4a'. Phase-3 admission — one Origin/Host matrix + brute-force
  //      limiter for every plane on the composed bind. Wraps the HTTP
  //      chain below and gates WS upgrades through the supervisor.
  const staticWebConfig = config.staticWeb;
  const staticWebEnabled = (): boolean => staticWebConfig !== undefined && (staticWebConfig.enabled?.() ?? true);
  const admission = createAdmissionControl({
    trustedProxy: config.admission?.trustedProxy,
    allowedHosts: config.admission?.allowedHosts,
    webEnabled: staticWebEnabled,
    oidcEnabled: config.oidc !== undefined,
    passwordEnabled: config.oidc === undefined,
  });

  // 4b. Daemon device-flow pairing surface (U3.3). One service instance
  //     per process; the HTTP handler is rebuilt with that service and
  //     handed to every bind the supervisor opens. Polling-only local
  //     contract — see `BridgeRpcContract['oh.daemon.pairing.*']`.
  //     Under trustedProxy the service's global brute-force budget is
  //     raised (S30 finding d): admission's strict per-peer pairing
  //     tier caps each WAN address at 5 guesses per 30-minute block,
  //     so tripping the raised global takes a ≥50-address-per-minute
  //     distributed sweep — where failing closed is the right answer —
  //     instead of a handful of rotating addresses denying pairing to
  //     everyone. Loopback/LAN keeps the service defaults.
  const pairingService = createDaemonPairingService(
    config.admission?.trustedProxy ? { maxFailedLookups: TRUSTED_PROXY_PAIRING_GLOBAL_BUDGET } : {},
  );
  const pairingHttpHandler = createPairingHttpHandler({ pairing: pairingService });

  // 4b''. Daemon-admin channel table (pairing/tokens/users/grants + the
  //       admin probe) — ONE implementation for both admission postures:
  //       the local `dispatchRpc` below (the caller is the operator by
  //       construction) and the WS peer plane (per-frame `daemon.admin`
  //       gate + audit in `peer-admin-rpc.ts`), wired into the server
  //       via the supervisor's `peerRpc` seam.
  // License slot (LICENSING_PLAN.md §3.3) — load/verify/watch the
  // host's license file; snapshot changes fan out on `licenseUpdated`
  // the same way `statusUpdated` rides. Slice 3's seat gate reads the
  // same handle.
  const licenseSlot = await installLicenseSlot({
    filePath: config.licenseFilePath ?? path.join(config.dataDir, 'license.key'),
    broadcast: (snapshot) => broadcastLocal('licenseUpdated', snapshot),
  });
  // The seat gate in `createDaemonUser` derives its limit from this
  // provider at every admission — never a cached number.
  setLicenseSnapshotProvider(() => licenseSlot.getSnapshot());
  // Personal-seat procurement knob — consulted by the gate's personal
  // branch on every at-capacity admission.
  setPersonalSeatRedemptionProvider(() => config.personalSeats !== false);
  // Self-serve renewal loop (§3.2) — periodically swaps a fresh signed
  // file in through the slot. Config-off covers air-gapped posture;
  // the agent's own gates cover no-license and `offline: true` files.
  const licenseRefreshAgent =
    config.licenseRefresh === false
      ? null
      : installLicenseRefreshAgent({ slot: licenseSlot, appVersion: config.appVersion });

  const adminChannels = createAdminChannelHandlers({
    pairing: pairingService,
    getBoundPort: () => boundPort,
    getWsServer: () => wsServer,
    // The audit RPC reads the same `oracle.db` handle the sink above
    // writes — the store's one read path, projected over the wire.
    queryAudit: (filter) => queryAuditEntries(syncPersistence.db, filter),
    license: licenseSlot,
  });

  // 4b'. `/healthz` — unauthenticated, data-free liveness for ops
  //      probes (DAEMON_PLAN.md §3). First in the composition below so a
  //      probe never touches the pairing/MCP routing.
  const healthzHandler = createHealthzHandler();

  // 4c. MCP endpoint (`/mcp`, MCP_SERVER_PLAN.md Phase 1). Read-tier
  //     tools over stateless streamable HTTP, gated by the `mcp.enabled`
  //     setting (default off) + a paired daemon token per request. Rides
  //     the same bound socket as pairing via handler composition below.
  const mcpInstall = await installMcpServer({
    serverVersion: config.appVersion,
    resolvePeer: admission.resolvePeer,
  });

  // 4c'. `/metrics` (Phase 6) — token-gated JSON snapshot of operational
  //      state: bind lifecycle, peer counts, status subsystems, and row
  //      counts on the shared SQLite handle. Read-only by construction;
  //      the CLI's `status --verbose` is its first consumer.
  const metricsHttpHandler = createMetricsHttpHandler({
    provider: createMetricsProvider({
      db: syncPersistence.db,
      appVersion: config.appVersion,
      bootedAtMs,
      getStatusSnapshot: () => status.getSnapshot(),
      getWsServer: () => wsServer,
      getBindState: () => lastBindState,
      listWorkspaceIds: () => listWorkspaces().map((ws) => ws.id),
    }),
    resolvePeer: admission.resolvePeer,
  });

  // 4c''. OIDC login routes (Phase 5 slice 3) — `/auth/oidc/*`, active
  //       only when a provider is configured. Composed BEFORE the static
  //       handler so the SPA fallback never serves HTML under an auth
  //       path.
  const oidcService: DaemonOidcService | null = config.oidc
    ? createDaemonOidcService(config.oidc, {
        // Shared grant re-fan-out seam — the same offer the manual
        // admin grant rides, here fed by the IdP claims reconcile.
        offerGrantedWorkspaces: (userId, workspaceIds) =>
          offerWorkspaceRowsToUserPeers(userId, workspaceIds, () => wsServer),
      })
    : null;
  const oidcHttpHandler =
    oidcService && config.oidc
      ? createOidcHttpHandler({
          service: oidcService,
          redirectOrigin: config.oidc.redirectOrigin,
          trustedProxy: config.admission?.trustedProxy,
        })
      : null;

  // 4c''''. Local password login (enterprise Phase 3) — `/auth/password/*`,
  //         composed ONLY when no OIDC provider is configured: password
  //         is the no-IdP deployment's login story, never an SSO bypass.
  //         Same session-kind mint the SSO flow terminates in.
  const passwordHttpHandler =
    config.oidc === undefined ? createPasswordHttpHandler({ service: createDaemonPasswordLoginService() }) : null;

  // 4c'''. Static web bundle (Phase 4a) — the Workbench front door,
  //      composed LAST so every claimed route (healthz, pairing, mcp)
  //      wins its path first. Absent config = no route; the 400
  //      fallback keeps answering unclaimed paths.
  const staticWebHandler = staticWebConfig ? createStaticWebHandler({ rootDir: staticWebConfig.rootDir }) : null;

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
    // Host-local eviction of one consumed workspace (Discard on a
    // removed backend, MULTI_BACKEND_STATUS.md S11) — no synced delete,
    // and it must run host-side: it purges IDB/SQLite log stripes and
    // per-workspace services the surface can't reach. Same channel the
    // extension SW serves; the shared remove flow calls it blind.
    if (type === 'evictWorkspace') {
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      if (!workspaceId) return { success: false, error: 'missing workspaceId' };
      try {
        const result = await evictConsumedWorkspace(workspaceId);
        return result.ok ? { success: true } : { success: false, error: result.reason };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
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
    // Cookie-jar inspection — the jar registry lives in this process
    // (the transport stores per-workspace session cookies in memory),
    // so this host answers the summary/clear/delete channels directly. The
    // summary is value-free by construction (`CookieJar.list`); an
    // unspecified workspace resolves to the active one, matching the
    // jar key an unpinned send runs under.
    if (type === 'getCookieJarSummary') {
      const workspaceId =
        typeof message.workspaceId === 'string' ? message.workspaceId : (getActiveWorkspaceId() ?? 'default');
      return { cookies: peekCookieJar(workspaceId)?.list() ?? [] };
    }
    if (type === 'clearCookieJar') {
      const workspaceId =
        typeof message.workspaceId === 'string' ? message.workspaceId : (getActiveWorkspaceId() ?? 'default');
      peekCookieJar(workspaceId)?.clear();
      return { success: true };
    }
    if (type === 'deleteCookieJarEntry') {
      const workspaceId =
        typeof message.workspaceId === 'string' ? message.workspaceId : (getActiveWorkspaceId() ?? 'default');
      if (typeof message.name === 'string' && typeof message.domain === 'string' && typeof message.path === 'string') {
        peekCookieJar(workspaceId)?.delete(message.name, message.domain, message.path);
      }
      return { success: true };
    }
    // Workbench Send — the node host's user-facing request execution,
    // answered in-process where the transport (and its cookie jar)
    // lives. Same channel contract the extension SW handles.
    if (type === 'executeRequest') {
      return await handleExecuteRequestRpc(message);
    }
    // Workbench gRPC Invoke — the GrpcRequest entity's executor plane,
    // same in-process answer posture as executeRequest above.
    if (type === 'executeGrpcRequest') {
      return await handleExecuteGrpcRequestRpc(message);
    }
    // Stop an in-flight interactive send by its caller-minted id — the
    // host-neutral active-send registry the executor registered into.
    // `success: false` = no such send (already settled, never started).
    if (type === 'abortRequestSend') {
      return { success: typeof message.sendId === 'string' && stopActiveSend(message.sendId) };
    }
    // Workspace-export import — the host-neutral orchestrator (the
    // extension SW answers the same channels). Local surface = the
    // operator by construction, like executeRequest above; the shared
    // import UI drives these through the host bridge.
    if (type === 'previewWorkspaceImport') {
      try {
        const res = await previewWorkspaceImport({
          incoming: message.incoming as ImportWorkspaceArgs['incoming'],
          target: message.target as ImportWorkspaceArgs['target'],
          backupRestore: message.backupRestore as boolean | undefined,
        });
        return {
          success: true,
          diff: res.diff,
          missingDeps: res.missingDeps,
          snapshotHash: res.snapshotHash,
          targetWorkspaceId: res.targetWorkspaceId,
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    if (type === 'importWorkspace') {
      try {
        const res = await importWorkspace({
          incoming: message.incoming as ImportWorkspaceArgs['incoming'],
          strategies: message.strategies as ImportWorkspaceArgs['strategies'],
          backupRestore: message.backupRestore as boolean | undefined,
          trustExport: message.trustExport as boolean | undefined,
          stripScripts: message.stripScripts as boolean | undefined,
          omitOAuthConfigs: message.omitOAuthConfigs as boolean | undefined,
          keepTargetCollectionOrder: message.keepTargetCollectionOrder as boolean | undefined,
          refuseUidCollision: message.refuseUidCollision as boolean | undefined,
          target: message.target as ImportWorkspaceArgs['target'],
          sourceHash: message.sourceHash as string,
        });
        return { success: true, report: res.report, targetWorkspaceId: res.targetWorkspaceId };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    if (type === 'getLastImportedSnapshots') {
      try {
        const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
        const snapshots =
          ((await hostStorage.get(wsKeys(workspaceId).lastImportedSnapshots)) as Record<string, string> | undefined) ??
          {};
        return { snapshots };
      } catch {
        return { snapshots: {} };
      }
    }
    // Workspace export — the host-neutral gatherer + core's pure
    // builder, same channel the extension SW answers. Source stamps
    // honestly per distribution: the desktop main process is
    // desktop/electron; the headless daemon is daemon/node.
    if (type === 'exportWorkspace') {
      const wsId = typeof message.workspaceId === 'string' ? message.workspaceId : getActiveWorkspaceId();
      const scope = message.scope as ExportGatherScope;
      const vaultMode = (message.vaultMode as 'omitted' | 'encrypted' | 'plaintext' | undefined) ?? 'omitted';
      const passphrase = message.passphrase as string | undefined;
      const passphraseHint = message.passphraseHint as string | undefined;
      try {
        const res = await gatherWorkspaceExport(wsId, scope, {
          app: config.identity.hostKind === 'desktop' ? 'desktop' : 'daemon',
          appVersion: config.appVersion,
          platform: config.identity.hostKind === 'desktop' ? 'electron' : 'node',
        });
        if (!res) return { success: false, error: 'Workspace or rule not found' };
        let secretsBlock: EncryptVaultBlockResult | undefined;
        if (vaultMode === 'encrypted') {
          if (!passphrase) return { success: false, error: 'Encrypted vault export requires a passphrase' };
          const vaultSecrets = res.input.entities.vault?.secrets ?? [];
          secretsBlock = await encryptVaultBlock(vaultSecrets, passphrase, {
            ...(passphraseHint ? { hint: passphraseHint } : {}),
          });
        }
        const envelope = buildWorkspaceExport(res.input, {
          vaultMode,
          ...(secretsBlock ? { secretsBlock: secretsBlock.block } : {}),
        });
        const yaml = serializeWorkspaceExport(envelope);
        return {
          success: true,
          yaml,
          exportId: envelope.exportId,
          scope: envelope.scope,
          ...(secretsBlock
            ? {
                ciphertextFingerprint: secretsBlock.ciphertextFingerprint,
                keyFingerprint: secretsBlock.keyFingerprint,
              }
            : {}),
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
    // Soft-dedup banner for the import preview — pure cross-workspace
    // read over the per-workspace import-report rings.
    if (type === 'findWorkspaceExportImportMatches') {
      try {
        return await findExportImportMatches({
          exportId: message.exportId as string,
          workspaceUid: message.workspaceUid as string,
          currentTargetWorkspaceId: message.currentTargetWorkspaceId as string | null,
        });
      } catch {
        return { exportIdSameTarget: [], exportIdOtherTargets: [], workspaceUidMatches: [] };
      }
    }
    // Imported-scripts review badge — reads/acks the active workspace's
    // pending set (hydrated by `hydrateActiveWorkspaceStores`).
    if (type === 'getRequestScriptsReviewPending') {
      try {
        return { uids: Array.from(getPendingScriptsReview()) };
      } catch {
        return { uids: [] };
      }
    }
    if (type === 'clearRequestScriptsReviewPending') {
      try {
        await clearPendingScriptsReview(message.uid as string);
        return { success: true };
      } catch {
        return { success: false };
      }
    }
    // Daemon-admin channels (pairing/tokens/users/grants + the admin
    // probe) — the shared table built above. The local caller is the
    // operator by construction; WS peers reach the SAME table through
    // the gated peer plane wired into the supervisor below.
    const adminHandler = typeof type === 'string' ? adminChannels.get(type) : undefined;
    if (adminHandler) {
      return await adminHandler(message);
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
  // Phase 6 discovery — advertise the daemon as `_openheaders._tcp` via
  // mDNS, but only while the bind is LAN-exposed: a loopback-only
  // daemon advertised on the LAN would point peers at a port they can't
  // reach. Driven from the bind lifecycle below so the advertisement
  // follows every rebind (and withdraws on a failed one). Link-local
  // multicast only — the zero-outbound posture holds.
  const mdnsAdvertiser = createMdnsAdvertiser({ textEntries: [`v=${config.appVersion}`] });
  // One long-lived reporter for the whole boot. It folds the supervisor's
  // bind lifecycle (binding / bound / failed) and the active server's peer
  // set into a single `sync` status entry, so a failed bind shows RED and
  // a healthy rebind shows a transient YELLOW rather than going silent.
  const syncStatusReporter: SyncStatusReporter = installSyncStatusReporter(config.reportSyncStatus ?? status.report);
  try {
    bindSupervisor = await startDaemonBindSupervisor({
      handshakeIdentity: config.handshakeIdentity,
      peerRpc: composePeerRpc(createPeerAdminRpc({ channels: adminChannels }), createPeerRequestsRpc()),
      httpRequestHandler: admission.wrapHttpHandler(
        (req, res) =>
          healthzHandler(req, res) ||
          metricsHttpHandler(req, res) ||
          pairingHttpHandler(req, res) ||
          mcpInstall.handler(req, res) ||
          (oidcHttpHandler !== null && oidcHttpHandler(req, res)) ||
          (passwordHttpHandler !== null && passwordHttpHandler(req, res)) ||
          (staticWebHandler !== null && staticWebEnabled() ? staticWebHandler(req, res) : false),
      ),
      admission: admission.wsHooks,
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
        lastBindState = state;
        syncStatusReporter.setBindState(state);
        mdnsAdvertiser.setAdvertisedPort(state.kind === 'bound' && state.host === '0.0.0.0' ? state.port : null);
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
    stopAuditPruneScheduler();
    auditForwarder?.stop();
    resetAuditSink();
    unsubscribeStatus();
    unsubscribeActivityEntries();
    unsubscribeMuteChanges();
    unsubscribeWorkspaceStore();
    status.clear();
    setMutationForwarderWsServer(null);
    setActivityLog(null);
    setActivityMuteStore(null);
    setLicenseSnapshotProvider(null);
    setPersonalSeatRedemptionProvider(null);
    licenseRefreshAgent?.dispose();
    licenseSlot.dispose();
    pairingService.dispose();
    oidcService?.dispose();
    mcpInstall.dispose();
    syncStatusReporter.dispose();
    await mdnsAdvertiser.dispose();
    await bindSupervisor?.dispose();
    bindSupervisor = null;
    wsServer = null;
    syncPersistence.close();
  };

  return { dispatchRpc, dispose };
}
