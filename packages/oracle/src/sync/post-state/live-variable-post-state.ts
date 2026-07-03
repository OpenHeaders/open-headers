/**
 * Per-envelope live-variable post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. LV is fully flat-scalar
 * — no set-modeled paths, so the projection carries only the projected
 * `LiveVariable`.
 */

import type { SyncLiveVariablePostState } from '@openheaders/core/protocol';
import { LIVE_VARIABLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { LiveVariable } from '@openheaders/core/types';
import { projectLiveVariable } from '@openheaders/core/sync-builders/projections/live-variable-projection';
import { makeFlatEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from '../oracle';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, LiveVariable, SyncLiveVariablePostState>({
  entityType: LIVE_VARIABLE_ENTITY_TYPE,
  project: projectLiveVariable,
  composeResult: (liveVariable) => ({ liveVariable }),
});

export const projectLiveVariablePostState = projectors.projectPostState;
export const projectLiveVariableByUid = projectors.projectByUid;
