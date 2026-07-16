/**
 * GrpcRequest projection — `GrpcRequest ⇄ MutationBatch / MaterializedEntity`.
 *
 * Parallel to {@link request-projection}: the gRPC-request entity
 * treats `metadata` as a **set** (parent-owned ordering with
 * itemId-keyed members + fractional indexing), while `GrpcRequest`
 * persists it as a plain array. `seedGrpcRequest` strips the
 * set-modeled field off the create payload and emits one `addToSet`
 * per row keyed by the row's own uid; `projectGrpcRequest` reads the
 * oracle's MaterializedEntity back into a `GrpcRequest`.
 */

import {
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_METADATA_PATH,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
} from '@openheaders/core/sync';
import type { GrpcRequest } from '@openheaders/core/types';

/**
 * Convert a persisted GrpcRequest into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per metadata row.
 * Each row's `uid` doubles as the sync engine's itemId, so reorder
 * gestures land as `moveBefore` over a known itemId set. Per-batch
 * all-or-nothing under the oracle's lock.
 */
export function seedGrpcRequest(request: GrpcRequest, ctx: MutatorContext): MutationBatch {
  // Deep clone via JSON round-trip — GrpcRequest has no functions /
  // symbols / Dates; correct-by-construction for the persisted shape.
  const shell = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
  delete shell[GRPC_REQUEST_METADATA_PATH];

  const bodies: MutationBody[] = [{ kind: 'create', type: GRPC_REQUEST_ENTITY_TYPE, id: request.uid, payload: shell }];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break.
  const nextKey = orderKeyMinter();
  for (const pair of request.metadata) {
    bodies.push({
      kind: 'addToSet',
      type: GRPC_REQUEST_ENTITY_TYPE,
      id: request.uid,
      path: GRPC_REQUEST_METADATA_PATH,
      itemId: pair.uid,
      item: pair,
      orderKey: nextKey(),
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `GrpcRequest`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds.
 */
export function projectGrpcRequest(materialized: MaterializedEntity): GrpcRequest | null {
  if (materialized.type !== GRPC_REQUEST_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; `metadata` is emitted as an array
  // at its setPath. The cast is honest because seedGrpcRequest
  // committed to that shape on the way in.
  return data as GrpcRequest;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
