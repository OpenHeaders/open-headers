/**
 * Per-header value parsers that turn raw header strings into small
 * structured summaries the Headers tab can render as flag chips and
 * inline explanations next to the value.
 *
 * Each parser is pure and tolerant — malformed input returns a partial
 * shape rather than throwing, so we never break the row over a server
 * that emits non-conforming headers.
 *
 * Coverage was chosen for "what does Chrome's Headers tab not interpret
 * for you, that a debugger consistently has to figure out by hand?":
 * Set-Cookie flags, Cache-Control freshness, Content-Type split, HSTS,
 * JWT detection in Authorization.
 */

// ── Set-Cookie ────────────────────────────────────────────────

export interface SetCookieInfo {
  name: string;
  /** Whether the cookie carries each flag. Three-valued to distinguish
   *  "no SameSite attribute at all" (`null`) from the explicit values. */
  httpOnly: boolean;
  secure: boolean;
  partitioned: boolean;
  sameSite: 'Strict' | 'Lax' | 'None' | null;
  domain: string | null;
  path: string | null;
  /** Seconds from now if `Max-Age` present; epoch-ms if `Expires` present;
   *  null for session cookies. */
  expiresAtMs: number | null;
  /** True when the cookie is a session cookie (no Max-Age, no Expires). */
  session: boolean;
  /** Flags the row should flag as missing best-practice. */
  missingFlags: ReadonlyArray<'Secure' | 'HttpOnly' | 'SameSite'>;
}

const ATTR_RE = /([^=;]+)(?:=([^;]*))?/g;

export function parseSetCookie(value: string, nowMs = Date.now()): SetCookieInfo | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // First chunk before `;` is "name=value".
  const semi = trimmed.indexOf(';');
  const head = semi === -1 ? trimmed : trimmed.slice(0, semi);
  const eq = head.indexOf('=');
  if (eq === -1) return null;
  const name = head.slice(0, eq).trim();
  if (!name) return null;
  const rest = semi === -1 ? '' : trimmed.slice(semi + 1);

  let httpOnly = false;
  let secure = false;
  let partitioned = false;
  let sameSite: SetCookieInfo['sameSite'] = null;
  let domain: string | null = null;
  let path: string | null = null;
  let maxAge: number | null = null;
  let expiresStr: string | null = null;

  ATTR_RE.lastIndex = 0;
  for (const m of rest.matchAll(ATTR_RE)) {
    const k = m[1].trim().toLowerCase();
    const v = m[2]?.trim();
    if (!k) continue;
    if (k === 'httponly') httpOnly = true;
    else if (k === 'secure') secure = true;
    else if (k === 'partitioned') partitioned = true;
    else if (k === 'samesite' && v) {
      const lv = v.toLowerCase();
      if (lv === 'strict') sameSite = 'Strict';
      else if (lv === 'lax') sameSite = 'Lax';
      else if (lv === 'none') sameSite = 'None';
    } else if (k === 'domain' && v) domain = v;
    else if (k === 'path' && v) path = v;
    else if (k === 'max-age' && v) {
      const n = Number.parseInt(v, 10);
      if (Number.isFinite(n)) maxAge = n;
    } else if (k === 'expires' && v) expiresStr = v;
  }

  let expiresAtMs: number | null = null;
  if (maxAge != null) expiresAtMs = nowMs + maxAge * 1000;
  else if (expiresStr) {
    const t = Date.parse(expiresStr);
    if (Number.isFinite(t)) expiresAtMs = t;
  }
  const session = expiresAtMs == null;

  const missingFlags: Array<'Secure' | 'HttpOnly' | 'SameSite'> = [];
  if (!secure) missingFlags.push('Secure');
  if (!httpOnly) missingFlags.push('HttpOnly');
  if (sameSite == null) missingFlags.push('SameSite');

  return {
    name,
    httpOnly,
    secure,
    partitioned,
    sameSite,
    domain,
    path,
    expiresAtMs,
    session,
    missingFlags,
  };
}

// ── Cache-Control ──────────────────────────────────────────────

export interface CacheControlInfo {
  noStore: boolean;
  noCache: boolean;
  mustRevalidate: boolean;
  immutable: boolean;
  isPublic: boolean;
  isPrivate: boolean;
  maxAgeSec: number | null;
  sMaxAgeSec: number | null;
  staleWhileRevalidateSec: number | null;
  /** Short human-readable summary for the row chip. */
  summary: string;
}

export function parseCacheControl(value: string): CacheControlInfo {
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const info: CacheControlInfo = {
    noStore: false,
    noCache: false,
    mustRevalidate: false,
    immutable: false,
    isPublic: false,
    isPrivate: false,
    maxAgeSec: null,
    sMaxAgeSec: null,
    staleWhileRevalidateSec: null,
    summary: '',
  };
  for (const part of parts) {
    const [rawK, rawV] = part.split('=', 2);
    const k = rawK.toLowerCase();
    const v = rawV ? Number.parseInt(rawV, 10) : null;
    if (k === 'no-store') info.noStore = true;
    else if (k === 'no-cache') info.noCache = true;
    else if (k === 'must-revalidate') info.mustRevalidate = true;
    else if (k === 'immutable') info.immutable = true;
    else if (k === 'public') info.isPublic = true;
    else if (k === 'private') info.isPrivate = true;
    else if (k === 'max-age' && v != null && Number.isFinite(v)) info.maxAgeSec = v;
    else if (k === 's-maxage' && v != null && Number.isFinite(v)) info.sMaxAgeSec = v;
    else if (k === 'stale-while-revalidate' && v != null && Number.isFinite(v)) info.staleWhileRevalidateSec = v;
  }
  if (info.noStore) info.summary = 'no-store';
  else if (info.immutable) info.summary = info.maxAgeSec ? `immutable · ${humanDuration(info.maxAgeSec)}` : 'immutable';
  else if (info.noCache) info.summary = 'revalidate every request';
  else if (info.maxAgeSec != null) {
    info.summary = `fresh ${humanDuration(info.maxAgeSec)}${info.mustRevalidate ? ' · must-revalidate' : ''}`;
  } else if (info.mustRevalidate) info.summary = 'must-revalidate';
  return info;
}

export function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 86400 * 30) return `${Math.round(seconds / 86400)}d`;
  if (seconds < 86400 * 365) return `${Math.round(seconds / (86400 * 30))}mo`;
  return `${Math.round(seconds / (86400 * 365))}y`;
}

// ── Content-Type ──────────────────────────────────────────────

export interface ContentTypeInfo {
  type: string;
  charset: string | null;
  boundary: string | null;
}

export function parseContentType(value: string): ContentTypeInfo {
  const [typePart, ...attrs] = value.split(';').map((s) => s.trim());
  const info: ContentTypeInfo = { type: typePart, charset: null, boundary: null };
  for (const a of attrs) {
    const eq = a.indexOf('=');
    if (eq === -1) continue;
    const k = a.slice(0, eq).trim().toLowerCase();
    let v = a.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (k === 'charset') info.charset = v;
    else if (k === 'boundary') info.boundary = v;
  }
  return info;
}

// ── Authorization (JWT detection) ─────────────────────────────

export interface AuthorizationInfo {
  scheme: string;
  isJwt: boolean;
  /** Decoded JWT header if `isJwt` — not validated, just base64-decoded. */
  jwtHeader: Record<string, unknown> | null;
  jwtPayload: Record<string, unknown> | null;
  /** Seconds remaining until exp, negative if expired, null if no exp. */
  jwtExpSecondsRemaining: number | null;
}

const JWT_RE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

function base64UrlDecode(s: string): string | null {
  try {
    const padLen = (4 - (s.length % 4)) % 4;
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
    // Both the browser panel runtime and vitest's jsdom/node test runner
    // ship `atob`. No Node fallback needed — the helper is pure-browser.
    return atob(b64);
  } catch {
    return null;
  }
}

export function parseAuthorization(value: string, nowMs = Date.now()): AuthorizationInfo | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const spaceIdx = trimmed.indexOf(' ');
  const scheme = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
  const rest = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
  const info: AuthorizationInfo = {
    scheme,
    isJwt: false,
    jwtHeader: null,
    jwtPayload: null,
    jwtExpSecondsRemaining: null,
  };
  if (!rest || !JWT_RE.test(rest)) return info;
  info.isJwt = true;
  const [h, p] = rest.split('.');
  const hDecoded = base64UrlDecode(h);
  const pDecoded = base64UrlDecode(p);
  if (hDecoded) {
    try {
      info.jwtHeader = JSON.parse(hDecoded) as Record<string, unknown>;
    } catch {
      // ignore
    }
  }
  if (pDecoded) {
    try {
      const payload = JSON.parse(pDecoded) as Record<string, unknown>;
      info.jwtPayload = payload;
      const exp = typeof payload.exp === 'number' ? payload.exp : null;
      if (exp != null) info.jwtExpSecondsRemaining = Math.floor((exp * 1000 - nowMs) / 1000);
    } catch {
      // ignore
    }
  }
  return info;
}

// ── Strict-Transport-Security ─────────────────────────────────

export interface HstsInfo {
  maxAgeSec: number;
  includeSubDomains: boolean;
  preload: boolean;
  summary: string;
}

export function parseHsts(value: string): HstsInfo | null {
  const parts = value.split(';').map((p) => p.trim().toLowerCase());
  let maxAge: number | null = null;
  let includeSubDomains = false;
  let preload = false;
  for (const part of parts) {
    if (part.startsWith('max-age=')) {
      const n = Number.parseInt(part.slice('max-age='.length), 10);
      if (Number.isFinite(n)) maxAge = n;
    } else if (part === 'includesubdomains') includeSubDomains = true;
    else if (part === 'preload') preload = true;
  }
  if (maxAge == null) return null;
  const bits = [humanDuration(maxAge)];
  if (includeSubDomains) bits.push('includeSubDomains');
  if (preload) bits.push('preload');
  return { maxAgeSec: maxAge, includeSubDomains, preload, summary: bits.join(' · ') };
}
