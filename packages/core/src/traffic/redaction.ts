/**
 * Redaction predicates for traffic projections (AGENT_TRAFFIC_PLAN.md
 * §4, slice S2). Sensitive values are replaced with a marker that is
 * STABLE per value — `[redacted:<sha256-prefix>]` — so a consumer can
 * still reason "the same token was sent on both requests" (the origin
 * session's decisive comparison) without ever seeing the secret.
 *
 * Two predicate families:
 *
 *   - **Header names** (`authorization`, `proxy-authorization`,
 *     `cookie`, `set-cookie`): always redacted, structure-preserving —
 *     an auth scheme, cookie names and set-cookie attributes survive,
 *     only the secret values become markers.
 *   - **Token shapes** (JWT triples, long opaque single-token values):
 *     redacted wherever they appear — any other header value and every
 *     URL query-parameter value.
 *
 * Redaction is best-effort by design (STATUS risk 4): a site can always
 * put a secret somewhere novel. Over-redaction is the safe direction —
 * a marker still supports equality comparisons, so redacting a harmless
 * id costs little while missing a secret costs everything. Surfaces
 * that describe redaction must say what it does and does not promise.
 *
 * These predicates are consumed by the record→projection mapping in
 * `@openheaders/oracle/traffic-retention` — the ONLY place records
 * become projections — never by tool code.
 */

import { sha256HexSync } from './sha256';

/** Header names whose values are categorically sensitive (lowercase). */
const SENSITIVE_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
]);

/** Three dot-separated base64url segments — the JWT wire shape. */
const JWT_PATTERN = /^[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}$/;

/**
 * A single long opaque token: no whitespace, base64url-ish charset,
 * carrying both letters and digits. Deliberately excludes `/`, `%` and
 * `:` so paths, percent-encoded values and timestamps stay readable;
 * UUID-shaped ids DO match — a stable marker keeps them comparable, so
 * over-redacting an id is the cheap direction.
 */
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_\-.+=]{24,}$/;

/** `Scheme credentials` — one word, one space, the rest. */
const SCHEME_PREFIXED_PATTERN = /^([A-Za-z][A-Za-z0-9-]*) (.+)$/;

const MARKER_HEX_CHARS = 8;

/** Bounded marker memo — header tokens repeat on every request, so the
 *  hash is paid once per distinct value, not once per projection. */
const markerMemo = new Map<string, string>();
const MARKER_MEMO_CAP = 2048;

/** The stable per-value marker: `[redacted:<sha256-prefix>]`. */
export function redactionMarker(value: string): string {
  const memoized = markerMemo.get(value);
  if (memoized !== undefined) return memoized;
  const marker = `[redacted:${sha256HexSync(value).slice(0, MARKER_HEX_CHARS)}]`;
  if (markerMemo.size >= MARKER_MEMO_CAP) {
    const oldest = markerMemo.keys().next();
    if (oldest.done !== true) markerMemo.delete(oldest.value);
  }
  markerMemo.set(value, marker);
  return marker;
}

export function isSensitiveHeaderName(name: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(name.toLowerCase());
}

export function isTokenShapedValue(value: string): boolean {
  if (JWT_PATTERN.test(value)) return true;
  if (!OPAQUE_TOKEN_PATTERN.test(value)) return false;
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

/** `a=1; session=x` → `a=[redacted:…]; session=[redacted:…]` — cookie
 *  names survive (which cookies rode is debugging signal), every value
 *  becomes a marker. */
function redactCookiePairs(value: string): string {
  return value
    .split(';')
    .map((pair) => {
      const trimmed = pair.trim();
      if (trimmed.length === 0) return trimmed;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) return redactionMarker(trimmed);
      return `${trimmed.slice(0, eq)}=${redactionMarker(trimmed.slice(eq + 1))}`;
    })
    .join('; ');
}

/** `name=secret; Path=/; HttpOnly` — the cookie value becomes a marker,
 *  the attributes (path, expiry, flags) survive verbatim. */
function redactSetCookie(value: string): string {
  const firstSemi = value.indexOf(';');
  const nameValue = firstSemi === -1 ? value : value.slice(0, firstSemi);
  const attributes = firstSemi === -1 ? '' : value.slice(firstSemi);
  const eq = nameValue.indexOf('=');
  if (eq <= 0) return `${redactionMarker(nameValue.trim())}${attributes}`;
  return `${nameValue.slice(0, eq)}=${redactionMarker(nameValue.slice(eq + 1))}${attributes}`;
}

/**
 * Redact one header value under both predicate families. Returns the
 * input string unchanged (same reference) when nothing matches, so
 * callers can detect "untouched" cheaply.
 */
export function redactHeaderValue(name: string, value: string): string {
  const lower = name.toLowerCase();
  if (lower === 'cookie') return redactCookiePairs(value);
  if (lower === 'set-cookie') return redactSetCookie(value);
  if (lower === 'authorization' || lower === 'proxy-authorization') {
    const schemed = SCHEME_PREFIXED_PATTERN.exec(value);
    if (schemed !== null) return `${schemed[1]} ${redactionMarker(schemed[2] ?? '')}`;
    return redactionMarker(value);
  }
  // Any other header: shape-based. `Scheme token` inside a custom
  // header (X-Auth: Bearer …) redacts the token and keeps the scheme.
  if (isTokenShapedValue(value)) return redactionMarker(value);
  const schemed = SCHEME_PREFIXED_PATTERN.exec(value);
  if (schemed !== null && isTokenShapedValue(schemed[2] ?? '')) {
    return `${schemed[1]} ${redactionMarker(schemed[2] ?? '')}`;
  }
  return value;
}

/**
 * Redact token-shaped query-parameter values in a URL string. Operates
 * on the raw query text (never re-encodes the rest of the URL); param
 * names and non-token values survive verbatim. Returns the same
 * reference when nothing matches.
 */
export function redactUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;
  const fragmentStart = url.indexOf('#', queryStart);
  const query = fragmentStart === -1 ? url.slice(queryStart + 1) : url.slice(queryStart + 1, fragmentStart);
  if (query.length === 0) return url;
  let changed = false;
  const redacted = query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=');
      const value = eq === -1 ? pair : pair.slice(eq + 1);
      if (!isTokenShapedValue(value)) return pair;
      changed = true;
      return eq === -1 ? redactionMarker(value) : `${pair.slice(0, eq)}=${redactionMarker(value)}`;
    })
    .join('&');
  if (!changed) return url;
  const suffix = fragmentStart === -1 ? '' : url.slice(fragmentStart);
  return `${url.slice(0, queryStart + 1)}${redacted}${suffix}`;
}

/**
 * Redact a header list in one pass. Returns the SAME array reference
 * when no header matched, so untouched projections stay allocation-free.
 */
export function redactHeaders(
  headers: readonly { name: string; value: string }[],
): readonly { name: string; value: string }[] {
  let redacted: { name: string; value: string }[] | null = null;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]!;
    const value = redactHeaderValue(header.name, header.value);
    if (value !== header.value && redacted === null) {
      redacted = headers.slice(0, i);
    }
    if (redacted !== null) redacted.push(value === header.value ? header : { name: header.name, value });
  }
  return redacted ?? headers;
}
