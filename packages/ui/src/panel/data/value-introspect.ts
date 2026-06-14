/**
 * Pure introspection of an arbitrary string value — detects JWTs, JSON,
 * base64 blobs, and percent-encoding. Drives the inline value expander
 * shared by the headers and cookies tabs.
 *
 * Detection is best-effort and ordered (most specific first). The
 * caller renders whichever the result type points to; the original
 * raw value is always preserved.
 */

export interface JwtParts {
  header: unknown;
  payload: unknown;
  signature: string;
  /** Parsed `exp` if present, in unix seconds. */
  expSec?: number;
  /** Parsed `iat` if present, in unix seconds. */
  iatSec?: number;
  /** Parsed `nbf` if present. */
  nbfSec?: number;
}

export type ValueIntrospection =
  | { kind: 'plain'; value: string }
  | { kind: 'url-encoded'; value: string; decoded: string }
  | { kind: 'json'; value: string; parsed: unknown }
  | { kind: 'jwt'; value: string; jwt: JwtParts }
  | { kind: 'base64'; value: string; decoded: string }
  // A recognized leading label (e.g. an HTTP auth scheme) wrapping the
  // introspection of the remainder. Structural only — the core
  // `introspectValue` never emits it; a composing layer that owns the
  // label vocabulary does (see auth-scheme.ts).
  | { kind: 'prefixed'; value: string; label: string; inner: ValueIntrospection };

function looksLikePercentEncoded(s: string): boolean {
  return /%[0-9A-Fa-f]{2}/.test(s);
}

function safeUrlDecode(s: string): string | null {
  try {
    const out = decodeURIComponent(s);
    return out === s ? null : out;
  } catch {
    return null;
  }
}

function tryParseJson(s: string): unknown | null {
  const trimmed = s.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function base64UrlDecode(s: string): string | null {
  // JWT-style base64url → base64
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b.length % 4 === 0 ? '' : '='.repeat(4 - (b.length % 4));
  try {
    if (typeof atob === 'function') {
      const decoded = atob(b + pad);
      // Round-trip non-printable bytes via TextDecoder for unicode safety.
      try {
        const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
      } catch {
        return decoded;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function tryParseJwt(value: string): JwtParts | null {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  // JWT segments are base64url-encoded, no `+` or `/` characters.
  if (!/^[A-Za-z0-9_-]+$/.test(parts[0])) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(parts[1])) return null;
  // Signature may be empty (none-alg). Otherwise base64url.
  if (parts[2] && !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null;

  const hdrJson = base64UrlDecode(parts[0]);
  const plJson = base64UrlDecode(parts[1]);
  if (!hdrJson || !plJson) return null;

  let header: unknown;
  let payload: unknown;
  try {
    header = JSON.parse(hdrJson);
    payload = JSON.parse(plJson);
  } catch {
    return null;
  }
  // A real JWT header carries `alg` (and usually `typ: "JWT"`).
  if (!header || typeof header !== 'object' || !('alg' in (header as Record<string, unknown>))) return null;

  const pl = payload as Record<string, unknown> | null;
  const expSec = typeof pl?.exp === 'number' ? pl.exp : undefined;
  const iatSec = typeof pl?.iat === 'number' ? pl.iat : undefined;
  const nbfSec = typeof pl?.nbf === 'number' ? pl.nbf : undefined;

  return {
    header,
    payload,
    signature: parts[2] ?? '',
    ...(expSec != null ? { expSec } : {}),
    ...(iatSec != null ? { iatSec } : {}),
    ...(nbfSec != null ? { nbfSec } : {}),
  };
}

function looksLikePlainBase64(s: string): boolean {
  // Plain (non-url-safe) base64: only A-Z a-z 0-9 + / = and length ≥ 16,
  // not a JWT (which has dots).
  if (s.length < 16) return false;
  if (s.includes('.')) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(s)) return false;
  // Should have at least one non-letter (otherwise it's just text)
  return /[+/=0-9]/.test(s);
}

export function introspectValue(rawValue: string): ValueIntrospection {
  // 1. JWT (most specific — three base64url segments separated by dots).
  const jwt = tryParseJwt(rawValue);
  if (jwt) return { kind: 'jwt', value: rawValue, jwt };

  // 2. URL-encoded? Decode and re-introspect once.
  if (looksLikePercentEncoded(rawValue)) {
    const decoded = safeUrlDecode(rawValue);
    if (decoded) {
      // After decoding it might be JSON.
      const j = tryParseJson(decoded);
      if (j != null) return { kind: 'json', value: rawValue, parsed: j };
      return { kind: 'url-encoded', value: rawValue, decoded };
    }
  }

  // 3. Raw JSON?
  const direct = tryParseJson(rawValue);
  if (direct != null) return { kind: 'json', value: rawValue, parsed: direct };

  // 4. Plain base64?
  if (looksLikePlainBase64(rawValue)) {
    try {
      const decoded = typeof atob === 'function' ? atob(rawValue) : null;
      if (decoded) {
        // Only worth surfacing if the decode looks printable enough.
        const printable = decoded.replace(/[^\x20-\x7e\t\n\r]/g, '').length;
        if (printable >= decoded.length * 0.8) {
          return { kind: 'base64', value: rawValue, decoded };
        }
      }
    } catch {
      // fall through
    }
  }

  return { kind: 'plain', value: rawValue };
}

export function introspectionHasDepth(i: ValueIntrospection): boolean {
  return i.kind !== 'plain';
}

/** The encoding kind to surface as a one-glyph hint — peels a `prefixed`
 *  wrapper down to the credential it carries. */
export function introspectionHint(i: ValueIntrospection): ValueIntrospection['kind'] {
  return i.kind === 'prefixed' ? introspectionHint(i.inner) : i.kind;
}
