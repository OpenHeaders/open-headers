/**
 * The client side of the device flow (the client sign-in plan §7) —
 * ONE host-neutral implementation of the `serverSignIn` capability over
 * an injected `fetch`, so the extension (a page-side fetch from its own
 * origin), the desktop app (Node's fetch in the MAIN process, F0-b) and
 * the CLI (Node) never each keep a copy of the wire:
 *
 *   - `start`     — `POST /pair` with the client kind and an optional
 *                   device label; answers the short code the person
 *                   reads, the long poll handle the client holds, and
 *                   the approve URL to open in a browser.
 *   - `poll`      — `GET /pair/poll` with the handle as the bearer; the
 *                   `approved` answer carries the bound session secret
 *                   ONCE. A transient mint fault answers 500 `pending`
 *                   and is polled again; an unknown handle is a 404.
 *   - `fetchMeta` — a JSON-only GET on the back-end's HTTP origin — the
 *                   seam the lifted gate resolver reads the three meta
 *                   routes through. Anything that is not a JSON 2xx
 *                   (the SPA fallback, a refusal, a dead socket) is
 *                   null, which every parser fails towards the safe
 *                   reading.
 *
 * The back-end is addressed by its configured WebSocket URL exactly as
 * `pairWithCode` is; the HTTP origin rides the same bound socket with
 * `ws→http` / `wss→https`.
 */

import type { ServerSignInApi, ServerSignInPollResult, ServerSignInStartResult } from '../capabilities/registry';
import type { DaemonPairingClientKind } from './daemon-pairing';

const START_PATH = '/pair';
const POLL_PATH = '/pair/poll';
const REQUEST_TIMEOUT_MS = 10_000;
const META_TIMEOUT_MS = 1_500;

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

export interface ServerSignInClientOptions {
  /** Which client asks — the page names it to the person. */
  readonly client: DaemonPairingClientKind;
  /** Test seam; defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
}

function isPollStatus(value: unknown): value is 'pending' | 'approved' | 'denied' | 'expired' | 'unknown' {
  return (
    value === 'pending' || value === 'approved' || value === 'denied' || value === 'expired' || value === 'unknown'
  );
}

export function createServerSignInClient(options: ServerSignInClientOptions): ServerSignInApi {
  const fetchFn = options.fetch ?? fetch;

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

  return {
    async start(input): Promise<ServerSignInStartResult> {
      const origin = wsUrlToHttpOrigin(input.url);
      if (!origin) return { ok: false, reason: 'error' };
      const label = input.deviceLabel?.trim();
      const response = await request(`${origin}${START_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(label ? { client: options.client, deviceLabel: label } : { client: options.client }),
      });
      if (response === null) return { ok: false, reason: 'offline' };
      if (response.status === 403) return { ok: false, reason: 'forbidden' };
      if (response.status === 429) return { ok: false, reason: 'throttled' };
      if (response.status === 503) return { ok: false, reason: 'too-many-pending' };
      if (!response.ok || !isJson(response)) return { ok: false, reason: 'error' };
      let body: { ok?: unknown; code?: unknown; pollToken?: unknown; expiresAt?: unknown; approveUrl?: unknown };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        return { ok: false, reason: 'error' };
      }
      if (
        body.ok === true &&
        typeof body.code === 'string' &&
        typeof body.pollToken === 'string' &&
        typeof body.expiresAt === 'number' &&
        typeof body.approveUrl === 'string'
      ) {
        return {
          ok: true,
          code: body.code,
          pollToken: body.pollToken,
          expiresAt: body.expiresAt,
          approveUrl: body.approveUrl,
        };
      }
      return { ok: false, reason: 'error' };
    },

    async poll(input): Promise<ServerSignInPollResult> {
      const origin = wsUrlToHttpOrigin(input.url);
      if (!origin) return { status: 'unknown' };
      const response = await request(`${origin}${POLL_PATH}`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${input.pollToken}` },
      });
      if (response === null) return { status: 'offline' };
      if (response.status === 404) return { status: 'unknown' };
      // A transient mint fault answers 500 `pending` — the next poll retries.
      if (response.status >= 500) return { status: 'pending', expiresAt: null };
      if (!response.ok || !isJson(response)) return { status: 'offline' };
      let body: { status?: unknown; secret?: unknown; tokenId?: unknown; expiresAt?: unknown };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        return { status: 'offline' };
      }
      if (!isPollStatus(body.status)) return { status: 'offline' };
      switch (body.status) {
        case 'pending':
          return { status: 'pending', expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : null };
        case 'approved':
          return typeof body.secret === 'string' && typeof body.tokenId === 'string'
            ? { status: 'approved', secret: body.secret, tokenId: body.tokenId }
            : { status: 'offline' };
        default:
          return { status: body.status };
      }
    },

    async fetchMeta(input): Promise<unknown | null> {
      const origin = wsUrlToHttpOrigin(input.url);
      if (!origin) return null;
      return fetchJsonDocument(`${origin}${input.path}`, fetchFn);
    },
  };
}
