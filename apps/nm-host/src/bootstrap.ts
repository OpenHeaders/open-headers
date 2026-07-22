/**
 * The host's one job (OBSERVABILITY_PLAN.md §4 + §8 Phase 7): take the
 * extension's bootstrap request, dial the desktop daemon's loopback
 * `/nm/bootstrap` route, and relay the answer. Identity verification
 * happens entirely on the daemon side — from OS truth about THIS
 * process (socket owner, executable path, spawning browser's
 * signature) — so nothing here is security-load-bearing except the
 * loopback pin: the host must never be talked into dialing a
 * non-loopback address, whatever the message claims.
 */

export interface BootstrapRequest {
  readonly url: string;
  readonly installId?: string;
}

export type BootstrapResponse =
  | { readonly ok: true; readonly token: string; readonly tokenId: string; readonly browser: string }
  | { readonly ok: false; readonly reason: 'bad-request' | 'unreachable' | 'refused' | 'unsupported' };

const MAX_INSTALL_ID_LENGTH = 128;

/** Validate the inbound NM message shape; null = not a bootstrap request. */
export function parseBootstrapRequest(raw: unknown): BootstrapRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as { kind?: unknown; url?: unknown; installId?: unknown };
  if (record.kind !== 'bootstrap' || typeof record.url !== 'string') return null;
  const installId =
    typeof record.installId === 'string' &&
    record.installId.trim().length > 0 &&
    record.installId.length <= MAX_INSTALL_ID_LENGTH
      ? record.installId.trim()
      : undefined;
  return { url: record.url, ...(installId !== undefined ? { installId } : {}) };
}

function isLoopbackHostname(hostname: string): boolean {
  const plain = hostname.replace(/^\[|\]$/g, '');
  return plain === 'localhost' || plain === '::1' || plain.startsWith('127.');
}

/**
 * Derive the daemon's bootstrap endpoint from the extension's backend
 * URL (`ws://127.0.0.1:59210`). Loopback-only by construction — a
 * non-loopback or unparseable URL answers null and the host refuses.
 */
export function daemonBootstrapEndpoint(backendUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(backendUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'http:') return null;
  if (!isLoopbackHostname(parsed.hostname)) return null;
  return `http://${parsed.host}/nm/bootstrap`;
}

interface DaemonBootstrapJson {
  ok?: unknown;
  secret?: unknown;
  tokenId?: unknown;
  browser?: unknown;
  reason?: unknown;
}

export async function performBootstrap(
  request: BootstrapRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<BootstrapResponse> {
  const endpoint = daemonBootstrapEndpoint(request.url);
  if (!endpoint) return { ok: false, reason: 'bad-request' };
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.installId !== undefined ? { installId: request.installId } : {}),
    });
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  let body: DaemonBootstrapJson;
  try {
    body = (await response.json()) as DaemonBootstrapJson;
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
  if (
    body.ok === true &&
    typeof body.secret === 'string' &&
    typeof body.tokenId === 'string' &&
    typeof body.browser === 'string'
  ) {
    return { ok: true, token: body.secret, tokenId: body.tokenId, browser: body.browser };
  }
  return { ok: false, reason: body.reason === 'unsupported' ? 'unsupported' : 'refused' };
}
