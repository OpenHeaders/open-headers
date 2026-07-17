/**
 * gRPC Response Example types — derived from the valibot schemas in
 * `../schemas/grpc-response-example.ts` so the runtime validator and
 * the TypeScript types stay locked together.
 */

import type * as v from 'valibot';
import type {
  CapturedGrpcMessageFrameSchema,
  CapturedGrpcRequestSchema,
  CapturedGrpcResponseSchema,
  GrpcResponseExampleSchema,
} from '../schemas/grpc-response-example';

/** Request shape as composed — authored values, variable refs unresolved. */
export type CapturedGrpcRequest = v.InferOutput<typeof CapturedGrpcRequestSchema>;

/** One captured message frame, direction-tagged for streams. */
export type CapturedGrpcMessageFrame = v.InferOutput<typeof CapturedGrpcMessageFrameSchema>;

/** Response side of the captured exchange. */
export type CapturedGrpcResponse = v.InferOutput<typeof CapturedGrpcResponseSchema>;

/** A snapshot of one executed gRPC exchange, saved under a GrpcRequest. */
export type GrpcResponseExample = v.InferOutput<typeof GrpcResponseExampleSchema>;
