/**
 * Admission enforcement at the daemon's HTTP-composition seam (Phase 3).
 * Binds the pure {@link evaluateAdmission} matrix and the per-peer
 * {@link PeerRateLimiter} to real requests:
 *
 *   - `wrapHttpHandler` fronts the composed handler chain
 *     (healthz ‖ pairing ‖ mcp): blocked peers get 429 on rate-limited
 *     routes, matrix rejects get 403, and responses whose status is a
 *     brute-force signal for their route (pairing 404, `/mcp` 401) feed
 *     the limiter on finish. Under `trustedProxy` the pairing route
 *     carries a second, stricter per-peer tier — see
 *     {@link TRUSTED_PROXY_PAIRING_LIMITS}.
 *   - `wsHooks` gives the WS gate the same admission: the upgrade is
 *     refused for blocked peers / forbidden Origins before HELLO runs,
 *     and `auth-required` HELLO rejects count as failures.
 *
 * Peer identity: the socket's remote address — unless the config says a
 * trusted reverse proxy fronts the daemon, in which case the last
 * `X-Forwarded-For` entry (the one the trusted proxy appended) is the
 * client. NEVER trusted by default: an untrusted client could otherwise
 * spoof the header to dodge its own throttle or poison another peer's.
 *
 * Every reject and every throttle transition is one physical log line
 * ending in `(peer=<addr>)` — the S5 auth-log contract fail2ban-style
 * scanners match against.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { WsAdmissionHooks, WsUpgradeVerdict } from '../host-runtime/ws-server';
import {
  type AdmissionRequestFacts,
  type AdmissionRoute,
  evaluateAdmission,
  routePostureFor,
} from './admission-matrix';
import { createPeerRateLimiter, type PeerRateLimiter, type RateLimiterOptions } from './rate-limiter';

const SCOPE = 'Admission';

/**
 * Stricter pairing-route tier active only under `trustedProxy` (S30
 * audit finding d). The pairing service's brute-force guard is one
 * GLOBAL budget — correct on loopback/LAN, but a WAN attacker rotating
 * a handful of addresses could keep it permanently tripped and deny
 * pairing to everyone. This tier caps each WAN peer's contribution to
 * that global budget at 5 unknown-code guesses before a 30-minute
 * block, so holding the global lockout takes a rotating fleet of
 * addresses, not a handful. A legitimate peer (one valid GET + one
 * valid POST) never registers a failure on either tier.
 */
const TRUSTED_PROXY_PAIRING_LIMITS: RateLimiterOptions = {
  maxFailures: 5,
  windowMs: 60_000,
  blockMs: 30 * 60_000,
};

/** Same composition contract as the healthz/pairing/MCP handlers: `true` = response owned. */
export type ComposedHttpHandler = (req: IncomingMessage, res: ServerResponse) => boolean;

export interface AdmissionControlOptions {
  /**
   * A trusted reverse proxy fronts this daemon — peer identity comes
   * from the last `X-Forwarded-For` entry instead of the socket address
   * (which would be the proxy's, throttling every client as one peer).
   */
  trustedProxy?: boolean;
  /** Hostnames (beyond IP literals / localhost / `*.local`) the daemon answers as. */
  allowedHosts?: readonly string[];
  /**
   * The daemon serves the web bundle — unclaimed paths take the `web`
   * posture. A getter is consulted per request so a host whose serving
   * flag is a live setting (desktop `backend.serveWebApp`) flips posture
   * without a re-boot; a plain boolean stays fixed for the process
   * lifetime (the standalone daemon's config).
   */
  webEnabled?: boolean | (() => boolean);
  /** SSO is configured — `/auth/oidc/*` takes the `oidc` posture. Fixed for the process lifetime. */
  oidcEnabled?: boolean;
  /** Limiter tuning override — tests only; production takes the defaults. */
  limiter?: RateLimiterOptions;
  /** Trusted-proxy pairing-tier override — tests only; production takes {@link TRUSTED_PROXY_PAIRING_LIMITS}. */
  pairingLimiter?: RateLimiterOptions;
}

export interface AdmissionControl {
  wrapHttpHandler(next: ComposedHttpHandler): ComposedHttpHandler;
  readonly wsHooks: WsAdmissionHooks;
  resolvePeer(req: IncomingMessage): string;
}

function factsFromRequest(req: IncomingMessage, upgrade: boolean): AdmissionRequestFacts {
  const origin = req.headers.origin;
  return {
    upgrade,
    path: (req.url ?? '').split('?', 1)[0],
    origin: typeof origin === 'string' ? origin : undefined,
    host: req.headers.host,
  };
}

export function createAdmissionControl(options: AdmissionControlOptions = {}): AdmissionControl {
  const trustedProxy = options.trustedProxy ?? false;
  const allowedHosts = options.allowedHosts ?? [];
  const webEnabled = options.webEnabled;
  const oidcEnabled = options.oidcEnabled ?? false;
  const matrixOptions =
    typeof webEnabled === 'function'
      ? () => ({ webEnabled: webEnabled(), oidcEnabled })
      : () => ({ webEnabled: webEnabled ?? false, oidcEnabled });
  const limiter: PeerRateLimiter = createPeerRateLimiter(options.limiter);
  // Second, stricter budget for pairing-code guesses behind a trusted
  // proxy — see TRUSTED_PROXY_PAIRING_LIMITS. Both budgets feed and
  // both block on the pairing route; elsewhere only the shared one.
  const pairingLimiter: PeerRateLimiter | null = trustedProxy
    ? createPeerRateLimiter(options.pairingLimiter ?? TRUSTED_PROXY_PAIRING_LIMITS)
    : null;

  function limitersFor(route: AdmissionRoute): readonly PeerRateLimiter[] {
    return route === 'pairing' && pairingLimiter !== null ? [limiter, pairingLimiter] : [limiter];
  }

  function resolvePeer(req: IncomingMessage): string {
    const direct = req.socket.remoteAddress ?? 'unknown';
    if (!trustedProxy) return direct;
    const header = req.headers['x-forwarded-for'];
    const raw = Array.isArray(header) ? header.join(',') : header;
    const entries = (raw ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    // Last entry = appended by the one proxy we trust; earlier entries
    // are client-supplied and forgeable.
    return entries.length > 0 ? entries[entries.length - 1] : direct;
  }

  function recordFailure(tier: PeerRateLimiter, peer: string, route: string): void {
    if (!tier.recordFailure(peer)) return;
    logger.warn(
      SCOPE,
      `peer throttled: ${tier.maxFailures} failed ${route} attempts in ${Math.round(tier.windowMs / 1000)}s, blocked for ${Math.round(tier.blockMs / 1000)}s (peer=${peer})`,
    );
  }

  function respondTooMany(res: ServerResponse, peer: string, tiers: readonly PeerRateLimiter[]): void {
    const remainingMs = Math.max(...tiers.map((tier) => tier.blockedRemainingMs(peer)));
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.end('{"error":"too many failed attempts"}');
  }

  function respondForbidden(res: ServerResponse): void {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end('{"error":"forbidden"}');
  }

  return {
    resolvePeer,
    wrapHttpHandler(next) {
      return (req, res) => {
        const facts = factsFromRequest(req, false);
        const requestMatrixOptions = matrixOptions();
        const posture = routePostureFor(facts, requestMatrixOptions);
        const peer = resolvePeer(req);
        const tiers = limitersFor(posture.route);
        if (posture.rateLimited && tiers.some((tier) => tier.isBlocked(peer))) {
          respondTooMany(res, peer, tiers);
          return true;
        }
        const verdict = evaluateAdmission(facts, allowedHosts, requestMatrixOptions);
        if (!verdict.ok) {
          logger.info(
            SCOPE,
            `rejected ${verdict.posture.route} request: ${verdict.reason} (origin=${facts.origin ?? 'none'} host=${facts.host ?? 'none'} peer=${peer})`,
          );
          respondForbidden(res);
          return true;
        }
        if (posture.failureStatuses.length > 0) {
          res.on('finish', () => {
            if (!posture.failureStatuses.includes(res.statusCode)) return;
            for (const tier of tiers) recordFailure(tier, peer, posture.route);
          });
        }
        return next(req, res);
      };
    },
    wsHooks: {
      admitUpgrade(request): WsUpgradeVerdict {
        const facts = factsFromRequest(request, true);
        const peer = resolvePeer(request);
        if (limiter.isBlocked(peer)) return { ok: false, reason: 'rate-limited' };
        const verdict = evaluateAdmission(facts, allowedHosts, matrixOptions());
        if (!verdict.ok) return { ok: false, reason: verdict.reason };
        return { ok: true };
      },
      recordAuthFailure(request) {
        recordFailure(limiter, resolvePeer(request), 'ws-auth');
      },
      resolvePeer,
    },
  };
}
