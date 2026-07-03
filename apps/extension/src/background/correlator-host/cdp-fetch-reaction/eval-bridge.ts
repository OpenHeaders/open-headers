/**
 * Eval bridge — wraps dynamic rules' user code into the function
 * declarations the interceptor evals in the request frame's isolated
 * world, builds the args those functions receive, and decodes CDP
 * response bodies for the `modifyResponse` path.
 */

import type { CdpEvalArg, CdpHeaderEntry, CdpRequestPaused, CdpResponseBody } from '@openheaders/oracle/correlator-cdp';

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

/**
 * Wrap a `network`+dynamic rule's user code into a function declaration that
 * defines `modifyResponse`, calls it over the modifyArgs arg, and returns the
 * body stringified IN the isolated world — byte-identical to the injection
 * path's realm-local `typeof o === 'object' ? JSON.stringify : String`.
 */
export function wrapNetworkResponseFn(userCode: string): string {
  return `function(arg){
${userCode}
var __oh = modifyResponse(arg);
return typeof __oh === 'object' ? JSON.stringify(__oh) : String(__oh);
}`;
}

/**
 * Wrap a dynamic `request-body` rule's user code into a function declaration
 * that defines `modifyRequestBody`, calls it over the modifyArgs arg, and
 * returns the new body stringified IN the isolated world — byte-identical to
 * the injection path's realm-local `typeof o === 'object' ? JSON.stringify :
 * String`.
 */
export function wrapRequestBodyFn(userCode: string): string {
  return `function(arg){
${userCode}
var __oh = modifyRequestBody(arg);
return typeof __oh === 'object' ? JSON.stringify(__oh) : String(__oh);
}`;
}

/** The `{method,url,requestBody}` a `mock`+dynamic `buildResponse` receives,
 *  sourced from the paused request (the injection path reads the same fields
 *  off the live fetch/XHR). `postData` is the request body text. */
export function mockResponseEvalArg(event: CdpRequestPaused): CdpEvalArg {
  return { method: event.request.method, url: event.request.url, requestBody: event.request.postData ?? '' };
}

/**
 * The `modifyArgs` a `network`+dynamic `modifyResponse` receives — faithful to
 * the injection path's `dynamicNetworkResponse` shape, sourced from the paused
 * request + the real reply: `response` is the decoded real body, `responseType`
 * the real reply's Content-Type, `requestHeaders` the real outgoing headers
 * (strictly more faithful than injection's XHR `{}`), `requestData` the outgoing
 * body, `responseJSON` the body parsed (guarded → null). Built host-side and
 * passed by value, like {@link mockResponseEvalArg}.
 */
export function networkResponseEvalArg(event: CdpRequestPaused, responseBodyText: string): CdpEvalArg {
  return {
    method: event.request.method,
    url: event.request.url,
    response: responseBodyText,
    responseType: responseContentType(event.responseHeaders ?? []),
    requestHeaders: event.request.headers ?? {},
    requestData: event.request.postData ?? null,
    responseJSON: parseJsonOrNull(responseBodyText),
  };
}

/**
 * The `{method,url,body,bodyAsJson}` a dynamic `request-body`'s
 * `modifyRequestBody` receives — faithful to the injection path's
 * `generateDynamicRequestBodyScript` shape: `method`/`url` from the paused
 * request, `body` the outgoing body text (inline `postData` or
 * `getRequestPostData`, supplied by the interceptor), `bodyAsJson` the body
 * parsed (guarded → null). Built host-side and passed by value, like
 * {@link networkResponseEvalArg}.
 */
export function requestBodyEvalArg(event: CdpRequestPaused, bodyText: string): CdpEvalArg {
  return {
    method: event.request.method,
    url: event.request.url,
    body: bodyText,
    bodyAsJson: parseJsonOrNull(bodyText),
  };
}

/** The real reply's Content-Type (case-insensitive), or '' when absent. */
function responseContentType(headers: readonly CdpHeaderEntry[]): string {
  return headers.find((h) => h.name.toLowerCase() === 'content-type')?.value ?? '';
}

/** Parse JSON, or null on any failure — the guarded parse the injection path
 *  runs in-realm, done host-side here (deterministic, same result). */
function parseJsonOrNull(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A `getResponseBody` result → UTF-8 text — the real body the `modifyResponse`
 *  eval runs over. `base64Encoded` bodies (binary / non-UTF-8) are decoded; a
 *  plain-text body is returned verbatim. */
export function decodeResponseBody(body: CdpResponseBody): string {
  if (!body.base64Encoded) return body.body;
  const binary = atob(body.body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
