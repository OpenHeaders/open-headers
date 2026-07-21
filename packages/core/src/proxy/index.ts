/**
 * Host capture plane — pure shared helpers (`@openheaders/core/proxy`).
 *
 * Scope-match predicate and the proxy lifecycle identity constant. Both
 * are consumed by the daemon MITM server (`@openheaders/oracle-host-node`)
 * and by surfaces that preview scope / render the proxy capture source.
 * No `node:` imports — networking and cert work stay daemon-side.
 */

export { PROXY_LIFECYCLE_TAB_ID } from './identity';
export { buildScopePac } from './pac';
export type { ScopePattern } from './scope';
export { hostInScope, isValidScopePattern, normalizeHost, parseScopePattern } from './scope';
