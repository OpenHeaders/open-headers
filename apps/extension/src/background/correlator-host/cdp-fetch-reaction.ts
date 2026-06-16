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
 *     static `network`-source `response` becomes an `await-response` continue
 *     (`interceptResponse:true`) that sends the real request and re-pauses at
 *     the Response stage. Its response-header conditions are DEFERRED to that
 *     stage (the real reply's headers don't exist yet).
 *   - {@link resolveResponseReaction} — RESPONSE stage, reached only for an
 *     `await-response` request. Re-matches (now evaluating response-header
 *     conditions against the real reply) and fulfills with the rule's static
 *     body, the real status (or the override), and the real headers with the
 *     CT / response-header overrides layered on — mirroring the injection
 *     path's `new Response(cfg.body, { status, headers })`.
 *
 * Falls through to pass-through for:
 *   - `network`+dynamic `response` and dynamic `request-body` (their bodies are
 *     user JS the host can't eval at the network layer yet — D2b-2b/c);
 *   - a rule carrying a condition no stage can evaluate (initiator-domains,
 *     domain-type) — enforcing it via injection's own page gate is correct,
 *     over-applying via Fetch is not.
 * `isFetchRealizableNow` is the single gate for the not-yet-realizable dynamic
 * cells; it returns false for them, so they never reach a fulfill branch. A
 * passed-through rule still runs its page-context injection path; only its
 * extended all-context reach is unavailable until D2b-2b/c adds the rest of
 * the host eval mechanism.
 */

import type {
  ConditionType,
  RequestBodyAction,
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
  CdpEvalArg,
  CdpFulfillResponse,
  CdpHeaderEntry,
  CdpRequestPaused,
} from '@openheaders/oracle/correlator-cdp';

/**
 * A dynamic `mock`-source `response` match (D2b-2a): the user code plus the
 * static reply envelope. The body is user JS, so the pure reaction can't build
 * the fulfill here — it yields this plan and the interceptor evals
 * `buildResponse` in the request frame's isolated world, then fulfills the
 * returned body under this envelope. No network is touched (mock).
 */
export interface CdpResponseEvalPlan {
  readonly userCode: string;
  readonly statusCode: number;
  readonly contentType: string;
  readonly responseHeaders: Readonly<Record<string, string>>;
}

/** The answer the interceptor gives a paused request at the REQUEST stage. */
export type CdpFetchReaction =
  | { readonly kind: 'fulfill'; readonly ruleUid: string; readonly response: CdpFulfillResponse }
  | { readonly kind: 'continue'; readonly ruleUid: string; readonly request: CdpContinueRequest }
  // Send the real request and intercept its reply: a `continueRequest` with
  // `interceptResponse:true`. The fire is DEFERRED to the Response stage —
  // the action only takes effect once the reply is fulfilled there.
  | { readonly kind: 'await-response'; readonly ruleUid: string; readonly request: CdpContinueRequest }
  // A dynamic `mock`-source body: the interceptor evals the user fn, then
  // fulfills. The fire is DEFERRED to that fulfill — an eval fault releases the
  // request and never fires (fire = the modification actually ran).
  | { readonly kind: 'eval-fulfill'; readonly ruleUid: string; readonly plan: CdpResponseEvalPlan }
  | { readonly kind: 'pass-through' };

/** The answer the interceptor gives a paused request at the RESPONSE stage. */
export type CdpResponseReaction =
  | { readonly kind: 'fulfill'; readonly ruleUid: string; readonly response: CdpFulfillResponse }
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

/**
 * Conditions the Response stage CAN additionally evaluate — the real reply's
 * headers are observable there. A `network`-source rule defers these at the
 * request stage (they don't disqualify it from being sent to the Response
 * stage) and {@link responseStageMatches} evaluates them once the reply lands.
 */
const RESPONSE_STAGE_ONLY_CONDITIONS: ReadonlySet<ConditionType> = new Set<ConditionType>([
  'response-header',
  'exclude-response-header',
]);

/** Response headers describing the original body's framing — dropped when we
 *  substitute the body, so the browser recomputes them from the new bytes. */
const BODY_FRAMING_HEADERS: ReadonlySet<string> = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

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

/** The first realizable debug-tier rule's request-stage answer, or pass-through. */
export function resolveFetchReaction(event: CdpRequestPaused, rules: readonly Rule[]): CdpFetchReaction {
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  const postData = event.request.postData;

  for (const rule of rules) {
    // Narrow to the Fetch-capable union for `rule.action` below; the
    // debug-tier + static gate is the shared core predicate (it admits both
    // response sources when static, rejecting only dynamic bodies).
    if (rule.type !== 'response' && rule.type !== 'request-body') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!graphqlGate(rule.action, postData)) continue;

    if (rule.type === 'response' && rule.action.responseSource === 'network') {
      // Send the real request and intercept the reply; the body substitution
      // + override merge happen at the Response stage, where the response-header
      // conditions (deferred here) become evaluable.
      if (!requestStageMatches(rule, ctx, true)) continue;
      return {
        kind: 'await-response',
        ruleUid: rule.uid,
        request: { requestId: event.requestId, interceptResponse: true },
      };
    }

    if (!requestStageMatches(rule, ctx)) continue;
    if (rule.type === 'response') {
      // A `mock`+dynamic body is user JS — defer to the interceptor's eval.
      // (network+dynamic and request-body+dynamic stay unrealizable until
      // D2b-2b/c, so `isFetchRealizableNow` already excluded them above.)
      if (rule.action.bodyType === 'dynamic') {
        return { kind: 'eval-fulfill', ruleUid: rule.uid, plan: buildResponseEvalPlan(rule.action) };
      }
      return { kind: 'fulfill', ruleUid: rule.uid, response: buildFulfill(event.requestId, rule.action) };
    }
    return { kind: 'continue', ruleUid: rule.uid, request: buildRequestBodyRewrite(event.requestId, rule.action) };
  }
  return { kind: 'pass-through' };
}

/**
 * The Response-stage answer for an intercepted reply (reached only via an
 * {@link CdpFetchReaction} `await-response`). Re-matches the live rules — now
 * able to evaluate response-header conditions against the real reply — and
 * fulfills the first matching `network`-source static `response` with its
 * literal body, the real status (or override), and the merged headers. A
 * failed real request, or no longer matching rule, releases the reply
 * untouched (pass-through → `continueResponse`).
 */
export function resolveResponseReaction(event: CdpRequestPaused, rules: readonly Rule[]): CdpResponseReaction {
  // A network-layer failure has no reply to fulfill from — let it surface.
  if (event.responseErrorReason !== undefined) return { kind: 'pass-through' };
  const ctx: RequestStageContext = {
    url: event.request.url,
    method: event.request.method,
    resourceType: cdpResourceTypeToCondition(event.resourceType),
  };
  const postData = event.request.postData;
  const responseHeaders = event.responseHeaders ?? [];

  for (const rule of rules) {
    if (rule.type !== 'response') continue;
    if (rule.action.responseSource !== 'network') continue;
    if (!isFetchRealizableNow(rule)) continue;
    if (!graphqlGate(rule.action, postData)) continue;
    if (!responseStageMatches(rule, ctx, responseHeaders)) continue;
    return { kind: 'fulfill', ruleUid: rule.uid, response: buildNetworkFulfill(event, rule.action) };
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

/**
 * Authoritative request-stage condition re-check (URL + domain/method/resource
 * excludes). `deferResponseHeaders` lets a `network`-source rule keep its
 * response-header conditions for the Response stage instead of being
 * disqualified here.
 */
function requestStageMatches(rule: Rule, ctx: RequestStageContext, deferResponseHeaders = false): boolean {
  for (const c of rule.conditions) {
    // An unconfigured row carries no constraint (mirrors the DNR builder).
    if (c.values.length === 0 && c.type !== 'domain-type') continue;
    if (REQUEST_STAGE_CONDITIONS.has(c.type)) continue;
    // A deferred response-header condition is evaluated at the Response stage,
    // so it must not disqualify the rule here.
    if (deferResponseHeaders && RESPONSE_STAGE_ONLY_CONDITIONS.has(c.type)) continue;
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
function responseStageMatches(
  rule: Rule,
  ctx: RequestStageContext,
  responseHeaders: readonly CdpHeaderEntry[],
): boolean {
  for (const c of rule.conditions) {
    if (RESPONSE_STAGE_ONLY_CONDITIONS.has(c.type)) continue; // evaluated below
    if (c.values.length === 0 && c.type !== 'domain-type') continue;
    if (!REQUEST_STAGE_CONDITIONS.has(c.type)) return false;
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

/** True unless a GraphQL filter is active and the request body fails it. */
function graphqlGate(action: ResponseAction | RequestBodyAction, postData: string | undefined): boolean {
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

/** Default Content-Type first, then the rule's response headers — an
 *  exact-name entry overrides the default, mirroring the injection's object
 *  spread. Shared by the static and dynamic `mock` fulfills. */
function fulfillHeaders(contentType: string, extra: Readonly<Record<string, string>>): CdpHeaderEntry[] {
  const headerMap = new Map<string, string>([['Content-Type', contentType]]);
  for (const [name, value] of Object.entries(extra)) headerMap.set(name, value);
  return [...headerMap].map(([name, value]) => ({ name, value }));
}

function buildFulfill(requestId: string, action: ResponseAction): CdpFulfillResponse {
  return {
    requestId,
    responseCode: action.statusCode || 200,
    responseHeaders: fulfillHeaders(action.contentType || 'application/json', action.responseHeaders),
    body: toBase64(action.responseBody),
  };
}

/** The static reply envelope for a `mock`+dynamic rule — defaults applied here
 *  (status → 200, CT → JSON) exactly as the injection path's `dynamicMock`
 *  script does, so only the body remains for the eval to supply. */
function buildResponseEvalPlan(action: ResponseAction): CdpResponseEvalPlan {
  return {
    userCode: action.responseBody,
    statusCode: action.statusCode || 200,
    contentType: action.contentType || 'application/json',
    responseHeaders: action.responseHeaders,
  };
}

/**
 * Wrap a `mock`+dynamic rule's user code into a function declaration that
 * defines `buildResponse`, calls it over the request arg, and returns the body
 * stringified IN the isolated world — byte-identical to the injection path's
 * realm-local `typeof o === 'object' ? JSON.stringify : String`.
 */
export function wrapMockResponseFn(userCode: string): string {
  return `function(arg){
${userCode}
var __oh = buildResponse(arg);
return typeof __oh === 'object' ? JSON.stringify(__oh) : String(__oh);
}`;
}

/** The `{method,url,requestBody}` a `mock`+dynamic `buildResponse` receives,
 *  sourced from the paused request (the injection path reads the same fields
 *  off the live fetch/XHR). `postData` is the request body text. */
export function mockResponseEvalArg(event: CdpRequestPaused): CdpEvalArg {
  return { method: event.request.method, url: event.request.url, requestBody: event.request.postData ?? '' };
}

/** Fulfill a `mock`+dynamic match with the eval's returned body under the
 *  rule's static envelope (status/CT/headers from {@link buildResponseEvalPlan}). */
export function buildEvalFulfill(requestId: string, plan: CdpResponseEvalPlan, body: string): CdpFulfillResponse {
  return {
    requestId,
    responseCode: plan.statusCode,
    responseHeaders: fulfillHeaders(plan.contentType, plan.responseHeaders),
    body: toBase64(body),
  };
}

function buildRequestBodyRewrite(requestId: string, action: RequestBodyAction): CdpContinueRequest {
  return { requestId, postData: toBase64(action.requestBody) };
}

/**
 * Fulfill an intercepted real reply for a `network`-source static rule: the
 * rule's literal body (the real bytes are discarded, mirroring the injection
 * path's `new Response(cfg.body, …)`), the real status unless overridden
 * (`statusCode === 0` keeps it), and the real headers with the CT /
 * response-header overrides layered on.
 */
function buildNetworkFulfill(event: CdpRequestPaused, action: ResponseAction): CdpFulfillResponse {
  const responseCode = action.statusCode !== 0 ? action.statusCode : (event.responseStatusCode ?? 200);
  const fulfill: CdpFulfillResponse = {
    requestId: event.requestId,
    responseCode,
    responseHeaders: mergeNetworkHeaders(event.responseHeaders ?? [], action),
    body: toBase64(action.responseBody),
  };
  // Keep the real status phrase (the injection path keeps `real.statusText`).
  return event.responseStatusText ? { ...fulfill, responsePhrase: event.responseStatusText } : fulfill;
}

/** Real reply headers minus body-framing, with the rule's CT / response-header
 *  overrides replacing any same-named entries (an empty CT is no override). */
function mergeNetworkHeaders(real: readonly CdpHeaderEntry[], action: ResponseAction): CdpHeaderEntry[] {
  const overrides = new Map<string, CdpHeaderEntry>();
  if (action.contentType) overrides.set('content-type', { name: 'Content-Type', value: action.contentType });
  for (const [name, value] of Object.entries(action.responseHeaders))
    overrides.set(name.toLowerCase(), { name, value });

  const out: CdpHeaderEntry[] = [];
  for (const h of real) {
    const lc = h.name.toLowerCase();
    if (BODY_FRAMING_HEADERS.has(lc) || overrides.has(lc)) continue;
    out.push(h);
  }
  out.push(...overrides.values());
  return out;
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
