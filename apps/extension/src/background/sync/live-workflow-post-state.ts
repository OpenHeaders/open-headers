/**
 * Per-envelope live-workflow post-state projection.
 *
 * LW has no set-modeled paths — `steps` is a whole-array scalar — so
 * the projection carries only the projected `V5.LiveWorkflow`.
 */

import type { SyncLiveWorkflowPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectLiveWorkflow } from '@/shared/sync/live-workflow-projection';
import type { EntityOracle } from './oracle';

export function projectLiveWorkflowPostState(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  envelope: MutationEnvelope,
): SyncLiveWorkflowPostState | null {
  if (envelope.body.type !== LIVE_WORKFLOW_ENTITY_TYPE) return null;
  return projectLiveWorkflowByUid(oracle, envelope.body.id);
}

export function projectLiveWorkflowByUid(
  oracle: Pick<EntityOracle, 'materializeOne'>,
  workflowUid: string,
): SyncLiveWorkflowPostState | null {
  const materialized = oracle.materializeOne(LIVE_WORKFLOW_ENTITY_TYPE, workflowUid);
  if (!materialized) return null;

  const workflow = projectLiveWorkflow(materialized);
  if (!workflow) return null;

  return { workflow };
}
