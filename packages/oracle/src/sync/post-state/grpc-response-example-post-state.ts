/**
 * Per-envelope gRPC response-example post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts`. Examples are flat
 * records with no set-modeled paths of their own; `path` and the
 * parent uid project from the live `examples` slot on the request
 * (`example-tree-post-state.ts`), the stored values being the net.
 */

import type { SyncGrpcResponseExamplePostState } from '@openheaders/core/protocol';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import { projectGrpcResponseExample } from '@openheaders/core/sync-builders/projections/grpc-response-example-projection';
import type { GrpcResponseExample } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { resolveExampleParent } from './example-tree-post-state';
import { makeFlatEntityProjectors } from './flat-entity-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, GrpcResponseExample, SyncGrpcResponseExamplePostState>({
  entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectGrpcResponseExample(materialized, resolveExampleParent(oracle, materialized.id)),
  composeResult: (grpcResponseExample) => ({ grpcResponseExample }),
});

export const projectGrpcResponseExamplePostState = projectors.projectPostState;
export const projectGrpcResponseExampleByUid = projectors.projectByUid;
