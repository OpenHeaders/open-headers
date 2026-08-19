/**
 * Snapshot-RPC transport for the renderer mirrors — `hostBridge.call`
 * plus the boot-window retry the mirror-bootstrap contract requires.
 *
 * A host that is still hydrating its stores (MV3 SW wake, fresh
 * install) answers the `oh.sync.snapshot*` / `oh.awareness.snapshot`
 * channels with `SyncRpcNotReadyResponse` instead of a partial or empty
 * snapshot (see `packages/oracle/src/rpc/sync-rpc.ts`). Every mirror
 * bootstrap fetch goes through {@link callSnapshotRpc}, which retries
 * with capped backoff until the host reports ready — so a workbench
 * opened mid-boot hydrates the moment the host finishes instead of
 * caching emptiness forever. Transport rejections (no handler, context
 * invalidated) are NOT retried; they propagate to the caller's existing
 * failure path.
 */

import {
  type BridgeRpcRequest,
  type BridgeRpcResponse,
  type BridgeRpcType,
  hostBridge,
} from '@openheaders/core/bridge';
import { isSyncRpcNotReady, type SyncRpcNotReadyResponse } from '@openheaders/core/protocol';

/** First retry delay; doubles per attempt up to {@link MAX_RETRY_DELAY_MS}. */
const INITIAL_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2000;
/** Give up after this long — a host that never reports ready is broken;
 *  the caller's catch logs once instead of polling forever. */
const MAX_TOTAL_WAIT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call a snapshot channel, retrying not-ready answers until the host is
 * hydrated. Resolves with the ready-branch response — the not-ready
 * member never escapes this helper.
 */
export async function callSnapshotRpc<K extends BridgeRpcType>(
  type: K,
  ...args: BridgeRpcRequest<K> extends Record<string, never> ? [] : [payload: BridgeRpcRequest<K>]
): Promise<Exclude<BridgeRpcResponse<K>, SyncRpcNotReadyResponse>> {
  const deadline = Date.now() + MAX_TOTAL_WAIT_MS;
  let delay = INITIAL_RETRY_DELAY_MS;
  for (;;) {
    const resp = await hostBridge.call(type, ...args);
    if (!isSyncRpcNotReady(resp)) {
      // The runtime guard proved resp is not the not-ready member, but
      // TS cannot subtract a union member from an unresolved generic —
      // the cast is the narrowing the guard already performed.
      return resp as Exclude<BridgeRpcResponse<K>, SyncRpcNotReadyResponse>;
    }
    if (Date.now() >= deadline) {
      throw new Error(`${type}: host still not ready after ${MAX_TOTAL_WAIT_MS}ms`);
    }
    await sleep(delay);
    delay = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
  }
}
