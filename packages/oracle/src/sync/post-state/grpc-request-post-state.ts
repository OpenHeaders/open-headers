/**
 * Per-envelope GrpcRequest post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `request-post-state.ts`. Renderer-side write helpers need the live
 * `(itemId, orderKey)` pairs at the set-modeled `metadata` path before
 * they can emit matching synthesizer envelopes (§19.4).
 */

import type { SyncGrpcRequestPostState } from '@openheaders/core/protocol';
import { GRPC_REQUEST_ENTITY_TYPE, GRPC_REQUEST_METADATA_PATH } from '@openheaders/core/sync';
import { projectGrpcRequest } from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import type { GrpcRequest } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';

/** Set-modeled paths on a GrpcRequest — mirrors the projection's set handling. */
const GRPC_REQUEST_SET_PATHS = [GRPC_REQUEST_METADATA_PATH] as const;

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveOrderedSetItems'>;

const projectors = makeFlatEntityProjectors<Reads, GrpcRequest, SyncGrpcRequestPostState>({
  entityType: GRPC_REQUEST_ENTITY_TYPE,
  project: projectGrpcRequest,
  composeResult: (grpcRequest, oracle, uid) => ({
    grpcRequest,
    ...buildSetMembersExtras(oracle, GRPC_REQUEST_ENTITY_TYPE, uid, GRPC_REQUEST_SET_PATHS),
  }),
});

export const projectGrpcRequestPostState = projectors.projectPostState;
export const projectGrpcRequestByUid = projectors.projectByUid;
