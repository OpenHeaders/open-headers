/**
 * Authoritative condition re-checks — the request-stage and
 * response-stage matchers (the `Fetch.enable` pattern set is only a
 * coarse pre-filter) plus the GraphQL body gate.
 */

import type { RequestBodyAction, ResourceType, ResponseAction, Rule } from '@openheaders/core/types';
import {
  CDP_REQUEST_STAGE_CONDITIONS,
  CDP_RESPONSE_STAGE_CONDITIONS,
  doesHostMatchDomains,
  doesUrlMatchEntry,
  doesUrlMatchRule,
  getRuleMatchPatterns,
} from '@openheaders/core/utils';
import type { CdpHeaderEntry } from '@openheaders/oracle/correlator-cdp';

type GraphqlFilter = NonNullable<ResponseAction['graphqlFilter']>;

export interface RequestStageContext {
  readonly url: string;
  readonly method: string;
  readonly resourceType: ResourceType;
}

/**
 * Authoritative request-stage condition re-check (URL + domain/method/resource
 * excludes). `deferResponseHeaders` lets a `network`-source rule keep its
 * response-header conditions for the Response stage instead of being
 * disqualified here.
 */
export function requestStageMatches(rule: Rule, ctx: RequestStageContext, deferResponseHeaders = false): boolean {
  for (const c of rule.conditions) {
    // An unconfigured row carries no constraint (mirrors the DNR builder).
    if (c.values.length === 0 && c.type !== 'domain-type') continue;
    if (CDP_REQUEST_STAGE_CONDITIONS.has(c.type)) continue;
    // A deferred response-header condition is evaluated at the Response stage,
    // so it must not disqualify the rule here.
    if (deferResponseHeaders && CDP_RESPONSE_STAGE_CONDITIONS.has(c.type)) continue;
    return false;
  }
  return matchesRequestStageValues(rule, ctx);
}

/**
 * Re-check at the Response stage: every request-stage condition (URL +
 * domain/method/resource) PLUS the response-header conditions against the real
 * reply. A condition no stage can evaluate (initiator-domains, domain-type)
 * still passes the rule through.
 */
export function responseStageMatches(
  rule: Rule,
  ctx: RequestStageContext,
  responseHeaders: readonly CdpHeaderEntry[],
): boolean {
  for (const c of rule.conditions) {
    if (CDP_RESPONSE_STAGE_CONDITIONS.has(c.type)) continue; // evaluated below
    if (c.values.length === 0 && c.type !== 'domain-type') continue;
    if (!CDP_REQUEST_STAGE_CONDITIONS.has(c.type)) return false;
  }
  if (!matchesRequestStageValues(rule, ctx)) return false;
  return matchesResponseHeaderConditions(rule, responseHeaders);
}

/** The URL + domain/method/resource value checks shared by both stages. */
function matchesRequestStageValues(rule: Rule, ctx: RequestStageContext): boolean {
  // No URL conditions ⇒ match-all (the coarse `Fetch.enable` pattern was `*`).
  if (getRuleMatchPatterns(rule).length > 0 && !doesUrlMatchRule(ctx.url, rule)) return false;

  const host = hostOf(ctx.url);
  const method = ctx.method.toLowerCase();
  for (const c of rule.conditions) {
    const values = c.values.map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) continue;
    switch (c.type) {
      case 'exclude-request-domains':
        if (host !== null && doesHostMatchDomains(host, values)) return false;
        break;
      case 'request-methods':
        if (!values.map((v) => v.toLowerCase()).includes(method)) return false;
        break;
      case 'exclude-request-methods':
        if (values.map((v) => v.toLowerCase()).includes(method)) return false;
        break;
      case 'resource-types':
        if (!values.includes(ctx.resourceType)) return false;
        break;
      case 'exclude-resource-types':
        if (values.includes(ctx.resourceType)) return false;
        break;
      default:
        break;
    }
  }
  return true;
}

/**
 * Evaluate the rule's response-header / exclude-response-header conditions
 * against the real reply. A row matches when its named header is present and
 * (with values) one value is a substring of the header value — Chrome's
 * response-header semantics; empty values mean "any value". An exclude row
 * inverts: a present-and-matching header disqualifies the rule.
 */
function matchesResponseHeaderConditions(rule: Rule, headers: readonly CdpHeaderEntry[]): boolean {
  for (const c of rule.conditions) {
    if (c.type !== 'response-header' && c.type !== 'exclude-response-header') continue;
    const name = (c.headerName ?? '').trim();
    if (!name) continue; // an unconfigured header row carries no constraint
    const values = c.values.map((v) => v.trim()).filter(Boolean);
    const present = responseHasHeader(headers, name, values);
    if (c.type === 'response-header' ? !present : present) return false;
  }
  return true;
}

/** True iff `headers` carries `name` (case-insensitive) with a value containing
 *  any of `values` — or, with no values, the header present at all. */
function responseHasHeader(headers: readonly CdpHeaderEntry[], name: string, values: readonly string[]): boolean {
  const lc = name.toLowerCase();
  const matches = headers.filter((h) => h.name.toLowerCase() === lc);
  if (matches.length === 0) return false;
  if (values.length === 0) return true;
  return matches.some((h) => values.some((v) => h.value.includes(v)));
}

/**
 * The matched rule's pattern annotation for a fire record: the first URL
 * pattern that matches the paused URL — the same entry the DNR fire ledger
 * records. A rule with no URL conditions matched everything ('' — the
 * matched-records surfaces omit the annotation and show the URL alone).
 */
export function matchedPatternFor(rule: Rule, url: string): string {
  for (const entry of getRuleMatchPatterns(rule)) {
    if (doesUrlMatchEntry(url, entry)) return entry.pattern;
  }
  return '';
}

/** True unless a GraphQL filter is active and the request body fails it. */
export function graphqlGate(action: ResponseAction | RequestBodyAction, postData: string | undefined): boolean {
  if (action.resourceType !== 'graphql' || !action.graphqlFilter?.key) return true;
  return matchesGraphqlBody(postData ?? '', action.graphqlFilter);
}

function matchesGraphqlBody(bodyStr: string, filter: GraphqlFilter): boolean {
  if (bodyStr.length === 0) return false;
  try {
    const parsed: unknown = JSON.parse(bodyStr);
    if (parsed == null || typeof parsed !== 'object') return false;
    const value = (parsed as Record<string, unknown>)[filter.key];
    if (typeof value !== 'string') return false;
    return filter.operator === 'Contains' ? value.includes(filter.value) : value === filter.value;
  } catch {
    return false;
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
