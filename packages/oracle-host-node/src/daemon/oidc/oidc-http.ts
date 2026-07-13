/**
 * HTTP surface of the OIDC login flow (Phase 5 slice 3), riding the
 * daemon's composed bind like pairing and `/mcp`:
 *
 *   - `GET  /auth/oidc/meta`     — is SSO configured + provider label;
 *     the served web app's login gate probes this to decide whether to
 *     render the SSO button. JSON, no secrets, no state.
 *   - `GET  /auth/oidc/start`    — top-level navigation entry: mints
 *     state/nonce/PKCE plus a login-binding nonce and 302s to the
 *     provider's authorization URL. The binding nonce rides back to the
 *     browser as an HttpOnly SameSite=Lax cookie (`__Host-`-prefixed
 *     with `Secure` when the effective scheme is https; a host-scoped
 *     fallback name on plain-http binds, where `Secure` cookies would
 *     be silently dropped and brick the login).
 *   - `GET  /auth/oidc/callback` — the provider's redirect target:
 *     requires the binding cookie to match the pending flow (the
 *     login-CSRF gate), then completes the flow (code exchange +
 *     ID-token verify + directory join + session-token mint) and 302s
 *     back into the SPA with a one-time claim code in the fragment
 *     (`/#oidc=<code>`) — never the token itself. Failures redirect
 *     with `/#oidc-error=<reason>` so the gate renders them in-band.
 *     The cookie is cleared on every callback outcome.
 *   - `POST /auth/oidc/claim`    — the SPA swaps the one-shot claim
 *     code for the session token, then validates it with a real
 *     HELLO/WELCOME like any pasted token. 404 on an unknown/expired
 *     code (a brute-force signal for the admission limiter).
 *
 * The whole `/auth/oidc/` prefix is claimed when the handler is
 * composed — unknown subpaths answer 404 rather than falling through
 * to the static SPA handler, which would serve HTML under an auth URL.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import { readRawBody } from '../../host-runtime/http-body';
import { type DaemonOidcService, PENDING_LOGIN_TTL_MS } from './oidc-service';

const SCOPE = 'OidcHttp';

export const OIDC_PATH_PREFIX = '/auth/oidc/';
const META_PATH = '/auth/oidc/meta';
const START_PATH = '/auth/oidc/start';
const CALLBACK_PATH = '/auth/oidc/callback';
const CLAIM_PATH = '/auth/oidc/claim';

/** `__Host-` demands `Secure` + `Path=/` — usable only when the browser sees https (or loopback). */
export const BINDING_COOKIE_SECURE = '__Host-oh-oidc-bind';
/** Plain-http binds (loopback dev, acknowledged insecure LAN) — `Secure` there would drop the cookie. */
export const BINDING_COOKIE_INSECURE = 'oh-oidc-bind';

export interface OidcHttpHandlerOptions {
  readonly service: DaemonOidcService;
  /**
   * Explicit external origin for the provider redirect (config
   * `oidc.redirectOrigin`). Absent = derived per request from the
   * admission-validated `Host` header, `X-Forwarded-Proto`-aware when
   * a trusted proxy fronts the daemon.
   */
  readonly redirectOrigin?: string;
  /** Same trust posture as the admission control's peer resolution. */
  readonly trustedProxy?: boolean;
}

/** Composition contract shared with healthz/pairing/mcp: `true` = response owned. */
export type OidcHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

function jsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(payload));
}

function redirectResponse(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  // The authorization URL carries state/nonce; the claim redirect
  // carries the one-shot code in its fragment. Neither may leak via
  // Referer chains.
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end();
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.statusCode = 405;
  res.setHeader('Allow', allow);
  res.end();
}

function notFound(res: ServerResponse): void {
  jsonResponse(res, 404, { ok: false });
}

function bindingCookieName(secure: boolean): string {
  return secure ? BINDING_COOKIE_SECURE : BINDING_COOKIE_INSECURE;
}

function bindingCookieValue(name: string, value: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [`${name}=${value}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function setBindingCookie(res: ServerResponse, value: string, secure: boolean): void {
  const maxAge = Math.floor(PENDING_LOGIN_TTL_MS / 1000);
  res.setHeader('Set-Cookie', bindingCookieValue(bindingCookieName(secure), value, maxAge, secure));
}

function clearBindingCookie(res: ServerResponse, secure: boolean): void {
  res.setHeader('Set-Cookie', bindingCookieValue(bindingCookieName(secure), '', 0, secure));
}

function readBindingCookie(req: IncomingMessage, secure: boolean): string {
  const header = req.headers.cookie;
  if (typeof header !== 'string') return '';
  const wanted = `${bindingCookieName(secure)}=`;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(wanted)) return trimmed.slice(wanted.length);
  }
  return '';
}

export function createOidcHttpHandler(options: OidcHttpHandlerOptions): OidcHttpHandler {
  const { service } = options;

  function externalOrigin(req: IncomingMessage): string {
    if (options.redirectOrigin) return options.redirectOrigin.replace(/\/$/, '');
    // Host has already passed the admission matrix's `known` posture on
    // this route, so it names an address the daemon legitimately answers
    // as. Scheme: only a trusted proxy can vouch for TLS termination.
    const host = req.headers.host ?? '127.0.0.1';
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto =
      options.trustedProxy && typeof forwardedProto === 'string' && forwardedProto.split(',')[0].trim() === 'https'
        ? 'https'
        : 'http';
    return `${proto}://${host}`;
  }

  return (req, res) => {
    const pathOnly = (req.url ?? '').split('?', 1)[0];
    if (!pathOnly.startsWith(OIDC_PATH_PREFIX)) return false;

    if (pathOnly === META_PATH) {
      if (req.method !== 'GET') {
        methodNotAllowed(res, 'GET');
        return true;
      }
      jsonResponse(res, 200, { enabled: true, provider: service.providerLabel() });
      return true;
    }

    if (pathOnly === START_PATH) {
      if (req.method !== 'GET') {
        methodNotAllowed(res, 'GET');
        return true;
      }
      const origin = externalOrigin(req);
      const secure = origin.startsWith('https:');
      // A personal-seat key pasted at the seat-limit refusal rides the
      // start navigation as a query param. It is not a bearer secret —
      // possession admits nobody without also completing SSO as the
      // licensee — so URL exposure carries no privilege.
      const personalLicense = new URL(req.url ?? '', 'http://placeholder').searchParams.get('personal_license') ?? '';
      void (async () => {
        try {
          const begun = await service.beginLogin(origin, personalLicense ? { personalLicense } : undefined);
          if (begun.ok) {
            setBindingCookie(res, begun.bindingNonce, secure);
            redirectResponse(res, begun.authorizationUrl);
            return;
          }
          redirectResponse(res, `/#oidc-error=${encodeURIComponent(begun.reason)}`);
        } catch (err) {
          logger.warn(SCOPE, 'start failed', err);
          redirectResponse(res, '/#oidc-error=provider-unavailable');
        }
      })();
      return true;
    }

    if (pathOnly === CALLBACK_PATH) {
      if (req.method !== 'GET') {
        methodNotAllowed(res, 'GET');
        return true;
      }
      const query = new URL(req.url ?? '', 'http://placeholder').searchParams;
      // The binding cookie is spent by this callback whatever the
      // outcome — success, refusal, or provider error.
      const secure = externalOrigin(req).startsWith('https:');
      const bindingNonce = readBindingCookie(req, secure);
      clearBindingCookie(res, secure);
      const idpError = query.get('error');
      if (idpError) {
        logger.warn(SCOPE, `provider returned error=${idpError}`);
        redirectResponse(res, '/#oidc-error=idp-error');
        return true;
      }
      const code = query.get('code');
      const state = query.get('state');
      if (!code || !state || !bindingNonce) {
        redirectResponse(res, '/#oidc-error=state-mismatch');
        return true;
      }
      void (async () => {
        try {
          const completed = await service.completeLogin({ code, state, bindingNonce });
          if (completed.ok) {
            redirectResponse(res, `/#oidc=${encodeURIComponent(completed.claimCode)}`);
            return;
          }
          redirectResponse(res, `/#oidc-error=${encodeURIComponent(completed.reason)}`);
        } catch (err) {
          logger.warn(SCOPE, 'callback failed', err);
          redirectResponse(res, '/#oidc-error=exchange-failed');
        }
      })();
      return true;
    }

    if (pathOnly === CLAIM_PATH) {
      if (req.method !== 'POST') {
        methodNotAllowed(res, 'POST');
        return true;
      }
      void (async () => {
        const raw = await readRawBody(req).catch(() => '');
        let claimCode = '';
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : null;
          if (parsed && typeof parsed === 'object' && 'code' in parsed) {
            const value = (parsed as { code?: unknown }).code;
            if (typeof value === 'string') claimCode = value;
          }
        } catch {
          // Malformed body falls through to the empty-code 404 below.
        }
        const claimed = claimCode ? service.claimToken(claimCode) : null;
        if (!claimed) {
          notFound(res);
          return;
        }
        jsonResponse(res, 200, { ok: true, secret: claimed.secret });
      })();
      return true;
    }

    // Claimed prefix, unknown subpath — never let the SPA fallback serve
    // HTML under an auth URL.
    notFound(res);
    return true;
  };
}
