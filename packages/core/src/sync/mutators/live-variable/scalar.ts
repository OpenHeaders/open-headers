/**
 * Scalar `setField` intent factory for live-variable entities.
 *
 * Single typed-path generic over the scalar paths on `LiveVariable`.
 * Same posture as `template/scalar.ts` and `request/scalar.ts` —
 * collapses near-identical micro-factories into one and catches schema
 * drift at the call site via the string-literal union.
 *
 * `manualOverride` is a scalar here even though it's a small object
 * (`{ value, until? }`). Editor gesture is "set override" / "clear
 * override" as one action; whole-object replacement is the v1 contract.
 *
 * Every scalar write emits an `INVALIDATE_RESOLVER` intent keyed by
 * the LV uid (§18.1) — flipping `enabled`, swapping the binding, or
 * toggling the override all change `{{live.<name>}}` resolution.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveLiveVariableSideEffects } from './side-effects';
import { LIVE_VARIABLE_ENTITY_TYPE } from './types';

/**
 * Aligned with `LiveVariableSchema` minus `uid` (carried as envelope
 * `id`), `schemaVersion` (immutable), `version` (slated for deletion
 * in commit 3 of this slice).
 */
export type LiveVariableScalarPath =
  | 'name'
  | 'description'
  | 'path'
  | 'workflowUid'
  | 'stepId'
  | 'captureName'
  | 'requireFreshOnRuleBuild'
  | 'manualOverride'
  | 'enabled'
  | 'published';

export interface SetLiveVariableFieldArgs {
  liveVariableUid: string;
  path: LiveVariableScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setLiveVariableField(ctx: MutatorContext, args: SetLiveVariableFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: args.liveVariableUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveLiveVariableSideEffects) };
}

/**
 * `unsetField` flavor for paths whose absence is semantically distinct
 * from explicit value (currently `description`, `requireFreshOnRuleBuild`,
 * `manualOverride`). Same envelope shape; resolver invalidation rides
 * along.
 */
export interface UnsetLiveVariableFieldArgs {
  liveVariableUid: string;
  path: LiveVariableScalarPath;
}

export function unsetLiveVariableField(ctx: MutatorContext, args: UnsetLiveVariableFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'unsetField',
      type: LIVE_VARIABLE_ENTITY_TYPE,
      id: args.liveVariableUid,
      path: args.path,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveLiveVariableSideEffects) };
}
