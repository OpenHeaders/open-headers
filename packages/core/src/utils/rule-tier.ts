/**
 * Derived rule-tier classification (CDP Control Plane, Phase D).
 *
 * A rule is *debug-tier* iff realizing its full effect REQUIRES CDP `Fetch`
 * interception — neither DNR nor page-context script injection can reach
 * every request it matches. The tier is never stored on the rule; it is
 * computed from the action's capability and the rule's reach, the same way
 * `DnrRuleType` / `ScriptRuleType` encode capability subsets rather than
 * persisted shapes.
 *
 * Reach, not just action: page-context injection (the fetch/XHR
 * monkey-patch that backs `body`/`response`) can only synthesize or rewrite a
 * response for a page-issued `xhr` request. Navigations, workers,
 * out-of-process iframes, non-fetch subresources, and sockets are beyond
 * its reach — only `Fetch.fulfillRequest`/`continueRequest` touch them. So
 * a `response`/`body` rule confined to `xhr` is injection-expressible
 * (standard); one whose reach exceeds `xhr` needs Fetch (debug).
 *
 * The classification is ADDITIVE, never a gate: an un-armed debug-tier rule
 * still runs its injection path over page `xhr` exactly as before; arming a
 * tab extends the SAME rule to the contexts injection can't reach. The
 * dormant-rule badge therefore means "extended all-context reach available
 * when armed", not "inert".
 */

import type { ConditionType, ExtensionRuleType, Rule } from '../types/rule';

/**
 * Resource types page-context fetch/XHR injection can intercept for
 * response synthesis/rewrite. Chrome classifies both `fetch()` and
 * `XMLHttpRequest` as `xhr`; every other resource type is issued outside
 * page JS's reach. Compared against the free-form condition `values`
 * strings directly — no narrowing cast.
 */
const INJECTION_REACHABLE_RESOURCE_TYPES: ReadonlySet<string> = new Set(['xhr']);

/**
 * Action types with a CDP `Fetch` realization. Only these can be
 * debug-tier; the rest are always standard (DNR for
 * header/block/redirect/query-param; page-context script for
 * inject/delay/ws/sse). `auth` answers a challenge over
 * `Fetch.continueWithAuth` (Phase D3) — it has no DNR / injection
 * equivalent, so it is unconditionally debug-tier (see below).
 */
const FETCH_CAPABLE_TYPES: ReadonlySet<ExtensionRuleType> = new Set<ExtensionRuleType>([
  'request-body',
  'response',
  'auth',
]);

/**
 * The resource-type reach a rule declares via its `resource-types`
 * condition. `null` means unrestricted — the rule matches every resource
 * type, which necessarily includes contexts injection cannot reach.
 */
function declaredResourceTypes(rule: Rule): readonly string[] | null {
  const condition = rule.conditions.find((c) => c.type === 'resource-types');
  if (!condition || condition.values.length === 0) return null;
  return condition.values;
}

/**
 * True iff the rule's full effect requires CDP `Fetch` interception: its
 * action has a Fetch realization AND its reach exceeds what page-context
 * injection covers (`xhr`). An un-restricted Fetch-capable rule is
 * debug-tier because it can match navigations/workers/subresources.
 */
export function isDebugTierRule(rule: Rule): boolean {
  if (!FETCH_CAPABLE_TYPES.has(rule.type)) return false;
  // An auth challenge (401/407) can only be answered over CDP `Fetch` —
  // page injection has no way to satisfy it — so an auth rule is
  // debug-tier regardless of its declared reach (the `xhr` contest below
  // is meaningless when there is no injection path at all).
  if (rule.type === 'auth') return true;
  const types = declaredResourceTypes(rule);
  if (types === null) return true;
  return types.some((type) => !INJECTION_REACHABLE_RESOURCE_TYPES.has(type));
}

/**
 * True iff a debug-tier rule's full effect is realizable RIGHT NOW once its
 * tab is in CDP scope: debug-tier AND a reaction the host can run at the
 * network layer. As of D2b-2c EVERY Fetch-capable cell qualifies, so
 * realizability has collapsed to debug-tier membership: static bodies (`mock`
 * fulfills synthetically at the request stage, `network` substitutes at the
 * Response stage — D2b-1), and all three dynamic bodies (`mock`+dynamic evals
 * `buildResponse` — D2b-2a; `network`+dynamic evals `modifyResponse` over the
 * real reply — D2b-2b; `request-body`+dynamic evals `modifyRequestBody` over
 * the outgoing body — D2b-2c). The single source of truth for the
 * realizability test the Fetch reaction uses, so the badge can never claim
 * "realizable" for something the interceptor passes through. D4a's
 * injection-suppression set and the dormant badge both derive from this
 * predicate.
 */
export function isFetchRealizableNow(rule: Rule): boolean {
  // An auth rule carries only static credentials (no user-JS body), so it
  // is always realizable once its tab is in scope — realizability collapses
  // to debug-tier membership (always true for auth).
  if (rule.type === 'auth') return isDebugTierRule(rule);
  if (rule.type !== 'response' && rule.type !== 'request-body') return false;
  // Every Fetch-capable cell — static or dynamic, every source — now realizes
  // at the network layer, so realizability is exactly debug-tier membership.
  return isDebugTierRule(rule);
}

/**
 * Conditions a CDP `Fetch` interception can evaluate at the REQUEST stage — URL,
 * request domain/method/resource and their excludes. A paused request exposes
 * none of the initiator, document party, or response headers.
 */
export const CDP_REQUEST_STAGE_CONDITIONS: ReadonlySet<ConditionType> = new Set<ConditionType>([
  'url-filter',
  'url-regex',
  'request-domains',
  'exclude-request-domains',
  'request-methods',
  'exclude-request-methods',
  'resource-types',
  'exclude-resource-types',
]);

/**
 * Conditions only the RESPONSE stage can additionally evaluate — the real
 * reply's headers are observable there. A `network`-source rule defers these
 * past the request stage; no other interception reaches them.
 */
export const CDP_RESPONSE_STAGE_CONDITIONS: ReadonlySet<ConditionType> = new Set<ConditionType>([
  'response-header',
  'exclude-response-header',
]);

/**
 * True iff EVERY condition the rule carries is evaluable by some CDP `Fetch`
 * stage. The complement — `initiator-domains`, `exclude-initiator-domains`,
 * `domain-type` — is a page-origin / document-party gate no network-layer stage
 * can see, so the reaction resolvers DECLINE such a rule (pass-through). Derived
 * from the stage sets, never the three names, so a future condition stays right.
 *
 * D4a's injection-suppression pairs this with {@link isFetchRealizableNow}: a
 * debug-tier rule is owned by CDP — its in-page wrapper suppressed — only when
 * CDP can ACTUALLY realize it. One carrying an un-evaluable condition keeps its
 * page-context injection path (over `xhr`, page-gated) instead of realizing
 * nowhere.
 */
export function isCdpEvaluable(rule: Rule): boolean {
  return rule.conditions.every((c) => {
    // An empty row carries no constraint (a `domain-type` row constrains even
    // when empty) — mirrors the resolver's stage re-check.
    if (c.values.length === 0 && c.type !== 'domain-type') return true;
    return CDP_REQUEST_STAGE_CONDITIONS.has(c.type) || CDP_RESPONSE_STAGE_CONDITIONS.has(c.type);
  });
}

/**
 * Rule types delivered as an in-page wrapper that can ride a document-bootstrap
 * script (CDP Control Plane, Phase E1). The script-based wrapper set minus
 * `inject` (a one-shot page-DOM injection at a configured position, not a
 * fetch/XHR/socket wrapper that races page scripts), plus `header` (whose
 * MERGE operations install an in-page wrapper — its set/append/remove ops are
 * pure DNR and carry no wrapper, which the compile step simply finds nothing
 * to render for).
 */
const BOOTSTRAP_WRAPPER_TYPES: ReadonlySet<ExtensionRuleType> = new Set<ExtensionRuleType>([
  'delay',
  'ws',
  'sse',
  'header',
  'response',
  'request-body',
]);

/**
 * True iff the rule declares an initiator-domain condition (include or
 * exclude) with at least one non-blank value — a PAGE-origin gate.
 */
function hasInitiatorDomainCondition(rule: Rule): boolean {
  return rule.conditions.some(
    (cond) =>
      (cond.type === 'initiator-domains' || cond.type === 'exclude-initiator-domains') &&
      cond.values.some((value) => value.trim().length > 0),
  );
}

/**
 * True iff the rule's in-page wrapper should be DELIVERED via a CDP document-
 * bootstrap script on an in-scope tab (Phase E1b) — the delivery-precedence
 * twin of {@link isFetchRealizableNow}'s modification precedence:
 *
 *   - {@link isFetchRealizableNow} → realized at the NETWORK layer (CDP `Fetch`),
 *     with NO in-page wrapper (D4a suppresses injection for it).
 *   - `isBootstrapEligible` → the COMPLEMENT among in-page wrappers, delivered
 *     race-free BEFORE page scripts via `Page.addScriptToEvaluateOnNewDocument`
 *     instead of racing the page on `webNavigation.onCommitted`.
 *
 * One partition line, two precedence axes. Three gates:
 *   1. a residual wrapper (NOT network-realized) — else the network owns it;
 *   2. a wrapper TYPE (not `inject`, which is page-DOM / navigation-only);
 *   3. NO initiator-domain condition — a page-origin gate the per-document
 *      `onCommitted` path enforces precisely, but a bootstrap script (which
 *      persists across navigations) cannot, so initiator-gated wrappers stay
 *      on the `onCommitted` path.
 */
export function isBootstrapEligible(rule: Rule): boolean {
  if (!BOOTSTRAP_WRAPPER_TYPES.has(rule.type)) return false;
  if (isFetchRealizableNow(rule)) return false;
  if (hasInitiatorDomainCondition(rule)) return false;
  return true;
}
