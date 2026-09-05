/**
 * GraphqlRequest mutator catalog — routing constants.
 *
 * One set-modeled path lives on the GraphqlRequest entity:
 *
 *   - `headers` — request header rows (`{ key, value, description?, enabled? }`)
 *
 * Every other field — `name`, `description`, `url`, `query`,
 * `variables`, `operationName`, the HTTP settings knobs, the HTTP
 * script pair — flows through `setField` scalars. `auth` and
 * `specLink` are container-valued; they route through the per-leaf
 * flatten-diff at the write site (the same treatment `auth` / `body`
 * get on the HTTP request) so edits share create's leaf
 * representation.
 *
 * No side effects: GraphQL requests don't feed DNR and don't touch
 * the variables resolver.
 */

/** Routing key carried on every GraphQL-request mutation envelope. */
export const GRAPHQL_REQUEST_ENTITY_TYPE = 'graphqlRequest';

/** Set path for request header rows. */
export const GRAPHQL_REQUEST_HEADERS_PATH = 'headers';

/**
 * Wire shape for a header row. Mirrors `RequestHeader` field-for-field
 * but typed locally so the catalog stays decoupled from
 * `@openheaders/core/types` (the same way other catalogs keep their
 * row shapes local).
 */
export interface GraphqlRequestHeaderRow {
  /** Persisted per-row identity; doubles as the sync engine's itemId. */
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
}
