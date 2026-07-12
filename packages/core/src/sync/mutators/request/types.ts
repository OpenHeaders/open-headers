/**
 * Request mutator catalog — routing constants + row shapes.
 *
 * Two set-modeled paths live on the Request entity:
 *
 *   - `headers` — request header rows (`{ key, value, description?, enabled? }`)
 *   - `params`  — URL query params (`{ key, value, description?, enabled?, hasEquals? }`)
 *
 * Every other request field — `name`, `description`, `method`, `url`,
 * `auth`, `body`, `credentialsMode`, `followRedirects`,
 * `sslVerification`, `tlsMinVersion`, `tlsMaxVersion`,
 * `tlsCipherSuites`, `allowHttp2`, `resolveToAddress`,
 * `clientCertificateRef`, `timeoutMs`,
 * `maxResponseBytes`, `maxRedirects`,
 * `followOriginalHttpMethod`, `followAuthorizationHeader`,
 * `preRequestScript`, `postResponseScript` — flows
 * through `setField`
 * scalars. Two design choices to call out:
 *
 *   - **`auth` and `body` are treated as scalars.** Both are
 *     discriminated unions whose type-flips (basic → oauth2, form →
 *     multipart) reshape the entire object. Per-field LWW within the
 *     variant would either need branch-aware paths the catalog can't
 *     know in advance, or would silently strand fields from the prior
 *     shape. Whole-object replacement is the v1 contract (parallel to
 *     `condition.ts`'s "per-field-within-set LWW is not a v1
 *     primitive" trade-off). Concurrent two-surface edits to body
 *     parts converge as last-writer-wins on the whole `body`.
 *   - **No `recompileDnr` / no `INVALIDATE_RESOLVER` side-effects.**
 *     Requests don't feed DNR (only Rules do), and the variables
 *     resolver invalidates on env / collection / workspace-vars /
 *     vault edits — never on consumer requests. Side effects are
 *     empty across every factory.
 */

/** Routing key carried on every request mutation envelope. */
export const REQUEST_ENTITY_TYPE = 'request';

/** Set path for request-header rows. */
export const REQUEST_HEADERS_PATH = 'headers';

/** Set path for URL query-param rows. */
export const REQUEST_PARAMS_PATH = 'params';

/**
 * Wire shape for a request-header row. Mirrors `RequestHeader`
 * field-for-field but typed locally so the catalog stays decoupled
 * from `@openheaders/core/types` (the same way other catalogs keep
 * their row shapes local).
 */
export interface RequestHeaderRow {
  /**
   * Persisted per-row identity. Doubles as the sync engine's itemId so
   * row identity round-trips through save/reload (parallel to
   * `HeaderModification.uid` and `RuleConditionLike.uid`).
   */
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
}

/**
 * Wire shape for a URL query-param row. Mirrors `QueryParam` —
 * `hasEquals` preserves the `?key` vs `?key=` distinction through
 * round-trip persistence (see schema for the full rationale).
 */
export interface RequestParamRow {
  /**
   * Persisted per-row identity. Doubles as the sync engine's itemId so
   * row identity round-trips through save/reload — parallel to
   * `RequestHeaderRow.uid`.
   */
  uid: string;
  key: string;
  value: string;
  description?: string;
  enabled?: boolean;
  hasEquals?: boolean;
}
