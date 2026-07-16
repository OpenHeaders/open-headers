/**
 * `deleteGrpcRequest` — gRPC request entity lifecycle. Creation goes
 * through the seed builder
 * (`sync-builders/projections/grpc-request-projection.ts`): the create
 * payload is the scalar shell and every metadata row lands as an
 * `addToSet`, so there is no whole-entity create factory here (same
 * posture as specs and environments).
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { GRPC_REQUEST_ENTITY_TYPE } from './types';

export interface DeleteGrpcRequestArgs {
  grpcRequestUid: string;
}

/** Delete a gRPC request. Tombstone is permanent under §7.2 delete-wins. */
export function deleteGrpcRequest(ctx: MutatorContext, args: DeleteGrpcRequestArgs): MutatorIntent {
  const batch = mintBatch(ctx, [{ kind: 'delete', type: GRPC_REQUEST_ENTITY_TYPE, id: args.grpcRequestUid }]);
  return { batch, sideEffects: [] };
}
