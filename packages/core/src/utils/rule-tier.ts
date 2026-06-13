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
 * monkey-patch that backs `body`/`mock`) can only synthesize or rewrite a
 * response for a page-issued `xhr` request. Navigations, workers,
 * out-of-process iframes, non-fetch subresources, and sockets are beyond
 * its reach — only `Fetch.fulfillRequest`/`continueRequest` touch them. So
 * a `mock`/`body` rule confined to `xhr` is injection-expressible
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
 * inject/delay/ws/sse). Phase D3's auth action joins this set.
 */
const FETCH_CAPABLE_TYPES: ReadonlySet<ExtensionRuleType> = new Set<ExtensionRuleType>(['body', 'mock']);

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
  const types = declaredResourceTypes(rule);
  if (types === null) return true;
  return types.some((type) => !INJECTION_REACHABLE_RESOURCE_TYPES.has(type));
}
