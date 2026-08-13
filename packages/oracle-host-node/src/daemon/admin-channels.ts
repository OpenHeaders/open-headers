/**
 * Daemon-admin RPC channels — one handler table for the `oh.daemon.*`
 * surface (pairing, tokens, users, grants, the admin probe), shared by
 * BOTH dispatch planes:
 *
 *   - the host-side `dispatchRpc` (desktop renderer over IPC, the
 *     daemon's own surfaces), where the caller IS the operator by
 *     construction — no gate;
 *   - the peer-facing WS plane (`peer-admin-rpc.ts`), which fronts the
 *     same table with a per-frame `daemon.admin` capability gate.
 *
 * One implementation, two admission postures — a handler change can
 * never drift between the local and remote admin surfaces.
 */

import {
  absorbPersonalSeat,
  createDaemonUser,
  type DaemonPairingService,
  deactivateDaemonUser,
  grantWorkspaceRole,
  listDaemonAuthTokens,
  listDaemonUsers,
  listWorkspaceRolesForPrincipal,
  mintDaemonAuthToken,
  revokeDaemonAuthToken,
  revokeWorkspaceRole,
  setDaemonUserGitEmail,
  setDaemonUserPassword,
  setDaemonUserWorkspaceCreate,
  WORKSPACE_CREATE_FUNCTIONAL_ROLE,
} from '@openheaders/core/identity';
import { verifyLicense } from '@openheaders/core/licensing';
import type { TelemetryDebugCommand, TelemetryDebugState, TelemetryStorageMethod } from '@openheaders/core/protocol';
import { isTelemetryStorageMethod } from '@openheaders/core/protocol';
import type { AuditLogEntry } from '@openheaders/core/types';
import { getWorkspace } from '@openheaders/oracle/workspace/extension-workspace-store';
import type { OracleWsServer } from '../host-runtime/ws-server';
import type { AuditQueryCursor, AuditQueryFilter } from '../sync/sqlite-audit-log';
import { projectArchivedSession, type TrafficSessionArchive, type TrafficTap } from '../traffic';
import type { CliProvisionService } from './cli-provision';
import { offerWorkspaceRowsToUserPeers } from './grant-workspace-offer';
import { listLanIpv4Addresses } from './lan-addresses';
import type { LicenseSlotHandle } from './license-slot';
import { hashPassword, PASSWORD_MIN_LENGTH } from './password/password-verifier';
import type { ProxyCaptureControl } from './proxy/proxy-capture-service';
import type { ProxyTrustService } from './proxy/proxy-trust';
import type { ProxyRoutingControl } from './proxy/routing-push';
import type { BrowserTelemetryPeerTabs } from './telemetry/browser-live-relay';

export { PASSWORD_MIN_LENGTH } from './password/password-verifier';

/** The admin-visibility probe channel — see `peer-admin-rpc.ts`. */
export const ADMIN_STATUS_CHANNEL = 'oh.daemon.admin.status';

/** `audit.query` page caps — a page rides one WS frame, so the limit is mandatory. */
export const AUDIT_QUERY_DEFAULT_LIMIT = 100;
export const AUDIT_QUERY_MAX_LIMIT = 500;

export interface AdminChannelDeps {
  pairing: DaemonPairingService;
  /** The port the WS server is actually bound on right now. */
  getBoundPort(): number;
  /**
   * This build's own release notes (`oh.daemon.changelog.get`): the
   * running server version and the `changelog/daemon` entry body the
   * daemon host embedded at build (CHANGELOG_PLAN.md §4.3) — null
   * notes = entry-less build, the admin card hides. Optional so
   * dispatch tables composed without it (the desktop host, test rigs)
   * answer an honest nothing instead of failing construction.
   */
  changelog?: { version: string; notes: string | null };
  /** Live server slot — null until the supervisor's first bind resolves. */
  getWsServer(): OracleWsServer | null;
  /**
   * Filtered read over the SQLite audit log (`queryAuditEntries` on the
   * spine's `oracle.db` handle) — the store's RPC projection, never a
   * second read path.
   */
  queryAudit(filter: AuditQueryFilter): AuditLogEntry[];
  /** The spine's license slot — the `oh.daemon.license.*` backing. */
  license: LicenseSlotHandle;
  /** The `oh.daemon.cli.*` backing — see `cli-provision.ts`. */
  cliProvision: CliProvisionService;
  /** The `oh.daemon.proxy.trust.*` backing — see `proxy/proxy-trust.ts`. */
  proxyTrust: ProxyTrustService;
  /** The `oh.daemon.proxy.{status,start,stop,scope.*}` backing — see
   *  `proxy/proxy-capture-service.ts`. */
  proxyCapture: ProxyCaptureControl;
  /** The `oh.daemon.proxy.routing.*` backing — the §5.1 scoped
   *  browser-routing controller. Optional so dispatch tables composed
   *  without the WS push plane (test rigs) answer an inert projection
   *  instead of failing construction. */
  proxyRouting?: ProxyRoutingControl;
  /** The `oh.daemon.telemetry.tabs.list` backing — the browser live-
   *  telemetry relay's per-peer tab inventory. Optional so dispatch
   *  tables composed without the relay (test rigs) answer an empty
   *  inventory instead of failing construction. */
  telemetryTabs?(): Promise<{ peers: BrowserTelemetryPeerTabs[] }>;
  /** The `oh.daemon.telemetry.debug.control` backing — one Debug-mode
   *  command relayed to the named extension peer. Optional as above. */
  telemetryDebugControl?(nodeId: string, command: TelemetryDebugCommand): Promise<TelemetryDebugState | null>;
  /** The `oh.daemon.telemetry.storage.call` backing — one storage
   *  bridge verb relayed to the named extension peer (Phase 3 storage
   *  plane, reads and writes). Optional as above. */
  telemetryStorageCall?(
    nodeId: string,
    method: TelemetryStorageMethod,
    params: unknown,
  ): Promise<{ ok: boolean; payload: unknown }>;
  /**
   * The `oh.daemon.traffic.*` backing — the agent-traffic tap's
   * operator-plane arm/disarm/status/records controls
   * (AGENT_TRAFFIC_PLAN.md §8 S1/S2). Status is content-free counters;
   * `records` answers REDACTED projections only (the projection-layer
   * law makes anything else unrepresentable). Optional so dispatch
   * tables composed without the tap (test rigs) answer an empty source
   * list instead of failing construction.
   */
  trafficTap?: TrafficTap;
  /**
   * The `oh.daemon.traffic.sessions.*` backing — the sessions
   * archive's index reads and organize/delete verbs (§11.1 the
   * Sessions tool window). Human/operator plane only, like the capture
   * verbs: no MCP mirror exists. Optional so dispatch tables composed
   * without an archive answer an empty archive instead of failing
   * construction.
   */
  trafficArchive?: TrafficSessionArchive;
  /**
   * The `oh.daemon.workspaceTree.dispatch` backing — the spine's
   * shared `oh.workspaceTree.*` verb table, so the admin console's
   * Git card drives the daemon's bindings over the wire through the
   * exact dispatch the local operator surface uses.
   */
  workspaceTreeDispatch(type: string, message: Record<string, unknown>): Promise<unknown>;
}

export type AdminChannelHandler = (message: Record<string, unknown>) => Promise<unknown> | unknown;

function parseAuditCursor(value: unknown): AuditQueryCursor | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as { occurredAt?: unknown; orgId?: unknown; seq?: unknown };
  if (
    typeof candidate.occurredAt !== 'string' ||
    typeof candidate.orgId !== 'string' ||
    typeof candidate.seq !== 'number' ||
    !Number.isInteger(candidate.seq)
  ) {
    return undefined;
  }
  return { occurredAt: candidate.occurredAt, orgId: candidate.orgId, seq: candidate.seq };
}

function isTelemetryDebugCommand(value: unknown): value is TelemetryDebugCommand {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { kind?: unknown; tabId?: unknown; pinned?: unknown; enabled?: unknown };
  if (candidate.kind === 'pin') return typeof candidate.tabId === 'number' && typeof candidate.pinned === 'boolean';
  if (candidate.kind === 'enable') return typeof candidate.enabled === 'boolean';
  return false;
}

/**
 * Build the `oh.daemon.*` handler table. Handlers answer in-band
 * `{ ok: false, error }` shapes on domain refusals (unknown user, bad
 * role, …) — the transport-level uniform deny for ungated peers lives
 * in the peer plane, not here.
 */
export function createAdminChannelHandlers(deps: AdminChannelDeps): ReadonlyMap<string, AdminChannelHandler> {
  const { pairing } = deps;
  const handlers = new Map<string, AdminChannelHandler>();

  // Visibility probe. This table is only ever dispatched for an
  // admitted admin subject: local surfaces are the operator by
  // construction, and the peer plane answers the probe from its own
  // capability resolution before reaching the table. So `true` here is
  // a fact, not a bypass.
  handlers.set(ADMIN_STATUS_CHANNEL, () => ({ admin: true }));

  // This build's own release notes — served rather than fetched (the
  // browser never dials the feed, CHANGELOG_PLAN.md §4.3). Null notes
  // (entry-less build, or a host that embeds none) hide the card.
  handlers.set('oh.daemon.changelog.get', () => ({
    version: deps.changelog?.version ?? null,
    notes: deps.changelog?.notes ?? null,
  }));

  handlers.set('oh.daemon.pairing.start', (message) => {
    try {
      const deviceLabel = typeof message.deviceLabel === 'string' ? message.deviceLabel.trim() || undefined : undefined;
      const userId = typeof message.userId === 'string' ? message.userId.trim() || undefined : undefined;
      const { code, expiresAt } = pairing.startPair({ deviceLabel, ...(userId ? { userId } : {}) });
      const boundPort = deps.getBoundPort();
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
  });

  handlers.set('oh.daemon.pairing.list', () => ({
    pairs: pairing.list().map((p) => ({
      code: p.code,
      deviceLabel: p.deviceLabel,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      status: p.status,
    })),
  }));

  handlers.set('oh.daemon.pairing.cancel', (message) => {
    const code = typeof message.code === 'string' ? message.code : '';
    if (code) pairing.cancel(code);
    return { ok: true };
  });

  handlers.set('oh.daemon.tokens.connected', () => {
    // Live ws-server state, not hostStorage — projected for the
    // "Known devices" admin surface (U3.4). Empty while loopback-only
    // (`wsServer` non-null but no LAN peers) or mid-rebind (null).
    const ids = deps.getWsServer()?.connectedTokenIds();
    return { tokenIds: ids ? [...ids] : [] };
  });

  handlers.set('oh.daemon.tokens.list', async () => {
    // Ledger projection minus the secret hash — revoked rows included
    // so admin surfaces keep the forensic view.
    const tokens = await listDaemonAuthTokens();
    return {
      tokens: tokens.map((t) => ({
        id: t.id,
        label: t.label,
        userId: t.userId,
        kind: t.kind,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
        revokedAt: t.revokedAt,
      })),
    };
  });

  handlers.set('oh.daemon.tokens.mint', async (message) => {
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
  });

  handlers.set('oh.daemon.tokens.revoke', async (message) => {
    const tokenId = typeof message.tokenId === 'string' ? message.tokenId : '';
    if (!tokenId) return { ok: false, error: 'missing tokenId' };
    try {
      // Persist the revoke BEFORE evicting the live socket: a peer that
      // reconnects in the eviction window then re-validates against the
      // already-revoked ledger and is rejected, rather than slipping a
      // fresh connection past a not-yet-written revoke.
      await revokeDaemonAuthToken(tokenId);
      deps.getWsServer()?.closePeersByTokenId(tokenId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // CLI provisioning (`oh.daemon.cli.*`) — status is derived live per
  // call, provision mints + writes host-side; the secret never crosses
  // the contract. Both delegate to the spine's provision service so the
  // ledger writes ride the same realm as every other token mutation.
  handlers.set('oh.daemon.cli.status', async () => await deps.cliProvision.status());

  handlers.set('oh.daemon.cli.provision', async () => {
    try {
      return await deps.cliProvision.provision();
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Proxy trust plane (`oh.daemon.proxy.trust.*`) — CA lifecycle for
  // the host capture plane. Status probes live per call; install is
  // the consent wizard's commit step (explicit store list, never
  // "all"); remove is the teardown law. The CA private key never
  // crosses these contracts — responses carry the public projection
  // and per-store outcomes only.
  handlers.set('oh.daemon.proxy.trust.status', async () => await deps.proxyTrust.status());

  handlers.set('oh.daemon.proxy.trust.install', async (message) => {
    const stores = Array.isArray(message.stores)
      ? message.stores.filter(
          (s): s is 'macos-login-keychain' | 'macos-system-keychain' | 'nss-firefox' =>
            s === 'macos-login-keychain' || s === 'macos-system-keychain' || s === 'nss-firefox',
        )
      : [];
    if (stores.length === 0) return { ok: false, error: 'missing stores' };
    try {
      return await deps.proxyTrust.install(stores);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.proxy.trust.remove', async (message) => {
    try {
      return await deps.proxyTrust.remove(message.dropCa === true);
    } catch (err) {
      return { ok: false, results: [], error: (err as Error).message };
    }
  });

  // Privileged-helper management — the Settings card's registration
  // surface. Read state is derived live per call; register/unregister
  // drive the helper's own client verbs and never touch a trust store.
  handlers.set('oh.daemon.proxy.trust.helper', async () => await deps.proxyTrust.helperState());

  handlers.set('oh.daemon.proxy.trust.helperRegister', async () => {
    try {
      return await deps.proxyTrust.helperRegister();
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.proxy.trust.helperUnregister', async () => {
    try {
      return await deps.proxyTrust.helperUnregister();
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.proxy.trust.helperLoginItems', async () => {
    try {
      return await deps.proxyTrust.helperOpenLoginItems();
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Proxy capture plane (`oh.daemon.proxy.*` sans `.trust`) — the L7
  // capture proxy's control surface. Status is re-derived live per call;
  // start/stop drive the bind; scope.set replaces the §2.4 decrypt list
  // (validated — an invalid pattern refuses the whole edit). Captures
  // themselves ride the lifecycle lifeline, never these contracts.
  handlers.set('oh.daemon.proxy.status', async () => await deps.proxyCapture.status());

  handlers.set('oh.daemon.proxy.start', async (message) => {
    const port = typeof message.port === 'number' ? message.port : undefined;
    try {
      return await deps.proxyCapture.start(port);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.proxy.stop', async () => {
    try {
      return await deps.proxyCapture.stop();
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.proxy.scope.set', async (message) => {
    const patterns = Array.isArray(message.patterns)
      ? message.patterns.filter((p): p is string => typeof p === 'string')
      : null;
    if (patterns === null) return { ok: false, error: 'missing patterns' };
    try {
      return await deps.proxyCapture.setScope(patterns);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Scoped browser routing (§5.1) — the persisted desire flip and the
  // live projection. Pushes to browser peers ride the routing
  // controller's own change subscription, never this table.
  handlers.set('oh.daemon.proxy.routing.set', async (message) => {
    if (typeof message.enabled !== 'boolean') return { ok: false, error: 'missing enabled' };
    if (!deps.proxyRouting) return { ok: false, error: 'routing control unavailable' };
    try {
      return await deps.proxyRouting.setEnabled(message.enabled);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set(
    'oh.daemon.proxy.routing.status',
    async () => (await deps.proxyRouting?.status()) ?? { enabled: false, active: false, peers: [] },
  );

  // Browser telemetry plane — the Live Network picker's tab inventory,
  // gathered live per call from every answering extension peer. The
  // lifecycle streams themselves never ride this table.
  handlers.set('oh.daemon.telemetry.tabs.list', async () => (await deps.telemetryTabs?.()) ?? { peers: [] });

  // One Debug-mode control command (pin a tab / flip the master switch)
  // relayed to the named extension peer — the Traffic Monitor's per-tab
  // fidelity affordance. `debug: null` = peer absent or never answered.
  handlers.set('oh.daemon.telemetry.debug.control', async (message) => {
    if (typeof message.nodeId !== 'string' || message.nodeId.length === 0) return { ok: false, debug: null };
    if (!isTelemetryDebugCommand(message.command)) return { ok: false, debug: null };
    const debug = (await deps.telemetryDebugControl?.(message.nodeId, message.command)) ?? null;
    return { ok: debug !== null, debug };
  });

  // One storage bridge verb (read or write) relayed to the named
  // extension peer — the Traffic Monitor's Storage pane. `method` is
  // gated on the storage whitelist here too, so a console/source-map
  // verb never reaches the relay regardless of caller.
  handlers.set('oh.daemon.telemetry.storage.call', async (message) => {
    if (typeof message.nodeId !== 'string' || message.nodeId.length === 0) return { ok: false, payload: null };
    if (!isTelemetryStorageMethod(message.method)) return { ok: false, payload: null };
    return (
      (await deps.telemetryStorageCall?.(message.nodeId, message.method, message.params)) ?? {
        ok: false,
        payload: null,
      }
    );
  });

  // Agent-traffic tap — operator-plane arming of retention sources
  // (S1) and, since S2, the operator read of REDACTED projections
  // (`records`). Status stays content-free counters; the records read
  // crosses the projection boundary, so redaction is structural — the
  // raw record type cannot ride this table. Agent-facing exposure is
  // the `observe` MCP tier (S3 tools), never these channels.
  handlers.set('oh.daemon.traffic.arm', async (message) => {
    if (!deps.trafficTap) return { ok: false, error: 'traffic tap unavailable' };
    const bounds = {
      ...(typeof message.maxRecords === 'number' ? { maxRecords: Math.floor(message.maxRecords) } : {}),
      ...(typeof message.maxBytes === 'number' ? { maxBytes: Math.floor(message.maxBytes) } : {}),
    };
    const options = {
      bounds,
      ...(typeof message.ttlMs === 'number' && message.ttlMs > 0 ? { ttlMs: Math.floor(message.ttlMs) } : {}),
    };
    if (message.kind === 'proxy') {
      return { ok: true, uid: deps.trafficTap.armProxy(options) };
    }
    if (message.kind === 'browser-tab') {
      if (typeof message.nodeId !== 'string' || message.nodeId.length === 0 || typeof message.tabId !== 'number') {
        return { ok: false, error: 'missing nodeId or tabId' };
      }
      // Human source label: the tab's title (fallback its URL) from the
      // telemetry inventory — the machine coordinates stay the tap's
      // own fallback when no peer answers in time.
      let label: string | undefined;
      try {
        const inventory = await deps.telemetryTabs?.();
        const tab = inventory?.peers
          .find((peer) => peer.nodeId === message.nodeId)
          ?.tabs.find((candidate) => candidate.tabId === message.tabId);
        label = (tab?.title.trim() || tab?.url.trim()) ?? undefined;
      } catch {
        // Inventory unavailable — the coordinate fallback stands.
      }
      const uid = deps.trafficTap.armBrowserTab(message.nodeId, message.tabId, {
        ...options,
        ...(label !== undefined && label.length > 0 ? { label } : {}),
      });
      if (uid === null) return { ok: false, error: 'arm refused — relay unavailable' };
      return { ok: true, uid };
    }
    return { ok: false, error: 'kind must be browser-tab or proxy' };
  });

  handlers.set('oh.daemon.traffic.disarm', (message) => {
    if (!deps.trafficTap) return { ok: false, error: 'traffic tap unavailable' };
    const uid = typeof message.uid === 'string' ? message.uid : '';
    if (!uid) return { ok: false, error: 'missing uid' };
    return { ok: deps.trafficTap.disarm(uid) };
  });

  handlers.set('oh.daemon.traffic.status', () => ({ sources: deps.trafficTap?.status() ?? [] }));

  handlers.set('oh.daemon.traffic.records', (message) => {
    if (!deps.trafficTap) return { records: null };
    const uid = typeof message.uid === 'string' ? message.uid : '';
    if (!uid) return { records: null };
    // Unarmed = absent: an unknown uid answers null, indistinguishable
    // from a uid that never existed (PLAN §4).
    return { records: deps.trafficTap.records(uid) };
  });

  // Capture sessions (S7, rebuilt on the §11 archive in C3) — the disk
  // tier's HUMAN plane. These three channels have no MCP mirror by
  // design: an agent may see that a source is capturing
  // (traffic_sources marker) but can never start, stop, or steer one.
  // The start gesture IS the durable-capture consent (§11.5) — the
  // session records the raw event log; redaction is applied at read
  // time by every consumer-facing projection.
  handlers.set('oh.daemon.traffic.capture.start', (message) => {
    if (!deps.trafficTap) return { ok: false, error: 'traffic tap unavailable' };
    const uid = typeof message.uid === 'string' ? message.uid : '';
    if (!uid) return { ok: false, error: 'missing uid' };
    // A blank name is accepted: the recorder stamps the dominant site
    // at seal — the caller passes a name only when it knows a better
    // one (a browser tab's title at the capture gesture).
    const name = typeof message.name === 'string' ? message.name.trim() : '';
    const bounds = {
      ...(typeof message.maxBytes === 'number' && message.maxBytes > 0
        ? { maxBytes: Math.floor(message.maxBytes) }
        : {}),
      ...(typeof message.maxDurationMs === 'number' && message.maxDurationMs > 0
        ? { maxDurationMs: Math.floor(message.maxDurationMs) }
        : {}),
    };
    const result = deps.trafficTap.captureStart(uid, { name, bounds });
    if (!result.ok) {
      const errors: Record<typeof result.reason, string> = {
        'unknown-source': `no armed source with uid '${uid}' — an unarmed or expired source is absent`,
        'capture-active': 'a capture session is already recording this source — stop it first',
        'capture-unavailable':
          'capture is unavailable on this host (no sessions archive or the session directory could not be created)',
      };
      return { ok: false, error: errors[result.reason] };
    }
    return { ok: true, session: result.session };
  });

  handlers.set('oh.daemon.traffic.capture.stop', (message) => {
    if (!deps.trafficTap) return { ok: true, session: null };
    const uid = typeof message.uid === 'string' ? message.uid : '';
    // Idempotent by contract: nothing capturing (or an unknown uid —
    // indistinguishable, absence semantics) answers session null.
    return { ok: true, session: uid ? deps.trafficTap.captureStop(uid) : null };
  });

  handlers.set('oh.daemon.traffic.capture.status', () => ({
    sessions: deps.trafficTap?.captureSessions() ?? [],
  }));

  // Sessions archive (§11.1, C5) — the Sessions tool window's index
  // read and organize/delete verbs over the meta index. Human plane
  // like the capture verbs above: no MCP mirror; agent session reads
  // arrive only with the C7 tier, redacted.
  handlers.set('oh.daemon.traffic.sessions.list', async () => {
    if (!deps.trafficArchive) return { sessions: [] };
    const rows = await deps.trafficArchive.listSessions();
    return { sessions: rows.map((row) => projectArchivedSession(row.id, row.meta)) };
  });

  handlers.set('oh.daemon.traffic.sessions.delete', async (message) => {
    if (!deps.trafficArchive) return { ok: false, error: 'sessions archive unavailable' };
    const id = typeof message.id === 'string' ? message.id : '';
    if (!id) return { ok: false, error: 'missing id' };
    return deps.trafficArchive.deleteSession(id);
  });

  handlers.set('oh.daemon.traffic.sessions.organize', async (message) => {
    if (!deps.trafficArchive) return { ok: false, error: 'sessions archive unavailable' };
    const id = typeof message.id === 'string' ? message.id : '';
    if (!id) return { ok: false, error: 'missing id' };
    return deps.trafficArchive.organizeSession(id, {
      ...(typeof message.name === 'string' ? { name: message.name } : {}),
      ...(typeof message.collection === 'string' || message.collection === null
        ? { collection: message.collection }
        : {}),
      ...(typeof message.folder === 'string' || message.folder === null ? { folder: message.folder } : {}),
    });
  });

  handlers.set('oh.daemon.users.create', async (message) => {
    const displayName = typeof message.displayName === 'string' ? message.displayName : '';
    const email = typeof message.email === 'string' ? message.email.trim() || undefined : undefined;
    try {
      const personalLicense =
        typeof message.personalLicense === 'string' ? message.personalLicense.trim() || undefined : undefined;
      const created = await createDaemonUser({
        displayName,
        ...(email ? { email } : {}),
        ...(personalLicense ? { personalLicense } : {}),
      });
      if (created.ok) return { ok: true, userId: created.record.user.id };
      if (created.reason === 'seat-limit-reached') {
        return {
          ok: false,
          reason: created.reason,
          error:
            `seat limit reached (${created.seatLimit} active users) — deactivate a user to free a seat, ` +
            "add seats via a license, or redeem the joining user's individual seat",
        };
      }
      if (created.reason === 'personal-license-identity-mismatch') {
        return {
          ok: false,
          reason: created.reason,
          error: 'the individual seat belongs to a different email — it only admits its holder',
        };
      }
      if (created.reason === 'personal-license-invalid') {
        return {
          ok: false,
          reason: created.reason,
          error: 'the individual-seat key is not usable (invalid, expired, or not an individual seat)',
        };
      }
      if (created.reason === 'personal-license-no-identity') {
        return {
          ok: false,
          reason: created.reason,
          error: 'an individual seat needs the user email to match — set an email for the new user',
        };
      }
      if (created.reason === 'personal-seats-disabled') {
        return { ok: false, reason: created.reason, error: 'individual-seat redemption is disabled on this daemon' };
      }
      return { ok: false, reason: created.reason, error: created.reason };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.list', async () => {
    const users = await listDaemonUsers();
    return {
      users: await Promise.all(
        users.map(async (r) => ({
          userId: r.user.id,
          displayName: r.user.displayName,
          email: r.userIdentity.kind === 'email' ? r.userIdentity.value : null,
          gitEmail: r.gitEmail ?? null,
          createdAt: r.createdAt,
          deactivatedAt: r.deactivatedAt,
          hasPassword: r.passwordVerifier !== undefined,
          mayCreateWorkspaces: r.membership.functionalRoles.includes(WORKSPACE_CREATE_FUNCTIONAL_ROLE),
          // Seat provenance — status derived at consume by verifying
          // the stored artifact (never cached); an expired personal
          // seat stays visible here but never evicts its user.
          ...(r.admission === undefined
            ? {}
            : {
                admission: {
                  licenseId: r.admission.licenseId,
                  status: (await verifyLicense(r.admission.licenseKey, new Date())).status,
                },
              }),
          grants: (await listWorkspaceRolesForPrincipal(r.principal.id)).map((wra) => ({
            workspaceId: wra.workspaceId,
            role: wra.role,
            ...(wra.origin !== undefined ? { origin: wra.origin } : {}),
          })),
        })),
      ),
    };
  });

  handlers.set('oh.daemon.users.setGitEmail', async (message) => {
    const userId = typeof message.userId === 'string' ? message.userId : '';
    if (!userId) return { ok: false, error: 'missing userId' };
    const gitEmail = typeof message.gitEmail === 'string' ? message.gitEmail : null;
    const result = await setDaemonUserGitEmail(userId, gitEmail);
    if (!result.ok) {
      return { ok: false, error: result.reason === 'unknown-user' ? 'unknown user' : 'user is deactivated' };
    }
    return { ok: true };
  });

  // The admin console's Git card (GIT_PLAN.md §11.5) — every
  // `oh.workspaceTree.*` gesture rides this one channel as
  // `{ op, ...payload }`, delegating to the spine's shared verb table.
  // Non-tree ops refuse up front; host-only verbs (the native folder
  // picker) answer the table's own not-implemented shape.
  handlers.set('oh.daemon.workspaceTree.dispatch', async (message) => {
    const op = typeof message.op === 'string' ? message.op : '';
    if (!op.startsWith('oh.workspaceTree.')) return { ok: false, error: 'unknown workspace-tree op' };
    const payload = typeof message.payload === 'object' && message.payload !== null ? message.payload : {};
    return await deps.workspaceTreeDispatch(op, payload as Record<string, unknown>);
  });

  handlers.set('oh.daemon.users.absorbSeat', async (message) => {
    // Org buy-out: fold a personally-admitted user into the seat pool.
    // Only meaningful when pool capacity exists — the gate never
    // re-checks existing users, so absorbing past capacity just moves
    // the provenance; refusing that here would add a check the model
    // deliberately doesn't have.
    const userId = typeof message.userId === 'string' ? message.userId : '';
    if (!userId) return { ok: false, error: 'missing userId' };
    const result = await absorbPersonalSeat(userId);
    if (!result.ok) {
      return {
        ok: false,
        error: result.reason === 'not-personal' ? 'user holds a pool seat already' : 'unknown user',
      };
    }
    return { ok: true };
  });

  handlers.set('oh.daemon.users.grant', async (message) => {
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
      if (!result.ok) return { ok: false, error: result.reason };
      // Zero-grant landing (slice 3): the granted user's already-open
      // tabs learn the workspace now, not on their next reconnect.
      await offerWorkspaceRowsToUserPeers(record.user.id, [workspaceId], deps.getWsServer);
      return { ok: true, updated: result.updated };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.revokeGrant', async (message) => {
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
  });

  handlers.set('oh.daemon.users.setCreateWorkspaces', async (message) => {
    const userId = typeof message.userId === 'string' ? message.userId : '';
    if (!userId) return { ok: false, error: 'missing userId' };
    if (typeof message.allowed !== 'boolean') return { ok: false, error: 'missing allowed flag' };
    try {
      const result = await setDaemonUserWorkspaceCreate(userId, message.allowed);
      if (!result.ok) {
        return { ok: false, error: result.reason === 'user-deactivated' ? 'user is deactivated' : 'unknown user' };
      }
      return { ok: true, updated: result.updated };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.setPassword', async (message) => {
    const userId = typeof message.userId === 'string' ? message.userId : '';
    if (!userId) return { ok: false, error: 'missing userId' };
    const password = message.password === null ? null : typeof message.password === 'string' ? message.password : '';
    if (password !== null && password.length < PASSWORD_MIN_LENGTH) {
      return { ok: false, error: `password must be at least ${PASSWORD_MIN_LENGTH} characters` };
    }
    try {
      // The verifier is computed host-side (scrypt); core stores the
      // opaque string. `null` clears the credential — the user keeps
      // any live sessions, they just can't password-login anew.
      const verifier = password === null ? null : await hashPassword(password);
      const result = await setDaemonUserPassword(userId, verifier);
      return result.ok ? { ok: true } : { ok: false, error: result.reason };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.users.deactivate', async (message) => {
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
        deps.getWsServer()?.closePeersByTokenId(token.id);
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.license.status', () => ({ snapshot: deps.license.getSnapshot() }));

  handlers.set('oh.daemon.license.install', async (message) => {
    const text = typeof message.text === 'string' ? message.text : '';
    if (!text.trim()) return { ok: false, error: 'missing license text' };
    try {
      return await deps.license.install(text);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  });

  handlers.set('oh.daemon.license.remove', async () => await deps.license.remove());

  handlers.set('oh.daemon.audit.query', (message) => {
    // Read projection of the SQLite audit log. The page limit is
    // mandatory-with-default: a response rides one WS frame, so an
    // unbounded query must not be expressible over the wire. One extra
    // row is fetched to decide whether a next page exists; the cursor
    // is the last returned row's full sort key (keyset pagination — no
    // loss or repeats across pages sharing a timestamp).
    const filter: AuditQueryFilter = {};
    if (typeof message.actorUserId === 'string' && message.actorUserId) filter.actorUserId = message.actorUserId;
    if (typeof message.capability === 'string' && message.capability) filter.capability = message.capability;
    if (typeof message.allow === 'boolean') filter.allow = message.allow;
    if (typeof message.workspaceId === 'string' && message.workspaceId) filter.workspaceId = message.workspaceId;
    if (typeof message.sinceIso === 'string' && message.sinceIso) filter.sinceIso = message.sinceIso;
    if (typeof message.untilIso === 'string' && message.untilIso) filter.untilIso = message.untilIso;
    if (message.order === 'asc' || message.order === 'desc') filter.order = message.order;
    const after = parseAuditCursor(message.after);
    if (after) filter.after = after;
    const requested =
      typeof message.limit === 'number' && Number.isFinite(message.limit)
        ? Math.floor(message.limit)
        : AUDIT_QUERY_DEFAULT_LIMIT;
    const limit = Math.min(Math.max(requested, 1), AUDIT_QUERY_MAX_LIMIT);
    const rows = deps.queryAudit({ ...filter, limit: limit + 1 });
    const entries = rows.slice(0, limit);
    const last = entries[entries.length - 1];
    const nextCursor =
      rows.length > limit && last ? { occurredAt: last.occurredAt, orgId: last.orgId, seq: last.seq } : null;
    return { entries, nextCursor };
  });

  return handlers;
}
