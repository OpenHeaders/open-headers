/**
 * NM token handoff — the wire mechanics of one bootstrap exchange with
 * the desktop's native-messaging host (OBSERVABILITY_PLAN.md §4 + §8
 * Phase 7). Context-neutral by design: the service worker's silent
 * auto-join policy and the workbench wizard's explicit pairing gesture
 * (the `nmAutoPair` capability) both ride this one primitive.
 *
 * The exchange is a single `chrome.runtime.sendNativeMessage`: the
 * browser spawns the desktop-registered host, the host dials the
 * daemon's loopback `/nm/bootstrap` route, the daemon verifies WHO is
 * asking from OS truth (never from the wire), and a short-lived
 * `nmSession` secret comes back — or a coarse refusal. What to DO with
 * either answer is the caller's policy, not this module's.
 */

export const NM_HOST_NAME = 'io.openheaders.nm_bootstrap';

export type SendNativeMessage = (host: string, message: Record<string, unknown>) => Promise<unknown>;

export function nativeMessagingAvailable(): boolean {
  return typeof chrome !== 'undefined' && typeof chrome.runtime?.sendNativeMessage === 'function';
}

export const defaultSendNativeMessage: SendNativeMessage = (host, message) =>
  new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(host, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) reject(new Error(lastError.message ?? 'native messaging failed'));
      else resolve(response);
    });
  });

export type NmHandoffResult =
  | { readonly ok: true; readonly token: string; readonly browser: string }
  /**
   * `refused` — the daemon's identity chain said no (or the host
   * answered any other error); `unreachable` — the host ran but the
   * daemon didn't answer; `unavailable` — no registered host at all
   * (dev desktop, no NM permission, unmanaged machine).
   */
  | { readonly ok: false; readonly reason: 'refused' | 'unreachable' | 'unavailable' };

function parseHostResponse(raw: unknown): NmHandoffResult {
  if (raw && typeof raw === 'object') {
    const record = raw as { ok?: unknown; token?: unknown; browser?: unknown; reason?: unknown };
    if (record.ok === true && typeof record.token === 'string') {
      return {
        ok: true,
        token: record.token,
        browser: typeof record.browser === 'string' ? record.browser : 'unknown',
      };
    }
    if (record.reason === 'unreachable') return { ok: false, reason: 'unreachable' };
  }
  return { ok: false, reason: 'refused' };
}

/**
 * Run one bootstrap exchange for `url` (the backend's WebSocket URL —
 * the host derives the daemon's HTTP endpoint from it, loopback-only by
 * construction). `installId` scopes token rotation on the daemon side;
 * it proves nothing and may be null when no identity is hydrated.
 */
export async function performNmHandoff(
  url: string,
  installId: string | null,
  send: SendNativeMessage = defaultSendNativeMessage,
): Promise<NmHandoffResult> {
  let raw: unknown;
  try {
    raw = await send(NM_HOST_NAME, {
      kind: 'bootstrap',
      url,
      ...(installId !== null ? { installId } : {}),
    });
  } catch {
    // The common shape of "no host registered" / "access denied".
    return { ok: false, reason: 'unavailable' };
  }
  return parseHostResponse(raw);
}
