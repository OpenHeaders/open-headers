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
import type { MutationLog } from './mutation-log';
import type { PendingIntents } from './pending-intents';

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
}

/**
 * Default provider — IndexedDB-backed. An unwired host (the browser
 * extension) runs on this as-is; only hosts without `indexedDB` need to
 * install a replacement.
 */
const IDB_SYNC_PERSISTENCE: SyncPersistenceProvider = {
  createMutationLog: (scope) => new IdbMutationLog(scope),
  createPendingIntents: (scope) => new IdbPendingIntents(scope),
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
