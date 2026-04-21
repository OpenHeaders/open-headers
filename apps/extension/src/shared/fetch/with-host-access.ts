/**
 * withHostAccess — single choke point for every user-request fetch
 * that leaves the service worker.
 *
 * Today this is a pass-through: the extension ships with `<all_urls>`
 * host permission, so every fetch is already authorized. The wrapper
 * exists so a future minimal-permissions enterprise SKU — which would
 * ship without `<all_urls>` and request host permissions on first use
 * — is a one-file change: gate inside here, not at every call site.
 *
 * Invariant: bare `fetch(` is forbidden in the SW path outside this
 * module. Request-executor, rule-refresh, future OAuth token refresh,
 * and any other user-facing HTTP path MUST route through here.
 *
 * Why a wrapper instead of a lint rule? Lint rules are easy to silence
 * and hard to enforce in multi-workspace monorepos. A typed function
 * with a dedicated module provides the single grep surface ("where do
 * user-fetches live?") and lets us inject cross-cutting behavior
 * (retries, structured telemetry, cancellation) without touching call
 * sites if/when we need it.
 */
export async function withHostAccess<T>(_url: string, fn: () => Promise<T>): Promise<T> {
  return fn();
}
