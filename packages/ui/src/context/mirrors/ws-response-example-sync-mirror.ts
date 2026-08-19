/**
 * Renderer-side WebSocket response-example sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link grpc-response-example-sync-mirror}. Examples are frozen flat
 * records so there are no set-modeled paths to enumerate.
 */

import { WS_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { WsResponseExample } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface WsResponseExampleMirrorEntry {
  wsResponseExample: WsResponseExample;
}

export type WsResponseExampleMirrorListener = (uid: string) => void;

export interface WsResponseExampleSyncMirror {
  getWsResponseExampleMirror(uid: string): WsResponseExampleMirrorEntry | null;
  listWsResponseExamples(): WsResponseExample[];
  /** Examples under one WebSocket request, capture order (oldest first). */
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
  return {
    getWsResponseExampleMirror: core.get,
    listWsResponseExamples: list,
    listWsResponseExamplesForRequest: (websocketRequestUid) =>
      list()
        .filter((e) => e.websocketRequestUid === websocketRequestUid)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
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
