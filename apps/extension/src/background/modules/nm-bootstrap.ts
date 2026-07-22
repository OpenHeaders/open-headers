/**
 * NM identity bootstrap — the extension side of the Phase 7 token
 * handoff (OBSERVABILITY_PLAN.md §4 + §8).
 *
 * When a loopback backend has no credential (fresh install) or the
 * backend is actively evicting this peer (revoked/rotated token), ask
 * the browser to spawn the desktop's NM host and exchange one message:
 * the host dials the daemon's `/nm/bootstrap` route, the daemon
 * verifies the calling browser from OS truth, and a short-lived
 * `nmSession` secret comes back. Writing it into the backend record is
 * the whole hand-off — the registry fingerprint changes, the
 * connection manager redials, HELLO carries the new token.
 *
 * Degraded mode (ratified S17): every failure — no NM permission
 * (Firefox/Safari manifests), no registered host (dev desktop without
 * the packed binary), a refused identity chain — leaves the existing
 * device-flow pairing gesture as the path, surfaced by the existing
 * connection UX. Nothing here retries on its own: one attempt per
 * backend per stored-token value, so a bootstrap that failed (or a
 * minted token the daemon later revokes) never loops — the next
 * attempt needs the stored token to have changed (pairing writes it,
 * a prior successful mint changed it) or an SW restart.
 */

import { getBackends, isLoopbackBackendUrl, updateBackend } from '@openheaders/core/backends';
import { logger } from '@utils/logger';
import { peekSyncInstallId } from './sync-install-id';

const SCOPE = 'NmBootstrap';

/** Must match the desktop-registered manifest name. */
export const NM_HOST_NAME = 'io.openheaders.nm_bootstrap';

export type SendNativeMessage = (host: string, message: Record<string, unknown>) => Promise<unknown>;

function nativeMessagingAvailable(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.sendNativeMessage === 'function';
}

const defaultSendNativeMessage: SendNativeMessage = (host, message) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(host, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'native messaging failed'));
      else resolve(response);
    });
  });

export interface NmBootstrapDeps {
  /** Test seam — defaults to `chrome.runtime.sendNativeMessage`. */
  readonly sendNativeMessage?: SendNativeMessage;
  /** Per-backend eviction signal (sticky auth rejection, audit X-1). */
  readonly isBackendEvicting?: (backendId: string) => boolean;
}

export type NmBootstrapBackendOutcome = 'token-written' | 'refused' | 'unreachable' | 'error';

export interface NmBootstrapResult {
  readonly backendId: string;
  readonly outcome: NmBootstrapBackendOutcome;
}

// One attempt per backend per stored-token value (the loop guard the
// module docs describe). SW-lifetime state by design: an SW restart is
// a legitimate re-attempt.
const attemptedTokens = new Map<string, string>();

export function resetNmBootstrapForTests(): void {
  attemptedTokens.clear();
}

function parseHostResponse(raw: unknown): { token: string; browser: string } | { refusal: 'refused' | 'unreachable' } {
  if (raw && typeof raw === 'object') {
    const record = raw as { ok?: unknown; token?: unknown; browser?: unknown; reason?: unknown };
    if (record.ok === true && typeof record.token === 'string') {
      return { token: record.token, browser: typeof record.browser === 'string' ? record.browser : 'unknown' };
    }
    if (record.reason === 'unreachable') return { refusal: 'unreachable' };
  }
  return { refusal: 'refused' };
}

/**
 * Attempt the NM token handoff for every loopback backend that needs a
 * credential. Safe to call repeatedly (boot, socket close) — the
 * per-token attempt guard makes extra calls cheap no-ops.
 */
export async function runNmBootstrap(deps: NmBootstrapDeps = {}): Promise<NmBootstrapResult[]> {
  // The availability guard covers the real API only — browsers whose
  // manifest carries no `nativeMessaging` permission (Firefox/Safari in
  // this slice) simply have no candidates to attempt.
  if (deps.sendNativeMessage === undefined && !nativeMessagingAvailable()) return [];
  const send = deps.sendNativeMessage ?? defaultSendNativeMessage;
  const isEvicting = deps.isBackendEvicting ?? (() => false);
  const results: NmBootstrapResult[] = [];
  for (const backend of getBackends()) {
    if (!backend.enabled || !isLoopbackBackendUrl(backend.url)) continue;
    if (backend.authToken.length > 0 && !isEvicting(backend.id)) continue;
    if (attemptedTokens.get(backend.id) === backend.authToken) continue;
    attemptedTokens.set(backend.id, backend.authToken);
    const installId = peekSyncInstallId();
    let raw: unknown;
    try {
      raw = await send(NM_HOST_NAME, {
        kind: 'bootstrap',
        url: backend.url,
        ...(installId !== null ? { installId } : {}),
      });
    } catch (err) {
      // The common shape of "no host registered" / "access denied" —
      // dev desktop, unmanaged machine. The pairing gesture remains.
      logger.info(SCOPE, `native host unavailable for ${backend.url}: ${(err as Error).message}`);
      results.push({ backendId: backend.id, outcome: 'error' });
      continue;
    }
    const parsed = parseHostResponse(raw);
    if ('refusal' in parsed) {
      logger.info(SCOPE, `bootstrap ${parsed.refusal} for ${backend.url}`);
      results.push({ backendId: backend.id, outcome: parsed.refusal });
      continue;
    }
    await updateBackend(backend.id, { authToken: parsed.token });
    // The freshly written token is this backend's settled credential —
    // guard against re-attempting on the next close event racing the
    // registry watch.
    attemptedTokens.set(backend.id, parsed.token);
    logger.info(SCOPE, `nmSession token installed for ${backend.url} (${parsed.browser})`);
    results.push({ backendId: backend.id, outcome: 'token-written' });
  }
  return results;
}
