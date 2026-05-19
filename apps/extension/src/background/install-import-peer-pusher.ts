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
import { generateUid } from '@openheaders/core/utils';
import { setImportPeerPusher } from '@openheaders/oracle/sync';
import { runBackendRpc } from '@openheaders/ui/shared/backend';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';
import { wsRequest } from './ws-request';
import { isWebSocketConnected } from './websocket';

/**
 * Same generous ceiling as Coexist's pusher — Import payloads carry the
 * full per-workspace materialized state per entry. Tunable; the
 * orchestrator surfaces the failure cleanly if the limit is hit.
 */
const IMPORT_PUSH_TIMEOUT_MS = 30_000;

const swImportPusher = async (payload: ImportPayload): Promise<ImportResult> => {
  if (isWebSocketConnected()) {
    return wsRequest<ImportResult>(
      { type: 'oh.sync.applyImport', workspaces: payload.workspaces },
      { timeoutMs: IMPORT_PUSH_TIMEOUT_MS },
    );
  }
  // Fresh-WS fallback — same rationale as the Coexist pusher (see
  // `install-coexist-peer-pusher.ts`): switching INTO a back-end can't
  // wait for the live WS to open because the live WS only opens AFTER
  // the executor succeeds.
  const url = getSetting('backend.url');
  const result = await runBackendRpc<ImportResult>(
    url,
    {
      agent: 'extension-import-push',
      nodeId: `import-${generateUid()}`,
      workspaceId: `import-${generateUid()}`,
      role: 'extension',
      timeoutMs: IMPORT_PUSH_TIMEOUT_MS,
    },
    { type: 'oh.sync.applyImport', workspaces: payload.workspaces },
    'oh.sync.applyImport:response',
    (responsePayload: unknown) => {
      if (!responsePayload || typeof responsePayload !== 'object') {
        return { ok: false, reason: 'malformed-response', detail: 'Empty response payload' };
      }
      return { ok: true, value: responsePayload as ImportResult };
    },
  );
  if (result.ok) return result.value;
  throw new Error(`import-push-failed: ${result.reason}${result.detail ? ` — ${result.detail}` : ''}`);
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
