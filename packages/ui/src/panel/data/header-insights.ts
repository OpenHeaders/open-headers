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
 */

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

export function computeHeaderInsights(inputs: HeaderInsightInputs, nowMs = Date.now()): readonly HeaderInsight[] {
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
      title: 'CORS misconfigured',
      detail:
        '`Access-Control-Allow-Origin: *` cannot be combined with credentials — the browser will reject this response.',
      action: origin
        ? {
            kind: 'override-header',
            direction: 'response',
            headerName: 'Access-Control-Allow-Origin',
            value: origin,
            label: `Override with ${origin}`,
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
      title: 'CORS request without Access-Control-Allow-Origin',
      detail: `Request carried \`Origin: ${requestOrigin}\` but the response has no \`Access-Control-Allow-Origin\`. The browser will block the response.`,
      action: {
        kind: 'add-header',
        direction: 'response',
        headerName: 'Access-Control-Allow-Origin',
        value: requestOrigin,
        label: `Add Access-Control-Allow-Origin: ${requestOrigin}`,
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
            ? `Cookie \`${first.name}\` missing \`Secure\``
            : `${missingSecure.length} cookies missing \`Secure\``,
        detail: 'Cookies set over HTTPS should carry `Secure` so they cannot be sent over plain HTTP.',
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
        title: 'No Content-Security-Policy on HTML response',
        action: {
          kind: 'add-header',
          direction: 'response',
          headerName: 'Content-Security-Policy',
          value: "default-src 'self'",
          label: 'Add a baseline CSP',
        },
      });
    }
    // ── Missing HSTS on HTTPS HTML response ───────────────────
    if (isHttpsUrl(url) && !lookup(responseHeaders, 'strict-transport-security')) {
      out.push({
        id: 'missing-hsts',
        severity: 'warn',
        title: 'No Strict-Transport-Security on HTTPS response',
        action: {
          kind: 'add-header',
          direction: 'response',
          headerName: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
          label: 'Add HSTS (1 year, subdomains)',
        },
      });
    }
  }

  // ── HSTS: very short max-age warning ────────────────────────
  const hsts = lookup(responseHeaders, 'strict-transport-security');
  if (hsts) {
    const parsed = parseHsts(hsts);
    if (parsed && parsed.maxAgeSec < 60 * 60 * 24 * 30) {
      out.push({
        id: 'hsts-short',
        severity: 'warn',
        title: `HSTS max-age is very short (${parsed.summary})`,
        detail: 'Most policies recommend at least 6 months; preload requires 1 year.',
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
            title: 'JWT in Authorization header is expired',
            detail: `Expired ${formatRelative(-exp)} ago.`,
          });
        } else if (exp < 300) {
          out.push({
            id: 'jwt-expiring',
            severity: 'warn',
            title: `JWT expires in ${formatRelative(exp)}`,
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
      title: 'Response has no Content-Type',
      action: {
        kind: 'add-header',
        direction: 'response',
        headerName: 'Content-Type',
        value: 'application/octet-stream',
        label: 'Add Content-Type',
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
