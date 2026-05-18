/**
 * Filter grammar for the Cookies tab. Mirrors `header-filter.ts` so the
 * keyboard feel is identical across tabs.
 *
 * Supported forms:
 *
 *   foo                    → name or value contains "foo" (case-insensitive)
 *   "exact phrase"         → quoted substring (case-insensitive)
 *   name:gh                → cookie name contains "gh"
 *   value:Madrid           → cookie value contains "Madrid"
 *   domain:.github.com     → domain contains the substring
 *   path:/api              → path contains the substring
 *   is:secure              → row has Secure
 *   is:httponly            → row has HttpOnly
 *   is:session             → row has no Expires / Max-Age
 *   is:expired             → row has expiry in the past
 *   is:samesite-none       → SameSite=None / no_restriction
 *   is:samesite-lax        → SameSite=Lax
 *   is:samesite-strict     → SameSite=Strict
 *   is:host-prefix         → name starts with __Host-
 *   is:secure-prefix       → name starts with __Secure-
 *   is:partitioned         → cookie has partition key
 *   is:third-party         → cookie's domain is cross-site to page origin
 *   is:set                 → response Set-Cookie row
 *   is:sent                → request-side row that was actually sent
 *   is:filtered-out        → jar cookie that wasn't sent on this request
 *   is:problem             → row triggered any insight
 *   is:rule                → cookie was added/replaced by an Open Headers rule
 *   -foo / -is:secure      → negate any token
 */

export type CookieFilterToken =
  | { kind: 'text'; value: string; negated: boolean }
  | { kind: 'name'; value: string; negated: boolean }
  | { kind: 'value'; value: string; negated: boolean }
  | { kind: 'domain'; value: string; negated: boolean }
  | { kind: 'path'; value: string; negated: boolean }
  | { kind: 'is'; value: string; negated: boolean };

export interface CookieRowMeta {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  session: boolean;
  expired: boolean;
  sameSite: string;
  partitioned: boolean;
  hostPrefix: boolean;
  securePrefix: boolean;
  thirdParty: boolean;
  isSet: boolean;
  isSent: boolean;
  isFilteredOut: boolean;
  problem: boolean;
  ruleModified: boolean;
}

const KNOWN_IS: ReadonlySet<string> = new Set([
  'secure',
  'httponly',
  'session',
  'expired',
  'samesite-none',
  'samesite-lax',
  'samesite-strict',
  'host-prefix',
  'secure-prefix',
  'partitioned',
  'third-party',
  'set',
  'sent',
  'filtered-out',
  'problem',
  'rule',
]);

function tokenizeRaw(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  let quoteChar = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (cur) {
        out.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

export function parseCookieQuery(input: string): readonly CookieFilterToken[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const out: CookieFilterToken[] = [];
  for (const raw of tokenizeRaw(trimmed)) {
    let s = raw;
    let negated = false;
    if (s.startsWith('-') && s.length > 1) {
      negated = true;
      s = s.slice(1);
    }
    const colon = s.indexOf(':');
    if (colon > 0) {
      const key = s.slice(0, colon).toLowerCase();
      const value = s.slice(colon + 1);
      if (value) {
        if (key === 'name') {
          out.push({ kind: 'name', value, negated });
          continue;
        }
        if (key === 'value') {
          out.push({ kind: 'value', value, negated });
          continue;
        }
        if (key === 'domain') {
          out.push({ kind: 'domain', value, negated });
          continue;
        }
        if (key === 'path') {
          out.push({ kind: 'path', value, negated });
          continue;
        }
        if (key === 'is' && KNOWN_IS.has(value.toLowerCase())) {
          out.push({ kind: 'is', value: value.toLowerCase(), negated });
          continue;
        }
      }
    }
    out.push({ kind: 'text', value: s, negated });
  }
  return out;
}

function matchOne(meta: CookieRowMeta, token: CookieFilterToken): boolean {
  if (token.kind === 'text') {
    const needle = token.value.toLowerCase();
    return (
      meta.name.toLowerCase().includes(needle) ||
      meta.value.toLowerCase().includes(needle) ||
      meta.domain.toLowerCase().includes(needle)
    );
  }
  if (token.kind === 'name') return meta.name.toLowerCase().includes(token.value.toLowerCase());
  if (token.kind === 'value') return meta.value.toLowerCase().includes(token.value.toLowerCase());
  if (token.kind === 'domain') return meta.domain.toLowerCase().includes(token.value.toLowerCase());
  if (token.kind === 'path') return meta.path.toLowerCase().includes(token.value.toLowerCase());
  switch (token.value) {
    case 'secure':
      return meta.secure;
    case 'httponly':
      return meta.httpOnly;
    case 'session':
      return meta.session;
    case 'expired':
      return meta.expired;
    case 'samesite-none':
      return meta.sameSite === 'no_restriction' || meta.sameSite.toLowerCase() === 'none';
    case 'samesite-lax':
      return meta.sameSite.toLowerCase() === 'lax';
    case 'samesite-strict':
      return meta.sameSite.toLowerCase() === 'strict';
    case 'partitioned':
      return meta.partitioned;
    case 'host-prefix':
      return meta.hostPrefix;
    case 'secure-prefix':
      return meta.securePrefix;
    case 'third-party':
      return meta.thirdParty;
    case 'set':
      return meta.isSet;
    case 'sent':
      return meta.isSent;
    case 'filtered-out':
      return meta.isFilteredOut;
    case 'problem':
      return meta.problem;
    case 'rule':
      return meta.ruleModified;
    default:
      return false;
  }
}

export function matchesCookieQuery(meta: CookieRowMeta, tokens: readonly CookieFilterToken[]): boolean {
  for (const token of tokens) {
    const ok = matchOne(meta, token);
    if (token.negated ? ok : !ok) return false;
  }
  return true;
}
