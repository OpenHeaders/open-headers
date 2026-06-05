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

/** Build the HAR `request` section from a CDP request descriptor. */
export function cdpRequestToHar(request: CdpRequestParams): HarRequest {
  const cookies = parseRequestCookies(request.headers);
  return {
    method: request.method,
    url: request.url,
    headers: headerRecordToHar(request.headers),
    queryString: queryStringFromUrl(request.url),
    ...(cookies !== undefined ? { cookies } : {}),
  };
}

/**
 * Build the HAR `response` section from a CDP response descriptor.
 * `transferSize` (wire bytes) is supplied separately because the final
 * hop learns it on `loadingFinished`, after the response headers landed.
 */
export function cdpResponseToHar(response: CdpResponseParams, transferSize?: number): HarResponse {
  const cookies = parseResponseCookies(response.headers);
  return {
    status: response.status,
    statusText: response.statusText,
    ...(response.protocol !== undefined ? { httpVersion: response.protocol } : {}),
    headers: headerRecordToHar(response.headers),
    ...(cookies !== undefined ? { cookies } : {}),
    content: { size: 0, mimeType: response.mimeType ?? '' },
    ...(transferSize !== undefined ? { _transferSize: transferSize } : {}),
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
 */
export function cdpTimingToHar(timing: CdpResourceTiming, totalMs?: number): HarTimings {
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

  return {
    blocked: round3(blocked),
    dns: round3(leg(dnsStart, dnsEnd)),
    connect: round3(leg(connectStart, connectEnd)),
    ssl: round3(leg(sslStart, sslEnd)),
    send: round3(send),
    wait: round3(wait),
    receive: round3(receive),
  };
}

/** Total request span in ms: terminal monotonic timestamp minus the timing base. */
export function totalTimeMs(timing: CdpResourceTiming | undefined, finishedSec: number): number | undefined {
  if (timing === undefined) return undefined;
  return round3(Math.max(0, (finishedSec - timing.requestTime) * 1000));
}
