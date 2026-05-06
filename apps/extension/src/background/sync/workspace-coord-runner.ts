/**
 * Workspace coordination runner (sync engine session 53).
 *
 * Drains the two ExtensionWorkspace-scoped intents from
 * `oh.sync.intents` (global stripe) whenever a broadcast lands on the
 * `extensionWorkspace` entity:
 *
 *   - `SWAP_PER_WORKSPACE_STORES` — singleton-keyed (one entry max,
 *     latest HLC wins). Every `setActiveExtensionWorkspace` mutator
 *     emits one alongside the batch (§18.1). When drained the runner
 *     reads the post-commit `activeWorkspaceId` from the workspace
 *     store (already updated by the global cache subscription that
 *     fires before this runner) and routes it through `swap` —
 *     production wires `swap` to the orchestrator's
 *     `swapPerWorkspaceStores` + `reinitForWorkspace` + every
 *     per-workspace `bridgeXSyncEngine` re-seed (the work that used
 *     to live in `background.ts`'s `onWorkspaceStoreChange` listener).
 *   - `PURGE_WORKSPACE_DATA` — keyed by removed workspace id (so
 *     concurrent removes of distinct workspaces don't coalesce; same-id
 *     retries do). Every `removeExtensionWorkspace` mutator emits one;
 *     the runner enumerates pending entries on every drain pass and
 *     pops each, routing the id through `purge` (orchestrator's
 *     per-workspace storage key removal + encapsulated store purges).
 *
 * Coalescing posture:
 *   - Singleton SWAP key → IDB keeps one entry at the highest HLC; if
 *     two flips enqueue before any handle drains, the older intent's
 *     drain returns the latest record. With sequential `oracle.apply`
 *     calls (the production path — broadcasts fire serially and the
 *     handle queue runs each in turn) every commit gets its own swap
 *     pass, but every pass reads `getActiveWorkspaceId()` at execution
 *     time (§S4 — materialized state, not per-envelope payload), so
 *     redundant passes still target the latest active id. Idempotent
 *     downstream (`switchToWorkspace` is a no-op when the target
 *     matches `loadedWorkspaceId`).
 *   - PURGE keyed by removed workspace id → distinct ids accumulate;
 *     same-id retries collapse. The runner enumerates pending entries
 *     on every drain pass.
 *
 * Ordering invariants:
 *   - Subscribe AFTER the `extensionWorkspace` cache (caches re-project
 *     + push to the workspace-store mirror first; the runner reads
 *     post-commit state). `global-service.wire()` enforces this by
 *     attaching caches before the runner subscription.
 *   - Per-broadcast handles are serialized through a promise tail —
 *     two broadcasts in quick succession (concurrent setActive +
 *     remove from different surfaces) must NOT interleave their async
 *     `swap` / `purge` work. Within-batch coalescing handles the
 *     natural redundancy; the queue prevents read-modify-write races
 *     across batches.
 */

import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  PURGE_WORKSPACE_DATA,
  SWAP_PER_WORKSPACE_STORES,
} from '@openheaders/core/sync';
import { logger } from '@utils/logger';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { PendingIntents } from './pending-intents';

export interface WorkspaceCoordRunnerConfig {
  broadcast: InMemoryBroadcast;
  intents: PendingIntents;
  /**
   * Read the post-commit active workspace id from the workspace store.
   * Returns `null` only on cold-wake races where the cache hasn't
   * pushed its first snapshot yet — runner short-circuits in that
   * case and waits for the next broadcast.
   */
  getActiveWorkspaceId: () => string | null;
  /**
   * Per-workspace store swap + DNR rebuild + per-workspace sync engine
   * reinit + bridge re-seeds for the new active workspace. Production
   * wires this to a composed `swapPerWorkspaceStores` +
   * `reinitForWorkspace` + every `bridgeXSyncEngine` call.
   */
  swap: (newId: string) => Promise<void>;
  /**
   * Per-workspace storage key removal + encapsulated store purges
   * (env / vault / test runs / files / OAuth / live-* / cooldowns) for
   * a removed workspace id. Production wires this to the orchestrator's
   * `purgeWorkspaceData([id])`.
   */
  purge: (workspaceId: string) => Promise<void>;
}

export interface WorkspaceCoordRunner {
  /** Tear down the broadcast subscription. Idempotent. */
  dispose(): void;
}

export function createWorkspaceCoordRunner(config: WorkspaceCoordRunnerConfig): WorkspaceCoordRunner {
  const { broadcast, intents, getActiveWorkspaceId, swap, purge } = config;
  let queue: Promise<void> = Promise.resolve();

  const handle = async (event: BroadcastEvent): Promise<void> => {
    if (event.envelope.body.type !== EXTENSION_WORKSPACE_ENTITY_TYPE) return;

    // SWAP first: the active flip's downstream re-seeds populate the
    // per-workspace caches that PURGE callers might check for residual
    // state. Order between SWAP and PURGE doesn't actually matter for
    // correctness today (the purge clears storage keys, not in-memory
    // state); SWAP-first matches the renderer's batch composition
    // (delete-of-active bundles `[remove, setActive]` so SWAP's swap
    // primes the in-memory mirrors before purge clears the source
    // workspace's storage keys).
    const swapIntent = await intents.drain(SWAP_PER_WORKSPACE_STORES, EXTENSION_WORKSPACE_ID);
    if (swapIntent) {
      const target = getActiveWorkspaceId();
      if (target) {
        await swap(target);
      }
    }

    const all = await intents.list();
    for (const intent of all) {
      if (intent.kind !== PURGE_WORKSPACE_DATA) continue;
      const drained = await intents.drain(PURGE_WORKSPACE_DATA, intent.key);
      if (!drained) continue;
      await purge(drained.key);
    }
  };

  const unsubscribe = broadcast.subscribe((event) => {
    queue = queue
      .then(() => handle(event))
      .catch((err: Error) => {
        logger.info('WorkspaceCoordRunner', `failed: ${err.message}`);
      });
  });

  return {
    dispose() {
      unsubscribe();
    },
  };
}
