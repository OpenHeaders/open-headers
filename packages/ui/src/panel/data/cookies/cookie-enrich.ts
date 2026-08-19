/**
 * Build the per-direction CookieRow lists for the Cookies tab.
 *
 * Request side:
 *   - HAR provides only name + value. We look up the same `(name)` in
 *     the jar (keyed by request URL) and graft Domain/Path/Expires/…
 *     onto the row when we find a match. Cookies that the HAR sent but
 *     the jar doesn't know about become `request-har` rows (rare —
 *     happens if the page set the cookie via `document.cookie` and
 *     immediately fired before the jar caught up, or the request fired
 *     before the panel installed its fetcher).
 *   - When `showFilteredOut` is on, every jar cookie for the URL that
 *     *wasn't* in the HAR appears as a `filtered-out` row with a short
 *     `filteredReason` string ("path mismatch", "session cookie expired",
 *     "Secure-only on http", "domain mismatch", "third-party blocked").
 *
 * Response side:
 *   - Parse each `Set-Cookie` header value. Multiple Set-Cookie headers
 *     stack; we never collapse them.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';
import { cookieEditKey, type JarCookie } from './cookie-jar-cache';
import type { CookieRow, CookieSameSite } from './cookie-model';
import { jarToRow } from './cookie-model';

function normaliseSameSiteAttr(raw: string): CookieSameSite | string {
  const lower = raw.toLowerCase();
  if (lower === 'none') return 'no_restriction';
  if (lower === 'lax' || lower === 'strict') return lower;
  return raw;
}

function parseMaxAge(raw: string): number | undefined {
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseExpiresDate(raw: string): number | undefined {
  // Spec uses IMF-fixdate; browsers accept many variants. Date.parse is
  // best-effort; null on failure.
  const t = Date.parse(raw);
  return Number.isFinite(t) ? Math.floor(t / 1000) : undefined;
}

/**
 * Parse a single Set-Cookie header value into a row. Returns null when
 * the line has no name/value pair.
 */
export function parseSetCookieLine(line: string, now: number = Date.now()): CookieRow | null {
  const parts = line
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const first = parts[0];
  if (!first) return null;

  const eqIdx = first.indexOf('=');
  const name = eqIdx >= 0 ? first.slice(0, eqIdx).trim() : first;
  const value = eqIdx >= 0 ? first.slice(eqIdx + 1) : '';
  if (!name) return null;

  const row: CookieRow = {
    name,
    value,
    direction: 'response',
    attribution: 'response-set',
    id: `response:set:${name}:${Math.random().toString(36).slice(2, 8)}`,
    size: name.length + 1 + value.length,
  };

  let sawMaxAge = false;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const lower = part.toLowerCase();
    if (lower.startsWith('domain=')) row.domain = part.slice(7);
    else if (lower.startsWith('path=')) row.path = part.slice(5);
    else if (lower.startsWith('expires=')) {
      row.expiresRaw = part.slice(8);
      const t = parseExpiresDate(row.expiresRaw);
      if (t != null) row.expirationDate = t;
    } else if (lower.startsWith('max-age=')) {
      sawMaxAge = true;
      const ma = parseMaxAge(part.slice(8));
      if (ma != null) {
        row.maxAge = ma;
        // Max-Age beats Expires when both present (RFC 6265 §5.3).
        row.expirationDate = Math.floor(now / 1000) + ma;
      }
    } else if (lower === 'httponly') row.httpOnly = true;
    else if (lower === 'secure') row.secure = true;
    else if (lower === 'partitioned') row.partitionKey = '(set: Partitioned)';
    else if (lower.startsWith('samesite=')) row.sameSite = normaliseSameSiteAttr(part.slice(9));
    else if (lower.startsWith('priority=')) row.priority = part.slice(9);
  }

  // No Expires and no Max-Age ⇒ session cookie (browser deletes on close).
  if (!sawMaxAge && row.expirationDate == null) {
    row.session = true;
  }

  return row;
}

/**
 * Compute the per-row filteredReason for a jar cookie that the
 * request didn't carry (also the Storage tool window's not-sent badge
 * reason for site-jar rows). The reasons are heuristic — the browser's
 * actual decision can hinge on partition-key / 3P-CHIPS / page
 * embedding state we can't see from a panel — but they're correct in
 * the common cases (domain / path / scheme / expiry).
 */
export function explainFilteredOut(c: JarCookie, parsedUrl: URL, now: number): string {
  if (c.expirationDate != null && c.expirationDate * 1000 <= now) {
    return 'expired';
  }
  if (c.secure && parsedUrl.protocol !== 'https:') {
    return 'Secure cookie on http';
  }
  const host = parsedUrl.hostname;
  const cookieDomain = c.domain.replace(/^\./, '');
  const domainMatches = c.hostOnly ? host === cookieDomain : host === cookieDomain || host.endsWith(`.${cookieDomain}`);
  if (!domainMatches) {
    return `domain mismatch (cookie domain ${c.domain})`;
  }
  const path = parsedUrl.pathname || '/';
  if (c.path && !path.startsWith(c.path)) {
    return `path mismatch (cookie path ${c.path})`;
  }
  if (c.sameSite === 'strict' || c.sameSite === 'lax') {
    return `SameSite=${c.sameSite}`;
  }
  return 'not sent';
}

/**
 * Find the jar entry a Set-Cookie row maps to. Domain / path from the
 * header narrow the match when present (leading dots stripped — the jar
 * stores domain-wide cookies dotted, the header may write either form);
 * a line that omitted them (host-only, default path) accepts any jar
 * cookie of that name — unless several qualify, where guessing could
 * point Edit / Delete at the wrong cookie, so no match is returned.
 */
function findResponseJarMatch(jar: readonly JarCookie[], row: CookieRow): JarCookie | undefined {
  const norm = (d: string) => d.replace(/^\./, '');
  const candidates = jar.filter(
    (j) =>
      j.name === row.name &&
      (row.domain == null || norm(j.domain) === norm(row.domain)) &&
      (row.path == null || j.path === row.path),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export interface EnrichmentInputs {
  url: string;
  har: InspectorHarEntry;
  jar: readonly JarCookie[] | null;
  /** When true, also surface jar cookies that *would* have been sent
   *  but weren't, with a `filteredReason`. */
  showFilteredOut: boolean;
  /** Identity keys (`cookieEditKey`) of cookies edited from the panel
   *  this session — those rows show the live jar value, not the value
   *  the request carried, and are flagged `edited`. */
  editedKeys?: ReadonlySet<string>;
  /** Unix ms — injected for deterministic tests. */
  now?: number;
}

export interface EnrichmentResult {
  request: readonly CookieRow[];
  response: readonly CookieRow[];
  /** Total bytes carried by the request `Cookie:` header (joined). */
  requestBytes: number;
  /** Total bytes carried by Set-Cookie response headers (joined). */
  responseBytes: number;
}

export function enrichCookies(input: EnrichmentInputs): EnrichmentResult {
  const now = input.now ?? Date.now();
  const har = input.har;
  const jar = input.jar;

  // ── Request side ─────────────────────────────────────────────────
  const sentHar = har.request?.cookies ?? [];
  const requestRows: CookieRow[] = [];
  const matchedJarIdx = new Set<number>();

  // The Cookie header can carry the same NAME more than once — one entry
  // per jar cookie of that name whose domain/path matched the URL (e.g.
  // a `tz` on `.openheaders.com` and another on `app.openheaders.com`).
  // Match each sent entry to a DISTINCT jar cookie (skip ones already
  // claimed) so the rows show their real, differing scopes — and key each
  // row by its sent-index so duplicate names never collide on the React
  // key (a collision corrupts the whole list's reconciliation).
  sentHar.forEach((sent, sentIdx) => {
    let jarMatchIdx = -1;
    if (jar) {
      for (let i = 0; i < jar.length; i++) {
        if (jar[i].name === sent.name && !matchedJarIdx.has(i)) {
          jarMatchIdx = i;
          break;
        }
      }
    }
    if (jarMatchIdx >= 0 && jar) {
      matchedJarIdx.add(jarMatchIdx);
      const j = jar[jarMatchIdx];
      const row = jarToRow(j, 'request', 'request-jar');
      row.id = `request:request-jar:${sentIdx}:${j.domain}${j.path}:${j.name}`;
      // Keep the live jar entry reachable — the row's value below may be
      // rewound to what the request CARRIED, but Edit targets the jar.
      row.jarCookie = j;
      const wasEdited = input.editedKeys?.has(cookieEditKey(j.name, j.domain, j.path)) ?? false;
      if (wasEdited && j.value !== sent.value) {
        // The user changed this cookie from the panel after the request
        // was made — show the live jar value (their edit), keep the
        // request-carried value for the tooltip.
        row.value = j.value;
        row.edited = true;
        row.sentValue = sent.value;
      } else {
        // Value the request actually carried wins over the jar's current
        // value (jar may have been updated by a Set-Cookie since).
        row.value = sent.value;
        if (wasEdited) row.edited = true;
      }
      row.size = row.name.length + 1 + row.value.length;
      requestRows.push(row);
    } else {
      requestRows.push({
        name: sent.name,
        value: sent.value,
        direction: 'request',
        attribution: 'request-har',
        id: `request:har:${sentIdx}:${sent.name}`,
        size: sent.name.length + 1 + sent.value.length,
      });
    }
  });

  if (input.showFilteredOut && jar) {
    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(input.url);
    } catch {
      parsedUrl = null;
    }
    for (let i = 0; i < jar.length; i++) {
      if (matchedJarIdx.has(i)) continue;
      const j = jar[i];
      const reason = parsedUrl ? explainFilteredOut(j, parsedUrl, now) : 'not sent';
      const row = jarToRow(j, 'request', 'filtered-out');
      row.id = `request:filtered-out:${i}:${j.domain}${j.path}:${j.name}`;
      row.filteredReason = reason;
      if (input.editedKeys?.has(cookieEditKey(j.name, j.domain, j.path))) row.edited = true;
      requestRows.push(row);
    }
  }

  // ── Response side ────────────────────────────────────────────────
  const responseRows: CookieRow[] = [];
  for (const h of har.response?.headers ?? []) {
    if (h.name.toLowerCase() !== 'set-cookie') continue;
    const row = parseSetCookieLine(h.value, now);
    if (!row) continue;
    // Join against the jar so the row's Edit / Delete can target the
    // real entry this Set-Cookie produced (or the pre-existing cookie a
    // rejected line failed to replace). The columns keep the header's
    // own facts; only the affordances read the jar entry.
    const jarMatch = jar ? findResponseJarMatch(jar, row) : undefined;
    if (jarMatch) row.jarCookie = jarMatch;
    responseRows.push(row);
  }

  // ── Sizes ────────────────────────────────────────────────────────
  let requestBytes = 0;
  for (const r of requestRows) {
    if (r.attribution === 'filtered-out') continue;
    requestBytes += r.size;
  }
  let responseBytes = 0;
  for (const r of responseRows) responseBytes += r.size;

  return { request: requestRows, response: responseRows, requestBytes, responseBytes };
}
