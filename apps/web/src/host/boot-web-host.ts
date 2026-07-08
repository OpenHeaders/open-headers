/**
 * Web host boot — the tab-oracle analog of the daemon boot spine, run
 * once before the Workbench mounts (the entry module awaits it, so
 * every mirror seed and capability probe lands on a live engine).
 *
 * The tab is a full local-first host: origin-scoped IDB persistence
 * (host storage, sync stores, blobs, audit), synthetic identity, and
 * the same host-neutral boot sequence every other distribution runs —
 * bootstrap workspaces → role assignments → identity snapshot →
 * Org resolver → hydrate stores → sync engine. What it deliberately
 * lacks in this phase is a wire: the WS join to the serving daemon is
 * Phase 4b's second slice, layered on the seams installed here.
 *
 * Lock runtime stays the default `navigator.locks` browser runtime;
 * no cipher is installed, so sensitive slots (vault, oauth) refuse to
 * persist — same posture as the headless daemon.
 */

import {
  ensureSyntheticIdentity,
  ensureWorkspaceRoleAssignments,
  getIdentitySnapshot,
  refreshIdentitySnapshotFromHostStorage,
  setAuditSink,
  setPinnedBackendIds,
} from '@openheaders/core/identity';
import { hostLogger as logger } from '@openheaders/core/logger';
import { hostStorage, OH } from '@openheaders/core/storage';
import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  invalidateAllWorkspaceOrgCache,
  setWorkspaceOrgResolver,
} from '@openheaders/core/sync';
import { setBlobBackend } from '@openheaders/oracle/files';
import { bootSyncEngine } from '@openheaders/oracle/host-runtime';
import {
  hasRecentlyApplied,
  setActivityMuteStore,
  setOracleHostHooks,
  setOutboundEchoGuard,
  setOutboundReachGuard,
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
import { IdbBlobBackend } from '@openheaders/oracle-host-browser/files/idb-blob-backend';
import { IdbAuditLog } from '@openheaders/oracle-host-browser/sync/idb-audit-log';
import { createIdbSyncPersistenceProvider } from '@openheaders/oracle-host-browser/sync/idb-sync-persistence';
import { getStatusSnapshot, report, subscribe as subscribeStatus } from '@openheaders/ui/shared/status';
import { hydrateDaemonToken } from './daemon-token';
import { WEB_DAEMON_BACKEND_ID } from './web-backend-id';
import { broadcastLocal } from './web-broadcast';
import { isServedOriginLoopback } from './wire-inbound';
import { forwardAwarenessOverWire, forwardMutationOverWire, setWirePendingOutQueue } from './wire-outbound';

const SCOPE = 'boot-web-host';

export async function bootWebHost(): Promise<void> {
  // 1. Cross-host seams. Logger, host storage, bridge, and lifeline
  //    are installed by the import-time `install-*` modules the entry
  //    file loads first; here come the oracle-facing backends.
  setBlobBackend(new IdbBlobBackend());
  const syncPersistence = createIdbSyncPersistenceProvider();
  setSyncPersistenceProvider(syncPersistence);
  setActivityMuteStore(syncPersistence.createActivityMuteStore?.() ?? null);

  // Single-wire seams (Phase 4b B2). The serving daemon is the tab's
  // one backend, present by construction — pin its fixed id so joined
  // Orgs fold without an `OH.backends` record (that slot is sensitive
  // and this cipher-less host refuses it). Echo guard pairs with the
  // inbound bridge's seen-set; the reach guard keeps same-device-only
  // mutations off a non-loopback daemon's wire (no vault can be minted
  // here yet, but the floor is the law, not the current entity set).
  setPinnedBackendIds([WEB_DAEMON_BACKEND_ID]);
  setOutboundEchoGuard(hasRecentlyApplied);
  setOutboundReachGuard(() => !isServedOriginLoopback());
  setWirePendingOutQueue(syncPersistence.createPendingOutQueue?.() ?? null);
  await hydrateDaemonToken();

  // U1.6 / U1.7 — materialize the synthetic identity-row tuple before
  // any privileged-path code runs. Idempotent across boots; failures
  // are logged, not fatal — the resolver denies privileged actions
  // while the snapshot is absent and the next boot re-runs this.
  await ensureSyntheticIdentity({ hostKind: 'browser', orgName: 'Web' }).catch((err: unknown) => {
    logger.warn(SCOPE, 'ensureSyntheticIdentity failed', err);
  });

  const auditLog = new IdbAuditLog();
  setAuditSink((entry) => {
    void auditLog
      .append({
        orgId: entry.orgId,
        actorUserId: entry.actorUserId,
        capability: entry.capability,
        ...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
        decision: entry.decision,
        occurredAt: entry.occurredAt,
      })
      .catch((err: unknown) => {
        logger.warn(SCOPE, 'audit log append failed', err);
      });
  });

  // 2. Oracle host hooks. The tab has no rule engine and no resolver
  //    cache to invalidate; every optional hook the oracle calls
  //    degrades gracefully when absent. Broadcasts fan out to the
  //    in-tab surfaces AND up the single wire — the outbound gate
  //    inside the forwarder decides what may cross.
  setOracleHostHooks({
    getActiveWorkspaceId,
    peekActiveWorkspaceId,
    broadcastSyncEvent: (event) => {
      broadcastLocal('syncBroadcast', event);
      forwardMutationOverWire(event);
    },
    broadcastAwareness: (event) => {
      broadcastLocal('awarenessBroadcast', event);
      forwardAwarenessOverWire(event);
    },
    reportStatus: (entry) =>
      report({
        subsystem: entry.subsystem as Parameters<typeof report>[0]['subsystem'],
        state: entry.state,
        message: entry.message,
        context: entry.context,
      }),
  });

  // 3. Boot sequence — workspace bootstrap, identity reconcile,
  //    Org resolver, hydrate active workspace, init sync engine.
  await bootstrapWorkspaces();
  await ensureWorkspaceRoleAssignments(listWorkspaces().map((ws) => ws.id)).catch((err: unknown) => {
    logger.warn(SCOPE, 'ensureWorkspaceRoleAssignments failed', err);
  });
  await refreshIdentitySnapshotFromHostStorage().catch((err: unknown) => {
    logger.warn(SCOPE, 'refreshIdentitySnapshotFromHostStorage failed', err);
  });
  hostStorage.subscribe(OH.syntheticIdentity, () => {
    void refreshIdentitySnapshotFromHostStorage().catch((err: unknown) => {
      logger.warn(SCOPE, 'identity snapshot refresh failed', err);
    });
  });
  setWorkspaceOrgResolver((workspaceId) => {
    const snapshot = getIdentitySnapshot();
    if (workspaceId === EXTENSION_WORKSPACE_GLOBAL_SCOPE) {
      return snapshot?.user.homeOrgId;
    }
    return getWorkspace(workspaceId)?.orgId ?? snapshot?.user.homeOrgId;
  });
  onWorkspaceStoreChange(() => {
    void ensureWorkspaceRoleAssignments(listWorkspaces().map((ws) => ws.id))
      .then(() => refreshIdentitySnapshotFromHostStorage())
      .catch((err: unknown) => {
        logger.warn(SCOPE, 'ensureWorkspaceRoleAssignments reconcile failed', err);
      });
    invalidateAllWorkspaceOrgCache();
  });
  await hydrateActiveWorkspaceStores();
  await bootSyncEngine();

  // 4. Status snapshot fan-out — surfaces mirror the shared store via
  //    the `statusUpdated` broadcast, same channel as every host.
  subscribeStatus((snapshot) => {
    broadcastLocal('statusUpdated', snapshot);
  });
  broadcastLocal('statusUpdated', getStatusSnapshot());
}
