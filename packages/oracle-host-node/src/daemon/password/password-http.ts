/**
 * HTTP surface of the local password login (enterprise Phase 3),
 * riding the daemon's composed bind like pairing and `/auth/oidc/*` —
 * and composed ONLY when no OIDC provider is configured: an
 * IdP-fronted daemon has exactly one interactive login story, with no
 * password bypass to reason about.
 *
 *   - `GET  /auth/password/meta`  — is password login usable (any
 *     active directory user holds a password)? The served gate probes
 *     this to decide whether to render the form. JSON, no secrets.
 *   - `POST /auth/password/login` — `{email, password}` in, and on a
 *     verified credential `{ok: true, secret}` out: the session token
 *     rides the response body of the SPA's own POST (no navigation, so
 *     no claim-code indirection is needed — nothing lands in history
 *     or proxy logs). Every refusal answers a byte-identical 401 — the
 *     admission limiter's counted failure on this route — so the
 *     endpoint enumerates neither emails nor password state.
 *
 * The whole `/auth/password/` prefix is claimed when the handler is
 * composed — unknown subpaths answer 404 rather than falling through
 * to the static SPA handler.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import { readRawBody } from '../../host-runtime/http-body';
import type { DaemonPasswordLoginService } from './password-login-service';

const SCOPE = 'PasswordHttp';

export const PASSWORD_PATH_PREFIX = '/auth/password/';
const META_PATH = '/auth/password/meta';
const LOGIN_PATH = '/auth/password/login';

export interface PasswordHttpHandlerOptions {
  readonly service: DaemonPasswordLoginService;
}

/** Composition contract shared with healthz/pairing/mcp/oidc: `true` = response owned. */
export type PasswordHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

function jsonResponse(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.end(JSON.stringify(payload));
}

function methodNotAllowed(res: ServerResponse, allow: string): void {
  res.statusCode = 405;
  res.setHeader('Allow', allow);
  res.end();
}

function parseCredentials(raw: string): { email: string; password: string } | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed === null || typeof parsed !== 'object') return null;
    const { email, password } = parsed as { email?: unknown; password?: unknown };
    if (typeof email !== 'string' || typeof password !== 'string') return null;
    return { email, password };
  } catch {
    return null;
  }
}

export function createPasswordHttpHandler(options: PasswordHttpHandlerOptions): PasswordHttpHandler {
  const { service } = options;

  return (req, res) => {
    const pathOnly = (req.url ?? '').split('?', 1)[0];
    if (!pathOnly.startsWith(PASSWORD_PATH_PREFIX)) return false;

    if (pathOnly === META_PATH) {
      if (req.method !== 'GET') {
        methodNotAllowed(res, 'GET');
        return true;
      }
      void (async () => {
        try {
          jsonResponse(res, 200, { enabled: await service.enabled() });
        } catch (err) {
          logger.warn(SCOPE, 'meta probe failed', err);
          jsonResponse(res, 200, { enabled: false });
        }
      })();
      return true;
    }

    if (pathOnly === LOGIN_PATH) {
      if (req.method !== 'POST') {
        methodNotAllowed(res, 'POST');
        return true;
      }
      void (async () => {
        const raw = await readRawBody(req).catch(() => '');
        const credentials = parseCredentials(raw);
        if (!credentials) {
          jsonResponse(res, 401, { ok: false });
          return;
        }
        try {
          const result = await service.login(credentials.email, credentials.password);
          if (result.ok) {
            jsonResponse(res, 200, { ok: true, secret: result.secret });
            return;
          }
          jsonResponse(res, 401, { ok: false });
        } catch (err) {
          logger.warn(SCOPE, 'login failed', err);
          jsonResponse(res, 401, { ok: false });
        }
      })();
      return true;
    }

    // Claimed prefix, unknown subpath — never let the SPA fallback serve
    // HTML under an auth URL.
    jsonResponse(res, 404, { ok: false });
    return true;
  };
}
