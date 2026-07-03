/**
 * Phase-D reaction logic: given a paused request and the live rules, decide
 * how to answer it. Pure and host-side (typed against the oracle control
 * vocabulary, like {@link compileFetchPatterns} in cdp-fetch-patterns.ts).
 * The `Fetch.enable` `urlPattern` set is only a COARSE pre-filter — THIS is
 * the authoritative match: it re-checks every condition (url, request-domains
 * / methods / resource-types and their excludes, the GraphQL filter, and — at
 * the Response stage — response-header conditions) before reacting.
 *
 * Two interception stages, two entry points:
 *   - {@link resolveFetchReaction} — REQUEST stage. A static `mock`-source
 *     `response` becomes a fulfill; a `mock`-source `response` with a DYNAMIC
 *     body becomes an `eval-fulfill` (the interceptor evals `buildResponse` in
 *     the request frame, then fulfills — D2b-2a); a static `request-body`
 *     becomes a request-body rewrite (the page-context wrapper does the same —
 *     it replaces the outgoing fetch/XHR body, not the server's response); a
 *     DYNAMIC `request-body` becomes an `eval-continue` (the interceptor reads
 *     the outgoing body, evals `modifyRequestBody` over it in the request
 *     frame, then continues with the rewritten body — D2b-2c); a
 *     `network`-source `response` (static OR dynamic body) becomes an
 *     `await-response` continue (`interceptResponse:true`) that sends the real
 *     request and re-pauses at the Response stage. Its response-header
 *     conditions are DEFERRED to that stage (the real reply's headers don't
 *     exist yet).
 *   - {@link resolveResponseReaction} — RESPONSE stage, reached only for an
 *     `await-response` request. Re-matches (now evaluating response-header
 *     conditions against the real reply) and either fulfills with the rule's
 *     static body (mirroring `new Response(cfg.body, { status, headers })`) or,
 *     for a DYNAMIC body, yields an `eval-response-fulfill` plan — the
 *     interceptor reads the real reply (`getResponseBody`), evals
 *     `modifyResponse` over it, then fulfills the result (D2b-2b). Either way
 *     over the real status (or the override) and the merged headers.
 *
 * Falls through to pass-through for a rule carrying a condition no stage can
 * evaluate (initiator-domains, domain-type) — enforcing it via injection's own
 * page gate is correct, over-applying via Fetch is not.
 * `isFetchRealizableNow` is the single gate; every Fetch-capable cell (static +
 * all dynamic) now realizes, so a passed-through rule is one whose conditions
 * the network layer can't see, never an unsupported reaction. A passed-through
 * rule still runs its page-context injection path.
 */

export {
  decodeResponseBody,
  mockResponseEvalArg,
  networkResponseEvalArg,
  requestBodyEvalArg,
  wrapMockResponseFn,
  wrapNetworkResponseFn,
  wrapRequestBodyFn,
} from './eval-bridge';
export {
  buildEvalFulfill,
  buildNetworkEvalFulfill,
  buildRequestBodyEvalContinue,
} from './fulfill';
export { resolveAuthReaction, resolveFetchReaction, resolveResponseReaction } from './resolve';
export { cdpResourceTypeToCondition, cdpResourceTypeToTracked } from './resource-types';
export type {
  CdpAuthReaction,
  CdpFetchReaction,
  CdpNetworkEvalPlan,
  CdpRequestBodyEvalPlan,
  CdpResponseEvalPlan,
  CdpResponseReaction,
} from './types';
