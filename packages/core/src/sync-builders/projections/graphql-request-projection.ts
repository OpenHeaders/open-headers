/**
 * GraphqlRequest projection — `GraphqlRequest ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Parallel to {@link websocket-request-projection}: the GraphQL-request
 * entity treats `headers` as a **set** (parent-owned ordering with
 * itemId-keyed members + fractional indexing), while `GraphqlRequest`
 * persists it as a plain array. `seedGraphqlRequest` strips the
 * set-modeled field off the create payload and emits one `addToSet`
 * per row keyed by the row's own uid; `projectGraphqlRequest` reads
 * the oracle's MaterializedEntity back into a `GraphqlRequest`.
 */

import {
  type ChildPlacement,
  GRAPHQL_REQUEST_ENTITY_TYPE,
  GRAPHQL_REQUEST_HEADERS_PATH,
  graphqlRequestChild,
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  orderKeyMinter,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type { GraphqlRequest } from '@openheaders/core/types';
import { lastPathSegment } from '@openheaders/core/utils';
import { projectLeafPath } from './leaf-path';

/**
 * Convert a persisted GraphqlRequest into a `MutationBatch` of one
 * `create` for the scalar shell plus one `addToSet` per header row.
 * Each row's `uid` doubles as the sync engine's itemId, so reorder
 * gestures land as `moveBefore` over a known itemId set. Per-batch
 * all-or-nothing under the oracle's lock.
 *
 * `placement` is the tree linkage for a NEW request: the parent's
 * `items` slot rides the same batch and the shell is stamped with its
 * frozen `pathSegment`. Boot-time re-seeds pass none.
 */
export function seedGraphqlRequest(
  request: GraphqlRequest,
  ctx: MutatorContext,
  placement?: ChildPlacement<RequestFolderParentRef>,
): MutationBatch {
  // Deep clone via JSON round-trip — GraphqlRequest has no functions /
  // symbols / Dates; correct-by-construction for the persisted shape.
  const shell = JSON.parse(JSON.stringify(request)) as Record<string, unknown>;
  delete shell[GRAPHQL_REQUEST_HEADERS_PATH];
  if (placement) shell.pathSegment ??= lastPathSegment(request.path);

  const bodies: MutationBody[] = [
    { kind: 'create', type: GRAPHQL_REQUEST_ENTITY_TYPE, id: request.uid, payload: shell },
  ];
  // Sequential orderKeys — a keyless addToSet defaults every row to the
  // same seedKey(), collapsing creation order to the uid tie-break.
  const nextKey = orderKeyMinter();
  for (const row of request.headers) {
    bodies.push({
      kind: 'addToSet',
      type: GRAPHQL_REQUEST_ENTITY_TYPE,
      id: request.uid,
      path: GRAPHQL_REQUEST_HEADERS_PATH,
      itemId: row.uid,
      item: row,
      orderKey: nextKey(),
    });
  }
  if (placement) bodies.push(graphqlRequestChild.slotAdd(request.uid, placement.parent, placement.orderKey));
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `GraphqlRequest`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds. `parentPath` is the resolved
 * path of the live parent slot; `null` keeps the stored `path`.
 */
export function projectGraphqlRequest(
  materialized: MaterializedEntity,
  parentPath: string | null = null,
): GraphqlRequest | null {
  if (materialized.type !== GRAPHQL_REQUEST_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  // Materialized data already carries the right shape: scalars are
  // unflattened from per-leaf paths; `headers` is emitted as an array
  // at its setPath. The cast is honest because seedGraphqlRequest
  // committed to that shape on the way in (`headers` is
  // schema-required, so the store's [] for an empty set path IS the
  // persisted shape).
  const request = data as GraphqlRequest;
  return parentPath === null ? request : { ...request, path: projectLeafPath(data, parentPath) };
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
