/**
 * `createLiveVariable` + `deleteLiveVariable` — LV entity lifecycle.
 *
 * Each is a single-envelope batch — LVs have no parent slot (the
 * `workflowUid` is just a reference field, not a hierarchical parent).
 * The projector layer flattens the create payload into per-leaf
 * `setField` envelopes; the catalog stays opaque about the leaf shape,
 * mirroring `seedRequest` / `seedTemplate`.
 *
 * Both create and delete emit `INVALIDATE_RESOLVER` — a new LV adds a
 * `{{live.<name>}}` namespace key, a delete removes one.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { LIVE_VARIABLE_ENTITY_TYPE } from './types';

export interface CreateLiveVariableArgs {
  liveVariableUid: string;
  /** Full `LiveVariable` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createLiveVariable(
  ctx: MutatorContext,
  args: CreateLiveVariableArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'create',
        type: LIVE_VARIABLE_ENTITY_TYPE,
        id: args.liveVariableUid,
        payload: args.payload,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.liveVariableUid, ctx.hlc)],
  };
}

export interface DeleteLiveVariableArgs {
  liveVariableUid: string;
}

export function deleteLiveVariable(
  ctx: MutatorContext,
  args: DeleteLiveVariableArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      { kind: 'delete', type: LIVE_VARIABLE_ENTITY_TYPE, id: args.liveVariableUid },
    ]),
    sideEffects: [invalidateResolverIntent(args.liveVariableUid, ctx.hlc)],
  };
}
