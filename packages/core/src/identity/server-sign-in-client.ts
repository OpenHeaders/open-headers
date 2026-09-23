/**
 * The client side of a person's sign-in from a native client (the
 * client sign-in plan §14.9) — ONE host-neutral OAuth 2.0 public client
 * over an injected `fetch`, so the extension's service worker, the
 * desktop's MAIN process and the CLI never each keep a copy of the
 * wire. The server is its own authorization server (§14.2); this
 * client is one of its three registered public clients (§14.6) and
 * runs the grant its registration and its host allow:
 *
 *   - the **authorization code grant with PKCE** (RFC 7636, RFC 8252)
 *     when the host injects a user agent — the desktop's system
 *     browser + loopback callback, the extension's identity API. The
 *     verifier never leaves this process; the redirect's `state` and
 *     RFC 9207 `iss` are checked; the code is redeemed at the token
 *     endpoint ONCE.
 *   - the **device authorization grant** (RFC 8628) otherwise — the CLI,
 *     the extension without an identity API. The device code never
 *     crosses to a surface; the poll honours `interval` and `slow_down`
 *     (a poll made early answers without a dial).
 *
 * Discovery comes first: the RFC 8414 metadata document names every
 * endpoint and the issuer — no path is hardcoded here. The token the
 * server answers IS the `session`-kind credential the HELLO carries;
 * `signOut` is RFC 7009 revocation of it.
 *
 * The in-flight flows live in this process under opaque handles; a
 * surface starts, polls, cancels. A host restart forgets them — the
 * poll answers `unknown` and the step offers Try again, which is the
 * honest reading. The back-end is addressed by its configured
 * WebSocket URL; the HTTP origin rides the same bound socket with
 * `ws→http` / `wss→https`.
 */

import type {
  ServerSignInApi,
  ServerSignInPollResult,
  ServerSignInSignOutInput,
  ServerSignInStartInput,
  ServerSignInStartResult,
} from '../capabilities/registry';
import {
  DEVICE_CODE_GRANT_TYPE,
  type OAuth2DeviceAuthorization,
  parseDeviceAuthorizationResponse,
  stepDevicePoll,
} from '../oauth/device';
import { OAUTH_AUTHORIZATION_SERVER_PATH, parseAuthorizationServerMetadata } from '../oauth/discovery';
import {
  base64UrlEncode,
  computeCodeChallenge,
  generateCodeVerifier,
  parseAuthorizationRedirect,
} from '../oauth/index';
import {
  DAEMON_DEVICE_LABEL_MAX_LENGTH,
  type DaemonAuthorizationClientKind,
  daemonAuthorizationClientByKind,
} from './daemon-authorization-clients';

const REQUEST_TIMEOUT_MS = 10_000;
const META_TIMEOUT_MS = 1_500;
/** The server parks a code-grant request for ten minutes (§14.3); the browser leg is given the same. */
const CODE_GRANT_TTL_MS = 10 * 60 * 1000;
/** How long a surface waits between polls while the browser leg is still open. */
const REDIRECT_POLL_MS = 1_000;
const AUTHORIZATION_CODE_GRANT_TYPE = 'authorization_code';

/**
 * Derive the back-end's HTTP origin from its WebSocket URL. Null for a
 * non-`ws(s)` or unparseable URL so a caller fails with a clear reason
 * rather than dialing garbage.
 */
export function wsUrlToHttpOrigin(wsUrl: string): string | null {
  try {
    const u = new URL(wsUrl);
    const protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : null;
    if (!protocol) return null;
    return `${protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isJson(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').includes('application/json');
}

/**
 * GET a JSON document with a short abort. Null when the socket is dead,
 * the answer is not a 2xx, or the body is not JSON — the meta routes'
 * "fail towards claimed / disabled" guard, shared by every caller.
 */
export async function fetchJsonDocument(
  url: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs: number = META_TIMEOUT_MS,
): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok || !isJson(response)) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * The code grant's user-agent hop, as the host provides it: where the
 * server may send the browser back (the registered redirect — read per
 * call so a rebound loopback port is reflected), and the act of opening
 * the authorize URL for the person and resolving with the full redirect
 * URL the browser landed on. Rejects when the leg ends without a
 * redirect (the window closed, the waiter timed out).
 */
export interface AuthorizationUserAgent {
  redirectUri(): string;
  launch(authorizeUrl: string, state: string): Promise<string>;
}

export interface ServerSignInClientOptions {
  /** Which registered client this host IS — its `client_id` and grants come from the clients module. */
  readonly client: DaemonAuthorizationClientKind;
  /** The code grant's browser hop; absent (or null) = the device grant. */
  readonly userAgent?: AuthorizationUserAgent | null;
  /** The label a start without one names this device by — trimmed and bounded here. */
  readonly deviceLabel?: () => string;
  /** Test seam; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Test seams; default to the platform's WebCrypto and clock. */
  readonly randomBytes?: (n: number) => Uint8Array;
  readonly now?: () => number;
}

interface Endpoints {
  readonly issuer: string;
  readonly authorizationEndpoint?: string;
  readonly tokenEndpoint: string;
  readonly deviceAuthorizationEndpoint?: string;
  readonly revocationEndpoint?: string;
}

type StartRefusal = Extract<ServerSignInStartResult, { ok: false }>['reason'];

/** The browser leg's verdict once the launcher settled. */
type CodeOutcome = { readonly kind: 'redirect'; readonly code: string } | { readonly kind: 'denied' | 'abandoned' };

interface CodeFlight {
  readonly grant: 'code';
  readonly expiresAt: number;
  readonly issuer: string;
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeVerifier: string;
  outcome: CodeOutcome | null;
  /** The redemption in flight — a second poll during it joins rather than redeems twice. */
  redeeming: Promise<ServerSignInPollResult> | null;
}

interface DeviceFlight {
  readonly grant: 'device';
  readonly tokenEndpoint: string;
  readonly clientId: string;
  readonly pending: OAuth2DeviceAuthorization;
  /** The earliest wall-clock ms the next dial is allowed — the interval, grown by every slow_down. */
  nextPollAt: number;
  dialing: Promise<ServerSignInPollResult> | null;
}

type Flight = CodeFlight | DeviceFlight;

function defaultRandomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedLabel(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim().slice(0, DAEMON_DEVICE_LABEL_MAX_LENGTH);
  return trimmed ? trimmed : undefined;
}

export function createServerSignInClient(options: ServerSignInClientOptions): ServerSignInApi {
  const fetchFn = options.fetch ?? fetch;
  const randomBytes = options.randomBytes ?? defaultRandomBytes;
  const now = options.now ?? Date.now;
  const registered = daemonAuthorizationClientByKind(options.client);
  const userAgent = options.userAgent ?? null;
  const flights = new Map<string, Flight>();

  async function request(url: string, init: RequestInit): Promise<Response | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetchFn(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch {
      return null;
    }
  }

  function postForm(url: string, params: Record<string, string>): Promise<Response | null> {
    return request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
    });
  }

  async function readJson(response: Response): Promise<Record<string, unknown> | null> {
    if (!isJson(response)) return null;
    try {
      return asRecord(await response.json());
    } catch {
      return null;
    }
  }

  /** The admission matrix's and the limiter's refusals, typed once for every dial that can meet them. */
  function refusalOf(response: Response | null): StartRefusal | null {
    if (response === null) return 'offline';
    if (response.status === 403) return 'forbidden';
    if (response.status === 429) return 'throttled';
    if (response.status === 503) return 'too-many-pending';
    return null;
  }

  /** RFC 8414: the metadata document at the well-known path, its issuer checked against the origin it was read from. */
  async function discover(
    origin: string,
  ): Promise<{ ok: true; endpoints: Endpoints } | { ok: false; reason: StartRefusal }> {
    const response = await request(`${origin}${OAUTH_AUTHORIZATION_SERVER_PATH}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const refused = refusalOf(response);
    if (refused !== null && refused !== 'too-many-pending') return { ok: false, reason: refused };
    if (response === null || !response.ok) return { ok: false, reason: 'error' };
    const json = await readJson(response);
    if (json === null) return { ok: false, reason: 'error' };
    try {
      const metadata = parseAuthorizationServerMetadata(json, origin);
      if (metadata.tokenEndpoint === undefined) return { ok: false, reason: 'error' };
      return {
        ok: true,
        endpoints: {
          issuer: metadata.issuer,
          tokenEndpoint: metadata.tokenEndpoint,
          authorizationEndpoint: metadata.authorizationEndpoint,
          deviceAuthorizationEndpoint: metadata.deviceAuthorizationEndpoint,
          revocationEndpoint: metadata.revocationEndpoint,
        },
      };
    } catch {
      return { ok: false, reason: 'error' };
    }
  }

  function mintHandle(): string {
    return base64UrlEncode(randomBytes(16));
  }

  /** RFC 6749 §4.1.1 + RFC 7636 §4.3: the six standard parameters and the display hint, on the metadata's endpoint. */
  function authorizeUrl(
    endpoint: string,
    flight: CodeFlight,
    codeChallenge: string,
    label: string | undefined,
  ): string {
    const url = new URL(endpoint);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', flight.clientId);
    url.searchParams.set('redirect_uri', flight.redirectUri);
    url.searchParams.set('state', flight.state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    if (label !== undefined) url.searchParams.set('device_label', label);
    return url.toString();
  }

  /** The browser leg's verdict: a code bound to our state and issuer, the person's refusal, or nothing usable. */
  function outcomeOf(flight: CodeFlight, redirectUrl: string): CodeOutcome {
    const parsed = parseAuthorizationRedirect(redirectUrl);
    if (parsed.state !== flight.state) return { kind: 'abandoned' };
    if (parsed.error === 'access_denied') return { kind: 'denied' };
    if (parsed.error !== null || parsed.code === null) return { kind: 'abandoned' };
    // RFC 9207 §2.4: the response must name the issuer we discovered.
    if (parsed.iss !== flight.issuer) return { kind: 'abandoned' };
    return { kind: 'redirect', code: parsed.code };
  }

  async function startCode(
    agent: AuthorizationUserAgent,
    endpoints: Endpoints,
    label: string | undefined,
  ): Promise<ServerSignInStartResult> {
    if (endpoints.authorizationEndpoint === undefined) return { ok: false, reason: 'error' };
    const codeVerifier = generateCodeVerifier(randomBytes);
    const codeChallenge = await computeCodeChallenge(codeVerifier, sha256);
    const handle = mintHandle();
    const flight: CodeFlight = {
      grant: 'code',
      expiresAt: now() + CODE_GRANT_TTL_MS,
      issuer: endpoints.issuer,
      tokenEndpoint: endpoints.tokenEndpoint,
      clientId: registered.id,
      redirectUri: agent.redirectUri(),
      state: base64UrlEncode(randomBytes(16)),
      codeVerifier,
      outcome: null,
      redeeming: null,
    };
    flights.set(handle, flight);
    // The leg runs on its own — the surface polls the handle; a late
    // settlement after a cancel lands on a record nobody holds.
    void agent.launch(authorizeUrl(endpoints.authorizationEndpoint, flight, codeChallenge, label), flight.state).then(
      (redirectUrl) => {
        flight.outcome = outcomeOf(flight, redirectUrl);
      },
      () => {
        flight.outcome = { kind: 'abandoned' };
      },
    );
    return { ok: true, kind: 'redirect', handle, expiresAt: flight.expiresAt };
  }

  async function startDevice(endpoints: Endpoints, label: string | undefined): Promise<ServerSignInStartResult> {
    if (endpoints.deviceAuthorizationEndpoint === undefined) return { ok: false, reason: 'error' };
    const response = await postForm(endpoints.deviceAuthorizationEndpoint, {
      client_id: registered.id,
      ...(label !== undefined ? { device_label: label } : {}),
    });
    const refused = refusalOf(response);
    if (refused !== null) return { ok: false, reason: refused };
    if (response === null || !response.ok) return { ok: false, reason: 'error' };
    const json = await readJson(response);
    if (json === null) return { ok: false, reason: 'error' };
    let pending: OAuth2DeviceAuthorization;
    try {
      pending = parseDeviceAuthorizationResponse(json, now());
    } catch {
      return { ok: false, reason: 'error' };
    }
    if (pending.verificationUriComplete === undefined) return { ok: false, reason: 'error' };
    const handle = mintHandle();
    flights.set(handle, {
      grant: 'device',
      tokenEndpoint: endpoints.tokenEndpoint,
      clientId: registered.id,
      pending,
      nextPollAt: now() + pending.intervalSeconds * 1000,
      dialing: null,
    });
    return {
      ok: true,
      kind: 'device',
      handle,
      userCode: pending.userCode,
      verificationUri: pending.verificationUri,
      verificationUriComplete: pending.verificationUriComplete,
      expiresAt: pending.expiresAt,
      intervalSeconds: pending.intervalSeconds,
    };
  }

  /** RFC 6749 §4.1.3 + RFC 7636 §4.5: the code and the verifier for the token, exactly once. */
  async function redeem(handle: string, flight: CodeFlight, code: string): Promise<ServerSignInPollResult> {
    const response = await postForm(flight.tokenEndpoint, {
      grant_type: AUTHORIZATION_CODE_GRANT_TYPE,
      code,
      code_verifier: flight.codeVerifier,
      redirect_uri: flight.redirectUri,
      client_id: flight.clientId,
    });
    // A dead socket or a server fault keeps the code — the next poll retries within its 60 s.
    if (response === null || response.status >= 500) return { status: 'offline' };
    const json = await readJson(response);
    flights.delete(handle);
    if (response.ok && typeof json?.access_token === 'string') return { status: 'approved', secret: json.access_token };
    // A one-shot code refused is a code that ran out (or was replayed) — the person starts again.
    return json?.error === 'invalid_grant' ? { status: 'expired' } : { status: 'abandoned' };
  }

  function pollCode(handle: string, flight: CodeFlight): Promise<ServerSignInPollResult> {
    if (flight.redeeming !== null) return flight.redeeming;
    const outcome = flight.outcome;
    if (outcome === null) {
      if (now() >= flight.expiresAt) {
        flights.delete(handle);
        return Promise.resolve({ status: 'expired' });
      }
      return Promise.resolve({ status: 'pending', retryAfterMs: REDIRECT_POLL_MS });
    }
    if (outcome.kind !== 'redirect') {
      flights.delete(handle);
      return Promise.resolve({ status: outcome.kind });
    }
    flight.redeeming = redeem(handle, flight, outcome.code).then((result) => {
      flight.redeeming = null;
      return result;
    });
    return flight.redeeming;
  }

  /** RFC 8628 §3.4 / §3.5 over the pure reducer — the reducer owns the rules, this owns the clock and the wire. */
  async function dialDevice(handle: string, flight: DeviceFlight): Promise<ServerSignInPollResult> {
    const response = await postForm(flight.tokenEndpoint, {
      grant_type: DEVICE_CODE_GRANT_TYPE,
      device_code: flight.pending.deviceCode,
      client_id: flight.clientId,
    });
    const at = now();
    if (response === null) return { status: 'offline' };
    if (response.status >= 500) {
      // A server fault is not a grant fault: the approval stands, the next interval retries.
      flight.nextPollAt = at + flight.pending.intervalSeconds * 1000;
      return { status: 'pending', retryAfterMs: flight.nextPollAt - at };
    }
    const json = await readJson(response);
    if (json?.error === 'invalid_grant') {
      flights.delete(handle);
      return { status: 'unknown' };
    }
    const step = stepDevicePoll(flight.pending, { status: response.status, json }, at);
    switch (step.kind) {
      case 'wait':
        flight.pending.intervalSeconds = step.intervalSeconds;
        flight.nextPollAt = at + step.delayMs;
        return { status: 'pending', retryAfterMs: step.delayMs };
      case 'granted':
        flights.delete(handle);
        return { status: 'approved', secret: step.bundle.accessToken };
      case 'denied':
        flights.delete(handle);
        return { status: 'denied' };
      case 'expired':
        flights.delete(handle);
        return { status: 'expired' };
      case 'failed':
        return { status: 'offline' };
    }
  }

  function pollDevice(handle: string, flight: DeviceFlight): Promise<ServerSignInPollResult> {
    if (flight.dialing !== null) return flight.dialing;
    const at = now();
    if (at < flight.nextPollAt) return Promise.resolve({ status: 'pending', retryAfterMs: flight.nextPollAt - at });
    flight.dialing = dialDevice(handle, flight).then((result) => {
      flight.dialing = null;
      return result;
    });
    return flight.dialing;
  }

  return {
    async start(input: ServerSignInStartInput): Promise<ServerSignInStartResult> {
      const origin = wsUrlToHttpOrigin(input.url);
      if (!origin) return { ok: false, reason: 'error' };
      const discovered = await discover(origin);
      if (!discovered.ok) return discovered;
      const label = boundedLabel(input.deviceLabel ?? options.deviceLabel?.());
      if (userAgent !== null && registered.grants.includes('code')) {
        return startCode(userAgent, discovered.endpoints, label);
      }
      if (registered.grants.includes('device')) return startDevice(discovered.endpoints, label);
      return { ok: false, reason: 'error' };
    },

    poll(input): Promise<ServerSignInPollResult> {
      const flight = flights.get(input.handle);
      if (flight === undefined) return Promise.resolve({ status: 'unknown' });
      return flight.grant === 'code' ? pollCode(input.handle, flight) : pollDevice(input.handle, flight);
    },

    async cancel(input): Promise<void> {
      flights.delete(input.handle);
    },

    async signOut(input: ServerSignInSignOutInput): Promise<{ ok: boolean }> {
      const origin = wsUrlToHttpOrigin(input.url);
      if (!origin) return { ok: false };
      const discovered = await discover(origin);
      if (!discovered.ok || discovered.endpoints.revocationEndpoint === undefined) return { ok: false };
      const response = await postForm(discovered.endpoints.revocationEndpoint, { token: input.token });
      return { ok: response?.ok === true };
    },

    async fetchMeta(input): Promise<unknown | null> {
      const origin = wsUrlToHttpOrigin(input.url);
      if (!origin) return null;
      return fetchJsonDocument(`${origin}${input.path}`, fetchFn);
    },
  };
}
