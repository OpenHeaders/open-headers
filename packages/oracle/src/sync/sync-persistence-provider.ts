/**
 * Sync-persistence provider — the install seam for the oracle's durable
 * stores ({@link MutationLog} + {@link PendingIntents}).
 *
 * Both stores are scoped by a string key (a workspace id, or the
 * `__global__` sentinel) and the oracle materializes one pair per scope
 * on sync-service init. The concrete backend is platform-specific:
 *
 *   - **Browser extension** — IndexedDB (`IdbMutationLog` /
 *     `IdbPendingIntents`). This is the shipped default, so the
 *     extension and every test that boots a sync service need no
 *     install call.
 *   - **Electron desktop** — a Node-backed store (file / SQLite),
 *     installed once at main-process boot via
 *     {@link setSyncPersistenceProvider}. `indexedDB` does not exist in
 *     a Node context, so the IDB default cannot run there.
 *   - **Tests** — drive in-memory stores directly through the sync
 *     service's `__init…ForTests` deps; they never touch this seam.
 *
 * Mirrors the `setLockRuntime` install seam in `coordination/with-lock`:
 * the browser default ships inline, hosts that need a different backend
 * swap it at boot.
 */

import { IdbMutationLog } from './idb-mutation-log';
import { IdbPendingIntents } from './idb-pending-intents';
import { IdbPendingOutQueue } from './idb-pending-out-queue';
import type { MutationLog } from './mutation-log';
import type { PendingIntents } from './pending-intents';
import type { PendingOutQueue } from './pending-out-queue';

/**
 * The contract a host's durable-store backend must satisfy. The oracle
 * only ever calls these factories — it never imports a concrete store
 * class on the production path.
 */
export interface SyncPersistenceProvider {
  /** Build the append-only mutation log for `scope`. */
  createMutationLog(scope: string): MutationLog;
  /** Build the pending side-effect intents store for `scope`. */
  createPendingIntents(scope: string): PendingIntents;
  /**
   * Build the pending-out queue (Phase C C13/C14). Host-singleton —
   * NOT per-workspace. The queue keys on `(remoteId, workspaceId,
   * hlcKey, mutationId)`; one instance per host suffices, and the
   * provider is expected to return the same handle on repeated calls.
   * Optional for forward-compat: the SW + tests that don't install a
   * non-default provider don't yet exercise this path.
   */
  createPendingOutQueue?(): PendingOutQueue;
}

/**
 * Default provider — IndexedDB-backed. An unwired host (the browser
 * extension) runs on this as-is; only hosts without `indexedDB` need to
 * install a replacement.
 */
let idbPendingOutSingleton: IdbPendingOutQueue | null = null;

const IDB_SYNC_PERSISTENCE: SyncPersistenceProvider = {
  createMutationLog: (scope) => new IdbMutationLog(scope),
  createPendingIntents: (scope) => new IdbPendingIntents(scope),
  createPendingOutQueue: () => {
    if (!idbPendingOutSingleton) idbPendingOutSingleton = new IdbPendingOutQueue();
    return idbPendingOutSingleton;
  },
};

let installed: SyncPersistenceProvider = IDB_SYNC_PERSISTENCE;

/**
 * Install (or replace) the sync-persistence provider. Hosts call this
 * once at boot before the sync service is initialized. The browser
 * extension never calls it — the IDB default already fits.
 */
export function setSyncPersistenceProvider(provider: SyncPersistenceProvider): void {
  installed = provider;
}

/** Returns the installed provider (the IDB default when unwired). */
export function getSyncPersistenceProvider(): SyncPersistenceProvider {
  return installed;
}
