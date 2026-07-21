/**
 * Pure HAR-entry shaping from proxy capture facts — the wire-truth
 * sibling of the heuristic plane's `webrequest-har-synth`. The proxy
 * measured every instant on its own sockets, so the `timings` block
 * carries genuine L4 legs (connect / ssl / send / wait / receive) the
 * browser-side correlators can only get from CDP. No sizes are invented:
 * byte counts are the encoded bytes the proxy itself relayed;
 * `content.size` is stated only when the tee captured the whole identity-
 * encoded body (captured length = decoded length), else it keeps the
 * exporter's unknown marker. A fully-captured UTF-8 request body rides
 * `request.postData` — the wire body, post any rule substitution.
 *
 * Both header sets are the post-rewrite wire sets the proxy actually
 * forwarded/relayed, so the capture stamp is effective/effective.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { type CapturedBody, shapeBodyContent } from './body-store';
import type { ProxyExchangeEnd, ProxyHeader, ProxyHopTiming, ProxyRequestStart, ProxyResponseHead } from './mitm-types';

const toHarHeaders = (headers: readonly ProxyHeader[]): Array<{ name: string; value: string }> =>
  headers.map((h) => ({ name: h.name, value: h.value }));

/** HAR `request.queryString` from the URL's search params. */
function queryStringOf(url: string): Array<{ name: string; value: string }> {
  try {
    const out: Array<{ name: string; value: string }> = [];
    for (const [name, value] of new URL(url).searchParams) out.push({ name, value });
    return out;
  } catch {
    return [];
  }
}

/** Case-insensitive first-match lookup. */
function findHeader(headers: readonly ProxyHeader[], target: string): string | undefined {
  const lower = target.toLowerCase();
  for (const h of headers) {
    if (h.name.toLowerCase() === lower) return h.value;
  }
  return undefined;
}

/** Bare mime from a `Content-Type` value. */
function mimeFromContentType(contentType: string | undefined): string {
  if (contentType === undefined) return '';
  const semi = contentType.indexOf(';');
  return (semi >= 0 ? contentType.slice(0, semi) : contentType).trim().toLowerCase();
}

interface ProxyHarTimings {
  blocked: number;
  dns: number;
  connect: number;
  ssl: number;
  send: number;
  wait: number;
  receive: number;
}

const leg = (from: number | undefined, to: number | undefined): number =>
  from === undefined || to === undefined ? -1 : Math.max(0, to - from);

/**
 * Decompose the measured instants into exporter-dialect legs. A pooled
 * socket has no dns/connect/ssl legs (`-1`, the exporter's absent
 * marker) — the same honest gap Chrome shows on a reused connection.
 * `blocked` spans request receipt to re-origination start, which
 * includes a delay rule's hold — deliberate queueing, honestly queued.
 */
function timingsOf(
  startedAtMs: number,
  t: ProxyHopTiming,
  responseAtMs: number,
  completedAtMs: number,
): ProxyHarTimings {
  const connectAnchor = t.dnsResolvedAtMs ?? t.atStartMs;
  const sendAnchor = t.tlsEstablishedAtMs ?? t.connectedAtMs ?? t.atStartMs;
  return {
    blocked: Math.max(0, t.atStartMs - startedAtMs),
    dns: t.reusedSocket ? -1 : leg(t.atStartMs, t.dnsResolvedAtMs),
    connect: t.reusedSocket ? -1 : leg(connectAnchor, t.tlsEstablishedAtMs ?? t.connectedAtMs),
    ssl: t.reusedSocket ? -1 : leg(t.connectedAtMs, t.tlsEstablishedAtMs),
    send: leg(sendAnchor, t.requestSentAtMs),
    wait: leg(t.requestSentAtMs ?? sendAnchor, t.responseAtMs ?? responseAtMs),
    receive: leg(t.responseAtMs ?? responseAtMs, completedAtMs),
  };
}

/** The exporter's `time`: a plain sum of the non-negative legs. */
function exporterTimeSum(t: ProxyHarTimings): number {
  let sum = 0;
  for (const l of [t.blocked, t.dns, t.connect, t.send, t.wait, t.receive]) {
    if (l > 0) sum += l;
  }
  return sum;
}

/**
 * Shape the hop's `InspectorHarEntry` from the capture facts. `start`
 * carries the ORIGINAL request identity; `url` is the hop's effective
 * (post-rewrite) target the entry describes.
 */
/** A fully-captured UTF-8 request body as the HAR `postData` block. */
function postDataOf(
  body: CapturedBody | undefined,
  requestHeaders: readonly ProxyHeader[],
): { mimeType: string; text: string } | undefined {
  if (body === undefined || body.truncated || body.totalBytes === 0) return undefined;
  const shaped = shapeBodyContent(body.bytes);
  if (shaped.encoding !== '') return undefined;
  return { mimeType: mimeFromContentType(findHeader(requestHeaders, 'Content-Type')), text: shaped.content };
}

/** Decoded body size — stated only when the tee holds the whole identity-
 *  encoded body; anything else keeps the unknown marker. */
function contentSizeOf(end: ProxyExchangeEnd): number {
  const body = end.responseBody;
  if (body === undefined || body.truncated) return 0;
  if (end.responseContentEncoding !== undefined && end.responseContentEncoding !== 'identity') return 0;
  return body.bytes.length;
}

export function proxyHarEntry(
  start: ProxyRequestStart,
  url: string,
  head: ProxyResponseHead,
  end: ProxyExchangeEnd,
): InspectorHarEntry {
  const timings =
    end.timing !== undefined ? timingsOf(start.startedAtMs, end.timing, head.atMs, end.completedAtMs) : undefined;
  const postData = postDataOf(end.requestBody, start.headers);
  return {
    _priority: null,
    _resourceType: 'other',
    _ohHeaderCapture: { request: 'effective', response: 'effective' },
    _ohEntrySource: 'proxy',
    cache: {},
    request: {
      method: start.method,
      url,
      headers: toHarHeaders(start.headers),
      queryString: queryStringOf(url),
      headersSize: -1,
      bodySize: end.requestBytes ?? -1,
      ...(postData !== undefined ? { postData } : {}),
    },
    response: {
      status: head.statusCode,
      statusText: head.statusText,
      headers: toHarHeaders(head.headers),
      content: {
        size: contentSizeOf(end),
        mimeType: mimeFromContentType(findHeader(head.headers, 'Content-Type')),
      },
      redirectURL: findHeader(head.headers, 'Location') ?? '',
      headersSize: -1,
      bodySize: end.responseBytes,
      _error: null,
    },
    startedDateTime: new Date(start.startedAtMs).toISOString(),
    time: timings !== undefined ? exporterTimeSum(timings) : Math.max(0, end.completedAtMs - start.startedAtMs),
    ...(timings !== undefined ? { timings } : {}),
  };
}
