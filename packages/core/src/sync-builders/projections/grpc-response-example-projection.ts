/**
 * gRPC response-example projection — `GrpcResponseExample ⇄
 * MutationBatch / MaterializedEntity`. The entity is a frozen flat
 * record, so the seed is a single `create` envelope and the projection
 * is a plain shape check.
 */

import {
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
} from '@openheaders/core/sync';
import type { GrpcResponseExample } from '@openheaders/core/types';

export function seedGrpcResponseExample(example: GrpcResponseExample, ctx: MutatorContext): MutationBatch {
  const payload = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
  const bodies: MutationBody[] = [
    { kind: 'create', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: example.uid, payload },
  ];
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `GrpcResponseExample`.
 * Returns `null` when the materialized data fails basic shape checks —
 * callers persist only when projection succeeds.
 */
export function projectGrpcResponseExample(materialized: MaterializedEntity): GrpcResponseExample | null {
  if (materialized.type !== GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as GrpcResponseExample;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
