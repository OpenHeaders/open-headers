/**
 * OAuth-bundle mutator catalog — routing constants.
 *
 * Singleton entity (per workspace). One OAuthBundle record holds three
 * parallel maps keyed by `credentialRef`:
 *   • `tokens`         — `OAuth2TokenBundle` (access/refresh/expiry).
 *   • `configs`        — `OAuth2Auth` sidecar captured at last
 *                        authorize/refresh; lets the scheduler rebuild
 *                        a refresh POST without walking the request
 *                        tree (§20 of the auth design).
 *   • `refreshErrors`  — `OAuthRefreshErrorState` failure counters for
 *                        exponential backoff across SW lifetimes.
 *
 * Each map is a set-modeled path on the singleton; set member identity
 * is `credentialRef`. Whole-record LWW per `(setPath, credentialRef)`
 * keeps the catalog primitives small and matches the env / collection
 * / workspace-vars / vault pattern.
 *
 * Sensitivity: the entire entity is §12.1 schema-marked sensitive
 * (access/refresh tokens, client_secret embedded in `configs[*]`).
 * Awareness scrubs `fieldFocus` for any state whose `entityFocus.type
 * === OAUTH_BUNDLE_ENTITY_TYPE` (§14.4). The §12.3 v1 commitment
 * (Vault non-syncing) extends here: this catalog services local
 * convergence only; shared transports skip OAuth bundles entirely.
 *
 * Side-effects: none. Token changes are consumed by the request
 * executor + offscreen host directly via the cache / chrome.storage
 * read path; the refresh scheduler + renderer credentials list
 * subscribe to the cache change signal. No `INVALIDATE_RESOLVER` —
 * tokens are not variables.
 */

/** Routing key carried on every oauth-bundle mutation envelope. */
export const OAUTH_BUNDLE_ENTITY_TYPE = 'oauth-bundle';

/** Fixed singleton id — every workspace has exactly one of these. */
export const OAUTH_BUNDLE_ID = 'oauth';

/** Set path holding `OAuth2TokenBundle` records keyed by credentialRef. */
export const OAUTH_TOKENS_PATH = 'tokens';

/** Set path holding `OAuth2Auth` sidecars keyed by credentialRef. */
export const OAUTH_CONFIGS_PATH = 'configs';

/** Set path holding `OAuthRefreshErrorState` records keyed by credentialRef. */
export const OAUTH_REFRESH_ERRORS_PATH = 'refreshErrors';
