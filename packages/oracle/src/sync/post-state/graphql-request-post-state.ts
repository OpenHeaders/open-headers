/**
 * Per-envelope GraphqlRequest post-state projection.
 *
 * Thin adapter over `flat-entity-post-state.ts` — parallel to
 * `websocket-request-post-state.ts`. Renderer-side write helpers need
 * the live `(itemId, orderKey)` pairs at the set-modeled `headers`
 * path before they can emit matching synthesizer envelopes (§19.4).
 */

import type { SyncGraphqlRequestPostState } from '@openheaders/core/protocol';
import { GRAPHQL_REQUEST_ENTITY_TYPE, GRAPHQL_REQUEST_HEADERS_PATH } from '@openheaders/core/sync';
import { projectGraphqlRequest } from '@openheaders/core/sync-builders/projections/graphql-request-projection';
import type { GraphqlRequest } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import { buildSetMembersExtras, makeFlatEntityProjectors } from './flat-entity-post-state';
import { resolveLeafParentPath } from './folder-tree-post-state';
import { REQUEST_TREE } from './request-folder-post-state';

/** Set-modeled paths on a GraphqlRequest — mirrors the projection's set handling. */
const GRAPHQL_REQUEST_SET_PATHS = [GRAPHQL_REQUEST_HEADERS_PATH] as const;

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

const projectors = makeFlatEntityProjectors<Reads, GraphqlRequest, SyncGraphqlRequestPostState>({
  entityType: GRAPHQL_REQUEST_ENTITY_TYPE,
  project: (materialized, oracle) =>
    projectGraphqlRequest(materialized, resolveLeafParentPath(oracle, materialized.id, REQUEST_TREE)),
  composeResult: (graphqlRequest, oracle, uid) => ({
    graphqlRequest,
    ...buildSetMembersExtras(oracle, GRAPHQL_REQUEST_ENTITY_TYPE, uid, GRAPHQL_REQUEST_SET_PATHS),
  }),
});

export const projectGraphqlRequestPostState = projectors.projectPostState;
export const projectGraphqlRequestByUid = projectors.projectByUid;
