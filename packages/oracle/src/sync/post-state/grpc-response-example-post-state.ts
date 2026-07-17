/**
 * Per-envelope gRPC response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `response-example-post-state.ts`. Examples are frozen flat records —
 * no set-modeled paths, so the projection carries only the projected
 * `GrpcResponseExample`.
 */

import type { SyncGrpcResponseExamplePostState } from '@openheaders/core/protocol';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectGrpcResponseExample } from '@openheaders/core/sync-builders/projections/grpc-response-example-projection';
import type { GrpcResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<EntityOracle, 'materializeOne'>;

const projectors = makeFlatEntityProjectors<Reads, GrpcResponseExample, SyncGrpcResponseExamplePostState>({
  entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: projectGrpcResponseExample,
  composeResult: (grpcResponseExample) => ({ grpcResponseExample }),
});

export const projectGrpcResponseExamplePostState = projectors.projectPostState;
export const projectGrpcResponseExampleByUid = projectors.projectByUid;
