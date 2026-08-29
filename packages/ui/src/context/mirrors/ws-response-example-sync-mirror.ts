/**
 * Renderer-side WebSocket response-example sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link grpc-response-example-sync-mirror}. Examples are frozen flat
 * records so there are no set-modeled paths to enumerate.
 */

import { WEBSOCKET_REQUEST_EXAMPLES_PATH, WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WsResponseExample } from '@openheaders/core/types';
import { orderedBySlots } from '@openheaders/core/utils';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';
import { getWebSocketRequestSyncMirrorForWorkspace } from './websocket-request-sync-mirror';

export interface WsResponseExampleMirrorEntry {
  wsResponseExample: WsResponseExample;
}

export type WsResponseExampleMirrorListener = (uid: string) => void;

export interface WsResponseExampleSyncMirror {
  getWsResponseExampleMirror(uid: string): WsResponseExampleMirrorEntry | null;
  listWsResponseExamples(): WsResponseExample[];
  /** Examples under one WebSocket request, the request's slot order. */
  listWsResponseExamplesForRequest(websocketRequestUid: string): WsResponseExample[];
  subscribeWsResponseExampleMirror(uid: string, listener: WsResponseExampleMirrorListener): () => void;
  subscribeAny(listener: WsResponseExampleMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateWsResponseExampleSyncMirrorOptions = CreateFlatMirrorOptions;

export function createWsResponseExampleSyncMirror(
  workspaceId: string,
  options: CreateWsResponseExampleSyncMirrorOptions = {},
): WsResponseExampleSyncMirror {
  const core = createFlatEntityMirror<WsResponseExampleMirrorEntry>(
    {
      loggerTag: 'WsResponseExampleSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, wsResponseExamplePostState } = event;
        if (!wsResponseExamplePostState && envelope.body.type !== WS_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!wsResponseExamplePostState) return { uid, entry: null };
        return { uid, entry: { wsResponseExample: wsResponseExamplePostState.wsResponseExample } };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotWsResponseExamples', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.wsResponseExample.uid,
          entry: { wsResponseExample: e.wsResponseExample },
        }));
      },
    },
    options,
  );
  const list = () => core.list().map((e) => e.wsResponseExample);
  const exampleSlots = (requestUid: string): string[] =>
    getWebSocketRequestSyncMirrorForWorkspace(workspaceId)
      .liveOrderedSetItems(requestUid, WEBSOCKET_REQUEST_EXAMPLES_PATH)
      .map((slot) => slot.itemId);
  return {
    getWsResponseExampleMirror: core.get,
    listWsResponseExamples: list,
    listWsResponseExamplesForRequest: (websocketRequestUid) =>
      orderedBySlots(
        list().filter((e) => e.websocketRequestUid === websocketRequestUid),
        exampleSlots(websocketRequestUid),
      ),
    subscribeWsResponseExampleMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const wsResponseExampleSyncMirrorRegistry = createWorkspaceMirrorRegistry<WsResponseExampleSyncMirror>((workspaceId) =>
  createWsResponseExampleSyncMirror(workspaceId),
);

export function getWsResponseExampleSyncMirrorForWorkspace(workspaceId: string): WsResponseExampleSyncMirror {
  return wsResponseExampleSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeWsResponseExampleSyncMirrorForWorkspace(workspaceId: string): void {
  wsResponseExampleSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllWsResponseExampleSyncMirrors(): void {
  wsResponseExampleSyncMirrorRegistry.disposeAll();
}
