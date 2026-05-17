/**
 * Mode-switch Import (M4) — extension-SW peer pusher installer.
 *
 * Symmetric mirror of {@link installCoexistPeerPusher} for M4's import
 * arm. The host-neutral orchestrator (`packages/oracle/src/sync/mode-
 * switch/import-orchestrator.ts`) collects locally then asks for a
 * pusher to deliver the payload to the peer. The pusher is host-
 * specific — extension SW has `wsRequest`; desktop main currently has
 * no client transport (Phase C MVP).
 *
 * Wire contract: peer's `dispatchSyncRpc` already routes
 * `oh.sync.applyImport` (registered in oracle/rpc/sync-rpc.ts), and the
 * WS server auto-replies with `:response` so `wsRequest` can resolve.
 *
 * Failure modes (handled by orchestrator's catch):
 *   - WS not connected               → `wsRequest` throws `not-connected`
 *   - Peer rejects via `__error`     → `wsRequest` throws server message
 *   - No reply inside timeout window → `wsRequest` throws `timeout`
 *
 * All three resolve to `peer-write-unavailable` in the orchestrator's
 * outer catch.
 */

import type { ImportPayload, ImportResult } from '@openheaders/core/sync';
import { setImportPeerPusher } from '@openheaders/oracle/sync';
import { wsRequest } from './ws-request';
import { isWebSocketConnected } from './websocket';

/**
 * Same generous ceiling as Coexist's pusher — Import payloads carry the
 * full per-workspace materialized state per entry. Tunable; the
 * orchestrator surfaces the failure cleanly if the limit is hit.
 */
const IMPORT_PUSH_TIMEOUT_MS = 30_000;

const swImportPusher = async (payload: ImportPayload): Promise<ImportResult> => {
  if (!isWebSocketConnected()) {
    throw new Error('not-connected');
  }
  return wsRequest<ImportResult>(
    { type: 'oh.sync.applyImport', workspaces: payload.workspaces },
    { timeoutMs: IMPORT_PUSH_TIMEOUT_MS },
  );
};

let installed = false;

/**
 * Install the SW pusher once at boot. Idempotent — calling more than
 * once is a no-op so background.ts can sequence this next to the other
 * oracle host hooks without ordering hazards.
 */
export function installImportPeerPusher(): void {
  if (installed) return;
  installed = true;
  setImportPeerPusher(swImportPusher);
}

/** Test seam — drops the installed pusher so tests start clean. */
export function __resetImportPeerPusherForTests(): void {
  installed = false;
  setImportPeerPusher(null);
}
