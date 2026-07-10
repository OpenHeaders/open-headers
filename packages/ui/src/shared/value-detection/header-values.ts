/**
 * Codecs for HTTP-header-shaped values — IMF-fixdate, query strings,
 * and the delimiter-list family (Cache-Control, HSTS,
 * Content-Disposition, Link, auth params, Accept lists). Same contract
 * as `encodings.ts`: strict evidence before a decode claims, framing
 * checks on re-encode (a line must not smuggle the join delimiter back
 * in), and an untouched round-trip never rewrites the value. List
 * values decode one segment per line for editing.
 */

/** Splits on commas that sit outside double-quoted spans — `Link`
 *  titles and auth params legitimately quote commas. */
function splitCommaOutsideQuotes(value: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of value) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if (ch === ',' && !inQuotes) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((s) => s.trim());
}

function toLines(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- date

const IMF_FIXDATE =
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

/** Attempts to read `value` as an IMF-fixdate HTTP date (`Expires`,
 *  `Last-Modified`, cookie `Expires` …). Returns the UTC ISO rendering
 *  for editing. */
export function tryDecodeHttpDate(value: string): string | null {
  const trimmed = value.trim();
  if (!IMF_FIXDATE.test(trimmed)) return null;
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) return null;
  const iso = new Date(ms).toISOString();
  return iso.endsWith('.000Z') ? `${iso.slice(0, -5)}Z` : iso;
}

/** Re-encodes an edited date back to IMF-fixdate. Null when the text
 *  doesn't parse as a date. */
export function encodeHttpDate(text: string): string | null {
  const ms = Date.parse(text.trim());
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toUTCString();
}

// --------------------------------------------------------------- query

const QUERY_PAIR = /^[^\s&=]+=[^&\s]*$/;

/** Attempts to read `value` as a query string / form-urlencoded body —
 *  at least two `&`-delimited `k=v` pairs (a single pair is too
 *  generic to claim). One pair per line for editing. */
export function tryDecodeQueryString(value: string): string | null {
  const segments = value.split('&');
  if (segments.length < 2) return null;
  if (!segments.every((s) => QUERY_PAIR.test(s))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-pair query text with `&`. Null when a line would
 *  break the framing (embedded `&` or whitespace). */
export function encodeQueryString(text: string): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => s.includes('&') || /\s/.test(s))) return null;
  return lines.join('&');
}

// ------------------------------------------------------- cache-control

// Closed directive vocabulary — bare flags and numeric-argument
// directives. Quoted-argument forms (`no-cache="set-cookie"`) are rare
// and deliberately not claimed.
const CC_FLAGS = new Set([
  'public',
  'private',
  'no-cache',
  'no-store',
  'no-transform',
  'must-revalidate',
  'proxy-revalidate',
  'must-understand',
  'immutable',
  'only-if-cached',
  'max-stale',
]);
const CC_NUMERIC = new Set([
  'max-age',
  's-maxage',
  'stale-while-revalidate',
  'stale-if-error',
  'max-stale',
  'min-fresh',
]);

function isCacheDirective(segment: string): boolean {
  const eq = segment.indexOf('=');
  if (eq === -1) return CC_FLAGS.has(segment.toLowerCase());
  return CC_NUMERIC.has(segment.slice(0, eq).toLowerCase()) && /^\d+$/.test(segment.slice(eq + 1));
}

/** Attempts to read `value` as a Cache-Control directive list. A lone
 *  bare flag (`public`) is too generic to claim; a lone `max-age=n` is
 *  strong enough evidence on its own. One directive per line. */
export function tryDecodeCacheControl(value: string): string | null {
  const segments = value.split(',').map((s) => s.trim());
  if (segments.some((s) => !s)) return null;
  if (!segments.every(isCacheDirective)) return null;
  if (segments.length < 2 && !segments[0].includes('=')) return null;
  return segments.join('\n');
}

/** Re-joins line-per-directive text with `, `. Null when a line embeds
 *  a comma. */
export function encodeCacheControl(text: string): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => s.includes(','))) return null;
  return lines.join(', ');
}

// ---------------------------------------------------------------- hsts

const HSTS_MAX_AGE = /^max-age=\d+$/i;
const HSTS_FLAG = /^(?:includeSubDomains|preload)$/i;

/** Attempts to read `value` as a Strict-Transport-Security policy —
 *  at least two `;`-delimited segments, one of them `max-age=n`, the
 *  rest from the closed HSTS vocabulary. One directive per line. */
export function tryDecodeHsts(value: string): string | null {
  const segments = value.split(';').map((s) => s.trim());
  if (segments.length < 2 || segments.some((s) => !s)) return null;
  if (!segments.some((s) => HSTS_MAX_AGE.test(s))) return null;
  if (!segments.every((s) => HSTS_MAX_AGE.test(s) || HSTS_FLAG.test(s))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-directive HSTS text with `; `. Null when a line
 *  embeds a semicolon. */
export function encodeHsts(text: string): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => s.includes(';'))) return null;
  return lines.join('; ');
}

// -------------------------------------------------- content-disposition

const CD_TYPE = /^(?:attachment|inline|form-data)$/i;
const CD_PARAM = /^[A-Za-z0-9*_-]+=(?:"[^"]*"|[^\s;]+)$/;

/** Attempts to read `value` as a Content-Disposition — a disposition
 *  token (`attachment`/`inline`/`form-data`) followed by at least one
 *  `;`-delimited parameter. Token on the first line, parameters on the
 *  following ones. */
export function tryDecodeContentDisposition(value: string): string | null {
  const segments = value.split(';').map((s) => s.trim());
  if (segments.length < 2 || segments.some((s) => !s)) return null;
  if (!CD_TYPE.test(segments[0])) return null;
  if (!segments.slice(1).every((s) => CD_PARAM.test(s))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-segment disposition text with `; `. Null when a
 *  line embeds a semicolon. */
export function encodeContentDisposition(text: string): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => s.includes(';'))) return null;
  return lines.join('; ');
}

// ---------------------------------------------------------------- link

const LINK_SEGMENT = /^<[^<>\s]+>\s*(?:;.+)?$/;

/** Attempts to read `value` as a Link header — every comma-delimited
 *  segment (quote-aware; `title` params may embed commas) is a
 *  `<uri>; params` link. One link per line. */
export function tryDecodeLinkHeader(value: string): string | null {
  if (!value.trimStart().startsWith('<')) return null;
  const segments = splitCommaOutsideQuotes(value);
  if (segments.some((s) => !s)) return null;
  if (!segments.every((s) => LINK_SEGMENT.test(s))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-link text with `, `. Null when a line carries an
 *  unquoted comma — it would silently split into two links. */
export function encodeLinkHeader(text: string): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => splitCommaOutsideQuotes(s).length > 1)) return null;
  return lines.join(', ');
}

// --------------------------------------------------------- auth params

// Schemes whose credentials are a comma-separated parameter list.
// Bearer/Basic carry opaque payloads and are handled by the JWT and
// base64 detectors instead.
const AUTH_SCHEME = /^(Digest|AWS4-HMAC-SHA256)\s+([\s\S]+)$/i;
const AUTH_PARAM = /^[A-Za-z0-9_-]+=(?:"[^"]*"|[^\s,]+)$/;

export interface DecodedAuthParams {
  /** The scheme token, preserved as a prefix on re-encode. */
  scheme: string;
  /** One `param=value` per line. */
  decoded: string;
}

/** Attempts to read `value` as a parameter-list Authorization
 *  credential (Digest, AWS SigV4) — scheme token plus at least two
 *  comma-delimited `k=v` / `k="v"` params. */
export function tryDecodeAuthParams(value: string): DecodedAuthParams | null {
  const match = value.trim().match(AUTH_SCHEME);
  if (!match) return null;
  const params = splitCommaOutsideQuotes(match[2]);
  if (params.length < 2 || params.some((s) => !s)) return null;
  if (!params.every((s) => AUTH_PARAM.test(s))) return null;
  return { scheme: match[1], decoded: params.join('\n') };
}

/** Re-joins line-per-param text behind the original scheme. Null when
 *  a line carries an unquoted comma. */
export function encodeAuthParams(text: string, shape: { scheme: string }): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => splitCommaOutsideQuotes(s).length > 1)) return null;
  return `${shape.scheme} ${lines.join(', ')}`;
}

// --------------------------------------------------------- accept list

const ACCEPT_ITEM = /^[A-Za-z*][A-Za-z0-9*+.^_-]*(?:\/[A-Za-z0-9*+.^_-]+)?(?:\s*;\s*[A-Za-z0-9_-]+=[A-Za-z0-9._-]+)*$/;

/** Attempts to read `value` as an Accept-family list (`Accept`,
 *  `Accept-Language`, `Accept-Encoding`) — at least two comma-delimited
 *  items, and at least one carrying a `/` MIME shape or `;` param so a
 *  generic word list (`foo, bar`) never claims. One item per line. */
export function tryDecodeAcceptList(value: string): string | null {
  const segments = value.split(',').map((s) => s.trim());
  if (segments.length < 2 || segments.some((s) => !s)) return null;
  if (!segments.every((s) => ACCEPT_ITEM.test(s))) return null;
  if (!segments.some((s) => s.includes('/') || s.includes(';'))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-item text with `, `. Null when a line embeds a
 *  comma. */
export function encodeAcceptList(text: string): string | null {
  const lines = toLines(text);
  if (!lines.length || lines.some((s) => s.includes(','))) return null;
  return lines.join(', ');
}
