/**
 * GraphqlRequest write-site → oracle helpers.
 *
 * Parallel to {@link websocket-request-mutations}: write sites produce
 * `(batch, sideEffects)` pairs as pure transforms — no oracle reads,
 * no IO. The set-modeled `headers` field routes through the shared
 * {@link synthesizeSetDiff} minimum-envelope synthesizer;
 * container-valued scalars (`auth`, `specLink`) route through
 * {@link synthesizeFieldDiff} so edits share create's per-leaf
 * representation and a cleared object tombstones its leaves.
 *
 * No side-effect intents: GraphQL requests don't feed DNR or the
 * variables resolver.
 */

import {
  type ChildPlacement,
  deleteGraphqlRequest,
  GRAPHQL_REQUEST_ENTITY_TYPE,
  GRAPHQL_REQUEST_HEADERS_PATH,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  type RequestFolderParentRef,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import { type LiveSetEntry, synthesizeFieldDiff, synthesizeSetDiff } from '@openheaders/core/sync-builders';
import type { GraphqlRequest } from '@openheaders/core/types';
import { seedGraphqlRequest } from '../projections/graphql-request-projection';

export interface GraphqlRequestMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

/** Live-itemId reader for the set path — see {@link request-mutations}' LiveSetEntries. */
export type GraphqlLiveSetEntries = (graphqlRequestUid: string, setPath: string) => ReadonlyArray<LiveSetEntry>;

/** Current materialized value reader for scalar paths — the
 *  container-valued ones' flatten-diff baseline (`auth`, `specLink`)
 *  and the explicit-clear guard for every plain knob (see
 *  {@link request-mutations}' LiveFieldValue). */
export type GraphqlLiveFieldValue = (graphqlRequestUid: string, path: string) => unknown;

/**
 * New GraphQL request → seed batch. No side effects. `placement` is
 * the parent whose `items` slot the request takes in the same batch;
 * `null` only when the parent is unresolvable at the write site.
 */
export function buildGraphqlAddBatch(
  request: GraphqlRequest,
  ctx: MutatorContext,
  placement: ChildPlacement<RequestFolderParentRef> | null,
): GraphqlRequestMutationPayload {
  return { batch: seedGraphqlRequest(request, ctx, placement ?? undefined), sideEffects: [] };
}

/**
 * Delete a GraphQL request: the parent's slot tombstone + the entity
 * tombstone in one batch. Tombstone is permanent under §7.2 delete-wins.
 */
export function buildGraphqlDeleteBatch(
  graphqlRequestUid: string,
  parent: RequestFolderParentRef,
  ctx: MutatorContext,
): GraphqlRequestMutationPayload {
  return deleteGraphqlRequest(ctx, { graphqlRequestUid, parent });
}

/** Bare entity tombstone for cascades where the parent is going too. */
export function buildGraphqlDeleteEntityBatch(
  graphqlRequestUid: string,
  ctx: MutatorContext,
): GraphqlRequestMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: GRAPHQL_REQUEST_ENTITY_TYPE, id: graphqlRequestUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/** The container-valued scalar paths that ride the per-leaf
 *  flatten-diff — and whose explicit `undefined` in a patch means
 *  CLEAR, not "field untouched": the diff tombstones every old leaf. */
const CONTAINER_SCALAR_PATHS: ReadonlySet<string> = new Set(['auth', 'specLink']);

/**
 * Translate a `Partial<Omit<GraphqlRequest, 'uid'|'path'>>` patch into
 * a single batch. Scalar fields → one `setField` per leaf; `headers` →
 * minimum diff via {@link synthesizeSetDiff}; `auth` / `specLink` →
 * per-leaf flatten-diff via {@link synthesizeFieldDiff}.
 */
export function buildGraphqlUpdateBatch(
  graphqlRequestUid: string,
  updates: Partial<Omit<GraphqlRequest, 'uid' | 'path'>>,
  ctx: MutatorContext,
  liveSetEntries: GraphqlLiveSetEntries,
  liveFieldValue: GraphqlLiveFieldValue,
): GraphqlRequestMutationPayload {
  const bodies: MutationBody[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      // An explicitly-present key with `undefined` clears: a
      // container scalar's old leaves tombstone through the flatten
      // diff (an absent baseline diffs to nothing); a plain knob
      // tombstones its one slot, but only when the canonical pre-image
      // actually carries a value — unconditional tombstones would
      // stamp fresh HLCs on every untouched field and stomp a peer's
      // concurrent set under LWW. The set-modeled path never clears.
      if (CONTAINER_SCALAR_PATHS.has(key)) {
        bodies.push(
          ...synthesizeFieldDiff({
            type: GRAPHQL_REQUEST_ENTITY_TYPE,
            id: graphqlRequestUid,
            basePath: key,
            oldValue: liveFieldValue(graphqlRequestUid, key),
            newValue: undefined,
          }),
        );
      } else if (key !== GRAPHQL_REQUEST_HEADERS_PATH && liveFieldValue(graphqlRequestUid, key) !== undefined) {
        bodies.push({ kind: 'unsetField', type: GRAPHQL_REQUEST_ENTITY_TYPE, id: graphqlRequestUid, path: key });
      }
      continue;
    }

    if (key === GRAPHQL_REQUEST_HEADERS_PATH && Array.isArray(value)) {
      bodies.push(
        ...synthesizeSetDiff({
          type: GRAPHQL_REQUEST_ENTITY_TYPE,
          id: graphqlRequestUid,
          path: GRAPHQL_REQUEST_HEADERS_PATH,
          live: liveSetEntries(graphqlRequestUid, GRAPHQL_REQUEST_HEADERS_PATH),
          newItems: value,
        }),
      );
      continue;
    }

    // Container-valued scalars (`auth`, `specLink`) — emit a per-leaf
    // flatten-diff so the edit shares create's representation.
    if (value !== null && typeof value === 'object') {
      bodies.push(
        ...synthesizeFieldDiff({
          type: GRAPHQL_REQUEST_ENTITY_TYPE,
          id: graphqlRequestUid,
          basePath: key,
          oldValue: liveFieldValue(graphqlRequestUid, key),
          newValue: value,
        }),
      );
      continue;
    }

    bodies.push({ kind: 'setField', type: GRAPHQL_REQUEST_ENTITY_TYPE, id: graphqlRequestUid, path: key, value });
  }

  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
