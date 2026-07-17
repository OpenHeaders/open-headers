/**
 * `createGrpcResponseExample` + `deleteGrpcResponseExample` — example
 * entity lifecycle. Each is a single-envelope batch; the create payload
 * is the flat `GrpcResponseExample` minus `uid` (carried on the
 * envelope as `id`). Duplicate is a fresh create with a new uid — no
 * dedicated mutation.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

export interface CreateGrpcResponseExampleArgs {
  grpcResponseExampleUid: string;
  /** Full `GrpcResponseExample` minus `uid` (carried on the envelope as `id`). */
  payload: unknown;
}

export function createGrpcResponseExample(ctx: MutatorContext, args: CreateGrpcResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'create',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.grpcResponseExampleUid,
      payload: args.payload,
    },
  ]);
  return { batch, sideEffects: [] };
}

export interface DeleteGrpcResponseExampleArgs {
  grpcResponseExampleUid: string;
}

export function deleteGrpcResponseExample(ctx: MutatorContext, args: DeleteGrpcResponseExampleArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    { kind: 'delete', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: args.grpcResponseExampleUid },
  ]);
  return { batch, sideEffects: [] };
}
