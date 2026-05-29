/**
 * Extension implementation of the `pairWithCode` capability (WS-A2).
 *
 * The in-app pairing gesture: the user types the 6-digit code the daemon
 * displayed, and we exchange it for a long-lived auth token without them
 * leaving the extension to open the server-rendered `/pair/<code>` page
 * and hand-copy the secret.
 *
 * The wire is a single localhost/LAN HTTP POST to the daemon's confirm
 * route — the same `/pair/<code>/confirm` the HTML page submits, asked
 * for as JSON (`Accept: application/json`). It rides the same bound
 * socket as the WebSocket server, so the HTTP origin is the configured
 * `backend.url` with `ws→http` / `wss→https`. The extension's
 * `<all_urls>` host permission lets an extension surface dial it
 * directly with no CORS preflight; this is a one-shot user-initiated
 * request, so running it from the calling surface (rather than relaying
 * through the service worker) is fine — the SW connects reactively once
 * the caller writes the returned token into `backend.authToken`.
 */

import type { PairWithCodeInput, PairWithCodeResult } from '@openheaders/core/capabilities';

/**
 * Derive the daemon's HTTP origin from its WebSocket URL. Returns null
 * for a non-`ws(s)` or unparseable URL so the caller can fail with a
 * clear `error` rather than dialing garbage.
 */
function wsUrlToHttpOrigin(wsUrl: string): string | null {
  try {
    const u = new URL(wsUrl);
    const protocol = u.protocol === 'wss:' ? 'https:' : u.protocol === 'ws:' ? 'http:' : null;
    if (!protocol) return null;
    return `${protocol}//${u.host}`;
  } catch {
    return null;
  }
}

interface DaemonConfirmJson {
  ok: boolean;
  secret?: unknown;
  tokenId?: unknown;
  reason?: unknown;
}

function isConfirmReason(value: unknown): value is 'unknown' | 'expired' | 'consumed' {
  return value === 'unknown' || value === 'expired' || value === 'consumed';
}

export async function pairWithCode(input: PairWithCodeInput): Promise<PairWithCodeResult> {
  const origin = wsUrlToHttpOrigin(input.url);
  if (!origin) {
    return { ok: false, reason: 'error', message: 'Backend URL must be a ws:// or wss:// address.' };
  }
  const code = input.code.trim();
  if (!/^\d+$/.test(code)) {
    return { ok: false, reason: 'error', message: 'Pairing code must be digits only.' };
  }

  let response: Response;
  try {
    response = await fetch(`${origin}/pair/${encodeURIComponent(code)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input.deviceLabel ? { deviceLabel: input.deviceLabel } : {}),
    });
  } catch {
    // Connection refused / DNS failure / TLS error — the back-end isn't
    // reachable at that address.
    return { ok: false, reason: 'unreachable' };
  }

  let body: DaemonConfirmJson;
  try {
    body = (await response.json()) as DaemonConfirmJson;
  } catch {
    return { ok: false, reason: 'error', message: 'The back-end returned an unexpected response.' };
  }

  if (body.ok === true && typeof body.secret === 'string' && typeof body.tokenId === 'string') {
    return { ok: true, token: body.secret, tokenId: body.tokenId };
  }
  if (isConfirmReason(body.reason)) {
    return { ok: false, reason: body.reason };
  }
  return { ok: false, reason: 'error', message: 'The back-end could not complete pairing.' };
}
