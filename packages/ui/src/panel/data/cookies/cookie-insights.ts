/**
 * Derive a small, actionable set of insights from the cookie rows of a
 * single inspector entry. Same shape as `header-insights.ts` — every
 * insight is interpretive and most carry an `action` the view renders
 * as a "Create rule" CTA.
 *
 * Keep the list short. Don't nag.
 */

import type { CookieRow } from './cookie-model';

export type InsightSeverity = 'info' | 'warn' | 'err';

export type CookieInsightAction =
  | {
      kind: 'override-set-cookie';
      cookieName: string;
      label: string;
    }
  | {
      kind: 'remove-cookie';
      cookieName: string;
      label: string;
    }
  | {
      kind: 'override-cookie-header';
      cookieName: string;
      label: string;
    };

export interface CookieInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail?: string;
  /** Cookie names this insight is about — drives per-row "problem" tagging. */
  cookieNames: readonly string[];
  action?: CookieInsightAction;
}

export interface CookieInsightInputs {
  url: string;
  request: readonly CookieRow[];
  response: readonly CookieRow[];
  pageOrigin: string | null;
  now?: number;
}

function isHttps(url: string): boolean {
  return url.toLowerCase().startsWith('https://');
}

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isCrossSite(cookieDomain: string | undefined, pageOrigin: string | null): boolean {
  if (!cookieDomain || !pageOrigin) return false;
  try {
    const top = new URL(pageOrigin).hostname.replace(/^www\./, '');
    const dom = cookieDomain.replace(/^\./, '').replace(/^www\./, '');
    if (!top || !dom) return false;
    return dom !== top && !top.endsWith(`.${dom}`) && !dom.endsWith(`.${top}`);
  } catch {
    return false;
  }
}

const MAX_TOTAL_COOKIE_BYTES = 4 * 1024;

export function computeCookieInsights(input: CookieInsightInputs): readonly CookieInsight[] {
  const now = input.now ?? Date.now();
  const out: CookieInsight[] = [];

  // ── SameSite=None without Secure ────────────────────────────────
  const noneNoSecure = input.response.filter(
    (c) => (c.sameSite === 'no_restriction' || String(c.sameSite).toLowerCase() === 'none') && !c.secure,
  );
  if (noneNoSecure.length > 0) {
    out.push({
      id: 'samesite-none-no-secure',
      severity: 'err',
      title: `${noneNoSecure.length} cookie${noneNoSecure.length > 1 ? 's' : ''} set with SameSite=None but missing Secure`,
      detail: 'Modern browsers reject SameSite=None cookies that are not also Secure — they will not be stored.',
      cookieNames: noneNoSecure.map((c) => c.name),
      action: {
        kind: 'override-set-cookie',
        cookieName: noneNoSecure[0].name,
        label: 'Add Secure attribute',
      },
    });
  }

  // ── __Host- prefix violation ────────────────────────────────────
  const hostBad = input.response.filter(
    (c) =>
      c.name.startsWith('__Host-') &&
      (!c.secure || c.path !== '/' || (c.domain && c.domain.length > 0 && c.hostOnly === false)),
  );
  if (hostBad.length > 0) {
    out.push({
      id: 'host-prefix-violation',
      severity: 'err',
      title: `__Host- prefix violated on ${hostBad.map((c) => c.name).join(', ')}`,
      detail: '__Host- cookies must be Secure, Path=/, and have no Domain attribute. Browsers reject them otherwise.',
      cookieNames: hostBad.map((c) => c.name),
    });
  }

  // ── __Secure- prefix violation ──────────────────────────────────
  const secureBad = input.response.filter((c) => c.name.startsWith('__Secure-') && !c.secure);
  if (secureBad.length > 0) {
    out.push({
      id: 'secure-prefix-violation',
      severity: 'err',
      title: `__Secure- prefix violated on ${secureBad.map((c) => c.name).join(', ')}`,
      detail: '__Secure- cookies must carry the Secure attribute. Browsers reject them otherwise.',
      cookieNames: secureBad.map((c) => c.name),
    });
  }

  // ── Partitioned without Secure ──────────────────────────────────
  const partNoSecure = input.response.filter((c) => c.partitionKey && !c.secure);
  if (partNoSecure.length > 0) {
    out.push({
      id: 'partitioned-no-secure',
      severity: 'err',
      title: `${partNoSecure.length} Partitioned cookie${partNoSecure.length > 1 ? 's' : ''} missing Secure`,
      detail: 'Partitioned cookies must be Secure.',
      cookieNames: partNoSecure.map((c) => c.name),
    });
  }

  // ── Insecure scheme but Set-Cookie ─────────────────────────────
  if (!isHttps(input.url) && input.response.length > 0) {
    const setOnHttp = input.response.filter((c) => !c.secure);
    if (setOnHttp.length > 0) {
      out.push({
        id: 'set-cookie-on-http',
        severity: 'warn',
        title: 'Cookies set over plain HTTP',
        detail: 'These cookies can be observed and replayed by anyone on the path. Use HTTPS + the Secure attribute.',
        cookieNames: setOnHttp.map((c) => c.name),
      });
    }
  }

  // ── Expired-but-sent ────────────────────────────────────────────
  const expiredSent = input.request.filter(
    (c) => c.attribution !== 'filtered-out' && c.expirationDate != null && c.expirationDate * 1000 < now,
  );
  if (expiredSent.length > 0) {
    out.push({
      id: 'expired-but-sent',
      severity: 'warn',
      title: `${expiredSent.length} expired cookie${expiredSent.length > 1 ? 's' : ''} still being sent`,
      detail: 'These cookies have an expiry in the past but the request carried them — the jar will drop them shortly.',
      cookieNames: expiredSent.map((c) => c.name),
    });
  }

  // ── Oversized payload ───────────────────────────────────────────
  let requestPayload = 0;
  for (const c of input.request) if (c.attribution !== 'filtered-out') requestPayload += c.size;
  if (requestPayload > MAX_TOTAL_COOKIE_BYTES) {
    out.push({
      id: 'oversized-cookie-payload',
      severity: 'warn',
      title: `Cookie header is ${requestPayload}B (over the 4KB common limit)`,
      detail:
        'Servers and intermediaries cap header size; oversized Cookie payloads can cause 4xx / 5xx without a clear error.',
      cookieNames: input.request
        .filter((c) => c.attribution !== 'filtered-out')
        .sort((a, b) => b.size - a.size)
        .slice(0, 3)
        .map((c) => c.name),
    });
  }

  // ── Third-party cookies set ────────────────────────────────────
  if (input.pageOrigin && input.response.length > 0) {
    const tp = input.response.filter((c) => isCrossSite(c.domain, input.pageOrigin));
    if (tp.length > 0) {
      const reqOrigin = originOf(input.url);
      out.push({
        id: 'third-party-set',
        severity: 'info',
        title: `${tp.length} third-party cookie${tp.length > 1 ? 's' : ''} set${reqOrigin ? ` by ${reqOrigin}` : ''}`,
        detail:
          'Modern browsers may block these in cross-site contexts unless they opt into CHIPS via the Partitioned attribute.',
        cookieNames: tp.map((c) => c.name),
      });
    }
  }

  return out;
}

/**
 * Lift the cookie names mentioned by insights into a flat set — used
 * by the row meta to set `problem: true` and by `is:problem`.
 */
export function problemCookieNames(insights: readonly CookieInsight[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const ins of insights) for (const n of ins.cookieNames) out.add(n);
  return out;
}

/**
 * Cookie names whose Set-Cookie line will be **rejected by the
 * browser** before it's even stored — `dropped` chip's source of
 * truth. Derived from the insight rules that imply rejection.
 *
 * The chip is meaningful in a way the columns aren't: the columns say
 * "the server sent it"; this says "but the browser refused".
 */
export function droppedCookieNames(insights: readonly CookieInsight[]): ReadonlySet<string> {
  const out = new Set<string>();
  const REJECTING_IDS: ReadonlySet<string> = new Set([
    'samesite-none-no-secure',
    'host-prefix-violation',
    'secure-prefix-violation',
    'partitioned-no-secure',
  ]);
  for (const ins of insights) {
    if (REJECTING_IDS.has(ins.id)) {
      for (const n of ins.cookieNames) out.add(n);
    }
  }
  return out;
}
