/**
 * Renderer-side gRPC response-example sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} — parallel to
 * {@link response-example-sync-mirror}. Examples are frozen flat
 * records so there are no set-modeled paths to enumerate.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { GrpcResponseExample } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface GrpcResponseExampleMirrorEntry {
  grpcResponseExample: GrpcResponseExample;
}

export type GrpcResponseExampleMirrorListener = (uid: string) => void;

export interface GrpcResponseExampleSyncMirror {
  getGrpcResponseExampleMirror(uid: string): GrpcResponseExampleMirrorEntry | null;
  listGrpcResponseExamples(): GrpcResponseExample[];
  /** Examples under one gRPC request, capture order (oldest first). */
  listGrpcResponseExamplesForRequest(grpcRequestUid: string): GrpcResponseExample[];
  subscribeGrpcResponseExampleMirror(uid: string, listener: GrpcResponseExampleMirrorListener): () => void;
  subscribeAny(listener: GrpcResponseExampleMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateGrpcResponseExampleSyncMirrorOptions = CreateFlatMirrorOptions;

export function createGrpcResponseExampleSyncMirror(
  workspaceId: string,
  options: CreateGrpcResponseExampleSyncMirrorOptions = {},
): GrpcResponseExampleSyncMirror {
  const core = createFlatEntityMirror<GrpcResponseExampleMirrorEntry>(
    {
      loggerTag: 'GrpcResponseExampleSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, grpcResponseExamplePostState } = event;
        if (!grpcResponseExamplePostState && envelope.body.type !== GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!grpcResponseExamplePostState) return { uid, entry: null };
        return { uid, entry: { grpcResponseExample: grpcResponseExamplePostState.grpcResponseExample } };
      },
      fetchSnapshot: async () => {
        const resp = await hostBridge.call('oh.sync.snapshotGrpcResponseExamples', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.grpcResponseExample.uid,
          entry: { grpcResponseExample: e.grpcResponseExample },
        }));
      },
    },
    options,
  );
  const list = () => core.list().map((e) => e.grpcResponseExample);
  return {
    getGrpcResponseExampleMirror: core.get,
    listGrpcResponseExamples: list,
    listGrpcResponseExamplesForRequest: (grpcRequestUid) =>
      list()
        .filter((e) => e.grpcRequestUid === grpcRequestUid)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    subscribeGrpcResponseExampleMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const grpcResponseExampleSyncMirrorRegistry = createWorkspaceMirrorRegistry<GrpcResponseExampleSyncMirror>(
  (workspaceId) => createGrpcResponseExampleSyncMirror(workspaceId),
);

export function getGrpcResponseExampleSyncMirrorForWorkspace(workspaceId: string): GrpcResponseExampleSyncMirror {
  return grpcResponseExampleSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeGrpcResponseExampleSyncMirrorForWorkspace(workspaceId: string): void {
  grpcResponseExampleSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllGrpcResponseExampleSyncMirrors(): void {
  grpcResponseExampleSyncMirrorRegistry.disposeAll();
}
