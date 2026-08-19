/**
 * Renderer-side response-example sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Examples are frozen
 * flat records so there are no set-modeled paths to enumerate.
 */

import { RESPONSE_EXAMPLE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ResponseExample } from '@openheaders/core/types';
import { type CreateFlatMirrorOptions, createFlatEntityMirror } from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';
import { callSnapshotRpc } from './snapshot-rpc';

export interface ResponseExampleMirrorEntry {
  responseExample: ResponseExample;
}

export type ResponseExampleMirrorListener = (uid: string) => void;

export interface ResponseExampleSyncMirror {
  getResponseExampleMirror(uid: string): ResponseExampleMirrorEntry | null;
  listResponseExamples(): ResponseExample[];
  /** Examples under one request, capture order (oldest first). */
  listResponseExamplesForRequest(requestUid: string): ResponseExample[];
  subscribeResponseExampleMirror(uid: string, listener: ResponseExampleMirrorListener): () => void;
  subscribeAny(listener: ResponseExampleMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateResponseExampleSyncMirrorOptions = CreateFlatMirrorOptions;

export function createResponseExampleSyncMirror(
  workspaceId: string,
  options: CreateResponseExampleSyncMirrorOptions = {},
): ResponseExampleSyncMirror {
  const core = createFlatEntityMirror<ResponseExampleMirrorEntry>(
    {
      loggerTag: 'ResponseExampleSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, responseExamplePostState } = event;
        if (!responseExamplePostState && envelope.body.type !== RESPONSE_EXAMPLE_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!responseExamplePostState) return { uid, entry: null };
        return { uid, entry: { responseExample: responseExamplePostState.responseExample } };
      },
      fetchSnapshot: async () => {
        const resp = await callSnapshotRpc('oh.sync.snapshotResponseExamples', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.responseExample.uid,
          entry: { responseExample: e.responseExample },
        }));
      },
    },
    options,
  );
  const list = () => core.list().map((e) => e.responseExample);
  return {
    getResponseExampleMirror: core.get,
    listResponseExamples: list,
    listResponseExamplesForRequest: (requestUid) =>
      list()
        .filter((e) => e.requestUid === requestUid)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    subscribeResponseExampleMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────

const responseExampleSyncMirrorRegistry = createWorkspaceMirrorRegistry<ResponseExampleSyncMirror>((workspaceId) =>
  createResponseExampleSyncMirror(workspaceId),
);

export function getResponseExampleSyncMirrorForWorkspace(workspaceId: string): ResponseExampleSyncMirror {
  return responseExampleSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeResponseExampleSyncMirrorForWorkspace(workspaceId: string): void {
  responseExampleSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllResponseExampleSyncMirrors(): void {
  responseExampleSyncMirrorRegistry.disposeAll();
}
