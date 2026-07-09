import { setLockObserver } from '@openheaders/oracle/coordination';
import { setBlobBackend } from '@openheaders/oracle/files';
import {
  hasRecentlyApplied,
  setActivityMuteStore,
  setOutboundEchoGuard,
  setOutboundReachGuard,
} from '@openheaders/oracle/sync';
import { setPendingOutQueue } from '@openheaders/oracle/sync/client/mutation-forwarder';
import {
  getSyncPersistenceProvider,
  setSyncPersistenceProvider,
} from '@openheaders/oracle/sync/sync-persistence-provider';
import { IdbBlobBackend } from '@openheaders/oracle-host-browser/files/idb-blob-backend';
import { createIdbSyncPersistenceProvider } from '@openheaders/oracle-host-browser/sync/idb-sync-persistence';
import { installActivityPruneScheduler } from '../activity-prune-scheduler';
import { isOrgBackendOffDevice } from '../backend-target';
import { recordLog } from '../modules/observability-log';
import { listWorkspaces } from '../modules/workspace/workspace-store';
import { setActivityLog } from '../sync-activity-installer';

// Wires the host-side adapters every other subsystem depends on. MUST run
// before any oracle / sync code: setBlobBackend in particular gates every
// blob read via a throw-on-missing guard, and the sync persistence
// provider supplies the IDB-backed durable stores at oracle boot.
export function installHostAdapters(): void {
  setBlobBackend(new IdbBlobBackend());
  setSyncPersistenceProvider(createIdbSyncPersistenceProvider());

  // Echo guard pairs with the inbound bridge's SEEN_MUTATION_IDS so the
  // outbound gate skips re-broadcasting envelopes the backend just sent us.
  setOutboundEchoGuard(hasRecentlyApplied);

  // Reach guard (WS-B B1): never push a same-device-only mutation (vault
  // root secret) up to a non-loopback backend. A loopback backend is the
  // same device, where vault crossing is sanctioned. Per-Org — the
  // envelope routes to the backend its Org is bound to.
  setOutboundReachGuard(isOrgBackendOffDevice);

  const pendingOutQueue = getSyncPersistenceProvider().createPendingOutQueue?.() ?? null;
  setPendingOutQueue(pendingOutQueue);

  const activityLog = getSyncPersistenceProvider().createActivityLog?.() ?? null;
  setActivityLog(activityLog);

  installActivityPruneScheduler({
    getLog: () => activityLog,
    listWorkspaceIds: () => listWorkspaces().map((ws) => ws.id),
  });

  setActivityMuteStore(getSyncPersistenceProvider().createActivityMuteStore?.() ?? null);

  // Lock observer is installed at module-load so any pre-init `withLock`
  // call still routes events to the (buffered) observability ring.
  setLockObserver(recordLog);
}
