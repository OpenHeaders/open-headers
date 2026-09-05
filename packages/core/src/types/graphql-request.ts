/**
 * GraphqlRequest types for the git-based workspace format.
 *
 * A GraphqlRequest is a standalone GraphQL operation — its own entity
 * kind beside the HTTP `Request`, `GrpcRequest`, `WebSocketRequest`
 * and `MqttRequest`, executed THROUGH the HTTP executor by one pure
 * compile (`@openheaders/core/graphql`). On disk, each GraphQL request
 * is a folder containing:
 *   graphql.yaml     — schemaVersion, uid, name, url, operationName,
 *                      headers, auth, specLink, the HTTP settings knobs
 *   query.graphql    — the document
 *   variables.json   — optional variables JSON text
 *   pre-request.js   — optional pre-request script
 *   post-response.js — optional post-response script
 *
 * The 8-char uid is embedded in `graphql.yaml` and mirrored in the
 * folder name's `<slug>-<uid>` suffix (slug is a human hint; uid is the
 * identity). Persisted shapes derive from the valibot schemas so the
 * runtime validator and the type stay locked together.
 */

import type * as v from 'valibot';
import type { GraphqlAuthSchema, GraphqlRequestSchema, GraphqlRequestSeedSchema } from '../schemas/graphql-request';

/** The request's own auth under the HTTP mask (every HTTP type + `inherit`). */
export type GraphqlAuth = v.InferOutput<typeof GraphqlAuthSchema>;

export type GraphqlRequest = v.InferOutput<typeof GraphqlRequestSchema>;

/**
 * Content-only shape (no `uid` / `path` / `schemaVersion`) — the
 * pre-fill handoff unit for the create tab.
 */
export type GraphqlRequestSeed = v.InferOutput<typeof GraphqlRequestSeedSchema>;
