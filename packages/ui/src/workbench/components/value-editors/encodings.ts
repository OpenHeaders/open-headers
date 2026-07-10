/**
 * Encoding codecs + heuristics for the value-type detectors — base64
 * (standard and url-safe alphabets), %XX URL-encoding, hex-encoded
 * text, Unix timestamps, JSON values, JSON string literals, data URIs,
 * cookie strings, and CSP directive lists. Pure text helpers; the
 * detector registry in `detect.ts` builds on these.
 *
 * Base64/hex detection is heuristic by nature (any alphanumeric run is
 * charset-valid), so it demands real evidence before claiming a hit:
 * minimum length, alphabet-specific shape checks, strict UTF-8
 * decodability, and a printable result. A missed value costs nothing
 * (no edit icon); a false hit puts a useless icon on the rail.
 */

const BASE64_STD = /^[A-Za-z0-9+/]+={0,2}$/;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;
const MIN_BASE64_LENGTH = 16;
// Control characters other than \t \n \r — a decode containing any is
// binary, not editable text.
function hasUnprintable(text: string): boolean {
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x7f) return true;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
  }
  return false;
}

export interface DecodedBase64 {
  decoded: string;
  /** `-_` alphabet (vs `+/`). Preserved on re-encode. */
  urlSafe: boolean;
  /** Whether the original carried `=` padding. Preserved on re-encode. */
  padded: boolean;
}

/** Attempts to read `value` as base64-encoded UTF-8 text. Returns null
 *  unless the value passes the shape heuristics AND decodes to clean
 *  printable text. */
export function tryDecodeBase64(value: string): DecodedBase64 | null {
  if (value.length < MIN_BASE64_LENGTH) return null;
  let urlSafe: boolean;
  if (BASE64_STD.test(value) && value.length % 4 === 0) {
    urlSafe = false;
  } else if (BASE64_URL.test(value) && /[-_]/.test(value)) {
    // The url-safe alphabet without its `-`/`_` marks is
    // indistinguishable from a plain word — require at least one.
    urlSafe = true;
  } else {
    return null;
  }
  const std = urlSafe ? value.replace(/-/g, '+').replace(/_/g, '/') : value;
  const paddedInput = std.padEnd(Math.ceil(std.length / 4) * 4, '=');
  let bytes: Uint8Array;
  try {
    const binary = atob(paddedInput);
    bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (!decoded || hasUnprintable(decoded)) return null;
  return { decoded, urlSafe, padded: value.includes('=') };
}

/** Re-encodes text to base64 in the same shape the original had —
 *  alphabet and padding both preserved so a round-trip is stable. */
export function encodeBase64(text: string, shape: { urlSafe: boolean; padded: boolean }): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  let encoded = btoa(binary);
  if (shape.urlSafe) encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_');
  if (!shape.padded) encoded = encoded.replace(/=/g, '');
  return encoded;
}

const HEX_PAIRS = /^(?:[0-9A-Fa-f]{2})+$/;
const MIN_HEX_LENGTH = 16;

export interface DecodedHex {
  decoded: string;
  /** `A-F` digits (vs `a-f`). Preserved on re-encode. */
  uppercase: boolean;
}

/** Attempts to read `value` as hex-encoded UTF-8 text. Beyond the
 *  shape check (even length, hex charset, length floor), at least one
 *  `a-f`/`A-F` digit is required — a pure-numeric string is far more
 *  likely an id or timestamp than deliberate hex — and the decode must
 *  be clean printable text, same bar as base64. */
export function tryDecodeHex(value: string): DecodedHex | null {
  if (value.length < MIN_HEX_LENGTH) return null;
  if (!HEX_PAIRS.test(value) || !/[A-Fa-f]/.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (!decoded || hasUnprintable(decoded)) return null;
  return { decoded, uppercase: !/[a-f]/.test(value) };
}

/** Re-encodes text to hex, preserving the original's digit case. */
export function encodeHex(text: string, shape: { uppercase: boolean }): string {
  const bytes = new TextEncoder().encode(text);
  let encoded = '';
  for (const byte of bytes) encoded += byte.toString(16).padStart(2, '0');
  return shape.uppercase ? encoded.toUpperCase() : encoded;
}

// Plausibility window for epoch values: 2001-09-09 (1e9 s — the first
// 10-digit second) through 2100-01-01. Anything outside is far more
// likely an id than a time.
const EPOCH_MIN_S = 1_000_000_000;
const EPOCH_MAX_S = 4_102_444_800;

export interface DecodedTimestamp {
  /** UTC ISO-8601 rendering of the epoch value. */
  iso: string;
  /** Original resolution — 10-digit seconds or 13-digit milliseconds.
   *  Preserved on re-encode. */
  unit: 's' | 'ms';
}

/** Attempts to read `value` as a Unix timestamp — exactly 10 digits
 *  (seconds) or 13 digits (milliseconds), inside a plausible date
 *  window. */
export function tryDecodeTimestamp(value: string): DecodedTimestamp | null {
  if (!/^\d{10}$/.test(value) && !/^\d{13}$/.test(value)) return null;
  const unit: 's' | 'ms' = value.length === 10 ? 's' : 'ms';
  const seconds = unit === 's' ? Number(value) : Number(value) / 1000;
  if (seconds < EPOCH_MIN_S || seconds >= EPOCH_MAX_S) return null;
  const iso = new Date(seconds * 1000).toISOString();
  return { unit, iso: iso.endsWith('.000Z') ? `${iso.slice(0, -5)}Z` : iso };
}

/** Re-encodes an edited date back to an epoch string in the original
 *  resolution. Returns null when the text doesn't parse as a date or
 *  falls outside the plausibility window. */
export function encodeTimestamp(text: string, shape: { unit: 's' | 'ms' }): string | null {
  const ms = Date.parse(text.trim());
  if (Number.isNaN(ms) || ms < EPOCH_MIN_S * 1000 || ms >= EPOCH_MAX_S * 1000) return null;
  return shape.unit === 's' ? String(Math.floor(ms / 1000)) : String(ms);
}

export interface DecodedJsonValue {
  /** Pretty-printed (2-space) rendering for comfortable editing. */
  decoded: string;
  /** Whether the original was already pretty-printed (had newlines).
   *  Preserved on re-encode — a compact value stays compact. */
  pretty: boolean;
}

/** Attempts to read `value` as a JSON object or array. Scalars are
 *  deliberately not claimed — a plain number or word is not "JSON" in
 *  any way worth an editor (quoted strings have their own detector). */
export function tryDecodeJsonValue(value: string): DecodedJsonValue | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== 'object') return null;
  return { decoded: JSON.stringify(parsed, null, 2), pretty: trimmed.includes('\n') };
}

/** Re-serializes edited JSON in the original's shape. Null when the
 *  text no longer parses. */
export function encodeJsonValue(text: string, shape: { pretty: boolean }): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return shape.pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed);
}

/** Attempts to read `value` as a JSON string literal — a quoted,
 *  escaped string like `"{\"userId\":123}"` or `"line1\nline2"`.
 *  Returns the unescaped inner text. */
export function tryDecodeJsonString(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 3 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  return typeof parsed === 'string' && parsed ? parsed : null;
}

/** Re-quotes edited text as a JSON string literal. Total — every
 *  string escapes cleanly. */
export function encodeJsonString(text: string): string {
  return JSON.stringify(text);
}

const DATA_URI = /^data:([^,]*),([\s\S]*)$/;

export interface DecodedDataUri {
  /** The payload as editable text. */
  decoded: string;
  /** Everything between `data:` and the comma (MIME type + params,
   *  including any `;base64` flag). Preserved verbatim on re-encode. */
  meta: string;
  /** Whether the payload is base64 (vs percent-encoded). Preserved. */
  base64: boolean;
}

/** Attempts to read `value` as a data URI with a TEXT payload. Binary
 *  payloads (images etc.) are not claimed — there is no useful text
 *  editor for them. */
export function tryDecodeDataUri(value: string): DecodedDataUri | null {
  const match = value.match(DATA_URI);
  if (!match) return null;
  const [, meta, payload] = match;
  const base64 = /(?:^|;)base64$/i.test(meta);
  let decoded: string;
  if (base64) {
    let bytes: Uint8Array;
    try {
      const binary = atob(payload);
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    } catch {
      return null;
    }
    try {
      decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return null;
    }
  } else {
    try {
      decoded = decodeURIComponent(payload);
    } catch {
      return null;
    }
  }
  if (!decoded || hasUnprintable(decoded)) return null;
  return { decoded, meta, base64 };
}

/** Re-encodes edited text into the data URI's original shape. */
export function encodeDataUri(text: string, shape: { meta: string; base64: boolean }): string {
  if (!shape.base64) return `data:${shape.meta},${encodeURIComponent(text)}`;
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${shape.meta},${btoa(binary)}`;
}

// Cookie pair (`name=value`, name is a token without spaces/;/=) or a
// valueless Set-Cookie attribute flag.
const COOKIE_PAIR = /^[^\s;=]+=[^;]*$/;
const COOKIE_FLAG = /^(?:Secure|HttpOnly|Partitioned)$/i;

/** Attempts to read `value` as a `; `-delimited cookie string — a
 *  Cookie header or Set-Cookie value. Requires at least two segments
 *  (a single `k=v` is too generic to claim) where the first is a
 *  `name=value` pair and the rest are pairs or attribute flags.
 *  Returns one segment per line for editing. */
export function tryDecodeCookieList(value: string): string | null {
  const segments = value.split(';').map((s) => s.trim());
  if (segments.length < 2 || segments.some((s) => !s)) return null;
  if (!COOKIE_PAIR.test(segments[0])) return null;
  if (!segments.every((s) => COOKIE_PAIR.test(s) || COOKIE_FLAG.test(s))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-segment cookie text. Null when a line would break
 *  the `; ` framing or stops looking like a cookie segment. */
export function encodeCookieList(text: string): string | null {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  if (!lines.every((s) => COOKIE_PAIR.test(s) || COOKIE_FLAG.test(s))) return null;
  return lines.join('; ');
}

// The CSP directive vocabulary is closed — a value whose every
// segment leads with one of these is a policy, not prose.
const CSP_DIRECTIVES = new Set([
  'default-src',
  'script-src',
  'script-src-elem',
  'script-src-attr',
  'style-src',
  'style-src-elem',
  'style-src-attr',
  'img-src',
  'connect-src',
  'font-src',
  'object-src',
  'media-src',
  'frame-src',
  'child-src',
  'worker-src',
  'manifest-src',
  'prefetch-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
  'sandbox',
  'report-uri',
  'report-to',
  'upgrade-insecure-requests',
  'block-all-mixed-content',
  'require-trusted-types-for',
  'trusted-types',
]);

/** Attempts to read `value` as a Content-Security-Policy — every
 *  `;`-delimited segment must lead with a known directive name.
 *  Returns one directive per line for editing. */
export function tryDecodeCspList(value: string): string | null {
  const segments = value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return null;
  if (!segments.every((s) => CSP_DIRECTIVES.has(s.split(/\s+/, 1)[0].toLowerCase()))) return null;
  return segments.join('\n');
}

/** Re-joins line-per-directive CSP text. Null when a line embeds a
 *  `;` (it would silently split into two directives). */
export function encodeCspList(text: string): string | null {
  const lines = text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length || lines.some((s) => s.includes(';'))) return null;
  return lines.join('; ');
}

/** Attempts to read `value` as a %XX URL-encoded component. Requires
 *  at least one escape sequence and a decode that actually changes the
 *  text. `+` is left alone — whether it means space is a form-encoding
 *  convention the field can't know. */
export function tryDecodeUrlComponent(value: string): string | null {
  if (!/%[0-9A-Fa-f]{2}/.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    return decoded !== value ? decoded : null;
  } catch {
    return null;
  }
}
