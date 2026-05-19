/**
 * Mode-switch Coexist (M3) — extension-SW peer pusher installer.
 *
 * The host-neutral orchestrator (`packages/oracle/src/sync/mode-switch/
 * coexist-orchestrator.ts`) collects locally then asks for a pusher to
 * deliver the payload to the peer. The pusher is host-specific —
 * extension SW has `wsRequest`; desktop main currently has no client
 * transport (Phase C MVP). This module installs the SW's pusher at boot.
 *
 * Wire contract: peer's `dispatchSyncRpc` already routes
 * `oh.sync.applyCoexistImport` (registered in oracle/rpc/sync-rpc.ts),
 * and the WS server auto-replies with `:response` so `wsRequest` can
 * resolve. No additional wire-protocol surface is needed.
 *
 * Failure modes (handled by orchestrator's catch):
 *   - WS not connected               → `wsRequest` throws `not-connected`
 *   - Peer rejects via `__error`     → `wsRequest` throws server message
 *   - No reply inside timeout window → `wsRequest` throws `timeout`
 *
 * All three resolve to `peer-write-unavailable` in the orchestrator's
 * outer catch, which is the right outcome — the user is told to connect
 * the target first rather than seeing a silent half-commit.
 */

import type { CoexistPayload, CoexistResult } from '@openheaders/core/sync';
import { generateUid } from '@openheaders/core/utils';
import { setCoexistPeerPusher } from '@openheaders/oracle/sync';
import { runBackendRpc } from '@openheaders/ui/shared/backend';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { wsRequest } from './ws-request';
import { isWebSocketConnected } from './websocket';

/**
 * Coexist payloads can carry every user-content entity in every
 * workspace — far larger than the M2 presence frame. Bump the
 * per-request timeout so the peer has room to mint workspaces + replay
 * snapshots end-to-end. Tunable; the orchestrator surfaces the failure
 * cleanly if the limit is hit.
 */
const COEXIST_PUSH_TIMEOUT_MS = 30_000;

const swCoexistPusher = async (payload: CoexistPayload): Promise<CoexistResult> => {
  if (isWebSocketConnected()) {
    // Live wire is up — reuse it. Spares an extra TCP/handshake roundtrip
    // for the steady-state case (user already on a connected backend
    // switching to coexist with another).
    return wsRequest<CoexistResult>(
      { type: 'oh.sync.applyCoexistImport', workspaces: payload.workspaces },
      { timeoutMs: COEXIST_PUSH_TIMEOUT_MS },
    );
  }
  // Live wire isn't up — typically because we're SWITCHING INTO this
  // backend from a mode that doesn't keep a WS open (in-browser).
  // Open a fresh, side-effect-free WS just for this push: HELLO →
  // applyCoexistImport → :response → close. Same engine the Test
  // Connection button and the orchestrator's peer-presence query use.
  const url = getSetting('backend.url');
  const result = await runBackendRpc<CoexistResult>(
    url,
    {
      agent: 'extension-coexist-push',
      nodeId: `coexist-${generateUid()}`,
      workspaceId: `coexist-${generateUid()}`,
      role: 'extension',
      timeoutMs: COEXIST_PUSH_TIMEOUT_MS,
    },
    { type: 'oh.sync.applyCoexistImport', workspaces: payload.workspaces },
    'oh.sync.applyCoexistImport:response',
    (responsePayload: unknown) => {
      if (!responsePayload || typeof responsePayload !== 'object') {
        return { ok: false, reason: 'malformed-response', detail: 'Empty response payload' };
      }
      return { ok: true, value: responsePayload as CoexistResult };
    },
  );
  if (result.ok) return result.value;
  // Surface the probe failure as a wsRequest-shape throw so the
  // orchestrator's existing catch folds it into `peer-write-unavailable`.
  throw new Error(`coexist-push-failed: ${result.reason}${result.detail ? ` — ${result.detail}` : ''}`);
};

let installed = false;

/**
 * Install the SW pusher once at boot. Idempotent — calling more than
 * once is a no-op so background.ts can sequence this next to the other
 * oracle host hooks without ordering hazards.
 */
export function installCoexistPeerPusher(): void {
  if (installed) return;
  installed = true;
  setCoexistPeerPusher(swCoexistPusher);
}

/** Test seam — drops the installed pusher so tests start clean. */
export function __resetCoexistPeerPusherForTests(): void {
  installed = false;
  setCoexistPeerPusher(null);
}
