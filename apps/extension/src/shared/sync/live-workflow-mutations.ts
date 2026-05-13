/**
 * Live-workflow write-site → oracle helpers.
 *
 * Pure transforms used by both the SW (live-workflow-store routing in
 * commit 3) and the renderer (`useLiveWorkflowMutator` in commit 3) to
 * produce `(batch, sideEffects)` pairs from the catalog factories.
 *
 * LW has no set-modeled paths — `steps` is a whole-array scalar
 * (rationale on the catalog `types.ts`), so update is a flat per-key
 * `setField` loop. Every write emits an `INVALIDATE_RESOLVER` intent
 * keyed by the workflow uid — flipping `enabled`, replacing `steps`, or
 * changing `refresh` invalidates every bound LV's resolution.
 */

import {
  liveWorkflowInvalidateResolverIntent,
  LIVE_WORKFLOW_ENTITY_TYPE,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { LiveWorkflow } from '@openheaders/core/types';
import { seedLiveWorkflow } from './live-workflow-projection';

export interface LiveWorkflowMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

export function buildAddLiveWorkflowBatch(
  workflow: LiveWorkflow,
  ctx: MutatorContext,
): LiveWorkflowMutationPayload {
  return {
    batch: seedLiveWorkflow(workflow, ctx),
    sideEffects: [liveWorkflowInvalidateResolverIntent(workflow.uid, ctx.hlc)],
  };
}

export function buildDeleteLiveWorkflowBatch(
  workflowUid: string,
  ctx: MutatorContext,
): LiveWorkflowMutationPayload {
  const bodies: MutationBody[] = [
    { kind: 'delete', type: LIVE_WORKFLOW_ENTITY_TYPE, id: workflowUid },
  ];
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [liveWorkflowInvalidateResolverIntent(workflowUid, ctx.hlc)],
  };
}

export function buildUpdateLiveWorkflowBatch(
  workflowUid: string,
  updates: Partial<Omit<LiveWorkflow, 'uid' | 'path'>>,
  ctx: MutatorContext,
): LiveWorkflowMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: LIVE_WORKFLOW_ENTITY_TYPE,
      id: workflowUid,
      path: key,
      value,
    });
  }
  return {
    batch: mintBatch(ctx, bodies),
    sideEffects: [liveWorkflowInvalidateResolverIntent(workflowUid, ctx.hlc)],
  };
}
