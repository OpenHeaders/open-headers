/**
 * Per-envelope WebSocket response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Examples are flat
 * records with no set-modeled paths of their own; `path` and the
 * parent uid project from the live `examples` slot on the request
 * (`example-tree-post-state.ts`), the stored values being the net.
 */

import type { SyncWsResponseExamplePostState } from '@openheaders/core/protocol';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectWsResponseExample } from '@openheaders/core/sync-builders/projections/ws-response-example-projection';
import type { WsResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { resolveExampleParent } from './example-tree-post-state';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, WsResponseExample, SyncWsResponseExamplePostState>({
  entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectWsResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
  composeResult: (wsResponseExample) => ({ wsResponseExample }),
});

export const projectWsResponseExamplePostState = projectors.projectPostState;
export const projectWsResponseExampleByUid = projectors.projectByUid;
