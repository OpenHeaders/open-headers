/**
 * Per-envelope response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Examples are frozen
 * flat records — no set-modeled paths, so the projection carries only
 * the projected `ResponseExample`.
 */

import type { SyncResponseExamplePostState } from '@openheaders/core/protocol';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectResponseExample } from '@openheaders/core/sync-builders/projections/response-example-projection';
import type { ResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, ResponseExample, SyncResponseExamplePostState>({
  entityType: RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: projectResponseExample,
  composeResult: (responseExample) => ({ responseExample }),
});

export const projectResponseExamplePostState = projectors.projectPostState;
export const projectResponseExampleByUid = projectors.projectByUid;
