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
 * Side effects single-source from the minted batch through
 * {@link deriveSideEffectsForEnvelope} — the same function the inbound
 * bridge runs — so every host that applies an LV write invalidates the
 * resolver, mint-side and receive-side alike.
 */

import {
  deriveSideEffectsForEnvelope,
  LIVE_VARIABLE_ENTITY_TYPE,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { LiveVariable } from '@openheaders/core/types';
import { seedLiveVariable } from '../projections/live-variable-projection';

export interface LiveVariableMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

export function buildAddLiveVariableBatch(
  liveVariable: LiveVariable,
  ctx: MutatorContext,
): LiveVariableMutationPayload {
  const batch = seedLiveVariable(liveVariable, ctx);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

export function buildDeleteLiveVariableBatch(
  liveVariableUid: string,
  ctx: MutatorContext,
): LiveVariableMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: LIVE_VARIABLE_ENTITY_TYPE, id: liveVariableUid }];
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}

/**
 * Translate a `Partial<Omit<LiveVariable, 'uid' | 'path'>>` patch
 * into a single batch of per-leaf `setField` envelopes. Undefined values
 * skip — the editor uses `unsetField` flow for explicit clears (commit 3
 * write-client).
 */
export function buildUpdateLiveVariableBatch(
  liveVariableUid: string,
  updates: Partial<Omit<LiveVariable, 'uid' | 'path'>>,
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
  const batch = mintBatch(ctx, bodies);
  return { batch, sideEffects: batch.mutations.flatMap(deriveSideEffectsForEnvelope) };
}
