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
  createDaemonUser,
  deactivateDaemonUser,
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  getIdentitySnapshot,
  grantWorkspaceRole,
  listDaemonAuthTokens,
  listDaemonUsers,
  listWorkspaceRolesForPrincipal,
  mintDaemonAuthToken,
  refreshIdentitySnapshotFromHostStorage,
  resetAuditSink,
  revokeDaemonAuthToken,
  revokeWorkspaceRole,
  setAuditSink,
} from '@openheaders/core/identity';
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
import { setLockRuntime } from '@openheaders/oracle/coordination';
import { setBlobBackend } from '@openheaders/oracle/files';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';
import {
  type OracleAwarenessBroadcast,
  type OracleSyncBroadcastEvent,
  setActivityMuteStore,
  setOracleHostHooks,
  subscribeActivityMuteChanges,
} from '@openheaders/oracle/sync';
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
import { evictConsumedWorkspace } from '@openheaders/oracle/workspace/workspace-eviction';
import { FileSystemBlobBackend } from '../files/fs-blob-backend';
import { createPairingHttpHandler } from '../host-runtime/pairing-http';
import type { OracleWsServer, OracleWsServerOptions } from '../host-runtime/ws-server';
import { SqliteAuditLog } from '../sync/sqlite-audit-log';
import { createSqliteSyncPersistence } from '../sync/sqlite-sync-persistence';
import { observeForActivityFeed, setActivityLog, subscribeActivityEntries } from './activity-installer';
import { installActivityPruneScheduler } from './activity-prune-scheduler';
import { createAdmissionControl } from './admission-control';
import { installAuditPruneScheduler } from './audit-prune-scheduler';
import { createAwarenessPeerFanOut } from './awareness-fan-out';
import { type DaemonBindState, type DaemonBindSupervisor, startDaemonBindSupervisor } from './bind-supervisor';
import { createHealthzHandler } from './healthz';
import { listLanIpv4Addresses } from './lan-addresses';
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
  // Durable audit sink — every capability decision the resolver emits
  // (WS gates, MCP policy, outbound filter) lands as a queryable
  // `audit_log` row on the same handle. Append is fire-and-forget so
  // gate latency never waits on SQLite; a failed write is logged, and
  // the decision itself is unaffected either way.
  const auditLog = new SqliteAuditLog(syncPersistence.db);
  setAuditSink((entry) => {
    void auditLog.append(entry).catch((err: unknown) => {
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
  const oidcService: DaemonOidcService | null = config.oidc ? createDaemonOidcService(config.oidc) : null;
  const oidcHttpHandler =
    oidcService && config.oidc
      ? createOidcHttpHandler({
          service: oidcService,
          redirectOrigin: config.oidc.redirectOrigin,
          trustedProxy: config.admission?.trustedProxy,
        })
      : null;

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
    if (type === 'oh.daemon.pairing.start') {
      try {
        const deviceLabel =
          typeof message.deviceLabel === 'string' ? message.deviceLabel.trim() || undefined : undefined;
        const userId = typeof message.userId === 'string' ? message.userId.trim() || undefined : undefined;
        const { code, expiresAt } = pairingService.startPair({ deviceLabel, ...(userId ? { userId } : {}) });
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
        const userId = typeof message.userId === 'string' ? message.userId.trim() || undefined : undefined;
        const minted = await mintDaemonAuthToken({ label, ...(userId ? { userId } : {}) });
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
    if (type === 'oh.daemon.users.create') {
      const displayName = typeof message.displayName === 'string' ? message.displayName : '';
      const email = typeof message.email === 'string' ? message.email.trim() || undefined : undefined;
      try {
        const created = await createDaemonUser({ displayName, ...(email ? { email } : {}) });
        return created.ok ? { ok: true, userId: created.record.user.id } : { ok: false, error: created.reason };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.daemon.users.list') {
      const users = await listDaemonUsers();
      return {
        users: await Promise.all(
          users.map(async (r) => ({
            userId: r.user.id,
            displayName: r.user.displayName,
            email: r.userIdentity.kind === 'email' ? r.userIdentity.value : null,
            createdAt: r.createdAt,
            deactivatedAt: r.deactivatedAt,
            grants: (await listWorkspaceRolesForPrincipal(r.principal.id)).map((wra) => ({
              workspaceId: wra.workspaceId,
              role: wra.role,
            })),
          })),
        ),
      };
    }
    if (type === 'oh.daemon.users.grant') {
      const userId = typeof message.userId === 'string' ? message.userId : '';
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      const role = typeof message.role === 'string' ? message.role : '';
      if (!userId || !workspaceId) return { ok: false, error: 'missing userId or workspaceId' };
      if (role !== 'owner' && role !== 'editor' && role !== 'viewer') {
        return { ok: false, error: 'role must be owner, editor or viewer' };
      }
      const record = (await listDaemonUsers()).find((r) => r.user.id === userId);
      if (!record) return { ok: false, error: 'unknown user' };
      if (record.deactivatedAt !== null) return { ok: false, error: 'user is deactivated' };
      // Validate against the live workspace set — a grant for a
      // non-existent workspace would only be silently dropped by the
      // next WRA reconcile; refuse it up front instead.
      if (!getWorkspace(workspaceId)) return { ok: false, error: 'unknown workspace' };
      try {
        const result = await grantWorkspaceRole({ principalId: record.principal.id, workspaceId, role });
        return result.ok ? { ok: true, updated: result.updated } : { ok: false, error: result.reason };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.daemon.users.revokeGrant') {
      const userId = typeof message.userId === 'string' ? message.userId : '';
      const workspaceId = typeof message.workspaceId === 'string' ? message.workspaceId : '';
      if (!userId || !workspaceId) return { ok: false, error: 'missing userId or workspaceId' };
      const record = (await listDaemonUsers()).find((r) => r.user.id === userId);
      if (!record) return { ok: false, error: 'unknown user' };
      try {
        const result = await revokeWorkspaceRole(record.principal.id, workspaceId);
        return result.ok ? { ok: true } : { ok: false, error: result.reason };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    }
    if (type === 'oh.daemon.users.deactivate') {
      const userId = typeof message.userId === 'string' ? message.userId : '';
      if (!userId) return { ok: false, error: 'missing userId' };
      try {
        const result = await deactivateDaemonUser(userId);
        if (!result.ok) return { ok: false, error: result.reason };
        // Kill the user's access now, not on their next HELLO: revoke
        // every token bound to the user, then evict live peers riding
        // them — same persist-before-evict ordering as tokens.revoke.
        const tokens = await listDaemonAuthTokens();
        for (const token of tokens) {
          if (token.userId !== userId || token.revokedAt !== null) continue;
          await revokeDaemonAuthToken(token.id);
          wsServer?.closePeersByTokenId(token.id);
        }
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
      httpRequestHandler: admission.wrapHttpHandler(
        (req, res) =>
          healthzHandler(req, res) ||
          metricsHttpHandler(req, res) ||
          pairingHttpHandler(req, res) ||
          mcpInstall.handler(req, res) ||
          (oidcHttpHandler !== null && oidcHttpHandler(req, res)) ||
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
    resetAuditSink();
    unsubscribeStatus();
    unsubscribeActivityEntries();
    unsubscribeMuteChanges();
    unsubscribeWorkspaceStore();
    status.clear();
    setMutationForwarderWsServer(null);
    setActivityLog(null);
    setActivityMuteStore(null);
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
