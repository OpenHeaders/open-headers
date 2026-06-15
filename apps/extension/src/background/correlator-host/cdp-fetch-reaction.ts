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
 * methods / resource-types and their excludes, plus the response/body GraphQL
 * filter) against the paused request before reacting.
 *
 * Only request-stage-realizable rules act here: a static `mock`-source
 * `response` becomes a fulfill, a static `body` becomes a request-body rewrite
 * (the page-context wrapper does the same — it replaces the outgoing fetch/XHR
 * body, it does not touch the server's response). Falls through to
 * pass-through for:
 *   - dynamic `response`/`body` (their bodies are user JS the host can't eval);
 *   - a `network`-source `response` (it modifies the REAL reply — a
 *     Response-stage round-trip this request stage doesn't have yet);
 *   - a rule carrying a condition the request stage can't evaluate
 *     (initiator-domains, domain-type, response-header) — enforcing it via
 *     injection's own page gate is correct, over-applying via Fetch is not.
 * `isFetchRealizableNow` is the single gate for the first two; it returns
 * false for both, so they never reach the fulfill branch below. A
 * passed-through rule still runs its page-context injection path; only its
 * extended all-context reach is unavailable until D2b adds the Response-stage
 * round-trip and a host eval mechanism.
 */

import type {
  BodyAction,
  ConditionType,
  ResourceType,
  ResponseAction,
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
  CdpAuthRequired,
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

/**
 * The answer the interceptor gives a paused AUTH challenge (D3).
 * `provide` carries the resolved credentials + the rule uid (for the fire);
 * `default` lets the browser run its native auth flow when no rule owns the
 * challenge — we never `CancelAuth` a challenge we didn't match.
 */
export type CdpAuthReaction =
  | { readonly kind: 'provide'; readonly ruleUid: string; readonly username: string; readonly password: string }
  | { readonly kind: 'default' };

type GraphqlFilter = NonNullable<ResponseAction['graphqlFilter']>;

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
    // debug-tier + static gate is the shared core predicate. It also rejects
    // `network`-source responses, so the `response` branch only ever sees a
    // mock-source (synthetic-fulfill) action.
    if (rule.type !== 'response' && rule.type !== 'body') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!requestStageMatches(rule, ctx)) continue;
    if (!graphqlGate(rule.action, postData)) continue;

    if (rule.type === 'response') {
      return { kind: 'fulfill', ruleUid: rule.uid, response: buildFulfill(event.requestId, rule.action) };
    }
    return { kind: 'continue', ruleUid: rule.uid, request: buildBodyRewrite(event.requestId, rule.action) };
  }
  return { kind: 'pass-through' };
}

/**
 * The first in-scope auth rule whose conditions match the challenged
 * request supplies credentials; with no match we answer `default` so the
 * browser runs its native dialog / proxy flow. Pure, like
 * {@link resolveFetchReaction} — it reuses the same request-stage matcher,
 * so an auth rule carrying a condition the auth stage can't evaluate
 * (initiator-domains, etc.) falls through to `default` rather than
 * over-applying. Credentials are already `{{…}}`-resolved upstream
 * (`liveRules`), so they are passed verbatim and never logged.
 */
export function resolveAuthReaction(event: CdpAuthRequired, rules: readonly Rule[]): CdpAuthReaction {
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  for (const rule of rules) {
    if (rule.type !== 'auth') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!requestStageMatches(rule, ctx)) continue;
    return { kind: 'provide', ruleUid: rule.uid, username: rule.action.username, password: rule.action.password };
  }
  return { kind: 'default' };
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
function graphqlGate(action: ResponseAction | BodyAction, postData: string | undefined): boolean {
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

function buildFulfill(requestId: string, action: ResponseAction): CdpFulfillResponse {
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
