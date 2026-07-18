/**
 * Renderer-side WebSocketRequest sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link grpc-request-sync-mirror}. Renderer write helpers consult
 * this mirror to read the canonical WebSocket-request shape
 * synchronously (§19.4) and enumerate live `(itemId, orderKey)` pairs
 * at the set-modeled `headers` / `params` paths.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { WEBSOCKET_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WebSocketRequest } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface WebSocketRequestMirrorEntry {
  websocketRequest: WebSocketRequest;
  /** Map keyed by set path (`headers`, `params`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for `moveBefore` writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type WebSocketRequestMirrorListener = (uid: string) => void;

export interface WebSocketRequestSyncMirror {
  getWebSocketRequestMirror(uid: string): WebSocketRequestMirrorEntry | null;
  listWebSocketRequests(): WebSocketRequest[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeWebSocketRequestMirror(uid: string, listener: WebSocketRequestMirrorListener): () => void;
  subscribeAny(listener: WebSocketRequestMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateWebSocketRequestSyncMirrorOptions = CreateFlatMirrorOptions;

export function createWebSocketRequestSyncMirror(
  workspaceId: string,
  options: CreateWebSocketRequestSyncMirrorOptions = {},
): WebSocketRequestSyncMirror {
  const core = createFlatEntityMirror<WebSocketRequestMirrorEntry>(
    {
      loggerTag: 'WebSocketRequestSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, websocketRequestPostState } = event;
        // A non-WebSocketRequest broadcast arrives with the post-state
        // undefined; ignore it so it doesn't tombstone an unrelated
        // entry. Type-matching tombstone (post-state absent on a
        // WebSocketRequest envelope) drops the entry.
        if (!websocketRequestPostState && envelope.body.type !== WEBSOCKET_REQUEST_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!websocketRequestPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            websocketRequest: websocketRequestPostState.websocketRequest,
            setItemIds: websocketRequestPostState.setItemIds,
            setOrderKeys: websocketRequestPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await hostBridge.call('oh.sync.snapshotWebSocketRequests', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.websocketRequest.uid,
          entry: {
            websocketRequest: e.websocketRequest,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getWebSocketRequestMirror: core.get,
    listWebSocketRequests: () =>
      core
        .list()
        .map((e) => e.websocketRequest)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeWebSocketRequestMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const websocketRequestSyncMirrorRegistry = createWorkspaceMirrorRegistry<WebSocketRequestSyncMirror>((workspaceId) =>
  createWebSocketRequestSyncMirror(workspaceId),
);

export function getWebSocketRequestSyncMirrorForWorkspace(workspaceId: string): WebSocketRequestSyncMirror {
  return websocketRequestSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeWebSocketRequestSyncMirrorForWorkspace(workspaceId: string): void {
  websocketRequestSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllWebSocketRequestSyncMirrors(): void {
  websocketRequestSyncMirrorRegistry.disposeAll();
}
