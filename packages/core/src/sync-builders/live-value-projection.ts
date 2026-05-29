/**
 * Live-value projection — `LiveValueSnapshot ⇄ MutationBatch`.
 *
 * The synced subset of every workflow-run cache row, keyed by run-key.
 * The oracle stores each as a set-modeled member at `values` with
 * itemId = run-key. `seedLiveValues` walks the map and emits one
 * `addToSet` per entry plus one `create` for the scalar shell (carries
 * `schemaVersion`). All-or-nothing under the oracle's per-entity lock.
 *
 * Unlike OAuth there is no separate persisted blob: the host's existing
 * `oh.ws.<id>.liveCache` blob is the at-rest store, and the live-layer
 * bridge projects this entity's materialized form back into it (merging
 * the value subset with each host's local runner bookkeeping). The
 * post-state projector in `live-value-post-state.ts` recovers the
 * `(runKey, record)` pairs via `oracle.liveSetItems`.
 */

import {
  LIVE_VALUE_ENTITY_TYPE,
  LIVE_VALUE_ID,
  LIVE_VALUE_VALUES_PATH,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
} from '@openheaders/core/sync';
import type { LiveValueRecord } from '../types/live-cache';

/** In-memory shape the cache hands to seed — the synced value map. */
export interface LiveValueSnapshot {
  schemaVersion: number;
  values: Record<string, LiveValueRecord>;
}

/**
 * Convert a live-value map into a `MutationBatch` of one `create` for
 * the scalar shell + one `addToSet` per run-key. All-or-nothing under
 * the oracle's per-entity lock.
 */
export function seedLiveValues(snapshot: LiveValueSnapshot, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: LIVE_VALUE_ENTITY_TYPE,
      id: LIVE_VALUE_ID,
      payload: { schemaVersion: snapshot.schemaVersion },
    },
  ];
  for (const [runKey, record] of Object.entries(snapshot.values)) {
    bodies.push({
      kind: 'addToSet',
      type: LIVE_VALUE_ENTITY_TYPE,
      id: LIVE_VALUE_ID,
      path: LIVE_VALUE_VALUES_PATH,
      itemId: runKey,
      item: record,
    });
  }
  return mintBatch(ctx, bodies);
}
