/**
 * Rule enforcement on the proxy plane (`PROXY_PLAN.md` Phase 3) — the
 * unification payoff: a rule authored once runs verbatim through the
 * MITM path. Pure planning module: given the current effective+resolved
 * rule set and one captured request, produce an enforcement plan the
 * server executes before/after re-origination.
 *
 * Matching rides the core `rule-matcher` primitives (the module's own
 * charter names this plane as its second consumer), so semantics are
 * identical to the extension by construction:
 *
 *  - URL conditions walk `getRuleMatchPatterns` + `doesUrlMatchEntry`;
 *    a rule with no URL conditions never matches (the extension law).
 *  - Method / request-domain conditions gate through the shared
 *    predicates. Resource-type conditions judge against the proxy's
 *    `other` classification (wire traffic carries no browser type).
 *  - Initiator conditions are skipped — the wire plane has no initiator
 *    evidence, mirroring the extension matcher's absent-context skip.
 *  - A response-gated rule (`response-header` conditions) participates
 *    ONLY in response-side header mods, judged against the actual
 *    arrived headers via `doesResponseHeaderMatchRule` — its
 *    request-side actions are unjudgeable at request time and skipped.
 *
 * Enforceable set this slice: header (request+response), redirect,
 * query-param, block, delay. Body-touching types (request-body,
 * response) need the capture body tee and are the next slice;
 * inject/ws/sse/auth stay browser-plane.
 *
 * Rules are evaluated against the ORIGINAL request URL (one pass, no
 * rewrite chaining); query-param mutations apply on top of a redirect
 * rewrite's target.
 */

import type { HeaderModification, QueryParamEntry, Rule } from '@openheaders/core/types';
import {
  doesMethodMatchRule,
  doesRequestDomainMatchRule,
  doesResourceTypeMatchRule,
  doesResponseHeaderMatchRule,
  doesUrlMatchEntry,
  getHeaderOperationCapability,
  getRuleMatchPatterns,
  isResponseGatedRule,
} from '@openheaders/core/utils';
import type { ProxyHeader } from './mitm-types';

/** Chrome webRequest/DNR vocabulary bucket for un-classified wire traffic. */
const PROXY_RESOURCE_TYPE = 'other';

/**
 * The current effective + resolved rule set. Implementations own the
 * effectiveness gate (`isRuleEffective`) and template resolution — the
 * planner trusts every returned rule to be live-fire material.
 */
export interface ProxyRuleSource {
  getRules(): readonly Rule[];
}

/** One rule-driven in-place URL rewrite, recorded as an internal hop. */
export interface ProxyInternalRewrite {
  readonly ruleUid: string;
  readonly sourceUrl: string;
  readonly redirectUrl: string;
}

/** Everything the server must do to one exchange before/after upstream. */
export interface ProxyRequestPlan {
  /** Effective target URL after redirect/query-param rewrites. */
  readonly url: string;
  /** Request headers after request-side header mods — the wire set. */
  readonly requestHeaders: readonly ProxyHeader[];
  /** Set when a block rule matched — refuse instead of re-originating. */
  readonly blockedBy?: string;
  /** Summed delay from matched delay rules; 0 when none. */
  readonly delayMs: number;
  /** Rule rewrites in application order (redirect first, then params). */
  readonly rewrites: readonly ProxyInternalRewrite[];
  /** Uids of every rule that acted on the request side. */
  readonly appliedRuleUids: readonly string[];
  /** Header rules holding response-side mods, judged/applied at arrival. */
  readonly responseHeaderRules: readonly Rule[];
}

export interface ProxyResponseHeadersResult {
  readonly headers: readonly ProxyHeader[];
  readonly appliedRuleUids: readonly string[];
}

export interface ProxyRuleEnforcer {
  planRequest(input: { url: string; method: string; headers: readonly ProxyHeader[] }): ProxyRequestPlan;
  /** Apply the plan's response-side header mods to the arrived head. */
  applyResponseHeaders(plan: ProxyRequestPlan, headers: readonly ProxyHeader[]): ProxyResponseHeadersResult;
}

/** Request-context match — everything judgeable before the wire. */
function matchesRequest(rule: Rule, url: string, method: string): boolean {
  if (!doesMethodMatchRule(method, rule)) return false;
  if (!doesResourceTypeMatchRule(PROXY_RESOURCE_TYPE, rule)) return false;
  if (!doesRequestDomainMatchRule(url, rule)) return false;
  const patterns = getRuleMatchPatterns(rule);
  if (patterns.length === 0) return false;
  return patterns.some((entry) => doesUrlMatchEntry(url, entry));
}

/**
 * Apply one direction's header mods to an ordered header list. Names
 * compare case-insensitively; list order and on-the-wire casing are
 * preserved for untouched entries. Mods whose resolved name fails the
 * shared capability gate are skipped — the DNR compiler's defensive
 * posture, so a rule behaves identically on both planes.
 */
function applyHeaderMods(
  headers: readonly ProxyHeader[],
  mods: readonly HeaderModification[],
  direction: 'request' | 'response',
): ProxyHeader[] {
  let out = [...headers];
  for (const mod of mods) {
    const name = mod.headerName.trim();
    if (name === '') continue;
    if (!getHeaderOperationCapability(direction, mod.operation, name).allowed) continue;
    const lower = name.toLowerCase();
    if (mod.operation === 'remove') {
      out = out.filter((h) => h.name.toLowerCase() !== lower);
      continue;
    }
    const value = mod.value ?? '';
    if (mod.operation === 'add') {
      out.push({ name, value });
      continue;
    }
    if (mod.operation === 'merge') {
      const separator = mod.mergeSeparator ?? ', ';
      const existing = out.filter((h) => h.name.toLowerCase() === lower).map((h) => h.value);
      const merged = existing.length > 0 ? `${existing.join(separator)}${separator}${value}` : value;
      out = out.filter((h) => h.name.toLowerCase() !== lower);
      out.push({ name, value: merged });
      continue;
    }
    // 'override' — replace every instance with one entry.
    out = out.filter((h) => h.name.toLowerCase() !== lower);
    out.push({ name, value });
  }
  return out;
}

/** Apply query-param entries to a URL; unparseable URLs pass through. */
function applyQueryParams(url: string, params: readonly QueryParamEntry[]): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  for (const entry of params) {
    if (entry.operation === 'remove-all') {
      parsed.search = '';
      continue;
    }
    const param = entry.param.trim();
    if (param === '') continue;
    if (entry.operation === 'remove') {
      parsed.searchParams.delete(param);
    } else if (entry.operation === 'override') {
      if (parsed.searchParams.has(param)) parsed.searchParams.set(param, entry.value ?? '');
    } else {
      // 'add' — add or replace.
      parsed.searchParams.set(param, entry.value ?? '');
    }
  }
  return parsed.toString();
}

export function createProxyRuleEnforcer(source: ProxyRuleSource): ProxyRuleEnforcer {
  function planRequest(input: { url: string; method: string; headers: readonly ProxyHeader[] }): ProxyRequestPlan {
    const rules = source.getRules();
    const matched: Rule[] = [];
    const responseHeaderRules: Rule[] = [];
    for (const rule of rules) {
      if (!matchesRequest(rule, input.url, input.method)) continue;
      if (rule.type === 'header' && rule.action.responseHeaders.length > 0) {
        responseHeaderRules.push(rule);
      }
      // Response-gated rules cannot prove themselves at request time —
      // they participate only in the response-side application above.
      if (isResponseGatedRule(rule)) continue;
      matched.push(rule);
    }

    const appliedRuleUids: string[] = [];
    const rewrites: ProxyInternalRewrite[] = [];

    const blocking = matched.find((rule) => rule.type === 'block');
    if (blocking !== undefined) {
      return {
        url: input.url,
        requestHeaders: input.headers,
        blockedBy: blocking.uid,
        delayMs: 0,
        rewrites: [],
        appliedRuleUids: [blocking.uid],
        responseHeaderRules: [],
      };
    }

    let url = input.url;
    const redirecting = matched.find((rule) => rule.type === 'redirect');
    if (redirecting !== undefined && redirecting.type === 'redirect') {
      const target = redirecting.action.redirectTo.trim();
      if (target !== '' && target !== url) {
        rewrites.push({ ruleUid: redirecting.uid, sourceUrl: url, redirectUrl: target });
        appliedRuleUids.push(redirecting.uid);
        url = target;
      }
    }

    for (const rule of matched) {
      if (rule.type !== 'query-param') continue;
      const next = applyQueryParams(url, rule.action.params);
      if (next === url) continue;
      rewrites.push({ ruleUid: rule.uid, sourceUrl: url, redirectUrl: next });
      appliedRuleUids.push(rule.uid);
      url = next;
    }

    let delayMs = 0;
    for (const rule of matched) {
      if (rule.type !== 'delay') continue;
      if (Number.isFinite(rule.action.delayMs) && rule.action.delayMs > 0) {
        delayMs += rule.action.delayMs;
        appliedRuleUids.push(rule.uid);
      }
    }

    let requestHeaders: readonly ProxyHeader[] = input.headers;
    for (const rule of matched) {
      if (rule.type !== 'header' || rule.action.requestHeaders.length === 0) continue;
      const next = applyHeaderMods(requestHeaders, rule.action.requestHeaders, 'request');
      requestHeaders = next;
      appliedRuleUids.push(rule.uid);
    }

    return { url, requestHeaders, delayMs, rewrites, appliedRuleUids, responseHeaderRules };
  }

  function applyResponseHeaders(plan: ProxyRequestPlan, headers: readonly ProxyHeader[]): ProxyResponseHeadersResult {
    let out: readonly ProxyHeader[] = headers;
    const appliedRuleUids: string[] = [];
    for (const rule of plan.responseHeaderRules) {
      if (rule.type !== 'header') continue;
      // Judge response-header conditions the moment Chrome itself would.
      if (!doesResponseHeaderMatchRule(headers, rule)) continue;
      out = applyHeaderMods(out, rule.action.responseHeaders, 'response');
      appliedRuleUids.push(rule.uid);
    }
    return { headers: out, appliedRuleUids };
  }

  return { planRequest, applyResponseHeaders };
}
