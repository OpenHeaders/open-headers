/**
 * IDB-backed {@link SyncPersistenceProvider} factory.
 *
 * Browser hosts deep-import this module and install the result via
 * {@link setSyncPersistenceProvider} during boot. Splitting the IDB
 * default out of `sync-persistence-provider.ts` keeps the seam itself
 * host-neutral — only callers that actually want IDB pay the cost of
 * pulling the runtime classes into their bundle.
 *
 * Host-singleton guarantees (one shared instance per process) for
 * `PendingOutQueue` / `ActivityLog` / `ActivityMuteStore` are preserved
 * via closure-scoped lazies, matching the prior in-tree default.
 */

import { IdbActivityLog } from './idb-activity-log';
import { IdbActivityMuteStore } from './idb-activity-mute-store';
import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { IdbPendingOutQueue } from './idb-pending-out-queue';
import type { SyncPersistenceProvider } from './sync-persistence-provider';

export function createIdbSyncPersistenceProvider(): SyncPersistenceProvider {
  let pendingOut: IdbPendingOutQueue | null = null;
  let activityLog: IdbActivityLog | null = null;
  let activityMute: IdbActivityMuteStore | null = null;
  return {
    createMutationLog: (scope) => new IdbMutationLog(scope),
    createPendingIntents: (scope) => new IdbPendingIntents(scope),
    createPendingOutQueue: () => {
      if (!pendingOut) pendingOut = new IdbPendingOutQueue();
      return pendingOut;
    },
    createActivityLog: () => {
      if (!activityLog) activityLog = new IdbActivityLog();
      return activityLog;
    },
    createActivityMuteStore: () => {
      if (!activityMute) activityMute = new IdbActivityMuteStore();
      return activityMute;
    },
  };
}
