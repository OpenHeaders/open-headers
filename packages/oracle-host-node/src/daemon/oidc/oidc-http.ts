/**
 * HTTP surface of the OIDC login flow (Phase 5 slice 3), riding the
 * daemon's composed bind like pairing and `/mcp`:
 *
 *   - `GET  /auth/oidc/meta`     — is SSO configured + provider label;
 *     the served web app's login gate probes this to decide whether to
 *     render the SSO button. JSON, no secrets, no state.
 *   - `GET  /auth/oidc/start`    — top-level navigation entry: mints
 *     state/nonce/PKCE and 302s to the provider's authorization URL.
 *   - `GET  /auth/oidc/callback` — the provider's redirect target:
 *     completes the flow (code exchange + ID-token verify + directory
 *     join + session-token mint) and 302s back into the SPA with a
 *     one-time claim code in the fragment (`/#oidc=<code>`) — never the
 *     token itself. Failures redirect with `/#oidc-error=<reason>` so
 *     the gate renders them in-band.
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
import type { DaemonOidcService } from './oidc-service';

const SCOPE = 'OidcHttp';

export const OIDC_PATH_PREFIX = '/auth/oidc/';
const META_PATH = '/auth/oidc/meta';
const START_PATH = '/auth/oidc/start';
const CALLBACK_PATH = '/auth/oidc/callback';
const CLAIM_PATH = '/auth/oidc/claim';

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

function readRawBody(req: IncomingMessage, maxBytes = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('request body too large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', (err) => reject(err));
  });
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
      void (async () => {
        try {
          const begun = await service.beginLogin(origin);
          if (begun.ok) {
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
      const idpError = query.get('error');
      if (idpError) {
        logger.warn(SCOPE, `provider returned error=${idpError}`);
        redirectResponse(res, '/#oidc-error=idp-error');
        return true;
      }
      const code = query.get('code');
      const state = query.get('state');
      if (!code || !state) {
        redirectResponse(res, '/#oidc-error=state-mismatch');
        return true;
      }
      void (async () => {
        try {
          const completed = await service.completeLogin({ code, state });
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
