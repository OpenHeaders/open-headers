/**
 * Live-value §4 sync bridge (WS-C C6).
 *
 * The propagation half of the live cache. `live-cache-store.ts` stays a
 * host-local store with two outbound hooks (`setLiveValuePropagator` /
 * `setLiveValueRemover`); this module wires them to the sync oracle and
 * mirrors the inbound direction back into the blob. Dependency flows one
 * way — `live` → `sync` — so there is no import cycle: the cache never
 * reaches into the sync engine, the bridge reaches into the cache.
 *
 * Outbound (this host runs a workflow):
 *   `putWorkflowRunCache` → propagator → `oracle.apply(putLiveValue)` →
 *   HLC stamp + mutation-log + `broadcastSyncEvent` → forwarded to
 *   paired WS peers. Host-local bookkeeping never enters the entity.
 *
 * Inbound (a peer's value arrives, or our own apply echoes):
 *   `oh.sync.mutation` → oracle apply → live-value cache re-projects →
 *   `onChange` → {@link applySyncedLiveValues} merges the value subset
 *   into this host's `liveCache` blob (preserving local bookkeeping) and
 *   fires `onLiveCacheStoreChange` — the existing path that refreshes the
 *   resolver mirror + recompiles DNR. The producer's own echo is a
 *   no-op write (identical value) so it costs nothing.
 *
 * Active-workspace only: live refresh is active-workspace-scoped on
 * every host, so the propagator applies against the workspace's oracle
 * when one is materialized and otherwise skips — the value is already in
 * the local blob and re-seeds into the oracle on the next bridge.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import {
  buildPutLiveValueBatch,
  buildRemoveLiveValuesBatch,
  type LiveValueMutationPayload,
} from '@openheaders/core/sync-builders/mutations/live-value-mutations';
import { logger } from '@openheaders/core/utils';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import { LIVE_VALUE_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import type { LiveValueCache } from '@openheaders/oracle/sync/live-value-cache';
import {
  getActiveCacheForRegistration,
  getOracleForWorkspace,
  nextSwMutatorContextForWorkspace,
} from '@openheaders/oracle/sync/service';
import {
  applySyncedLiveValues,
  type LiveValuePropagator,
  type LiveValueRemover,
  setLiveValuePropagator,
  setLiveValueRemover,
} from './live-cache-store';

// ── Outbound: write-site → oracle ──────────────────────────────────

const propagate: LiveValuePropagator = ({ runKey, value }, workspaceId) => {
  void applyLiveValueMutation(workspaceId, (ctx) => buildPutLiveValueBatch({ runKey, value }, ctx), 'putLiveValue');
};

const remove: LiveValueRemover = (runKeys, workspaceId) => {
  if (runKeys.length === 0) return;
  void applyLiveValueMutation(workspaceId, (ctx) => buildRemoveLiveValuesBatch({ runKeys }, ctx), 'removeLiveValues');
};

async function applyLiveValueMutation(
  workspaceId: string,
  factory: (ctx: MutatorContext) => LiveValueMutationPayload,
  op: string,
): Promise<void> {
  const oracle = getOracleForWorkspace(workspaceId);
  const ctx = nextSwMutatorContextForWorkspace(workspaceId, { surfaceId: 'sw' });
  // No materialized oracle for this workspace → no backend bridge to
  // ride. The value is already in the local blob; it re-seeds into the
  // oracle when this workspace is next bridged. Not an error.
  if (!oracle || !ctx) return;
  const { batch, sideEffects } = factory(ctx);
  if (batch.mutations.length === 0) return;
  try {
    const result = await oracle.apply(batch, sideEffects);
    if (!result.ok) {
      logger.info(
        'LiveValueStore',
        `${op} rejected (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
      );
    }
  } catch (err) {
    logger.info('LiveValueStore', `${op} threw: ${(err as Error).message}`);
  }
}

// ── Inbound: oracle → blob ─────────────────────────────────────────

let cacheUnsubscribe: (() => void) | null = null;

/**
 * Wire the live-value cache to this host's `liveCache` blob for the
 * active workspace. Idempotent — the prior subscription is dropped
 * first. Registers the outbound propagation hooks (once is enough; the
 * setters are global) and reconciles the blob with the oracle's current
 * value set. Called at boot + on every active-workspace flip by
 * `reseedAllPerWorkspaceBridges`.
 */
export async function bridgeLiveValueSyncEngine(): Promise<void> {
  setLiveValuePropagator(propagate);
  setLiveValueRemover(remove);
  const cache = getActiveCacheForRegistration<LiveValueCache>(LIVE_VALUE_REGISTRATION);
  if (!cache) return;
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  const workspaceId = requireActiveWorkspaceId();
  cacheUnsubscribe = cache.onChange(() => {
    void applySyncedLiveValues(workspaceId, cache.getSnapshot().values).catch((err) => {
      logger.info('LiveValueStore', `applySyncedLiveValues failed (ws=${workspaceId}): ${(err as Error).message}`);
    });
  });
  // Initial reconcile — fold the oracle's current value set (post-
  // hydrate) into the blob. A no-op when the blob already seeded the
  // oracle, which is the common case.
  await applySyncedLiveValues(workspaceId, cache.getSnapshot().values);
}

// ── Test helper ────────────────────────────────────────────────────

export function __resetForTests(): void {
  if (cacheUnsubscribe) {
    cacheUnsubscribe();
    cacheUnsubscribe = null;
  }
  setLiveValuePropagator(null);
  setLiveValueRemover(null);
}
