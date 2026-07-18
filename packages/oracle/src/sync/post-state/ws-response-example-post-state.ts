/**
 * Per-envelope WebSocket response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `grpc-response-example-post-state.ts`. Examples are frozen flat
 * records — no set-modeled paths, so the projection carries only the
 * projected `WsResponseExample`.
 */

import type { SyncWsResponseExamplePostState } from '@openheaders/core/protocol';
import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectWsResponseExample } from '@openheaders/core/sync-builders/projections/ws-response-example-projection';
import type { WsResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, WsResponseExample, SyncWsResponseExamplePostState>({
  entityType: WS_RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: projectWsResponseExample,
  composeResult: (wsResponseExample) => ({ wsResponseExample }),
});

export const projectWsResponseExamplePostState = projectors.projectPostState;
export const projectWsResponseExampleByUid = projectors.projectByUid;
