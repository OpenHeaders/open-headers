/**
 * Derive a small, actionable set of insights from the request +
 * response headers of a single inspector entry. Every insight is
 * interpretive (turns numbers/states into an answer); most carry an
 * `action` the view renders as a "Create rule" CTA so the user can
 * fix what they're being told about in one click.
 *
 * Keep the list short. The Headers tab is information-dense already —
 * never emit more than ~5 insights, and only when the condition is
 * unambiguous. Don't nag.
 *
 * Copy is t-first (`panel.inspector.headers.insights.*`); origins,
 * cookie names, HSTS summaries, and durations ride as raw holes.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { parseAuthorization, parseHsts, parseSetCookie } from './header-value-introspection';

export type InsightSeverity = 'info' | 'warn' | 'err';

export type HeaderInsightAction =
  | {
      kind: 'add-header';
      direction: 'request' | 'response';
      headerName: string;
      value?: string;
      label: string;
    }
  | {
      kind: 'override-header';
      direction: 'request' | 'response';
      headerName: string;
      value: string;
      label: string;
    };

export interface HeaderInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail?: string;
  action?: HeaderInsightAction;
}

interface Header {
  name: string;
  value: string;
}

export interface HeaderInsightInputs {
  url: string;
  mimeType: string | null;
  statusCode: number | null;
  requestHeaders: readonly Header[];
  responseHeaders: readonly Header[];
}

function lookup(headers: readonly Header[], name: string): string | null {
  const lower = name.toLowerCase();
  for (const h of headers) if (h.name.toLowerCase() === lower) return h.value;
  return null;
}

function lookupAll(headers: readonly Header[], name: string): readonly string[] {
  const lower = name.toLowerCase();
  const out: string[] = [];
  for (const h of headers) if (h.name.toLowerCase() === lower) out.push(h.value);
  return out;
}

function isHtmlResponse(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return mimeType.toLowerCase().startsWith('text/html');
}

function isHttpsUrl(url: string): boolean {
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

export function computeHeaderInsights(
  t: Translate,
  inputs: HeaderInsightInputs,
  nowMs = Date.now(),
): readonly HeaderInsight[] {
  const out: HeaderInsight[] = [];
  const { requestHeaders, responseHeaders, mimeType, url, statusCode } = inputs;

  // ── CORS: `*` + credentials is a hard browser-side block ────
  const allowOrigin = lookup(responseHeaders, 'access-control-allow-origin');
  const allowCreds = lookup(responseHeaders, 'access-control-allow-credentials');
  if (allowOrigin === '*' && allowCreds && allowCreds.toLowerCase() === 'true') {
    const origin = lookup(requestHeaders, 'origin') ?? originOf(url) ?? '';
    out.push({
      id: 'cors-wildcard-with-creds',
      severity: 'err',
      title: t('panel.inspector.headers.insights.corsWildcard.title'),
      detail: t('panel.inspector.headers.insights.corsWildcard.detail'),
      action: origin
        ? {
            kind: 'override-header',
            direction: 'response',
            headerName: 'Access-Control-Allow-Origin',
            value: origin,
            label: t('panel.inspector.headers.insights.corsWildcard.action', { origin }),
          }
        : undefined,
    });
  }

  // ── CORS: request had Origin but no ACAO came back ───────────
  const requestOrigin = lookup(requestHeaders, 'origin');
  if (requestOrigin && !allowOrigin && statusCode != null && statusCode >= 200 && statusCode < 400) {
    out.push({
      id: 'cors-missing-acao',
      severity: 'warn',
      title: t('panel.inspector.headers.insights.corsMissingAcao.title'),
      detail: t('panel.inspector.headers.insights.corsMissingAcao.detail', { origin: requestOrigin }),
      action: {
        kind: 'add-header',
        direction: 'response',
        headerName: 'Access-Control-Allow-Origin',
        value: requestOrigin,
        label: t('panel.inspector.headers.insights.corsMissingAcao.action', { origin: requestOrigin }),
      },
    });
  }

  // ── Set-Cookie: surface insecure cookies on the response ────
  const setCookies = lookupAll(responseHeaders, 'set-cookie');
  if (setCookies.length > 0) {
    const parsed = setCookies.map((v) => parseSetCookie(v, nowMs)).filter((p): p is NonNullable<typeof p> => p != null);
    const missingSecure = parsed.filter((c) => !c.secure);
    if (missingSecure.length > 0 && isHttpsUrl(url)) {
      const first = missingSecure[0];
      out.push({
        id: 'cookie-missing-secure',
        severity: 'warn',
        title:
          missingSecure.length === 1
            ? t('panel.inspector.headers.insights.cookieMissingSecure.titleOne', { name: first.name })
            : t('panel.inspector.headers.insights.cookieMissingSecure.titleMany', { count: missingSecure.length }),
        detail: t('panel.inspector.headers.insights.cookieMissingSecure.detail'),
      });
    }
  }

  // ── Missing CSP on HTML response ────────────────────────────
  if (isHtmlResponse(mimeType)) {
    const hasCsp = !!lookup(responseHeaders, 'content-security-policy');
    if (!hasCsp) {
      out.push({
        id: 'missing-csp',
        severity: 'warn',
        title: t('panel.inspector.headers.insights.missingCsp.title'),
        action: {
          kind: 'add-header',
          direction: 'response',
          headerName: 'Content-Security-Policy',
          value: "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
          label: t('panel.inspector.headers.insights.missingCsp.action'),
        },
      });
    }
    // No missing-HSTS insight: `Strict-Transport-Security` is a
    // browser-protected response header that extensions can't add or
    // modify, so there's nothing actionable to surface from here.
  }

  // ── HSTS: very short max-age warning ────────────────────────
  const hsts = lookup(responseHeaders, 'strict-transport-security');
  if (hsts) {
    const parsed = parseHsts(hsts);
    if (parsed && parsed.maxAgeSec < 60 * 60 * 24 * 30) {
      out.push({
        id: 'hsts-short',
        severity: 'warn',
        title: t('panel.inspector.headers.insights.hstsShort.title', { summary: parsed.summary }),
        detail: t('panel.inspector.headers.insights.hstsShort.detail'),
      });
    }
  }

  // ── Authorization: JWT decode + expiry ──────────────────────
  const auth = lookup(requestHeaders, 'authorization');
  if (auth) {
    const parsed = parseAuthorization(auth, nowMs);
    if (parsed?.isJwt) {
      const exp = parsed.jwtExpSecondsRemaining;
      if (exp != null) {
        if (exp < 0) {
          out.push({
            id: 'jwt-expired',
            severity: 'err',
            title: t('panel.inspector.headers.insights.jwtExpired.title'),
            detail: t('panel.inspector.headers.insights.jwtExpired.detail', { duration: formatRelative(-exp) }),
          });
        } else if (exp < 300) {
          out.push({
            id: 'jwt-expiring',
            severity: 'warn',
            title: t('panel.inspector.headers.insights.jwtExpiring.title', { duration: formatRelative(exp) }),
          });
        }
        // Non-expired JWT: row chips already show alg + exp; no insight.
      }
      // Non-JWT / no-exp JWT details live on the row chip; no insight.
    }
  }

  // ── Content-Type missing on response body ──────────────────
  const ct = lookup(responseHeaders, 'content-type');
  if (!ct && statusCode != null && statusCode >= 200 && statusCode < 300) {
    out.push({
      id: 'missing-content-type',
      severity: 'warn',
      title: t('panel.inspector.headers.insights.missingContentType.title'),
      action: {
        kind: 'add-header',
        direction: 'response',
        headerName: 'Content-Type',
        value: 'application/octet-stream',
        label: t('panel.inspector.headers.insights.missingContentType.action'),
      },
    });
  }

  return out;
}

function formatRelative(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h`;
  return `${Math.round(secs / 86400)}d`;
}
