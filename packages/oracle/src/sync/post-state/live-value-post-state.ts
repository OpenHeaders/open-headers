/**
 * Per-envelope live-value post-state projection (WS-C C6).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * The materialized form folds the `values` set into an array; consumers
 * (the live-layer bridge that merges into the `liveCache` blob) want a
 * Record keyed by run-key. The compose callback uses
 * `oracle.liveSetItems` to recover the `(runKey, record)` pairs.
 *
 * Sensitive in full — a resolved capture set can hold an access token.
 * This projection feeds the same-machine broadcast + the snapshot
 * builder; cross-trust-zone transports strip it (§12.3).
 */

import type { SyncLiveValuePostState } from '@openheaders/core/protocol';
import { LIVE_VALUE_ENTITY_TYPE, LIVE_VALUE_ID, LIVE_VALUE_VALUES_PATH } from '@openheaders/core/sync';
import type { LiveValueRecord } from '@openheaders/core/types';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from '../oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncLiveValuePostState>({
  entityType: LIVE_VALUE_ENTITY_TYPE,
  entityId: LIVE_VALUE_ID,
  compose: (_materialized, oracle) => {
    const values = recordFromLiveSet(oracle);
    const runKeys = Object.keys(values).sort();
    return { values, runKeys };
  },
});

export const projectLiveValuePostState = projectors.projectPostState;
export const projectLiveValueSingleton = projectors.projectSingleton;

function recordFromLiveSet(oracle: Pick<EntityOracle, 'liveSetItems'>): Record<string, LiveValueRecord> {
  const out: Record<string, LiveValueRecord> = {};
  for (const entry of oracle.liveSetItems(LIVE_VALUE_ENTITY_TYPE, LIVE_VALUE_ID, LIVE_VALUE_VALUES_PATH)) {
    out[entry.itemId] = entry.item as LiveValueRecord;
  }
  return out;
}
