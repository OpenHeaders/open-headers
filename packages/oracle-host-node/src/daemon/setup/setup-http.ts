/**
 * HTTP surface of the server claim (the front-door plan §4.2), riding
 * the daemon's composed bind beside `/auth/password/*` and
 * `/auth/oidc/*`:
 *
 *   - `GET  /auth/setup/meta`  — `{unclaimed, requiresCode}`, so the
 *     gate knows which screen to draw. Answers everyone (O1): the
 *     state is transient, the claim behind it is still gated by
 *     loopback-or-code, and a loopback-only answer would leave the
 *     coded remote path — which exists precisely because there is no
 *     browser on the box — unable to tell which screen it is on.
 *   - `POST /auth/setup/claim` — `{displayName, email, password, code?}`
 *     in, `{ok: true, secret, revokedTokens}` out. The two fields the
 *     SPA consumes are the same two `/auth/password/login` answers
 *     with, so the candidate → HELLO → persist path is reused verbatim;
 *     `revokedTokens` is O3's disclosure, telling the new admin how
 *     many devices the claim just unpaired.
 *
 * Unlike the password prefix this one is composed on EVERY deployment,
 * SSO included (O8). An uncomposed prefix would fall through to the
 * static SPA handler and answer the meta probe with `index.html`, so
 * an OIDC daemon would leave the gate inferring "claimed" from a parse
 * failure; composed always, it answers `unclaimed: false` and means it.
 *
 * Refusals split by what they reveal (O9). Input the caller can see is
 * wrong answers 400 with a typed reason and is NOT a limiter failure —
 * it discloses nothing, and a typo must not lock out the person
 * claiming their own box. Anything turning on server state answers ONE
 * byte-identical 403, which the admission matrix counts.
 *
 * Loopback is decided from the ADMISSION-resolved peer, not the raw
 * socket: behind a trusted reverse proxy on the same machine every
 * remote client would otherwise present as loopback and the setup code
 * would gate nothing.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import { readRawBody } from '../../host-runtime/http-body';
import { isLoopbackRemote } from '../../host-runtime/ws-server/classify';
import type { DaemonSetupClaimInput, DaemonSetupClaimService } from './setup-claim-service';

const SCOPE = 'SetupHttp';

export const SETUP_PATH_PREFIX = '/auth/setup/';
const META_PATH = '/auth/setup/meta';
const CLAIM_PATH = '/auth/setup/claim';

export interface SetupHttpHandlerOptions {
  readonly service: DaemonSetupClaimService;
  /** Admission's peer resolution — the socket address, or the trusted proxy's `X-Forwarded-For` entry. */
  readonly resolvePeer: (req: IncomingMessage) => string;
}

/** Composition contract shared with healthz/pairing/mcp/oidc/password: `true` = response owned. */
export type SetupHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

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

/** The uniform state refusal — byte-identical whatever the cause (O9). */
function refused(res: ServerResponse): void {
  jsonResponse(res, 403, { ok: false });
}

function parseClaim(raw: string): DaemonSetupClaimInput | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed === null || typeof parsed !== 'object') return null;
    const { displayName, email, password, code } = parsed as {
      displayName?: unknown;
      email?: unknown;
      password?: unknown;
      code?: unknown;
    };
    if (typeof displayName !== 'string' || typeof email !== 'string' || typeof password !== 'string') return null;
    return { displayName, email, password, ...(typeof code === 'string' ? { code } : {}) };
  } catch {
    return null;
  }
}

export function createSetupHttpHandler(options: SetupHttpHandlerOptions): SetupHttpHandler {
  const { service, resolvePeer } = options;

  return (req, res) => {
    const pathOnly = (req.url ?? '').split('?', 1)[0];
    if (!pathOnly.startsWith(SETUP_PATH_PREFIX)) return false;

    if (pathOnly === META_PATH) {
      if (req.method !== 'GET') {
        methodNotAllowed(res, 'GET');
        return true;
      }
      void (async () => {
        try {
          jsonResponse(res, 200, await service.meta());
        } catch (err) {
          // A server whose directory cannot be read is not one to
          // offer a claim on — fail towards "claimed".
          logger.warn(SCOPE, 'meta probe failed', err);
          jsonResponse(res, 200, { unclaimed: false, requiresCode: false });
        }
      })();
      return true;
    }

    if (pathOnly === CLAIM_PATH) {
      if (req.method !== 'POST') {
        methodNotAllowed(res, 'POST');
        return true;
      }
      const peerIsLoopback = isLoopbackRemote(resolvePeer(req));
      void (async () => {
        const raw = await readRawBody(req).catch(() => '');
        const input = parseClaim(raw);
        if (input === null) {
          // A body this handler cannot read never reached the service,
          // so it says nothing about server state either.
          jsonResponse(res, 400, { ok: false, reason: 'malformed-request' });
          return;
        }
        try {
          const result = await service.claim(input, peerIsLoopback);
          if (result.ok) {
            jsonResponse(res, 200, { ok: true, secret: result.secret, revokedTokens: result.revokedTokens });
            return;
          }
          if (result.kind === 'invalid') {
            jsonResponse(res, 400, { ok: false, reason: result.reason });
            return;
          }
          refused(res);
        } catch (err) {
          logger.warn(SCOPE, 'claim failed', err);
          refused(res);
        }
      })();
      return true;
    }

    // Claimed prefix, unknown subpath — never let the SPA fallback
    // serve HTML under an auth URL.
    jsonResponse(res, 404, { ok: false });
    return true;
  };
}
