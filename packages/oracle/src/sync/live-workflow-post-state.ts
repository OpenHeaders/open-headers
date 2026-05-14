/**
 * Per-envelope live-workflow post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. LW has no set-modeled
 * paths — `steps` is a whole-array scalar — so the projection carries
 * only the projected `LiveWorkflow`.
 */

import type { SyncLiveWorkflowPostState } from '@openheaders/core/protocol';
import { LIVE_WORKFLOW_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveWorkflow } from '@openheaders/core/types';
import { projectLiveWorkflow } from '@openheaders/core/sync-builders/live-workflow-projection';
import { makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, LiveWorkflow, SyncLiveWorkflowPostState>({
  entityType: LIVE_WORKFLOW_ENTITY_TYPE,
  project: projectLiveWorkflow,
  composeResult: (workflow) => ({ workflow }),
});

export const projectLiveWorkflowPostState = projectors.projectPostState;
export const projectLiveWorkflowByUid = projectors.projectByUid;
