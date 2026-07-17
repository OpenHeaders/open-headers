/**
 * Scalar `setField` intent factory for gRPC response-example entities.
 *
 * Writable paths: `name` (rename), `path` (parent request rename
 * cascades the folder path), and the captured `request` / `response`
 * blocks — examples start as captures but stay editable afterwards.
 * Each block writes as one LWW value: rows inside a capture are not
 * set-modeled, so concurrent edits resolve per block, not per row.
 */

import type { MutatorContext, MutatorIntent } from '../types';
import { mintBatch } from './envelope';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from './types';

/** Writable paths — identity (`uid`) and `capturedAt` (a historical
 *  fact) stay frozen. */
export type GrpcResponseExampleScalarPath = 'name' | 'path' | 'request' | 'response';

export interface SetGrpcResponseExampleFieldArgs {
  grpcResponseExampleUid: string;
  path: GrpcResponseExampleScalarPath;
  /** Field's new value. Schema validation happens at the oracle boundary. */
  value: unknown;
}

export function setGrpcResponseExampleField(ctx: MutatorContext, args: SetGrpcResponseExampleFieldArgs): MutatorIntent {
  const batch = mintBatch(ctx, [
    {
      kind: 'setField',
      type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: args.grpcResponseExampleUid,
      path: args.path,
      value: args.value,
    },
  ]);
  return { batch, sideEffects: [] };
}
