/**
 * Renderer-side GrpcRequest sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link request-sync-mirror}. Renderer write helpers consult this
 * mirror to read the canonical gRPC-request shape synchronously
 * (§19.4) and enumerate live `(itemId, orderKey)` pairs at the
 * set-modeled `metadata` path.
 */

import { GRPC_REQUEST_ENTITY_TYPE } from '@openheaders/core/sync';
import type { GrpcRequest } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface GrpcRequestMirrorEntry {
  grpcRequest: GrpcRequest;
  /** Map keyed by set path (`metadata`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for `moveBefore` writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type GrpcRequestMirrorListener = (uid: string) => void;

export interface GrpcRequestSyncMirror {
  getGrpcRequestMirror(uid: string): GrpcRequestMirrorEntry | null;
  listGrpcRequests(): GrpcRequest[];
  liveSetItems(uid: string, setPath: string): string[];
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeGrpcRequestMirror(uid: string, listener: GrpcRequestMirrorListener): () => void;
  subscribeAny(listener: GrpcRequestMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateGrpcRequestSyncMirrorOptions = CreateFlatMirrorOptions;

export function createGrpcRequestSyncMirror(
  workspaceId: string,
  options: CreateGrpcRequestSyncMirrorOptions = {},
): GrpcRequestSyncMirror {
  const core = createFlatEntityMirror<GrpcRequestMirrorEntry>(
    {
      loggerTag: 'GrpcRequestSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, grpcRequestPostState } = event;
        // A non-GrpcRequest broadcast arrives with the post-state
        // undefined; ignore it so it doesn't tombstone an unrelated
        // entry. Type-matching tombstone (post-state absent on a
        // GrpcRequest envelope) drops the entry.
        if (!grpcRequestPostState && envelope.body.type !== GRPC_REQUEST_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!grpcRequestPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            grpcRequest: grpcRequestPostState.grpcRequest,
            setItemIds: grpcRequestPostState.setItemIds,
            setOrderKeys: grpcRequestPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotGrpcRequests', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.grpcRequest.uid,
          entry: {
            grpcRequest: e.grpcRequest,
            setItemIds: e.setItemIds,
            setOrderKeys: e.setOrderKeys,
          },
        }));
      },
    },
    options,
  );
  return {
    getGrpcRequestMirror: core.get,
    listGrpcRequests: () =>
      core
        .list()
        .map((e) => e.grpcRequest)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveSetItems: (uid, setPath) => core.get(uid)?.setItemIds[setPath] ?? [],
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeGrpcRequestMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const grpcRequestSyncMirrorRegistry = createWorkspaceMirrorRegistry<GrpcRequestSyncMirror>((workspaceId) =>
  createGrpcRequestSyncMirror(workspaceId),
);

export function getGrpcRequestSyncMirrorForWorkspace(workspaceId: string): GrpcRequestSyncMirror {
  return grpcRequestSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeGrpcRequestSyncMirrorForWorkspace(workspaceId: string): void {
  grpcRequestSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllGrpcRequestSyncMirrors(): void {
  grpcRequestSyncMirrorRegistry.disposeAll();
}
