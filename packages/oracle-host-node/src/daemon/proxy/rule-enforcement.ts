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
 * Enforceable set: header (request+response), redirect, query-param,
 * block, delay, plus — with the capture body tee — the two body-touching
 * types, STATIC bodies only (a dynamic body is user JS whose eval plane
 * is the page/CDP; the wire plane skips it defensively, the
 * capability-refused posture):
 *
 *  - `request-body` substitutes the outgoing body before re-origination;
 *  - `response` `mock` answers synthetically without re-originating;
 *  - `response` `network` sends the real request and substitutes the
 *    arrived reply (deferred response-header conditions judged there).
 *
 * Body-rule selection is first-match exclusive in rule order across both
 * types — the CDP `Fetch` reaction's resolver contract. A GraphQL-
 * filtered rule judges against the read-ahead request body under the
 * shared inline bound (over-bound ⇒ the gate sees no body ⇒ no fire).
 *
 * Rules are evaluated against the ORIGINAL request URL (one pass, no
 * rewrite chaining); query-param mutations apply on top of a redirect
 * rewrite's target.
 */

import type { HeaderModification, QueryParamEntry, Rule } from '@openheaders/core/types';
import {
  doesGraphqlBodyGatePass,
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
  /**
   * Static body-capable candidates (`request-body`, `response`
   * mock/network) that matched the request stage, in rule order — their
   * gates (GraphQL filter, deferred response-header conditions) are
   * judged later when the evidence exists, and a gate-failing candidate
   * falls through to the next (the CDP resolver's contract). Empty = no
   * body rule participates.
   */
  readonly bodyRules: readonly Rule[];
}

/** What the server must do about bodies, judged once the gate evidence exists. */
export type ProxyBodyPlan =
  /** Substitute the outgoing request body with the rule's literal. */
  | { readonly kind: 'request-body'; readonly ruleUid: string; readonly body: string }
  /** Answer synthetically — the exchange never re-originates. */
  | {
      readonly kind: 'mock';
      readonly ruleUid: string;
      readonly statusCode: number;
      readonly headers: readonly ProxyHeader[];
      readonly body: string;
    }
  /**
   * Send the real request; substitution is judged/applied at arrival.
   * Carries every gate-passed `network`-source candidate in order — the
   * arrival judgment takes the first whose deferred response-header
   * conditions match the real reply.
   */
  | { readonly kind: 'network-response'; readonly rules: readonly Rule[] };

/** The substituted reply a `network`-source response rule serves. */
export interface ProxyServedResponse {
  readonly ruleUid: string;
  readonly statusCode: number;
  readonly statusText: string;
  readonly headers: readonly ProxyHeader[];
  readonly body: string;
}

export interface ProxyResponseHeadersResult {
  readonly headers: readonly ProxyHeader[];
  readonly appliedRuleUids: readonly string[];
}

export interface ProxyRuleEnforcer {
  planRequest(input: { url: string; method: string; headers: readonly ProxyHeader[] }): ProxyRequestPlan;
  /**
   * True when judging the plan's body candidate needs the request-body
   * text (an active GraphQL filter) — the server reads ahead up to the
   * gate bound before calling {@link planBody}.
   */
  needsRequestBodyText(plan: ProxyRequestPlan): boolean;
  /**
   * Judge the plan's body candidate against the read-ahead body text
   * (`undefined` = absent or over the gate bound). `null` = no body
   * action on this exchange.
   */
  planBody(plan: ProxyRequestPlan, requestBodyText: string | undefined): ProxyBodyPlan | null;
  /**
   * Judge a `network-response` plan against the arrived reply and
   * assemble the substituted head+body from the first candidate whose
   * deferred response-header conditions match: the real status unless
   * the rule overrides it (`statusCode === 0` keeps it), the real
   * headers minus body-framing with the CT/header overrides layered on,
   * the rule's literal body. `null` = no candidate fires — release the
   * reply untouched.
   */
  resolveNetworkResponse(
    plan: Extract<ProxyBodyPlan, { kind: 'network-response' }>,
    arrived: { statusCode: number; statusText: string; headers: readonly ProxyHeader[] },
  ): ProxyServedResponse | null;
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

/** Response headers describing the original body's framing — dropped when a
 *  rule substitutes the body, so the framing is recomputed from the new bytes. */
const BODY_FRAMING_HEADERS: ReadonlySet<string> = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

/**
 * True for a rule the wire plane can realize as a body action: static
 * bodies only (dynamic is page/CDP-eval territory), and a response-gated
 * rule only where the gate is judgeable — a `network`-source response
 * defers it to arrival; a mock or request-body rule can never prove it.
 */
function isBodyCandidate(rule: Rule): boolean {
  if (rule.type === 'request-body') {
    return rule.action.bodyType === 'static' && !isResponseGatedRule(rule);
  }
  if (rule.type === 'response') {
    if (rule.action.bodyType !== 'static') return false;
    return rule.action.responseSource === 'network' || !isResponseGatedRule(rule);
  }
  return false;
}

/** A mock's head: default Content-Type first, the rule's response headers
 *  layered on (an exact-name entry overrides the default). */
function mockHeaders(contentType: string, extra: Readonly<Record<string, string>>): ProxyHeader[] {
  const headerMap = new Map<string, string>([['Content-Type', contentType]]);
  for (const [name, value] of Object.entries(extra)) headerMap.set(name, value);
  return [...headerMap].map(([name, value]) => ({ name, value }));
}

/** Real reply headers minus body-framing, with the CT / response-header
 *  overrides replacing any same-named entries (an empty CT is no override). */
function mergeNetworkHeaders(
  real: readonly ProxyHeader[],
  contentType: string,
  responseHeaders: Readonly<Record<string, string>>,
): ProxyHeader[] {
  const overrides = new Map<string, ProxyHeader>();
  if (contentType !== '') overrides.set('content-type', { name: 'Content-Type', value: contentType });
  for (const [name, value] of Object.entries(responseHeaders)) overrides.set(name.toLowerCase(), { name, value });

  const out: ProxyHeader[] = [];
  for (const h of real) {
    const lower = h.name.toLowerCase();
    if (BODY_FRAMING_HEADERS.has(lower) || overrides.has(lower)) continue;
    out.push(h);
  }
  out.push(...overrides.values());
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
    const bodyRules: Rule[] = [];
    for (const rule of rules) {
      if (!matchesRequest(rule, input.url, input.method)) continue;
      if (rule.type === 'header' && rule.action.responseHeaders.length > 0) {
        responseHeaderRules.push(rule);
      }
      if (isBodyCandidate(rule)) bodyRules.push(rule);
      // Response-gated rules cannot prove themselves at request time —
      // they participate only in the response-side applications above.
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
        bodyRules: [],
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

    return { url, requestHeaders, delayMs, rewrites, appliedRuleUids, responseHeaderRules, bodyRules };
  }

  function needsRequestBodyText(plan: ProxyRequestPlan): boolean {
    return plan.bodyRules.some(
      (rule) =>
        (rule.type === 'request-body' || rule.type === 'response') &&
        rule.action.resourceType === 'graphql' &&
        (rule.action.graphqlFilter?.key ?? '') !== '',
    );
  }

  function planBody(plan: ProxyRequestPlan, requestBodyText: string | undefined): ProxyBodyPlan | null {
    const gatePassed = plan.bodyRules.filter(
      (rule) =>
        (rule.type === 'request-body' || rule.type === 'response') &&
        doesGraphqlBodyGatePass(rule.action, requestBodyText),
    );
    const first = gatePassed[0];
    if (first === undefined) return null;
    if (first.type === 'request-body') {
      return { kind: 'request-body', ruleUid: first.uid, body: first.action.requestBody };
    }
    if (first.type !== 'response') return null;
    if (first.action.responseSource === 'mock') {
      return {
        kind: 'mock',
        ruleUid: first.uid,
        statusCode: first.action.statusCode || 200,
        headers: mockHeaders(first.action.contentType || 'application/json', first.action.responseHeaders),
        body: first.action.responseBody,
      };
    }
    return {
      kind: 'network-response',
      rules: gatePassed.filter((rule) => rule.type === 'response' && rule.action.responseSource === 'network'),
    };
  }

  function resolveNetworkResponse(
    plan: Extract<ProxyBodyPlan, { kind: 'network-response' }>,
    arrived: { statusCode: number; statusText: string; headers: readonly ProxyHeader[] },
  ): ProxyServedResponse | null {
    for (const rule of plan.rules) {
      if (rule.type !== 'response') continue;
      // Judge the deferred response-header conditions the moment the
      // reply exists — the request-stage values were proven at plan time.
      if (!doesResponseHeaderMatchRule(arrived.headers, rule)) continue;
      return {
        ruleUid: rule.uid,
        statusCode: rule.action.statusCode !== 0 ? rule.action.statusCode : arrived.statusCode,
        statusText: arrived.statusText,
        headers: mergeNetworkHeaders(arrived.headers, rule.action.contentType, rule.action.responseHeaders),
        body: rule.action.responseBody,
      };
    }
    return null;
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

  return { planRequest, needsRequestBodyText, planBody, resolveNetworkResponse, applyResponseHeaders };
}
