/**
 * Valibot schema for `GraphqlRequest` — the native GraphQL request
 * entity.
 *
 * Own entity kind beside the HTTP `Request`, `GrpcRequest`,
 * `WebSocketRequest` and `MqttRequest` — the first that is NOT
 * session-shaped: one HTTP POST of `{ query, variables, operationName }`
 * and one JSON response. What makes it a kind of its own is the
 * EDITOR anatomy (a schema-aware document editor, a variables pane,
 * an operation pick), never the wire: the entity reaches the executor
 * through ONE pure compile (`@openheaders/core/graphql` —
 * `toHttpRequest`) into the runtime HTTP `Request`, so the field list
 * below is exactly the compile's input contract (`GraphqlRequestLike`)
 * — a type-level test pins the two together.
 *
 * GraphQL is an HTTP FLAVOR for the three inheritance units: the auth
 * mask is the HTTP list (every type + `inherit`), the settings knobs
 * are the HTTP slice verbatim (`HTTP_INHERITABLE_SETTING_KEYS`), and
 * the scripts are the frozen HTTP pair (`preRequestScript` /
 * `postResponseScript`, `pre-request.js` / `post-response.js`). NO
 * `method`, NO `params`, NO body-mode union.
 */

import * as v from 'valibot';
import { PathSegmentSchema, RelativePathSchema, SchemaVersionSchema, UidSchema } from './common';
import { HttpSettingsObjectSchema } from './inheritable-settings';
import { proxyPairChecks, RequestHeaderSchema, RequestSpecLinkSchema } from './request';
import { HTTP_AUTH_TYPES, requestAuthSchemaFor } from './session-auth';

/**
 * The request's OWN auth under the HTTP mask (`HTTP_AUTH_TYPES` —
 * every type an HTTP send takes) or `inherit`, resolving through the
 * ancestor pool (`@openheaders/core/auth-inheritance`) under the same
 * mask. Absent = `none`; the create default is `inherit`.
 */
export const GraphqlAuthSchema = requestAuthSchemaFor(HTTP_AUTH_TYPES);

const GraphqlRequestObjectSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  path: RelativePathSchema,
  pathSegment: v.optional(PathSegmentSchema),
  name: v.string(),
  /** Free-form Markdown notes (Docs-tab parity with the HTTP request). */
  description: v.optional(v.string()),
  /** The endpoint the operation POSTs to. Templates welcome. */
  url: v.string(),
  /**
   * The GraphQL document. Fans out to the `query.graphql` sibling on
   * disk (the HTTP body mode's `body.graphql` posture); the manifest
   * never carries it. Empty string = nothing composed yet.
   */
  query: v.string(),
  /**
   * JSON text of the variables object. Fans out to `variables.json`
   * (the body mode's sibling, same name); absent = no variables.
   * Templates welcome — the resolve pass runs before the JSON parse.
   */
  variables: v.optional(v.string()),
  /**
   * The operation to run when the document holds several — the wire
   * envelope's `operationName`. Absent = the document's only
   * operation (the census owns the pick rule; a single-operation
   * document sends none).
   */
  operationName: v.optional(v.string()),
  /** Request header rows (set-modeled — the HTTP recipe). */
  headers: v.array(RequestHeaderSchema),
  auth: GraphqlAuthSchema,
  /** Ids-only binding to the `graphql` Spec feeding the schema plane. */
  specLink: v.optional(RequestSpecLinkSchema),
  /**
   * The HTTP settings knobs — the SAME optional scalars the HTTP
   * request carries, exactly the container's `http` slice, so a
   * collection sets its proxy / CA / budget ONCE for its REST and
   * GraphQL requests alike. The field docs live on `RequestSchema`.
   */
  ...HttpSettingsObjectSchema.entries,
  /** The frozen HTTP script pair — `pre-request.js` / `post-response.js`. */
  preRequestScript: v.optional(v.string()),
  postResponseScript: v.optional(v.string()),
});

/** The persisted GraphqlRequest shape with the proxy mode / URL tie —
 *  see {@link proxyPairChecks}. */
export const GraphqlRequestSchema = v.pipe(
  GraphqlRequestObjectSchema,
  ...proxyPairChecks<v.InferOutput<typeof GraphqlRequestObjectSchema>>(),
);

/**
 * Content-only shape (no `schemaVersion` / `uid` / `path`) — the
 * pre-fill handoff unit, mirroring `RequestSeedSchema`.
 */
export const GraphqlRequestSeedSchema = v.omit(GraphqlRequestObjectSchema, [
  'schemaVersion',
  'uid',
  'path',
  'pathSegment',
]);
