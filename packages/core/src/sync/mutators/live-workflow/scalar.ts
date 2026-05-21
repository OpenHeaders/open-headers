/**
 * Scalar `setField` intent factory for live-workflow entities.
 *
 * Single typed-path generic over scalar paths on `LiveWorkflow`.
 * `steps` is a scalar here (whole-array LWW) — see `types.ts` for the
 * rationale. `refresh` is also a scalar (the whole policy variant
 * swaps atomically; the editor never edits a single field within an
 * `expires-in` policy without rewriting the rest).
 *
 * Every scalar write emits an `INVALIDATE_RESOLVER` intent keyed by
 * the workflow uid (§18.1) — flipping `enabled`, replacing `steps`,
 * or changing `refresh` may change the resolved value for any bound
 * LV.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { deriveLiveWorkflowSideEffects } from './side-effects';
import { LIVE_WORKFLOW_ENTITY_TYPE } from './types';

/**
 * Aligned with `LiveWorkflowSchema` minus `uid` (envelope `id`),
 * `schemaVersion` (immutable), `version` (slated for deletion in
 * commit 3 of this slice).
 */
export type LiveWorkflowScalarPath =
  | 'name'
  | 'description'
  | 'path'
  | 'steps'
  | 'refresh'
  | 'enabled'
  | 'published'
  | 'parallelExecution';

export interface SetLiveWorkflowFieldArgs {
  workflowUid: string;
  path: LiveWorkflowScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setLiveWorkflowField(ctx: MutatorContext, args: SetLiveWorkflowFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: args.workflowUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveLiveWorkflowSideEffects) };
}

export interface UnsetLiveWorkflowFieldArgs {
  workflowUid: string;
  path: LiveWorkflowScalarPath;
}

export function unsetLiveWorkflowField(ctx: MutatorContext, args: UnsetLiveWorkflowFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'unsetField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: args.workflowUid,
      path: args.path,
    },
  ]);
  return { batch, sideEffects: batch.mutations.flatMap(deriveLiveWorkflowSideEffects) };
}
