/**
 * Rule matching core — the resolved-rule view, the cached url-filter
 * matcher, pattern precompilation, and the URL→rules attribution the
 * fire-recorder and shadow arbitration consume.
 */

import type { HeaderOperation, HeaderRule, ResponseSource, Rule } from '@openheaders/core/types';
import {
  doesUrlMatchEntry as coreDoesUrlMatchEntry,
  doesInitiatorMatchRule,
  doesMethodMatchRule,
  doesRequestDomainMatchRule,
  doesResourceTypeMatchRule,
  doesResponseHeaderMatchRule,
  getRuleMatchPatterns,
  isResponseGatedRule,
  isRuleComplete,
  type MatchPattern,
} from '@openheaders/core/utils';
import { getRules as getRawRules } from '@openheaders/oracle/entity/rule-store';
import { getResolvedRules, getUnresolvableRuleUids } from '@openheaders/oracle/rule-engine/variables-resolver';
import { clearPatternCache, doesUrlMatchPattern, normalizeUrlForTracking, precompileAllPatterns } from '../url-utils';

/** Read the current rule list in resolved form, falling back to the
 *  raw rule-store view before the first compile has populated the
 *  resolver snapshot. Every call site in this folder that matches URL
 *  patterns goes through this helper. */
export function getRules(): Rule[] {
  const resolved = getResolvedRules();
  return resolved.length > 0 ? resolved : getRawRules();
}

/**
 * Test if a URL matches a MatchPattern. Thin wrapper around core's
 * matcher that routes 'url-filter' patterns through the extension's
 * compiled-regex cache (`doesUrlMatchPattern`) for hot-path perf. The
 * match semantics are identical to core — the cache is pure memoization.
 */
export function doesUrlMatchEntry(url: string, entry: MatchPattern): boolean {
  if (entry.kind === 'url-filter') {
    return doesUrlMatchPattern(url, entry.pattern);
  }
  return coreDoesUrlMatchEntry(url, entry);
}

// ── Pattern precompilation ────────────────────────────────────────

/**
 * Precompile URL patterns from all rules for fast matching.
 * Called when rules change.
 */
export function precompileRulePatterns(): void {
  clearPatternCache();
  const compilablePatterns: string[] = [];
  for (const rule of getRules()) {
    for (const entry of getRuleMatchPatterns(rule)) {
      // url-regex patterns are used as-authored; only url-filter goes
      // through the cached urlFilter compiler.
      if (entry.kind === 'url-filter') {
        compilablePatterns.push(entry.pattern);
      }
    }
  }
  if (compilablePatterns.length > 0) {
    precompileAllPatterns(compilablePatterns);
  }
}

// ── Matching ──────────────────────────────────────────────────────

/**
 * Check if a URL matches any rule's URL conditions (request-domains,
 * url-filter, url-regex). A complete rule without any URL conditions
 * is never considered a match — rules that don't declare where they
 * apply don't fire anywhere.
 */
export function checkIfUrlMatchesAnyRule(url: string): boolean {
  const normalizedUrl = normalizeUrlForTracking(url);
  const unresolvable = getUnresolvableRuleUids();
  for (const rule of getRules()) {
    if (!isRuleComplete(rule)) continue;
    if (unresolvable.has(rule.uid)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * A single header operation as seen by arbitration. Normalized away from
 * the wire shape (`override`/`add` collapsed into set/append) because
 * the arbitrator only cares about the *effective semantics* on Chrome's
 * side, not the UX labels. The name is lowercased — HTTP header names are
 * case-insensitive and Chrome collapses them internally.
 */
export interface MatchingRuleHeaderOp {
  side: 'request' | 'response';
  /**
   * Effective operation:
   *   - 'set'     — override an existing value (Chrome 'set'; previously 'override')
   *   - 'append'  — add a new header entry alongside any existing ('add')
   *   - 'remove'  — delete all instances of the header
   *   - 'merge'   — scriptable read-modify-write, not a DNR operation
   */
  operation: 'set' | 'append' | 'remove' | 'merge';
  /** Lowercased header name. */
  name: string;
}

/**
 * A single rule that matched a request — the minimum info the fire-recorder
 * needs to drive tab-telemetry ingestion AND shadow arbitration.
 */
export interface MatchingRule {
  uid: string;
  name: string;
  type: Rule['type'];
  pattern: string;
  /**
   * True when the rule has a scriptable channel that *might* emit a fire
   * via the in-page fire-bridge. Gates the 500ms fallback buffer in
   * tab-telemetry. See `computeDeferred` below for the per-type rules —
   * notably, header rules are only deferred when they have `merge`
   * operations, because plain override/set/remove operations run through
   * pure DNR and never emit a scriptable fire.
   */
  deferred: boolean;
  /**
   * Populated only for `header` rules. Used by shadow arbitration to
   * detect header-stacking ambiguity and mock-intercept on response-side
   * modifications. Normalized away from the wire shape.
   */
  headerOps?: MatchingRuleHeaderOp[];
  /**
   * Populated only for `response` rules — the source axis. Shadow
   * arbitration only treats a `mock`-source response as a fabricating
   * intercept; a `network`-source one modifies the real reply and never
   * shadows the response-side modifiers around it.
   */
  responseSource?: ResponseSource;
  /**
   * True when the rule's action is gated on request CONTENT (a GraphQL
   * operation filter on response / request-body rules). A URL-only
   * observation cannot prove such a rule acted — the wrapper declines
   * non-matching operations on the same URL — so the fire-recorder must
   * not attribute observed fires; the wrapper relay is the only source.
   */
  contentGated?: boolean;
  /**
   * True when the rule carries a `response-header` /
   * `exclude-response-header` condition — a gate Chrome judges only when
   * the reply arrives, so it is unjudgeable at request start. Same law as
   * `contentGated`, different moment: the fire-recorder parks such rules
   * at observation time and judges them against the actual response
   * headers at the headers-received phase (promote or drop).
   */
  responseGated?: boolean;
}

/**
 * Decide whether a specific rule instance can emit a scriptable fire. This
 * is per-rule, not per-type, because `header` rules are split: merge-type
 * operations flow through the MAIN-world fire-bridge, but plain
 * override/set/remove operations stay pure DNR. Passing the wrong flag
 * would strand plain header rules in the fallback buffer and surface them
 * as `matched-fallback` evidence, which is factually wrong. Inject is NOT
 * deferred: it has no fire-bridge channel at all — its only act is the
 * frameId-0 injection after commit, carried by the main-frame record.
 */
function computeDeferred(rule: Rule): boolean {
  switch (rule.type) {
    case 'delay':
    case 'request-body':
    case 'response':
      return true;
    case 'header':
      return hasHeaderMergeAction(rule);
    default:
      return false;
  }
}

function hasHeaderMergeAction(rule: HeaderRule): boolean {
  const req = rule.action.requestHeaders ?? [];
  const res = rule.action.responseHeaders ?? [];
  for (const h of req) if (h.operation === 'merge') return true;
  for (const h of res) if (h.operation === 'merge') return true;
  return false;
}

/**
 * Normalize a header rule's action into the arbitration-facing shape.
 * the model'ss `override` is Chrome's `set`; the model'ss `add` is Chrome's `append`;
 * `remove` and `merge` pass through. Names are lowercased because HTTP
 * header matching is case-insensitive. Empty output means "header rule
 * with no modifications" — callers should treat that the same as a
 * non-header rule for arbitration purposes.
 */
function extractHeaderOps(rule: HeaderRule): MatchingRuleHeaderOp[] {
  const out: MatchingRuleHeaderOp[] = [];
  const convert = (op: HeaderOperation): MatchingRuleHeaderOp['operation'] => {
    if (op === 'override') return 'set';
    if (op === 'add') return 'append';
    return op; // 'remove' | 'merge'
  };
  for (const h of rule.action.requestHeaders ?? []) {
    if (!h.headerName) continue;
    out.push({ side: 'request', operation: convert(h.operation), name: h.headerName.toLowerCase() });
  }
  for (const h of rule.action.responseHeaders ?? []) {
    if (!h.headerName) continue;
    out.push({ side: 'response', operation: convert(h.operation), name: h.headerName.toLowerCase() });
  }
  return out;
}

/**
 * Return every enabled, complete rule whose URL conditions match this URL.
 * Used by the fire-recorder (rule-engine-driver) to attribute each
 * observed request to the specific rule uids that would have matched.
 * The `pattern` field is the literal pattern string from the first matching
 * condition — callers pass it through to tab-telemetry so the expand panel
 * can highlight which condition matched. `name` is included so shadow
 * arbitration can surface the shadowing rule's name in tooltips. `deferred`
 * is computed per-rule so header rules without merge operations don't end
 * up stranded in the scriptable fallback buffer. `context` carries the
 * observation's non-URL evidence: when present, request-methods and
 * resource-types conditions gate the match — a condition-gated rule never
 * touched a request outside its gate and must not attribute a fire off it.
 */
export interface MatchRequestContext {
  method?: string;
  resourceType?: string;
  /** The request initiator (an origin string, e.g. 'http://openheaders.com'). */
  initiator?: string;
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function matchRulesToRequest(url: string, context?: MatchRequestContext): MatchingRule[] {
  const normalizedUrl = normalizeUrlForTracking(url);
  const initiatorHost = context?.initiator === undefined ? undefined : hostnameOf(context.initiator);
  const unresolvable = getUnresolvableRuleUids();
  const out: MatchingRule[] = [];
  for (const rule of getRules()) {
    if (!rule.enabled || !isRuleComplete(rule)) continue;
    if (context?.method !== undefined && !doesMethodMatchRule(context.method, rule)) continue;
    if (context?.resourceType !== undefined && !doesResourceTypeMatchRule(context.resourceType, rule)) continue;
    if (!doesRequestDomainMatchRule(normalizedUrl, rule)) continue;
    if (initiatorHost !== undefined && !doesInitiatorMatchRule(initiatorHost, rule)) continue;
    // Rules with unresolved `{{ref}}`s aren't in Chrome's DNR set
    // (see `dnr-manager.rebuildAll`), so they don't participate in
    // arbitration either. Skipping here means shadow-warnings stay
    // honest — we don't report a "shadowed by X" conflict against a
    // rule that isn't actually active on the wire.
    if (unresolvable.has(rule.uid)) continue;
    for (const entry of getRuleMatchPatterns(rule)) {
      if (doesUrlMatchEntry(normalizedUrl, entry)) {
        const matching: MatchingRule = {
          uid: rule.uid,
          name: rule.name,
          type: rule.type,
          pattern: entry.pattern,
          deferred: computeDeferred(rule),
        };
        if (rule.type === 'header') {
          const ops = extractHeaderOps(rule);
          if (ops.length > 0) matching.headerOps = ops;
        }
        if (rule.type === 'response') matching.responseSource = rule.action.responseSource;
        if ((rule.type === 'response' || rule.type === 'request-body') && rule.action.graphqlFilter?.key) {
          matching.contentGated = true;
        }
        if (isResponseGatedRule(rule)) matching.responseGated = true;
        out.push(matching);
        break;
      }
    }
  }
  return out;
}

/**
 * Judge a response-gated rule against the response headers that actually
 * arrived — the moment Chrome itself evaluates the gate. Resolved fresh
 * against the current rule pool (nothing is cached from observation
 * time); a rule deleted or rewritten since the request started has no
 * proof it acted and judges false.
 */
export function doesResponseHeaderGateApprove(
  ruleUid: string,
  headers: readonly { name: string; value: string }[],
): boolean {
  const rule = getRules().find((r) => r.uid === ruleUid);
  if (!rule) return false;
  return doesResponseHeaderMatchRule(headers, rule);
}
