/**
 * Transient pre-apply prior store for the Activity Feed classifier.
 *
 * The classifier's highlight kinds (`sensitive-field-rotation`,
 * `permission-scope-expansion`) compare a materialized entity AS IT
 * EXISTED BEFORE THE INBOUND MUTATION against the post-apply state.
 * `materializeOne` is a snapshot read on a mutable store; once
 * {@link applySyncRequest} commits, the prior view is gone. We capture
 * it pre-apply, key it by mutationId, and let the installer consume it
 * post-apply when the broadcast event fires.
 *
 * Storage shape mirrors the {@link mutation-stream-bridge} seen-set:
 * a process-wide Map with FIFO eviction at a generous cap. The map
 * holds at most one prior per `(workspaceId, mutationId)` because the
 * bridge writes each entry exactly once. Entries are evicted lazily:
 * `consumePriorForMutation` deletes on read (typical path), and the
 * cap evicts the oldest entry if the consumer side ever misses.
 *
 * Why not also hand back the post-apply state from this store: the
 * installer can read `materializeOne` itself via
 * `getOracleForWorkspace(workspaceId)`. Stashing both here would
 * double-write and risk staleness if a follow-up mutation lands
 * between apply and observe. The prior is the only piece that the
 * apply step destroys; the next is always reconstructible.
 */
import type { MaterializedEntity } from '@openheaders/core/sync';

interface PriorRecord {
  prior: MaterializedEntity | null;
  workspaceId: string;
}

const PRIORS = new Map<string, PriorRecord>();
const PRIORS_CAP = 10_000;

export function rememberPriorForMutation(
  mutationId: string,
  workspaceId: string,
  prior: MaterializedEntity | null,
): void {
  PRIORS.set(mutationId, { prior, workspaceId });
  if (PRIORS.size > PRIORS_CAP) {
    const first = PRIORS.keys().next().value;
    if (first !== undefined) PRIORS.delete(first);
  }
}

/**
 * Read + evict the prior captured for `mutationId`. Returns `null`
 * when no prior was captured (the envelope was a `create`, the entity
 * didn't exist yet, or the priors map was bypassed by a unit test).
 */
export function consumePriorForMutation(mutationId: string): MaterializedEntity | null {
  const record = PRIORS.get(mutationId);
  if (!record) return null;
  PRIORS.delete(mutationId);
  return record.prior;
}

/** Test-only — reset state between cases. */
export function __resetActivityPriorsForTests(): void {
  PRIORS.clear();
}

/** Test-only — peek the priors map size. */
export function __activityPriorsSizeForTests(): number {
  return PRIORS.size;
}
