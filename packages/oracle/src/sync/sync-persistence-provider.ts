/**
 * Sync-persistence provider — the install seam for the oracle's durable
 * stores ({@link MutationLog} + {@link PendingIntents}).
 *
 * Both stores are scoped by a string key (a workspace id, or the
 * `__global__` sentinel) and the oracle materializes one pair per scope
 * on sync-service init. The concrete backend is platform-specific:
 *
 *   - **Browser extension** — deep-imports `createIdbSyncPersistenceProvider`
 *     from `@openheaders/oracle-host-browser/sync/idb-sync-persistence` and installs
 *     at boot.
 *   - **Electron desktop** — installs a Node/SQLite-backed provider once
 *     at main-process boot.
 *   - **Tests** — drive in-memory stores directly through the sync
 *     service's `__init…ForTests` deps; they never touch this seam.
 *
 * Mirrors the `setLockRuntime` install seam in `coordination/with-lock`,
 * but every host installs explicitly — no implicit IDB default lives in
 * this module so it stays host-neutral.
 */

import type { ActivityLog } from './activity-log';
import type { ActivityMuteStore } from './activity-mute-store';
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
  /**
   * Build the activity log (Phase C F1). Host-singleton; per-workspace
   * isolation is enforced inside the log by the `workspaceId` argument
   * on every method. Provider is expected to return the same handle on
   * repeated calls. Optional for forward-compat: tests that don't
   * install a non-default provider don't yet exercise this path.
   */
  createActivityLog?(): ActivityLog;
  /**
   * Build the activity mute store (Phase C F6.b). Host-singleton;
   * per-workspace isolation is enforced inside the store by the
   * `workspaceId` argument on every method. Provider is expected to
   * return the same handle on repeated calls. Optional for forward-
   * compat: tests that don't install a non-default provider don't yet
   * exercise this path.
   */
  createActivityMuteStore?(): ActivityMuteStore;
}

let installed: SyncPersistenceProvider | null = null;

/**
 * Install (or replace) the sync-persistence provider. Every host calls
 * this once at boot before the sync service is initialized.
 */
export function setSyncPersistenceProvider(provider: SyncPersistenceProvider): void {
  installed = provider;
}

/** Returns the installed provider. Throws if no host wired one up. */
export function getSyncPersistenceProvider(): SyncPersistenceProvider {
  if (installed === null) {
    throw new Error(
      'SyncPersistenceProvider not installed — call setSyncPersistenceProvider() ' +
        'during host boot (e.g. createIdbSyncPersistenceProvider in browser hosts)',
    );
  }
  return installed;
}
