/**
 * Value intent factories for live-value.
 *
 * Two primitives keyed by run-key:
 *
 *  • `putLiveValue` — store/refresh one workflow-run value. One
 *    `addToSet` on `values`; whole-record LWW per `(values, runKey)`,
 *    so the freshest extraction wins on reconverge (HLC last-writer).
 *    The producer derives `expiresAt` via `@openheaders/core/live`
 *    `deriveExpiresAt` before minting.
 *
 *  • `removeLiveValues` — atomic batch dropping a set of run-keys from
 *    `values`. Used when a workflow definition is deleted or a "clear
 *    cache" gesture drops the host-local rows: the synced value must
 *    drop too, so a peer's cache doesn't keep serving an orphaned
 *    value for a workflow that no longer exists.
 *
 * Per-batch all-or-nothing at the local oracle (§11.2) — observers
 * never see a half-applied multi-row clear.
 */

import type { LiveValueRecord } from '../../../types/live-cache';
import type { MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { LIVE_VALUE_ENTITY_TYPE, LIVE_VALUE_ID, LIVE_VALUE_VALUES_PATH } from './types';

export interface PutLiveValueArgs {
  /** `${workflowUid}:${environmentId ?? '__none__'}` — set member identity. */
  runKey: string;
  /** The value-subset record. Opaque to the catalog beyond its shape. */
  value: LiveValueRecord;
}

/** Persist one workflow-run value under `runKey`. */
export function putLiveValue(ctx: MutatorContext, args: PutLiveValueArgs): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'addToSet',
        type: LIVE_VALUE_ENTITY_TYPE,
        id: LIVE_VALUE_ID,
        path: LIVE_VALUE_VALUES_PATH,
        itemId: args.runKey,
        item: args.value,
      },
    ]),
    sideEffects: [],
  };
}

export interface RemoveLiveValuesArgs {
  /** One or more run-keys to drop. */
  runKeys: readonly string[];
}

/** Drop a set of run-keys from `values`. Atomic across the set. */
export function removeLiveValues(ctx: MutatorContext, args: RemoveLiveValuesArgs): MutatorIntent {
  const bodies: MutationBody[] = args.runKeys.map((runKey) => ({
    kind: 'removeFromSet',
    type: LIVE_VALUE_ENTITY_TYPE,
    id: LIVE_VALUE_ID,
    path: LIVE_VALUE_VALUES_PATH,
    itemId: runKey,
  }));
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
