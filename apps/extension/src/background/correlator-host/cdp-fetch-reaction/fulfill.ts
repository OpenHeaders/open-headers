/**
 * Fulfill / continue builders — the static and eval-result assembly of
 * `Fetch.fulfillRequest` / `Fetch.continueRequest` payloads for the
 * mock, network, and request-body cells.
 */

import type { RequestBodyAction, ResponseAction } from '@openheaders/core/types';
import type {
  CdpContinueRequest,
  CdpFulfillResponse,
  CdpHeaderEntry,
  CdpRequestPaused,
} from '@openheaders/oracle/correlator-cdp';
import type { CdpNetworkEvalPlan, CdpRequestBodyEvalPlan, CdpResponseEvalPlan } from './types';

/** Response headers describing the original body's framing — dropped when we
 *  substitute the body, so the browser recomputes them from the new bytes. */
const BODY_FRAMING_HEADERS: ReadonlySet<string> = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

/** Default Content-Type first, then the rule's response headers — an
 *  exact-name entry overrides the default, mirroring the injection's object
 *  spread. Shared by the static and dynamic `mock` fulfills. */
function fulfillHeaders(contentType: string, extra: Readonly<Record<string, string>>): CdpHeaderEntry[] {
  const headerMap = new Map<string, string>([['Content-Type', contentType]]);
  for (const [name, value] of Object.entries(extra)) headerMap.set(name, value);
  return [...headerMap].map(([name, value]) => ({ name, value }));
}

export function buildFulfill(requestId: string, action: ResponseAction): CdpFulfillResponse {
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
export function buildResponseEvalPlan(action: ResponseAction): CdpResponseEvalPlan {
  return {
    userCode: action.responseBody,
    statusCode: action.statusCode || 200,
    contentType: action.contentType || 'application/json',
    responseHeaders: action.responseHeaders,
  };
}

/** The override envelope for a `network`+dynamic rule — the raw action fields
 *  (no mock defaults): `statusCode === 0` keeps the real status, an empty
 *  `contentType` keeps the real CT, exactly as the static network path reads
 *  them. The `userCode` is the `modifyResponse` body. */
export function buildNetworkEvalPlan(action: ResponseAction): CdpNetworkEvalPlan {
  return {
    userCode: action.responseBody,
    statusCode: action.statusCode,
    contentType: action.contentType,
    responseHeaders: action.responseHeaders,
  };
}

/** The plan for a dynamic `request-body` rule — just the `modifyRequestBody`
 *  user code (the cell rewrites the outgoing body, so there is no reply
 *  envelope to carry). */
export function buildRequestBodyEvalPlan(action: RequestBodyAction): CdpRequestBodyEvalPlan {
  return { userCode: action.requestBody };
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

export function buildRequestBodyRewrite(requestId: string, action: RequestBodyAction): CdpContinueRequest {
  return { requestId, postData: toBase64(action.requestBody) };
}

/** Continue an intercepted request for a dynamic `request-body` match with the
 *  eval's transformed body (D2b-2c) — the same `continueRequest{postData}`
 *  shape as the static {@link buildRequestBodyRewrite}, only the body comes from
 *  the eval rather than the rule literal. */
export function buildRequestBodyEvalContinue(requestId: string, evalBody: string): CdpContinueRequest {
  return { requestId, postData: toBase64(evalBody) };
}

/** The `network`-source override envelope shared by the static and dynamic
 *  fulfills — `statusCode === 0` keeps the real status, `contentType === ''`
 *  keeps the real CT. Both {@link ResponseAction} and {@link CdpNetworkEvalPlan}
 *  satisfy it structurally. */
interface NetworkFulfillEnvelope {
  readonly statusCode: number;
  readonly contentType: string;
  readonly responseHeaders: Readonly<Record<string, string>>;
}

/**
 * Fulfill an intercepted real reply for a `network`-source static rule: the
 * rule's literal body (the real bytes are discarded, mirroring the injection
 * path's `new Response(cfg.body, …)`), the real status unless overridden
 * (`statusCode === 0` keeps it), and the real headers with the CT /
 * response-header overrides layered on.
 */
export function buildNetworkFulfill(event: CdpRequestPaused, action: ResponseAction): CdpFulfillResponse {
  return assembleNetworkFulfill(event, action, action.responseBody);
}

/**
 * Fulfill an intercepted real reply for a `network`+dynamic rule with the
 * eval's transformed body (D2b-2b) under the plan's override envelope merged
 * onto the real status / headers — the same assembly as the static path, only
 * the body differs (the eval result, not the rule literal).
 */
export function buildNetworkEvalFulfill(
  event: CdpRequestPaused,
  plan: CdpNetworkEvalPlan,
  evalBody: string,
): CdpFulfillResponse {
  return assembleNetworkFulfill(event, plan, evalBody);
}

/** Real status (unless overridden), merged headers, and `body` — the shared
 *  core of every `network`-source fulfill. */
function assembleNetworkFulfill(
  event: CdpRequestPaused,
  envelope: NetworkFulfillEnvelope,
  body: string,
): CdpFulfillResponse {
  const responseCode = envelope.statusCode !== 0 ? envelope.statusCode : (event.responseStatusCode ?? 200);
  const fulfill: CdpFulfillResponse = {
    requestId: event.requestId,
    responseCode,
    responseHeaders: mergeNetworkHeaders(event.responseHeaders ?? [], envelope.contentType, envelope.responseHeaders),
    body: toBase64(body),
  };
  // Keep the real status phrase (the injection path keeps `real.statusText`).
  return event.responseStatusText ? { ...fulfill, responsePhrase: event.responseStatusText } : fulfill;
}

/** Real reply headers minus body-framing, with the CT / response-header
 *  overrides replacing any same-named entries (an empty CT is no override). */
function mergeNetworkHeaders(
  real: readonly CdpHeaderEntry[],
  contentType: string,
  responseHeaders: Readonly<Record<string, string>>,
): CdpHeaderEntry[] {
  const overrides = new Map<string, CdpHeaderEntry>();
  if (contentType) overrides.set('content-type', { name: 'Content-Type', value: contentType });
  for (const [name, value] of Object.entries(responseHeaders)) overrides.set(name.toLowerCase(), { name, value });

  const out: CdpHeaderEntry[] = [];
  for (const h of real) {
    const lc = h.name.toLowerCase();
    if (BODY_FRAMING_HEADERS.has(lc) || overrides.has(lc)) continue;
    out.push(h);
  }
  out.push(...overrides.values());
  return out;
}

/** UTF-8 → base64 — CDP `Fetch` carries `body` / `postData` base64-encoded. */
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
