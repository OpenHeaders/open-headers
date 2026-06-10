/**
 * Pure HAR-entry shaping from webRequest facts — the heuristic sibling of
 * `cdp-har-synth`.
 *
 * webRequest delivers the wire response headers + status line at
 * `onHeadersReceived`, but the panel's detail tabs (Headers / Cookies /
 * General) read exclusively from the row's HAR slot, which the devtools
 * `onRequestFinished` join fills. A request with no terminal event — a
 * document canceled mid-stream never gets one — never produces that HAR,
 * so the row showed nothing even though the headers were already in our
 * hands. These shapers project the captured webRequest facts into a
 * partial `InspectorHarEntry` for the hop slot; the joined devtools HAR
 * overwrites it wholesale when it lands (`setHopSlot` is a clean
 * refinement), so finished rows keep their single authoritative source.
 *
 * Everything here is a host-recorded fact: headers and status line from
 * the wire events, the server IP and failure code from the hop's terminal
 * event. No sizes are invented — webRequest reports no byte counts, so
 * `_transferSize` stays absent (the Size column reads honestly empty) and
 * `content.size`/`bodySize` carry the exporter's unknown markers.
 *
 * List-native on purpose: webRequest headers arrive as an ordered array
 * with duplicates intact (each `Set-Cookie` its own entry), which is
 * richer than the CDP record shape — so cookie parsing here walks the
 * list instead of reusing the record-keyed CDP helpers.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { queryStringFromUrl } from '../correlator-cdp/cdp-har-synth';

import type { WebRequestHeader } from './events';
import type { InspectorHarTimings } from './webrequest-har-timings';

/** Hop facts captured before the response: identity + the wire request headers. */
export interface PartialHarSeed {
  /** Hop start, wall-clock ms (`onBeforeRequest` / `onBeforeRedirect` time). */
  readonly startedAtMs: number;
  readonly method: string;
  readonly url: string;
  /** The set `onSendHeaders` reported leaving for the wire, when it fired. */
  readonly requestHeaders?: readonly WebRequestHeader[];
}

/** Response facts from `onHeadersReceived`. */
export interface PartialHarResponse {
  readonly statusCode: number;
  readonly statusLine?: string;
  readonly responseHeaders?: readonly WebRequestHeader[];
  /** webRequest `type` (`main_frame`, `xmlhttprequest`, …) — HAR `_resourceType`. */
  readonly resourceType: string;
}

/** Facts the hop's terminal event adds (`onCompleted` / `onErrorOccurred` / `onBeforeRedirect`). */
export interface PartialHarTerminal {
  /** Terminal wall-clock ms — resolves the entry's total `time`. */
  readonly completedAtMs: number;
  readonly ip?: string;
  /** Net-stack code from `onErrorOccurred` — HAR `_error`. */
  readonly error?: string;
}

/** The hop's timing block + the open-download verdict (see `webrequest-har-timings`). */
export interface PartialHarTiming {
  readonly timings: InspectorHarTimings;
  /** The body never finished downloading — the not-finished caution. */
  readonly responseBodyIncomplete?: boolean;
}

/**
 * The exporter's `time`: a plain sum of the non-negative legs. With the
 * dns-anchored `connect` dialect this over-counts a dns-bearing request
 * by its DNS leg — exactly what the host exporter writes, and what every
 * consumer (the Time column's `time − queueing − dns`) decodes.
 */
function exporterTimeSum(t: InspectorHarTimings): number {
  let sum = 0;
  for (const leg of [t.blocked, t.dns, t.connect, t.send, t.wait, t.receive]) {
    if (typeof leg === 'number' && leg > 0) sum += leg;
  }
  return sum;
}

const toHarHeaders = (headers: readonly WebRequestHeader[] | undefined): Array<{ name: string; value: string }> =>
  (headers ?? []).map((h) => ({ name: h.name, value: h.value ?? '' }));

/** Case-insensitive first-match lookup over a webRequest header list. */
function findHeader(headers: readonly WebRequestHeader[] | undefined, target: string): string | undefined {
  if (headers === undefined) return undefined;
  const lower = target.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === lower) return h.value ?? '';
  }
  return undefined;
}

/** HAR `request.cookies` from the `Cookie` request header. */
function parseRequestCookieList(
  headers: readonly WebRequestHeader[] | undefined,
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

/** HAR `response.cookies` from every `Set-Cookie` line (name + value only). */
function parseResponseCookieList(
  headers: readonly WebRequestHeader[] | undefined,
): Array<{ name: string; value: string }> | undefined {
  if (headers === undefined) return undefined;
  const out: Array<{ name: string; value: string }> = [];
  for (const h of headers) {
    if (h.name.toLowerCase() !== 'set-cookie') continue;
    const first = (h.value ?? '').split(';', 1)[0] ?? '';
    const eq = first.indexOf('=');
    if (eq < 0) continue;
    const name = first.slice(0, eq).trim();
    if (name === '') continue;
    out.push({ name, value: first.slice(eq + 1).trim() });
  }
  return out.length > 0 ? out : undefined;
}

/** `'HTTP/1.1 200 OK'` → `'HTTP/1.1'`; `undefined` when absent/malformed. */
function httpVersionFromStatusLine(statusLine: string | undefined): string | undefined {
  if (statusLine === undefined) return undefined;
  const firstSpace = statusLine.indexOf(' ');
  if (firstSpace <= 0) return undefined;
  const version = statusLine.slice(0, firstSpace);
  return version.startsWith('HTTP/') ? version : undefined;
}

/** `'HTTP/1.1 200 OK'` → `'OK'`; `undefined` when absent/malformed. */
function statusTextFromStatusLine(statusLine: string | undefined): string | undefined {
  if (statusLine === undefined) return undefined;
  const firstSpace = statusLine.indexOf(' ');
  if (firstSpace < 0) return undefined;
  const secondSpace = statusLine.indexOf(' ', firstSpace + 1);
  if (secondSpace < 0) return undefined;
  const text = statusLine.slice(secondSpace + 1).trim();
  return text.length > 0 ? text : undefined;
}

/** Bare mime from a `Content-Type` value (`'text/html; charset=utf-8'` → `'text/html'`). */
function mimeFromContentType(contentType: string | undefined): string {
  if (contentType === undefined) return '';
  const semi = contentType.indexOf(';');
  return (semi >= 0 ? contentType.slice(0, semi) : contentType).trim().toLowerCase();
}

/**
 * webRequest `type` → the devtools HAR `_resourceType` vocabulary —
 * the inverse of `harResourceTypeToWebRequest` in `har-to-update`.
 */
function webRequestTypeToHarResourceType(type: string): string {
  switch (type) {
    case 'main_frame':
    case 'sub_frame':
      return 'document';
    case 'xmlhttprequest':
      return 'xhr';
    case 'csp_report':
      return 'cspviolationreport';
    default:
      return type;
  }
}

/**
 * Shape a partial `InspectorHarEntry` for one hop from webRequest facts.
 *
 * Emitted at `onHeadersReceived` (no terminal yet), re-emitted refined
 * at the hop's terminal event with `serverIPAddress`, `_error` and the
 * total `time`, and re-emitted once more when the page's Resource Timing
 * legs join. Sizes follow the exporter's unknown conventions
 * (`headersSize`/`bodySize` `-1`, `content.size` `0`); the `timings`
 * block carries only host-recorded instants — the webRequest floor or
 * the page-recorded connection ladder, never an invented leg.
 */
export function partialHarEntry(
  seed: PartialHarSeed,
  response: PartialHarResponse,
  terminal?: PartialHarTerminal,
  timing?: PartialHarTiming,
): InspectorHarEntry {
  const requestCookies = parseRequestCookieList(seed.requestHeaders);
  const responseCookies = parseResponseCookieList(response.responseHeaders);
  const statusText = statusTextFromStatusLine(response.statusLine);
  const httpVersion = httpVersionFromStatusLine(response.statusLine);
  const location = findHeader(response.responseHeaders, 'Location');
  return {
    _priority: null,
    _resourceType: webRequestTypeToHarResourceType(response.resourceType),
    cache: {},
    request: {
      method: seed.method,
      url: seed.url,
      ...(httpVersion !== undefined ? { httpVersion } : {}),
      headers: toHarHeaders(seed.requestHeaders),
      queryString: queryStringFromUrl(seed.url),
      ...(requestCookies !== undefined ? { cookies: requestCookies } : {}),
      headersSize: -1,
      bodySize: -1,
    },
    response: {
      status: response.statusCode,
      statusText: statusText ?? '',
      ...(httpVersion !== undefined ? { httpVersion } : {}),
      headers: toHarHeaders(response.responseHeaders),
      ...(responseCookies !== undefined ? { cookies: responseCookies } : {}),
      content: {
        size: 0,
        mimeType: mimeFromContentType(findHeader(response.responseHeaders, 'Content-Type')),
      },
      redirectURL: location ?? '',
      headersSize: -1,
      bodySize: -1,
      _error: terminal?.error ?? null,
      ...(timing?.responseBodyIncomplete === true ? { _responseBodyIncomplete: true } : {}),
    },
    serverIPAddress: terminal?.ip ?? '',
    startedDateTime: new Date(seed.startedAtMs).toISOString(),
    // With a timing block, `time` is the exporter's leg sum (the floor sum
    // equals the wall span; the page-recorded ladder carries the exporter's
    // dns overlap); a block-less terminal falls back to the wall span.
    ...(terminal !== undefined
      ? {
          time:
            timing !== undefined
              ? exporterTimeSum(timing.timings)
              : Math.max(0, terminal.completedAtMs - seed.startedAtMs),
        }
      : {}),
    ...(timing !== undefined ? { timings: timing.timings } : {}),
  };
}
