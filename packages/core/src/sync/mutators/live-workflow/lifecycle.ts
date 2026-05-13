/**
 * `createLiveWorkflow` + `deleteLiveWorkflow` — workflow entity
 * lifecycle.
 *
 * Each is a single-envelope batch — workflows have no parent slot
 * (LiveVariables reference workflows by uid, but they are not stored
 * as children of workflows). The projector layer flattens the create
 * payload into per-leaf scalars, mirroring `seedRequest` /
 * `seedTemplate`.
 *
 * Deleting a workflow does NOT cascade-delete the LVs bound to it
 * (the existing semantics, preserved): orphans surface
 * `workflow-not-found` resolution errors at resolve time so the user
 * sees the broken binding rather than silently losing the namespace
 * entry. The cascade primitive is therefore intentionally absent
 * from this catalog.
 *
 * Both create and delete emit `INVALIDATE_RESOLVER` — every LV bound
 * to the workflow may need to re-evaluate.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { invalidateResolverIntent } from './side-effects';
import { LIVE_WORKFLOW_ENTITY_TYPE } from './types';

export interface CreateLiveWorkflowArgs {
  workflowUid: string;
  /** Full `LiveWorkflow` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createLiveWorkflow(
  ctx: MutatorContext,
  args: CreateLiveWorkflowArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      {
        kind: 'create',
        type: LIVE_WORKFLOW_ENTITY_TYPE,
        id: args.workflowUid,
        payload: args.payload,
      },
    ]),
    sideEffects: [invalidateResolverIntent(args.workflowUid, ctx.hlc)],
  };
}

export interface DeleteLiveWorkflowArgs {
  workflowUid: string;
}

export function deleteLiveWorkflow(
  ctx: MutatorContext,
  args: DeleteLiveWorkflowArgs,
): MutatorIntent {
  return {
    batch: mintBatch(ctx, [
      { kind: 'delete', type: LIVE_WORKFLOW_ENTITY_TYPE, id: args.workflowUid },
    ]),
    sideEffects: [invalidateResolverIntent(args.workflowUid, ctx.hlc)],
  };
}
