/**
 * Scope-match predicate for the host capture plane (`PROXY_SECURITY.md`
 * §2.4 — scoped decrypt by default). A pure host→boolean test shared by
 * the daemon MITM server (which hosts to TLS-terminate vs blind-tunnel)
 * and any surface that previews the scope list. Core stays `node:`-free,
 * so this holds no networking — only the string predicate.
 *
 * A host is decrypted only when it matches an explicit pattern; the
 * empty list matches nothing (opaque passthrough is the default, never
 * accidental interception).
 *
 * Pattern grammar (case-insensitive, port-agnostic):
 *  - `example.com`   — exact hostname (the apex only).
 *  - `*.example.com` — any single-or-multi-label subdomain of the apex,
 *                      NOT the apex itself (mirrors the wildcard-cert
 *                      convention users already know from `*.` SANs, and
 *                      the scoped-SSL lists of desktop debugging proxies).
 *  - `10.0.0.5`      — an IP literal matches exactly (no wildcarding).
 *
 * Deliberately no bare `*` / catch-all: a global-intercept switch is a
 * routing decision (system-proxy mode), not a scope entry, and must be
 * an explicit separate control — never a pattern a fat-fingered list can
 * enable silently.
 */

/**
 * Normalise a host for matching: lowercase, strip any `:port` suffix and
 * surrounding brackets (an IPv6 literal arrives as `[::1]` / `[::1]:443`
 * in a CONNECT authority). Returns `''` for an empty/whitespace host so
 * callers can reject it explicitly rather than matching a bare pattern.
 */
export function normalizeHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.length === 0) return '';
  if (h.startsWith('[')) {
    // Bracketed IPv6 literal, optionally with a `:port` after the `]`.
    const close = h.indexOf(']');
    return close === -1 ? h.slice(1) : h.slice(1, close);
  }
  // A single colon is a `host:port` separator; multiple colons is a bare
  // IPv6 literal (no port) and must be left intact.
  const firstColon = h.indexOf(':');
  if (firstColon !== -1 && h.indexOf(':', firstColon + 1) === -1) {
    h = h.slice(0, firstColon);
  }
  return h;
}

/** A single normalised pattern paired with whether it is a `*.` wildcard. */
export interface ScopePattern {
  readonly wildcard: boolean;
  /** For a wildcard, the apex after `*.`; otherwise the exact host. */
  readonly base: string;
}

/** Parse one raw pattern; returns `null` for an empty/invalid entry. */
export function parseScopePattern(raw: string): ScopePattern | null {
  const p = raw.trim().toLowerCase();
  if (p.length === 0) return null;
  if (p.startsWith('*.')) {
    const base = p.slice(2);
    return base.length === 0 ? null : { wildcard: true, base };
  }
  return { wildcard: false, base: p };
}

/**
 * True when `raw` is a well-formed scope pattern: a non-empty exact
 * host, IP literal, or `*.` wildcard with a non-empty apex. Rejects the
 * bare `*` catch-all by construction (`*.` with an empty base parses to
 * `null`, and `*` alone is an exact-host pattern that can never match a
 * normalised hostname — but refusing it here keeps the list honest at
 * edit time instead of storing a dead entry).
 */
export function isValidScopePattern(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '*') return false;
  return parseScopePattern(trimmed) !== null;
}

/**
 * True when `host` is in scope for decryption under `patterns`. The
 * empty (or all-invalid) list matches nothing. `host` may carry a port
 * or IPv6 brackets — it is normalised first.
 */
export function hostInScope(host: string, patterns: readonly string[]): boolean {
  const h = normalizeHost(host);
  if (h.length === 0) return false;
  for (const raw of patterns) {
    const pattern = parseScopePattern(raw);
    if (pattern === null) continue;
    if (pattern.wildcard) {
      // `*.example.com` matches `a.example.com` and `a.b.example.com`,
      // never the apex `example.com` itself.
      if (h.length > pattern.base.length + 1 && h.endsWith(`.${pattern.base}`)) return true;
    } else if (h === pattern.base) {
      return true;
    }
  }
  return false;
}
