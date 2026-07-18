/**
 * Renderer-side imperative entry point for WebSocketRequest writes.
 *
 * Mirrors {@link grpc-request-write-client}: write sites build a
 * `MutationBatch` against the active WebSocket-request mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. The
 * synchronous-render discipline (§19.4) lives in the editor; this
 * helper is what it reaches for once the user commits.
 */

import { WEBSOCKET_REQUEST_HEADERS_PATH, WEBSOCKET_REQUEST_PARAMS_PATH } from '@openheaders/core/sync';
import {
  buildWebSocketAddBatch,
  buildWebSocketDeleteBatch,
  buildWebSocketUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/websocket-request-mutations';
import type { WebSocketRequest } from '@openheaders/core/types';
import {
  getWebSocketRequestSyncMirrorForWorkspace,
  type WebSocketRequestSyncMirror,
} from '../../context/mirrors/websocket-request-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';

export type WebSocketRequestUpdates = Partial<Omit<WebSocketRequest, 'uid' | 'path' | 'schemaVersion'>>;

export type WebSocketRequestMutationResult =
  | { ok: true; websocketRequest: WebSocketRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type WebSocketRequestSimpleResult = SyncSimpleResult;

export interface WebSocketRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: WebSocketRequestSyncMirror;
}

/**
 * Apply a partial WebSocketRequest patch through the local oracle.
 * Returns `{ ok: true, websocketRequest }` with an optimistic merge of
 * `updates` into the mirror's pre-image.
 */
export async function applyWebSocketRequestUpdate(
  webSocketRequestUid: string,
  updates: WebSocketRequestUpdates,
  opts: WebSocketRequestWriteOptions,
): Promise<WebSocketRequestMutationResult> {
  const mirror = resolveMirror(opts, getWebSocketRequestSyncMirrorForWorkspace);
  // Hydration must complete before the mirror read — see
  // {@link applyRequestUpdate} for the fresh-boot race this closes.
  await mirror.hydrated;
  const entry = mirror.getWebSocketRequestMirror(webSocketRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildWebSocketUpdateBatch(
    webSocketRequestUid,
    updates,
    ctx,
    (uid, path) => {
      const orderKeys = mirror.liveOrderedSetItems(uid, path);
      if (orderKeys.length === 0) return [];
      const snap = mirror.getWebSocketRequestMirror(uid)?.websocketRequest;
      const rows =
        snap && path === WEBSOCKET_REQUEST_HEADERS_PATH
          ? snap.headers
          : snap && path === WEBSOCKET_REQUEST_PARAMS_PATH
            ? snap.params
            : undefined;
      if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
      const byUid = new Map<string, unknown>();
      for (const row of rows) byUid.set(row.uid, row);
      return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
    },
    // Baseline for the subprotocols / specLink per-leaf flatten-diff.
    (uid, path) => {
      const snap = mirror.getWebSocketRequestMirror(uid)?.websocketRequest;
      if (!snap) return undefined;
      if (path === 'subprotocols') return snap.subprotocols;
      if (path === 'specLink') return snap.specLink;
      return undefined;
    },
  );
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, websocketRequest: { ...entry.websocketRequest, ...updates } as WebSocketRequest };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/** Seed a brand-new WebSocket request through the oracle. Caller mints
 *  the full `WebSocketRequest` shape; the helper handles the create +
 *  per-row addToSet envelopes via the projection layer. */
export async function applyWebSocketRequestCreate(
  request: WebSocketRequest,
  opts: WebSocketRequestWriteOptions,
): Promise<WebSocketRequestSimpleResult> {
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildWebSocketAddBatch(request, ctx);
  return applySyncPayload(payload);
}

export async function applyWebSocketRequestDelete(
  webSocketRequestUid: string,
  opts: WebSocketRequestWriteOptions,
): Promise<WebSocketRequestSimpleResult> {
  const mirror = resolveMirror(opts, getWebSocketRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  if (!mirror.getWebSocketRequestMirror(webSocketRequestUid)) return { ok: false, reason: 'not-found' };
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildWebSocketDeleteBatch(webSocketRequestUid, ctx);
  return applySyncPayload(payload);
}
