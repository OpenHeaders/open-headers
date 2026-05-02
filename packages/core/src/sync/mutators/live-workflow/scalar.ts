/**
 * Scalar `setField` intent factory for live-workflow entities.
 *
 * Single typed-path generic over scalar paths on `V5.LiveWorkflow`.
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
import { invalidateResolverIntent } from './side-effects';
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

export function setLiveWorkflowField(
  ctx: MutatorContext,
  args: SetLiveWorkflowFieldArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'setField',
        type: LIVE_WORKFLOW_ENTITY_TYPE,
        id: args.workflowUid,
        path: args.path,
        value: args.value,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.workflowUid, ctx.hlc)],
  };
}

export interface UnsetLiveWorkflowFieldArgs {
  workflowUid: string;
  path: LiveWorkflowScalarPath;
}

export function unsetLiveWorkflowField(
  ctx: MutatorContext,
  args: UnsetLiveWorkflowFieldArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'unsetField',
        type: LIVE_WORKFLOW_ENTITY_TYPE,
        id: args.workflowUid,
        path: args.path,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.workflowUid, ctx.hlc)],
  };
}
