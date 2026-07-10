/**
 * Daemon-wide Host/Origin admission matrix (Phase 3, DAEMON_PLAN.md §3):
 * one table declaring, per route on the composed bind, which Origins
 * and Hosts are accepted. Generalizes the `/mcp` posture (any Origin ⇒
 * 403, verified live in the MCP epic) to every route instead of leaving
 * each handler to invent its own:
 *
 *   - `/healthz`     — open. Liveness probes carry arbitrary headers.
 *   - `/metrics`     — native processes only (the handler adds the
 *                      bearer-token gate); any Origin ⇒ reject, same
 *                      posture as `/mcp`.
 *   - WS upgrade     — non-browser clients (no Origin), browser-extension
 *                      origins (the extension SW dials with its own
 *                      `chrome-extension://` origin), and the daemon's
 *                      own served origin (the Phase 4 web app's tabs).
 *                      Any other browser origin is a drive-by page.
 *   - `/pair/*`      — no Origin (top-level navigations, curl) or the
 *                      own served origin (the confirm form's same-origin
 *                      POST carries one). Cross-origin browser POSTs are
 *                      forged confirms.
 *   - `/mcp`         — native processes only; any Origin ⇒ reject
 *                      (pinned in the MCP epic, don't re-open).
 *   - `/auth/oidc/*` — active only when SSO is configured. Top-level
 *                      navigations (start, the IdP's callback redirect)
 *                      carry no Origin; the SPA's claim POST carries the
 *                      own served origin. Foreign browser origins are
 *                      forged logins. Claim-code guesses (404) feed the
 *                      brute-force limiter.
 *   - web (Phase 4a) — when the daemon serves the web bundle, every
 *                      path not claimed above is the static front door:
 *                      top-level navigations (no Origin) and the own
 *                      served origin's fetches pass; foreign browser
 *                      origins are drive-by pages.
 *   - everything else — with no web bundle configured there is no
 *                      legitimate browser caller; reject browser
 *                      origins, let the 400 fallback answer the rest.
 *
 * The Host side guards the browser-facing routes against DNS rebinding
 * (a hostname an attacker controls resolving to the daemon's address):
 * IP literals, `localhost`, and mDNS `*.local` names are always
 * acceptable — rebinding needs a real DNS name — and anything else
 * (a reverse-proxy domain, an intranet hostname) must be declared in
 * the config's allowed-hosts list.
 *
 * Pure evaluation over {@link AdmissionRequestFacts} — no `node:http`
 * types, so the matrix is unit-testable without sockets. The
 * enforcement seam (peer resolution, 403/429 responses, failure
 * counting) lives in `admission-control.ts`.
 */

import { isIP } from 'node:net';
import { MCP_HTTP_PATH } from '@openheaders/core/protocol';

/** The header facts admission is decided on, extracted from one request. */
export interface AdmissionRequestFacts {
  /** True for a WebSocket upgrade request. */
  readonly upgrade: boolean;
  /** URL path with the query string stripped. */
  readonly path: string;
  /** Raw `Origin` header, if the client sent one. */
  readonly origin: string | undefined;
  /** Raw `Host` header, if the client sent one. */
  readonly host: string | undefined;
}

export type AdmissionRoute = 'healthz' | 'metrics' | 'ws-upgrade' | 'pairing' | 'mcp' | 'oidc' | 'web' | 'default';

/** Matrix-wide switches derived from the daemon's composition, not per-request facts. */
export interface AdmissionMatrixOptions {
  /** The daemon serves the web bundle — unclaimed paths are the browser-facing `web` route. */
  readonly webEnabled?: boolean;
  /** SSO is configured — `/auth/oidc/*` takes the `oidc` posture. */
  readonly oidcEnabled?: boolean;
}

export type OriginPosture =
  /** Any Origin (or none) is acceptable. */
  | 'any'
  /** Any Origin header at all ⇒ reject — native-process clients only. */
  | 'non-browser'
  /** No Origin, a browser-extension origin, or the daemon's own served origin. */
  | 'own-or-extension'
  /** No Origin or the daemon's own served origin. */
  | 'own';

export type HostPosture =
  /** Any Host (or none). */
  | 'any'
  /** IP literal, `localhost`, `*.local`, or a configured allowed host. */
  | 'known';

export interface RoutePosture {
  readonly route: AdmissionRoute;
  readonly origin: OriginPosture;
  readonly host: HostPosture;
  /** Blocked peers get 429 / upgrade-refused on this route. */
  readonly rateLimited: boolean;
  /** Response statuses recorded as brute-force failures on this route. */
  readonly failureStatuses: readonly number[];
}

const PAIRING_PATH_PREFIX = '/pair/';
const OIDC_PATH_PREFIX = '/auth/oidc/';
const HEALTHZ_PATH = '/healthz';
const METRICS_PATH = '/metrics';

const ROUTE_POSTURES: Record<AdmissionRoute, RoutePosture> = {
  healthz: { route: 'healthz', origin: 'any', host: 'any', rateLimited: false, failureStatuses: [] },
  // Token-gated like /mcp: native consumers only (the CLI, a scraper),
  // and a 401 is a token guess.
  metrics: { route: 'metrics', origin: 'non-browser', host: 'any', rateLimited: true, failureStatuses: [401] },
  // HELLO auth failures are counted through the WS gate's own hook, not
  // an HTTP status — the upgrade has already happened by the time the
  // token is evaluated.
  'ws-upgrade': {
    route: 'ws-upgrade',
    origin: 'own-or-extension',
    host: 'known',
    rateLimited: true,
    failureStatuses: [],
  },
  // 404 = a pairing-code guess. 410 (expired/consumed) is a legitimate
  // user racing the 5-minute window, not an attack signal.
  pairing: { route: 'pairing', origin: 'own', host: 'known', rateLimited: true, failureStatuses: [404] },
  mcp: { route: 'mcp', origin: 'non-browser', host: 'any', rateLimited: true, failureStatuses: [401] },
  // 404 = a claim-code guess (the one-shot code the callback redirect
  // hands the SPA). Redirect-shaped failures (bad state, refused login)
  // are 302s into the SPA's error fragment, not attack statuses.
  oidc: { route: 'oidc', origin: 'own', host: 'known', rateLimited: true, failureStatuses: [404] },
  // Static misses are ordinary navigation noise, not auth signals — no
  // failure statuses; the rate limit still holds the front door against
  // peers already blocked for real failures elsewhere.
  web: { route: 'web', origin: 'own', host: 'known', rateLimited: true, failureStatuses: [] },
  default: { route: 'default', origin: 'non-browser', host: 'any', rateLimited: false, failureStatuses: [] },
};

export function routePostureFor(facts: AdmissionRequestFacts, options: AdmissionMatrixOptions = {}): RoutePosture {
  if (facts.upgrade) return ROUTE_POSTURES['ws-upgrade'];
  if (facts.path === HEALTHZ_PATH) return ROUTE_POSTURES.healthz;
  if (facts.path === METRICS_PATH) return ROUTE_POSTURES.metrics;
  if (facts.path.startsWith(PAIRING_PATH_PREFIX)) return ROUTE_POSTURES.pairing;
  if (facts.path === MCP_HTTP_PATH || facts.path === `${MCP_HTTP_PATH}/`) return ROUTE_POSTURES.mcp;
  if (options.oidcEnabled && facts.path.startsWith(OIDC_PATH_PREFIX)) return ROUTE_POSTURES.oidc;
  return options.webEnabled ? ROUTE_POSTURES.web : ROUTE_POSTURES.default;
}

export type AdmissionRejectReason = 'origin-forbidden' | 'host-forbidden';

export type AdmissionVerdict =
  | { readonly ok: true; readonly posture: RoutePosture }
  | { readonly ok: false; readonly posture: RoutePosture; readonly reason: AdmissionRejectReason };

/** Origin schemes browsers mint for extension contexts — legitimate WS dialers. */
const EXTENSION_ORIGIN_SCHEMES: readonly string[] = ['chrome-extension:', 'moz-extension:', 'safari-web-extension:'];

/** Case-fold and elide the schemes' default ports so `https://h` matches `Host: h:443`. */
function normalizeHostPort(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/:(443|80)$/, '');
}

/**
 * Does the Origin name the same host the request was addressed to —
 * i.e. is this the daemon's own served origin? Compared against the
 * `Host` header because the daemon doesn't know its external names
 * (a reverse proxy or LAN IP decides them); a forged Origin that
 * matches Host is same-origin by definition, which is the property
 * being enforced.
 */
function isOwnServedOrigin(origin: string, hostHeader: string | undefined): boolean {
  if (!hostHeader) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  return normalizeHostPort(parsed.host) === normalizeHostPort(hostHeader);
}

function isExtensionOrigin(origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  return EXTENSION_ORIGIN_SCHEMES.includes(parsed.protocol);
}

function originAccepted(posture: OriginPosture, facts: AdmissionRequestFacts): boolean {
  if (posture === 'any') return true;
  if (facts.origin === undefined) return true;
  if (posture === 'non-browser') return false;
  if (posture === 'own-or-extension' && isExtensionOrigin(facts.origin)) return true;
  return isOwnServedOrigin(facts.origin, facts.host);
}

/**
 * Is this Host one the daemon can be legitimately addressed as? IP
 * literals and `localhost` can't be rebound; `*.local` is mDNS (LAN
 * discovery, same property); anything else must be declared.
 */
export function isKnownHost(hostHeader: string | undefined, allowedHosts: readonly string[]): boolean {
  if (!hostHeader) return false;
  let hostname: string;
  try {
    // Parse via URL so `host:port` and bracketed IPv6 split correctly.
    hostname = new URL(`http://${hostHeader}`).hostname;
  } catch {
    return false;
  }
  if (isIP(hostname.replace(/^\[|\]$/g, '')) !== 0) return true;
  if (hostname === 'localhost' || hostname.endsWith('.local')) return true;
  return allowedHosts.some((allowed) => allowed.toLowerCase() === hostname);
}

function hostAccepted(posture: HostPosture, facts: AdmissionRequestFacts, allowedHosts: readonly string[]): boolean {
  if (posture === 'any') return true;
  return isKnownHost(facts.host, allowedHosts);
}

export function evaluateAdmission(
  facts: AdmissionRequestFacts,
  allowedHosts: readonly string[],
  options: AdmissionMatrixOptions = {},
): AdmissionVerdict {
  const posture = routePostureFor(facts, options);
  if (!originAccepted(posture.origin, facts)) return { ok: false, posture, reason: 'origin-forbidden' };
  if (!hostAccepted(posture.host, facts, allowedHosts)) return { ok: false, posture, reason: 'host-forbidden' };
  return { ok: true, posture };
}
