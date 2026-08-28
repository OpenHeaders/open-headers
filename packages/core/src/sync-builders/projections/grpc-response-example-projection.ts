/**
 * gRPC response-example projection — `GrpcResponseExample ⇄ MutationBatch /
 * MaterializedEntity`. The entity is a flat record with no set-modeled
 * paths, so the seed is one `create` envelope plus, for a NEW example,
 * the parent request's `examples` slot in the same batch; the shell
 * is stamped with its frozen `pathSegment`. Boot-time re-seeds pass
 * no placement.
 *
 * On the way back, `path` and the parent uid are projections of the
 * live slot — the request's projected path plus the segment, and the
 * request the slot sits on. With no live slot (old client, mid-replay)
 * the stored values are the net.
 */

import {
  type ChildPlacement,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  type GrpcResponseExampleParentRef,
  grpcResponseExampleChild,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
} from '@openheaders/core/sync';
import type { GrpcResponseExample } from '@openheaders/core/types';
import { lastPathSegment } from '@openheaders/core/utils';
import { type ExampleParent, projectExamplePath } from './leaf-path';

export function seedGrpcResponseExample(
  example: GrpcResponseExample,
  ctx: MutatorContext,
  placement?: ChildPlacement<GrpcResponseExampleParentRef>,
): MutationBatch {
  const payload = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
  if (placement) payload.pathSegment ??= lastPathSegment(example.path);
  const bodies: MutationBody[] = [
    { kind: 'create', type: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, id: example.uid, payload },
  ];
  if (placement) bodies.push(grpcResponseExampleChild.slotAdd(example.uid, placement.parent, placement.orderKey));
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `GrpcResponseExample`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds. `parent` is the live slot's
 * request (its projected path + uid); `null` keeps the stored values.
 */
export function projectGrpcResponseExample(
  materialized: MaterializedEntity,
  parent: ExampleParent | null = null,
): GrpcResponseExample | null {
  if (materialized.type !== GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  const example = data as GrpcResponseExample;
  return parent === null
    ? example
    : { ...example, path: projectExamplePath(data, parent.path), grpcRequestUid: parent.uid };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
