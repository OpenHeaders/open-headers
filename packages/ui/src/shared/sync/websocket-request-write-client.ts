/**
 * Renderer-side imperative entry point for WebSocketRequest writes.
 *
 * Mirrors {@link grpc-request-write-client}: write sites build a
 * `MutationBatch` against the active WebSocket-request mirror and fire
 * `oh.sync.apply` directly — no SW round-trip per write. The
 * synchronous-render discipline (§19.4) lives in the editor; this
 * helper is what it reaches for once the user commits.
 */

import {
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WEBSOCKET_REQUEST_EVENTS_PATH,
  WEBSOCKET_REQUEST_HEADERS_PATH,
  WEBSOCKET_REQUEST_PARAMS_PATH,
  WEBSOCKET_REQUEST_SAVED_MESSAGES_PATH,
} from '@openheaders/core/sync';
import {
  buildWebSocketAddBatch,
  buildWebSocketDeleteBatch,
  buildWebSocketDeleteEntityBatch,
  buildWebSocketUpdateBatch,
} from '@openheaders/core/sync-builders/mutations/websocket-request-mutations';
import type { WebSocketRequest } from '@openheaders/core/types';
import { parentPathOf } from '@openheaders/core/utils';
import type { RequestCollectionSyncMirror } from '../../context/mirrors/request-collection-sync-mirror';
import type { RequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';
import {
  getWebSocketRequestSyncMirrorForWorkspace,
  type WebSocketRequestSyncMirror,
} from '../../context/mirrors/websocket-request-sync-mirror';
import type { WsResponseExampleSyncMirror } from '../../context/mirrors/ws-response-example-sync-mirror';
import {
  applySyncPayload,
  type BaseSyncWriteOptions,
  resolveMirror,
  resolveRendererContext,
  type SyncSimpleResult,
} from './apply-payload';
import { applyRequestExampleDeletes, requestExamples } from './tree-descendants';
import { requestTreeMirrors, resolveChildPlacement, resolveLeafParent, unresolvableParent } from './tree-placement';

export type WebSocketRequestUpdates = Partial<Omit<WebSocketRequest, 'uid' | 'path' | 'pathSegment' | 'schemaVersion'>>;

export type WebSocketRequestMutationResult =
  | { ok: true; websocketRequest: WebSocketRequest }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'other'; message?: string };

export type WebSocketRequestSimpleResult = SyncSimpleResult;

export interface WebSocketRequestWriteOptions extends BaseSyncWriteOptions {
  /** Override the singleton mirror for tests. */
  mirror?: WebSocketRequestSyncMirror;
  /** Override the response-example mirror the delete cascade reads (tests). */
  exampleMirror?: WsResponseExampleSyncMirror;
  /** Override the parent-resolving container mirrors for tests. */
  collectionMirror?: RequestCollectionSyncMirror;
  folderMirror?: RequestFolderSyncMirror;
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
            : snap && path === WEBSOCKET_REQUEST_EVENTS_PATH
              ? (snap.events ?? [])
              : snap && path === WEBSOCKET_REQUEST_SAVED_MESSAGES_PATH
                ? (snap.savedMessages ?? [])
                : undefined;
      if (!rows) return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: undefined }));
      const byUid = new Map<string, unknown>();
      for (const row of rows) byUid.set(row.uid, row);
      return orderKeys.map((e) => ({ itemId: e.itemId, orderKey: e.orderKey, item: byUid.get(e.itemId) }));
    },
    // Scalar pre-image reader from the same canonical snapshot — the
    // subprotocols / specLink / auth / scripts flatten-diff baseline (a
    // save writes only the script slots that changed and tombstones
    // the ones the draft emptied) and the explicit-clear guard (a knob
    // reset to inherit tombstones its leaf only while one is stored).
    (uid, path) => {
      const snap = mirror.getWebSocketRequestMirror(uid)?.websocketRequest;
      if (!snap) return undefined;
      return snap[path as keyof WebSocketRequest];
    },
  );
  const ack = await applySyncPayload(payload);
  if (ack.ok) {
    return { ok: true, websocketRequest: { ...entry.websocketRequest, ...updates } as WebSocketRequest };
  }
  if (ack.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: ack.message };
}

/**
 * Seed a brand-new WebSocket request through the oracle. Caller mints
 * the full `WebSocketRequest` shape; the helper resolves the parent from
 * the request's path (its `items` slot rides the create batch) and
 * handles the per-row addToSet envelopes via the projection layer. An
 * unplaceable parent fails the create.
 */
export async function applyWebSocketRequestCreate(
  request: WebSocketRequest,
  opts: WebSocketRequestWriteOptions,
): Promise<WebSocketRequestSimpleResult> {
  const parentPath = parentPathOf(request.path) ?? '';
  const placement = await resolveChildPlacement(requestTreeMirrors(opts.workspaceId, opts), parentPath);
  if (!placement) return unresolvableParent(parentPath);
  const ctx = resolveRendererContext(opts).next(opts.batchId ? { batchId: opts.batchId } : undefined);
  const payload = buildWebSocketAddBatch(request, ctx, placement);
  return applySyncPayload(payload);
}

export async function applyWebSocketRequestDelete(
  webSocketRequestUid: string,
  opts: WebSocketRequestWriteOptions,
): Promise<WebSocketRequestSimpleResult> {
  const mirror = resolveMirror(opts, getWebSocketRequestSyncMirrorForWorkspace);
  await mirror.hydrated;
  const entry = mirror.getWebSocketRequestMirror(webSocketRequestUid);
  if (!entry) return { ok: false, reason: 'not-found' };
  // Cascade: the request's examples go first (`tree-descendants.ts`).
  const examples = await requestExamples(
    opts.workspaceId,
    { websocketMirror: mirror, wsExampleMirror: opts.exampleMirror },
    { type: WEBSOCKET_REQUEST_ENTITY_TYPE, uid: webSocketRequestUid },
  );
  const handle = resolveRendererContext(opts);
  const cascade = await applyRequestExampleDeletes(examples, handle, `request-delete-cascade-${webSocketRequestUid}`);
  if (!cascade.ok) return cascade;
  // The parent's `items` slot tombstones with the entity; an
  // unresolvable parent (already tombstoned) takes the bare tombstone.
  const parent = await resolveLeafParent(requestTreeMirrors(opts.workspaceId, opts), entry.websocketRequest.path);
  const ctx = handle.next(opts.batchId ? { batchId: opts.batchId } : undefined);
  return applySyncPayload(
    parent
      ? buildWebSocketDeleteBatch(webSocketRequestUid, parent, ctx)
      : buildWebSocketDeleteEntityBatch(webSocketRequestUid, ctx),
  );
}
