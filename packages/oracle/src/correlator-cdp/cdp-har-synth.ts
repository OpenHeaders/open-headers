/**
 * Pure projections from CDP shapes into `InspectorHarEntry` fragments.
 *
 * The stateful {@link CdpHarBuilder} owns cross-event accumulation; this
 * module owns the per-fragment shape conversions it composes — request /
 * response sections, header records → HAR header arrays, cookie parsing,
 * the wall-clock `startedDateTime`, and the timing base-conversion. No
 * state, no chrome; every function is total and table-testable.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';

import type { CdpRequestParams, CdpResourceTiming, CdpResponseParams } from './events';

/** A resolved HAR `timings` object (every leg present; `-1` = not applicable). */
export type HarTimings = NonNullable<InspectorHarEntry['timings']>;
type HarRequest = NonNullable<InspectorHarEntry['request']>;
type HarResponse = NonNullable<InspectorHarEntry['response']>;

/** CDP `wallTime` (UNIX seconds, fractional) → HAR ISO-8601 `startedDateTime`. */
export function wallTimeToIso(wallTimeSec: number): string {
  return new Date(wallTimeSec * 1000).toISOString();
}

/**
 * Project a CDP header record into the HAR `[{name, value}]` array.
 * CDP joins duplicate headers with `\n`; we split them back out so each
 * physical header is one entry (Set-Cookie especially relies on this).
 */
export function headerRecordToHar(
  headers: Readonly<Record<string, string>> | undefined,
): Array<{ name: string; value: string }> {
  if (!headers) return [];
  const out: Array<{ name: string; value: string }> = [];
  for (const [name, raw] of Object.entries(headers)) {
    for (const value of raw.split('\n')) out.push({ name, value });
  }
  return out;
}

/** Case-insensitive single-header lookup over a CDP header record. */
function findHeader(headers: Readonly<Record<string, string>> | undefined, target: string): string | undefined {
  if (!headers) return undefined;
  const lower = target.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === lower) return value;
  }
  return undefined;
}

/** Request `Cookie: a=1; b=2` → HAR request cookies, or `undefined` if absent. */
export function parseRequestCookies(
  headers: Readonly<Record<string, string>> | undefined,
): Array<{ name: string; value: string }> | undefined {
  const cookie = findHeader(headers, 'Cookie');
  if (cookie === undefined) return undefined;
  const out: Array<{ name: string; value: string }> = [];
  for (const pair of cookie.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    if (name === '') continue;
    out.push({ name, value: pair.slice(eq + 1).trim() });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Response `Set-Cookie` → HAR response cookies, or `undefined` if absent.
 * Multiple Set-Cookie headers are `\n`-joined by CDP; each line is one
 * cookie whose name/value is its first `name=value` pair.
 */
export function parseResponseCookies(
  headers: Readonly<Record<string, string>> | undefined,
): Array<{ name: string; value: string }> | undefined {
  const setCookie = findHeader(headers, 'Set-Cookie');
  if (setCookie === undefined) return undefined;
  const out: Array<{ name: string; value: string }> = [];
  for (const line of setCookie.split('\n')) {
    const first = line.split(';', 1)[0] ?? '';
    const eq = first.indexOf('=');
    if (eq < 0) continue;
    const name = first.slice(0, eq).trim();
    if (name === '') continue;
    out.push({ name, value: first.slice(eq + 1).trim() });
  }
  return out.length > 0 ? out : undefined;
}

/** Drop a URL's `#fragment`, the part HAR `request.url` never carries. */
export function stripUrlFragment(url: string): string {
  const hash = url.indexOf('#');
  return hash < 0 ? url : url.slice(0, hash);
}

/** Decompose a URL's query into HAR `[{name, value}]`; `[]` on a bare/invalid URL. */
export function queryStringFromUrl(url: string): Array<{ name: string; value: string }> {
  const q = url.indexOf('?');
  if (q < 0) return [];
  const out: Array<{ name: string; value: string }> = [];
  for (const [name, value] of new URLSearchParams(url.slice(q + 1))) {
    out.push({ name, value });
  }
  return out;
}

type HarPostData = NonNullable<HarRequest['postData']>;

/**
 * Build the HAR `request.postData` from the inline CDP request body, or
 * `undefined` when CDP carried none. The mime type is the request's
 * `Content-Type`; a `application/x-www-form-urlencoded` body is also split
 * into `params` so the Payload tab renders the key/value table the
 * heuristic HAR path shows, with the raw text kept as the fallback.
 */
function postDataToHar(
  text: string | undefined,
  headers: Readonly<Record<string, string>> | undefined,
): HarPostData | undefined {
  if (text === undefined) return undefined;
  const mimeType = findHeader(headers, 'Content-Type') ?? '';
  const params = /^application\/x-www-form-urlencoded\b/i.test(mimeType)
    ? Array.from(new URLSearchParams(text), ([name, value]) => ({ name, value }))
    : undefined;
  return { mimeType, text, ...(params !== undefined && params.length > 0 ? { params } : {}) };
}

/**
 * Build the HAR `request` section from a CDP request descriptor.
 * `headersOverride`, when supplied, is the on-the-wire header set from
 * `requestWillBeSentExtraInfo` — it supersedes the cooked
 * `request.headers` wholesale for both the header array and the parsed
 * request cookies (method / url / query string stay from the request).
 */
export function cdpRequestToHar(
  request: CdpRequestParams,
  headersOverride?: Readonly<Record<string, string>>,
): HarRequest {
  const headers = headersOverride ?? request.headers;
  const cookies = parseRequestCookies(headers);
  const postData = postDataToHar(request.postData, headers);
  const url = stripUrlFragment(request.url);
  return {
    method: request.method,
    url,
    headers: headerRecordToHar(headers),
    queryString: queryStringFromUrl(url),
    ...(cookies !== undefined ? { cookies } : {}),
    ...(postData !== undefined ? { postData } : {}),
    // CDP never reports the raw request header byte block, so `headersSize`
    // stays at the HAR "unavailable" sentinel. `bodySize` is the UTF-8 byte
    // length of the posted body, or `0` when there is none — the one size
    // field recoverable from the inline `postData`.
    headersSize: -1,
    bodySize: requestBodySize(request.postData),
  };
}

/** UTF-8 byte length of an inline request body, or `0` when absent. */
function requestBodySize(postData: string | undefined): number {
  return postData === undefined ? 0 : new TextEncoder().encode(postData).length;
}

/**
 * Decoded-body size for HAR `content.size`, in bytes.
 *
 * The streamed `dataReceived` sum is authoritative when the body actually
 * crossed the network — it is the *decoded* length, so a compressed
 * response reports its uncompressed size correctly. But media and
 * cache-served resources (a `<video>` range fetch, a disk-cache hit) never
 * stream chunks, leaving the sum at 0 even though the resource has real
 * bytes; for those we fall back to the `Content-Length` header, which is
 * what the browser's own panel shows as the resource size. We only fall
 * back when nothing streamed, so a genuinely-empty body stays 0 and a
 * compressed body keeps its decoded sum over the (smaller) encoded length.
 */
function decodedContentSize(
  contentSize: number | undefined,
  headers: Readonly<Record<string, string>> | undefined,
): number {
  if (contentSize !== undefined && contentSize > 0) return contentSize;
  const raw = findHeader(headers, 'Content-Length');
  if (raw === undefined) return contentSize ?? 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : (contentSize ?? 0);
}

/**
 * Build the HAR `response` section from a CDP response descriptor.
 * `transferSize` (wire bytes) and `contentSize` (decoded body bytes,
 * summed from `dataReceived`) are supplied separately because the final
 * hop learns them on/after `loadingFinished`, once the body has streamed.
 * `error`, when supplied, is the net-stack code from a terminal
 * `loadingFailed` (`net::ERR_*`) — HAR `_error`, which external tools read
 * to distinguish an aborted/blocked hop from a clean one.
 * `headersOverride`, when supplied, is the on-the-wire header set from
 * `responseReceivedExtraInfo` — it supersedes the cooked `response.headers`
 * wholesale for both the header array and the parsed `Set-Cookie` cookies
 * (status / protocol / mime type stay from the response).
 */
export function cdpResponseToHar(
  response: CdpResponseParams,
  transferSize?: number,
  contentSize?: number,
  error?: string,
  headersOverride?: Readonly<Record<string, string>>,
): HarResponse {
  const headers = headersOverride ?? response.headers;
  const cookies = parseResponseCookies(headers);
  return {
    status: response.status,
    statusText: response.statusText,
    ...(response.protocol !== undefined ? { httpVersion: response.protocol } : {}),
    headers: headerRecordToHar(headers),
    ...(cookies !== undefined ? { cookies } : {}),
    content: { size: decodedContentSize(contentSize, headers), mimeType: response.mimeType ?? '' },
    // The redirect target, always present on a Chrome export: the `Location`
    // header for a redirect hop, `''` otherwise.
    redirectURL: findHeader(headers, 'Location') || '',
    // CDP never reports the raw header/body byte lengths the HAR spec wants
    // here; `-1` is the HAR "unavailable" sentinel external tools expect.
    headersSize: -1,
    bodySize: -1,
    _fetchedViaServiceWorker: Boolean(response.fromServiceWorker),
    ...(transferSize !== undefined ? { _transferSize: transferSize } : {}),
    ...(error !== undefined ? { _error: error } : {}),
  };
}

const offset = (value: number | undefined): number => (value === undefined ? -1 : value);

/**
 * Round a ms quantity to microsecond precision. Scaling fractional
 * monotonic seconds to ms (`* 1000`) injects representational noise
 * (e.g. `0.1 * 1000 → 100.00000000002274`); without this, otherwise-equal
 * legs differ in their 11th decimal and a clean total reads as a near-miss.
 */
const round3 = (ms: number): number => Math.round(ms * 1000) / 1000;

/** Duration of a `[start, end]` leg in ms, or `-1` when either bound is unmeasured. */
function leg(start: number, end: number): number {
  if (start < 0 || end < 0 || end < start) return -1;
  return end - start;
}

/** Smallest non-negative value, or `-1` when none is measured. */
function leastNonNegative(values: readonly number[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const v of values) if (v >= 0 && v < best) best = v;
  return best === Number.POSITIVE_INFINITY ? -1 : best;
}

/**
 * Convert CDP `Network.ResourceTiming` legs into a HAR `timings` object.
 *
 * The classic failure mode is mixing time bases: ResourceTiming offsets
 * are ms relative to the monotonic `requestTime`, while the request's
 * start is a separate `wallTime`. We never cross those bases here — every
 * leg is computed from offsets within the same `requestTime` frame, and
 * the caller supplies `totalMs` (also relative to `requestTime`, derived
 * from the terminal event's monotonic timestamp) so `receive` is the
 * residual after headers, never a wall-vs-monotonic subtraction.
 *
 *   blocked  earliest real activity offset (queue / stall before connect)
 *   dns      dnsStart..dnsEnd
 *   connect  connectStart..connectEnd (TLS included)
 *   ssl      sslStart..sslEnd (subset of connect)
 *   send     sendStart..sendEnd
 *   wait     sendEnd..receiveHeadersEnd (server think time)
 *   receive  totalMs - receiveHeadersEnd (body download); `-1` until total known
 *
 * `-1` legs are the HAR convention for "not applicable" (e.g. a reused
 * connection skips dns/connect/ssl) and keep the waterfall from inventing
 * phantom phases.
 *
 *   _blocked_queueing  startTime - issueTime: the gap between the request
 *                      being issued and the network start (`issuedSec` →
 *                      `requestTime`). Always present; `-1` when not measured.
 *   _blocked_proxy     proxyStart..proxyEnd, only when a proxy leg occurred.
 */
export function cdpTimingToHar(timing: CdpResourceTiming, totalMs?: number, issuedSec?: number): HarTimings {
  const dnsStart = offset(timing.dnsStart);
  const dnsEnd = offset(timing.dnsEnd);
  const connectStart = offset(timing.connectStart);
  const connectEnd = offset(timing.connectEnd);
  const sslStart = offset(timing.sslStart);
  const sslEnd = offset(timing.sslEnd);
  const sendStart = offset(timing.sendStart);
  const sendEnd = offset(timing.sendEnd);
  const receiveHeadersEnd = offset(timing.receiveHeadersEnd);

  const send = Math.max(0, leg(sendStart, sendEnd));
  const wait = Math.max(0, leg(sendEnd, receiveHeadersEnd));
  const blocked = leastNonNegative([dnsStart, connectStart, sendStart]);
  const receive = totalMs !== undefined && receiveHeadersEnd >= 0 ? Math.max(0, totalMs - receiveHeadersEnd) : -1;

  const queued =
    issuedSec !== undefined && timing.requestTime > issuedSec ? (timing.requestTime - issuedSec) * 1000 : -1;
  const proxyStart = offset(timing.proxyStart);
  const proxyEnd = offset(timing.proxyEnd);

  return {
    blocked: round3(blocked),
    dns: round3(leg(dnsStart, dnsEnd)),
    connect: round3(leg(connectStart, connectEnd)),
    ssl: round3(leg(sslStart, sslEnd)),
    send: round3(send),
    wait: round3(wait),
    receive: round3(receive),
    _blocked_queueing: queued < 0 ? -1 : round3(queued),
    ...(proxyEnd >= 0 ? { _blocked_proxy: round3(proxyEnd - proxyStart) } : {}),
  };
}

/** Total request span in ms: terminal monotonic timestamp minus the timing base. */
export function totalTimeMs(timing: CdpResourceTiming | undefined, finishedSec: number): number | undefined {
  if (timing === undefined) return undefined;
  return round3(Math.max(0, (finishedSec - timing.requestTime) * 1000));
}
