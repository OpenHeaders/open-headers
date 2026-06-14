/**
 * Phase-D2 reaction logic: given a paused request and the live rules, decide
 * how to answer it — synthesize a mock response (`fulfillRequest`), rewrite
 * the outgoing request body (`continueRequest` with `postData`), or let it
 * flow through unmodified.
 *
 * Pure and host-side (typed against the oracle control vocabulary, like
 * {@link compileFetchPatterns} in cdp-fetch-patterns.ts). The `Fetch.enable`
 * `urlPattern` set is only a COARSE pre-filter — THIS is the authoritative
 * match: it re-checks every request-stage condition (url, request-domains /
 * methods / resource-types and their excludes, plus the body/mock GraphQL
 * filter) against the paused request before reacting.
 *
 * Only STATIC `mock`/`body` rules are realizable here: a static `mock`
 * becomes a fulfill, a static `body` becomes a request-body rewrite (the
 * page-context wrapper does the same — it replaces the outgoing fetch/XHR
 * body, it does not touch the server's response). Falls through to
 * pass-through for:
 *   - dynamic `mock`/`body` (their bodies are user JS the host can't eval);
 *   - a rule carrying a condition the request stage can't evaluate
 *     (initiator-domains, domain-type, response-header) — enforcing it via
 *     injection's own page gate is correct, over-applying via Fetch is not.
 * A passed-through rule still runs its page-context injection path; only its
 * extended all-context reach is unavailable until D2b adds the Response-stage
 * round-trip and a host eval mechanism.
 */

import type {
  BodyAction,
  ConditionType,
  MockAction,
  ResourceType,
  Rule,
  TrackedResourceType,
} from '@openheaders/core/types';
import {
  doesHostMatchDomains,
  doesUrlMatchRule,
  getRuleMatchPatterns,
  isFetchRealizableNow,
} from '@openheaders/core/utils';
import type {
  CdpContinueRequest,
  CdpFulfillResponse,
  CdpHeaderEntry,
  CdpRequestPaused,
} from '@openheaders/oracle/correlator-cdp';

/** The answer the interceptor gives a paused request. */
export type CdpFetchReaction =
  | { readonly kind: 'fulfill'; readonly ruleUid: string; readonly response: CdpFulfillResponse }
  | { readonly kind: 'continue'; readonly ruleUid: string; readonly request: CdpContinueRequest }
  | { readonly kind: 'pass-through' };

type GraphqlFilter = NonNullable<MockAction['graphqlFilter']>;

/**
 * Conditions evaluable at the request stage. A rule carrying any condition
 * outside this set is not Fetch-realizable here (we can't observe the
 * initiator, document party, or response headers of a paused request), so it
 * passes through rather than over-applying.
 */
const REQUEST_STAGE_CONDITIONS: ReadonlySet<ConditionType> = new Set<ConditionType>([
  'url-filter',
  'url-regex',
  'request-domains',
  'exclude-request-domains',
  'request-methods',
  'exclude-request-methods',
  'resource-types',
  'exclude-resource-types',
]);

/** CDP `Fetch.requestPaused` resource type → our condition vocabulary. */
const CDP_TO_CONDITION_RESOURCE_TYPE: Readonly<Record<string, ResourceType>> = {
  Document: 'page',
  Stylesheet: 'stylesheet',
  Image: 'image',
  Media: 'media',
  Font: 'font',
  Script: 'script',
  XHR: 'xhr',
  Fetch: 'xhr',
  WebSocket: 'websocket',
};

/** CDP resource type → the tab-telemetry fire-record vocabulary. */
const CDP_TO_TRACKED_RESOURCE_TYPE: Readonly<Record<string, TrackedResourceType>> = {
  Document: 'main_frame',
  Stylesheet: 'stylesheet',
  Image: 'image',
  Media: 'media',
  Font: 'font',
  Script: 'script',
  XHR: 'xmlhttprequest',
  Fetch: 'xmlhttprequest',
  WebSocket: 'websocket',
  Ping: 'ping',
};

/** Map a CDP pause resource type onto the `resource-types` condition vocabulary. */
export function cdpResourceTypeToCondition(raw: string): ResourceType {
  return CDP_TO_CONDITION_RESOURCE_TYPE[raw] ?? 'other';
}

/** Map a CDP pause resource type onto the fire-record resource vocabulary. */
export function cdpResourceTypeToTracked(raw: string): TrackedResourceType {
  return CDP_TO_TRACKED_RESOURCE_TYPE[raw] ?? 'other';
}

interface RequestStageContext {
  readonly url: string;
  readonly method: string;
  readonly resourceType: ResourceType;
}

/** The first realizable debug-tier rule's answer for `event`, or pass-through. */
export function resolveFetchReaction(event: CdpRequestPaused, rules: readonly Rule[]): CdpFetchReaction {
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  const postData = event.request.postData;

  for (const rule of rules) {
    // Narrow to the Fetch-capable union for `rule.action` below; the
    // debug-tier + static gate is the shared core predicate.
    if (rule.type !== 'mock' && rule.type !== 'body') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!requestStageMatches(rule, ctx)) continue;
    if (!graphqlGate(rule.action, postData)) continue;

    if (rule.type === 'mock') {
      return { kind: 'fulfill', ruleUid: rule.uid, response: buildFulfill(event.requestId, rule.action) };
    }
    return { kind: 'continue', ruleUid: rule.uid, request: buildBodyRewrite(event.requestId, rule.action) };
  }
  return { kind: 'pass-through' };
}

/** Authoritative request-stage condition re-check (URL + domain/method/resource excludes). */
function requestStageMatches(rule: Rule, ctx: RequestStageContext): boolean {
  for (const c of rule.conditions) {
    // An unconfigured row carries no constraint (mirrors the DNR builder).
    if (c.values.length === 0 && c.type !== 'domain-type') continue;
    if (!REQUEST_STAGE_CONDITIONS.has(c.type)) return false;
  }

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

/** True unless a GraphQL filter is active and the request body fails it. */
function graphqlGate(action: MockAction | BodyAction, postData: string | undefined): boolean {
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

function buildFulfill(requestId: string, action: MockAction): CdpFulfillResponse {
  // Default Content-Type first, then the action's headers — an exact-name
  // entry overrides the default, mirroring the injection's object spread.
  const headerMap = new Map<string, string>([['Content-Type', action.contentType || 'application/json']]);
  for (const [name, value] of Object.entries(action.responseHeaders)) headerMap.set(name, value);
  const responseHeaders: CdpHeaderEntry[] = [...headerMap].map(([name, value]) => ({ name, value }));
  return {
    requestId,
    responseCode: action.statusCode || 200,
    responseHeaders,
    body: toBase64(action.responseBody),
  };
}

function buildBodyRewrite(requestId: string, action: BodyAction): CdpContinueRequest {
  return { requestId, postData: toBase64(action.body) };
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** UTF-8 → base64 — CDP `Fetch` carries `body` / `postData` base64-encoded. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
