/**
 * Renderer-side imperative entry point for GraphqlRequest writes.
 *
 * Mirrors {@link websocket-request-write-client}: write sites build a
 * `MutationBatch` against the active GraphQL-request mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. The
 * synchronous-render discipline (§19.4) lives in the editor; this
 * helper is what it reaches for once the user commits.
 */

import { GRAPHQL_REQUEST_ENTITY_TYPE, GRAPHQL_REQUEST_HEADERS_PATH } from '@openheaders/core/sync';
import {
  buildGraphqlAddBatch,
  buildGraphqlDeleteBatch,
  buildGraphqlDeleteEntityBatch,
  buildGraphqlUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/graphql-request-mutations';
import type { GraphqlRequest } from '@openheaders/core/types';
import { parentPathOf } from '@openheaders/core/utils';
import {
  type GraphqlRequestSyncMirror,
  getGraphqlRequestSyncMirrorForWorkspace,
} from '../../context/mirrors/graphql-request-sync-mirror';
import type { RequestCollectionSyncMirror } from '../../context/mirrors/request-collection-sync-mirror';
import type { RequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';
import type { ResponseExampleSyncMirror } from '../../context/mirrors/response-example-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import { applyRequestExampleDeletes, requestExamples } from './tree-descendants';
import { requestTreeMirrors, resolveChildPlacement, resolveLeafParent, unresolvableParent } from './tree-placement';

export type GraphqlRequestUpdates = Partial<Omit<GraphqlRequest, 'uid' | 'path' | 'pathSegment' | 'schemaVersion'>>;

export type GraphqlRequestMutationResult =
  | { ok: true; graphqlRequest: GraphqlRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type GraphqlRequestSimpleResult = SyncSimpleResult;

export interface GraphqlRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: GraphqlRequestSyncMirror;
  /** Override the parent-resolving container mirrors for tests. */
  collectionMirror?: RequestCollectionSyncMirror;
  folderMirror?: RequestFolderSyncMirror;
  /** Override the response-example mirror the delete cascade reads (tests) — a GraphQL request holds the HTTP example kind. */
  exampleMirror?: ResponseExampleSyncMirror;
}

/**
 * Apply a partial GraphqlRequest patch through the local oracle.
 * Returns `{ ok: true, graphqlRequest }` with an optimistic merge of
 * `updates` into the mirror's pre-image.
 */
export async function applyGraphqlRequestUpdate(
  graphqlRequestUid: string,
  updates: GraphqlRequestUpdates,
  opts: GraphqlRequestWriteOptions,
): Promise<GraphqlRequestMutationResult> {
  const mirror = resolveMirror(opts, getGraphqlRequestSyncMirrorForWorkspace);
  // Hydration must complete before the mirror read — see
  // {@link applyRequestUpdate} for the fresh-boot race this closes.
  await mirror.hydrated;
  const entry = mirror.getGraphqlRequestMirror(graphqlRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildGraphqlUpdateBatch(
    graphqlRequestUid,
    updates,
    ctx,
    (uid, path) => {
      const orderKeys = mirror.liveOrderedSetItems(uid, path);
      if (orderKeys.length === 0) return [];
      const snap = mirror.getGraphqlRequestMirror(uid)?.graphqlRequest;
      const rows = snap && path === GRAPHQL_REQUEST_HEADERS_PATH ? snap.headers : undefined;
      if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
      const byUid = new Map<string, unknown>();
      for (const row of rows) byUid.set(row.uid, row);
      return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
    },
    // Scalar pre-image reader from the same canonical snapshot — the
    // auth / specLink flatten-diff baseline and the explicit-clear
    // guard (a knob reset to inherit tombstones its leaf only while one
    // is stored).
    (uid, path) => {
      const snap = mirror.getGraphqlRequestMirror(uid)?.graphqlRequest;
      if (!snap) return undefined;
      return snap[path as keyof GraphqlRequest];
    },
  );
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, graphqlRequest: { ...entry.graphqlRequest, ...updates } as GraphqlRequest };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Seed a brand-new GraphQL request through the oracle. Caller mints
 * the full `GraphqlRequest` shape; the helper resolves the parent from
 * the request's path (its `items` slot rides the create batch) and
 * handles the per-row addToSet envelopes via the projection layer. An
 * unplaceable parent fails the create.
 */
export async function applyGraphqlRequestCreate(
  request: GraphqlRequest,
  opts: GraphqlRequestWriteOptions,
): Promise<GraphqlRequestSimpleResult> {
  const parentPath = parentPathOf(request.path) ?? '';
  const placement = await resolveChildPlacement(requestTreeMirrors(opts.workspaceId, opts), parentPath);
  if (!placement) return unresolvableParent(parentPath);
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildGraphqlAddBatch(request, ctx, placement);
  return applySyncPayload(payload);
}

/**
 * Delete a GraphQL request: its parent's `items` slot tombstones in
 * the same batch as the entity; an unresolvable parent (already
 * tombstoned) falls back to the bare entity tombstone.
 */
export async function applyGraphqlRequestDelete(
  graphqlRequestUid: string,
  opts: GraphqlRequestWriteOptions,
): Promise<GraphqlRequestSimpleResult> {
  const mirror = resolveMirror(opts, getGraphqlRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getGraphqlRequestMirror(graphqlRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Cascade: the request's examples go first (`tree-descendants.ts`).
  const examples = await requestExamples(
    opts.workspaceId,
    { graphqlMirror: mirror, responseExampleMirror: opts.exampleMirror },
    { type: GRAPHQL_REQUEST_ENTITY_TYPE, uid: graphqlRequestUid },
  );
  const handle = resolveRendererContext(opts);
  const cascade = await applyRequestExampleDeletes(examples, handle, `request-delete-cascade-${graphqlRequestUid}`);
  if (!cascade.ok) return cascade;
  const parent = await resolveLeafParent(requestTreeMirrors(opts.workspaceId, opts), entry.graphqlRequest.path);
  const ctx = handle.next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(
    parent
      ? buildGraphqlDeleteBatch(graphqlRequestUid, parent, ctx)
      : buildGraphqlDeleteEntityBatch(graphqlRequestUid, ctx),
  );
}
