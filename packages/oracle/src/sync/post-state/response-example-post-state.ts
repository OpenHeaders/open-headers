/**
 * Per-envelope response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Examples are flat
 * records with no set-modeled paths of their own; `path` and the
 * parent uid project from the live `examples` slot on the request
 * (`example-tree-post-state.ts`), the stored values being the net.
 */

import type { SyncResponseExamplePostState } from '@openheaders/core/protocol';
import { RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectResponseExample } from '@openheaders/core/sync-builders/projections/response-example-projection';
import type { ResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { resolveExampleParent } from './example-tree-post-state';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, ResponseExample, SyncResponseExamplePostState>({
  entityType: RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
  composeResult: (responseExample) => ({ responseExample }),
});

export const projectResponseExamplePostState = projectors.projectPostState;
export const projectResponseExampleByUid = projectors.projectByUid;
