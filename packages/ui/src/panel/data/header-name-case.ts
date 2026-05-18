/**
 * Header-name display formatter for the Headers tab.
 *
 * HTTP/2+ flattens header names to lowercase on the wire, so a real
 * response carries `content-type`, `cf-cache-status`, `etag`. That's
 * faithful to what was sent, but Chrome / Firefox / Edge all canonicalise
 * to Train-Case (`Content-Type`, `CF-Cache-Status`, `ETag`) in their
 * Network panels because it's vastly easier to scan.
 *
 * We default to Train-Case for the same reason. Users who want to see
 * exactly what came back can flip the View menu's "Name case" to
 * "Original".
 *
 * Algorithm:
 *   1. Pseudo-headers (starting with `:`) always stay lowercase.
 *   2. Lookup the canonical form in a small specials map — covers
 *      headers whose Train-Case doesn't match the convention (`ETag`,
 *      not `Etag`; `WWW-Authenticate`, not `Www-Authenticate`;
 *      `Sec-CH-UA`, not `Sec-Ch-Ua`).
 *   3. Otherwise, capitalize the first letter of each hyphen-separated
 *      segment.
 */

export type HeaderNameCase = 'train' | 'original';

/** Canonical forms for headers whose Train-Case rendering deviates
 *  from the strict capitalize-each-segment rule. Keep keys lowercase. */
const SPECIALS: ReadonlyMap<string, string> = new Map<string, string>([
  // Acronym-bearing
  ['etag', 'ETag'],
  ['www-authenticate', 'WWW-Authenticate'],
  ['dnt', 'DNT'],
  ['te', 'TE'],
  ['im', 'IM'],
  ['p3p', 'P3P'],
  ['nel', 'NEL'],
  ['mime-version', 'MIME-Version'],
  ['x-xss-protection', 'X-XSS-Protection'],
  ['x-ua-compatible', 'X-UA-Compatible'],
  ['x-dns-prefetch-control', 'X-DNS-Prefetch-Control'],
  ['ect', 'ECT'],
  ['rtt', 'RTT'],
  // Client Hints (CH = Client Hints, UA = User Agent — both kept all-caps)
  ['accept-ch', 'Accept-CH'],
  ['critical-ch', 'Critical-CH'],
  ['sec-ch-ua', 'Sec-CH-UA'],
  ['sec-ch-ua-mobile', 'Sec-CH-UA-Mobile'],
  ['sec-ch-ua-platform', 'Sec-CH-UA-Platform'],
  ['sec-ch-ua-platform-version', 'Sec-CH-UA-Platform-Version'],
  ['sec-ch-ua-arch', 'Sec-CH-UA-Arch'],
  ['sec-ch-ua-model', 'Sec-CH-UA-Model'],
  ['sec-ch-ua-bitness', 'Sec-CH-UA-Bitness'],
  ['sec-ch-ua-full-version', 'Sec-CH-UA-Full-Version'],
  ['sec-ch-ua-full-version-list', 'Sec-CH-UA-Full-Version-List'],
  ['sec-ch-ua-wow64', 'Sec-CH-UA-WoW64'],
  ['sec-gpc', 'Sec-GPC'],
  // WebSocket — keep CamelCase as IANA registers
  ['sec-websocket-key', 'Sec-WebSocket-Key'],
  ['sec-websocket-accept', 'Sec-WebSocket-Accept'],
  ['sec-websocket-version', 'Sec-WebSocket-Version'],
  ['sec-websocket-protocol', 'Sec-WebSocket-Protocol'],
  ['sec-websocket-extensions', 'Sec-WebSocket-Extensions'],
  // CDN / vendor
  ['cf-ray', 'CF-Ray'],
  ['cf-cache-status', 'CF-Cache-Status'],
  ['cf-request-id', 'CF-Request-Id'],
  ['cf-connecting-ip', 'CF-Connecting-IP'],
  ['cf-ipcountry', 'CF-IPCountry'],
  // W3C trace-context — spec specifies all-lowercase
  ['traceparent', 'traceparent'],
  ['tracestate', 'tracestate'],
  ['baggage', 'baggage'],
]);

function trainCaseFallback(name: string): string {
  return name
    .split('-')
    .map((seg) => (seg.length === 0 ? seg : seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase()))
    .join('-');
}

export function formatHeaderName(name: string, mode: HeaderNameCase): string {
  if (mode === 'original') return name;
  if (name.startsWith(':')) return name.toLowerCase();
  const lower = name.toLowerCase();
  const special = SPECIALS.get(lower);
  if (special) return special;
  return trainCaseFallback(lower);
}
