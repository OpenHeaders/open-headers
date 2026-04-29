/**
 * Live-variable write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by both the SW
 * (live-variable-store routing in commit 3) and the renderer
 * (`useLiveVariableMutator` in commit 3) to produce
 * `(batch, sideEffects)` pairs from the catalog factories.
 *
 * LV is fully flat-scalar — there are no set-modeled paths — so the
 * update helper is a flat per-key loop emitting `setField` envelopes.
 * Every write emits an `INVALIDATE_RESOLVER` intent (catalog already
 * stamps it on each scalar / lifecycle factory) to keep the resolver
 * cache in lockstep with binding/override flips.
 */

import {
  liveVariableInvalidateResolverIntent,
  LIVE_VARIABLE_ENTITY_TYPE,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { seedLiveVariable } from './live-variable-projection';

export interface LiveVariableMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

export function buildAddLiveVariableBatch(
  liveVariable: V5.LiveVariable,
  ctx: MutatorContext,
): LiveVariableMutationPayload {
  return {
    batch: seedLiveVariable(liveVariable, ctx),
    sideEffects: [liveVariableInvalidateResolverIntent(liveVariable.uid, ctx.hlc)],
  };
}

export function buildDeleteLiveVariableBatch(
  liveVariableUid: string,
  ctx: MutatorContext,
): LiveVariableMutationPayload {
  const bodies: MutationBody[] = [
    { kind: 'delete', type: LIVE_VARIABLE_ENTITY_TYPE, id: liveVariableUid },
  ];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [liveVariableInvalidateResolverIntent(liveVariableUid, ctx.hlc)],
  };
}

/**
 * Translate a `Partial<Omit<V5.LiveVariable, 'uid' | 'path'>>` patch
 * into a single batch of per-leaf `setField` envelopes. Undefined values
 * skip — the editor uses `unsetField` flow for explicit clears (commit 3
 * write-client).
 */
export function buildUpdateLiveVariableBatch(
  liveVariableUid: string,
  updates: Partial<Omit<V5.LiveVariable, 'uid' | 'path'>>,
  ctx: MutatorContext,
): LiveVariableMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: liveVariableUid,
      path: key,
      value,
    });
  }
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [liveVariableInvalidateResolverIntent(liveVariableUid, ctx.hlc)],
  };
}
