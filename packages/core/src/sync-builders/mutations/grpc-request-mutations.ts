/**
 * GrpcRequest write-site → oracle helpers.
 *
 * Parallel to {@link request-mutations}: write sites produce
 * `(batch, sideEffects)` pairs as pure transforms — no oracle reads,
 * no IO. The one set-modeled field (`metadata`) routes through the
 * shared {@link synthesizeSetDiff} minimum-envelope synthesizer;
 * object-valued scalars (`method`, `specLink`) route through
 * {@link synthesizeFieldDiff} so edits share create's per-leaf
 * representation and a cleared object tombstones its leaves.
 *
 * No side-effect intents: gRPC requests don't feed DNR or the
 * variables resolver.
 */

import {
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_REQUEST_METADATA_PATH,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { type LiveSetEntry, synthesizeFieldDiff, synthesizeSetDiff } from '@openheaders/core/sync-builders';
import type { GrpcRequest } from '@openheaders/core/types';
import { seedGrpcRequest } from '../projections/grpc-request-projection';

export interface GrpcRequestMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/** Live-itemId reader for the `metadata` set path — see {@link request-mutations}' LiveSetEntries. */
export type GrpcLiveSetEntries = (grpcRequestUid: string, setPath: string) => ReadonlyArray<LiveSetEntry>;

/** Current materialized value reader for object-valued scalar paths (`method`, `specLink`). */
export type GrpcLiveFieldValue = (grpcRequestUid: string, path: string) => unknown;

/** New gRPC request → seed batch. No side effects. */
export function buildGrpcAddBatch(request: GrpcRequest, ctx: MutatorContext): GrpcRequestMutationPayload {
  return { batch: seedGrpcRequest(request, ctx), sideEffects: [] };
}

/** Delete a gRPC request. Tombstone is permanent under §7.2 delete-wins. */
export function buildGrpcDeleteBatch(grpcRequestUid: string, ctx: MutatorContext): GrpcRequestMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: GRPC_REQUEST_ENTITY_TYPE, id: grpcRequestUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/**
 * Translate a `Partial<Omit<GrpcRequest, 'uid'|'path'>>` patch into a
 * single batch. Scalar fields → one `setField` per leaf; `metadata` →
 * minimum diff via {@link synthesizeSetDiff}; `method` / `specLink` →
 * per-leaf flatten-diff via {@link synthesizeFieldDiff}.
 */
export function buildGrpcUpdateBatch(
  grpcRequestUid: string,
  updates: Partial<Omit<GrpcRequest, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: GrpcLiveSetEntries,
  liveFieldValue: GrpcLiveFieldValue,
): GrpcRequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    if (key === GRPC_REQUEST_METADATA_PATH && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: GRPC_REQUEST_ENTITY_TYPE,
          id: grpcRequestUid,
          path: GRPC_REQUEST_METADATA_PATH,
          live: liveSetEntries(grpcRequestUid, GRPC_REQUEST_METADATA_PATH),
          newItems: value,
        }),
      );
      continue;
    }

    // Object-valued scalars (`method`, `specLink`) — emit a per-leaf
    // flatten-diff so the edit shares create's representation.
    if (value !== null && typeof value === 'object') {
      bodies.push(
        ...synthesizeFieldDiff({
          type: GRPC_REQUEST_ENTITY_TYPE,
          id: grpcRequestUid,
          basePath: key,
          oldValue: liveFieldValue(grpcRequestUid, key),
          newValue: value,
        }),
      );
      continue;
    }

    bodies.push({ kind: 'setField', type: GRPC_REQUEST_ENTITY_TYPE, id: grpcRequestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
