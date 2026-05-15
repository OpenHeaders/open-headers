/**
 * In-memory {@link SyncPersistenceProvider} for the desktop main —
 * Stage 2 interim. Replaced by a better-sqlite3 backend in a follow-up
 * commit. Mutation log + pending intents live in Maps and reset on
 * every main-process boot.
 *
 * The provider hands out one `InMemoryMutationLog` + one
 * `InMemoryPendingIntents` per scope (workspace id, or the
 * `__global__` sentinel). Subsequent calls for the same scope return
 * the same instances so per-scope state stays coherent across the
 * boot sequence.
 */

import { InMemoryMutationLog, type MutationLog } from '@openheaders/oracle/sync/mutation-log';
import { InMemoryPendingIntents, type PendingIntents } from '@openheaders/oracle/sync/pending-intents';
import type { SyncPersistenceProvider } from '@openheaders/oracle/sync/sync-persistence-provider';

const logs = new Map<string, MutationLog>();
const intents = new Map<string, PendingIntents>();

export const inMemorySyncPersistenceProvider: SyncPersistenceProvider = {
  createMutationLog(scope: string): MutationLog {
    let log = logs.get(scope);
    if (!log) {
      log = new InMemoryMutationLog();
      logs.set(scope, log);
    }
    return log;
  },
  createPendingIntents(scope: string): PendingIntents {
    let store = intents.get(scope);
    if (!store) {
      store = new InMemoryPendingIntents();
      intents.set(scope, store);
    }
    return store;
  },
};
