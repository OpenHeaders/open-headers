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
import { setCoexistPeerPusher } from '@openheaders/oracle/sync';
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
  // Fast-fail if the wire is down — the wsRequest helper does this too,
  // but skipping the request avoids enqueueing a slot that the timeout
  // would have to drain.
  if (!isWebSocketConnected()) {
    throw new Error('not-connected');
  }
  return wsRequest<CoexistResult>(
    { type: 'oh.sync.applyCoexistImport', workspaces: payload.workspaces },
    { timeoutMs: COEXIST_PUSH_TIMEOUT_MS },
  );
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
