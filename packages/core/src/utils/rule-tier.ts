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

import type { ExtensionRuleType, Rule } from '../types/rule';

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
const FETCH_CAPABLE_TYPES: ReadonlySet<ExtensionRuleType> = new Set<ExtensionRuleType>(['body', 'response', 'auth']);

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
 * tab is in CDP scope: debug-tier AND a *static* reaction. A dynamic
 * `response`/`body` body is user JS the request-stage interceptor can't eval, so
 * bringing a tab into scope does nothing for it (until the Response-stage
 * round-trip lands) — badging it dormant would imply a fix that arming can't
 * deliver. The single source of truth for the static test the Fetch reaction
 * uses, so the badge can never claim "realizable" for something the
 * interceptor passes through.
 */
export function isFetchRealizableNow(rule: Rule): boolean {
  // An auth rule carries only static credentials (no user-JS body), so it
  // is always realizable once its tab is in scope — realizability collapses
  // to debug-tier membership (always true for auth).
  if (rule.type === 'auth') return isDebugTierRule(rule);
  if (rule.type !== 'response' && rule.type !== 'body') return false;
  if (!isDebugTierRule(rule)) return false;
  return rule.action.bodyType !== 'dynamic';
}
