/**
 * Renderer-side files sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Renderer
 * write helpers consult this mirror to compute `FileRef` lookups
 * synchronously (§19.4).
 */

import type { FileRef } from '@openheaders/core/files';
import { FILES_ENTITY_TYPE } from '@openheaders/core/sync';
import { hostBridge } from '@openheaders/core/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface FilesMirrorEntry {
  refs: FileRef[];
  fileIds: string[];
}

export type FilesMirrorListener = () => void;

export interface FilesSyncMirror {
  getMirror(): FilesMirrorEntry | null;
  liveFileIds(): string[];
  liveRefs(): FileRef[];
  subscribeMirror(listener: FilesMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateFilesSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createFilesSyncMirror(
  workspaceId: string,
  options: CreateFilesSyncMirrorOptions = {},
): FilesSyncMirror {
  const core = createSingletonEntityMirror<FilesMirrorEntry>(
    {
      loggerTag: 'FilesSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, filesPostState } = event;
        if (envelope.body.type !== FILES_ENTITY_TYPE) return null;
        if (!filesPostState) return 'tombstone';
        return { refs: filesPostState.refs, fileIds: filesPostState.fileIds };
      },
      fetchSnapshot: async () => {
        const resp = await hostBridge.call('oh.sync.snapshotFiles', { workspaceId });
        const first = resp.entries[0];
        return first ? { refs: first.refs, fileIds: first.fileIds } : null;
      },
    },
    options,
  );
  return {
    getMirror: core.get,
    liveFileIds: () => core.get()?.fileIds ?? [],
    liveRefs: () => core.get()?.refs ?? [],
    subscribeMirror: core.subscribe,
    hydrated: core.hydrated,
    dispose: core.dispose,
  };
}

// ── Per-workspace registry ───────────────────────────────────────────
//
// Symmetric to the SW data plane's `services: Map<workspaceId,
// WorkspaceServiceState>` (commit 1, sub-commit 1a). Each workspace's
// mirror is independent: its bridge subscription filters by
// `event.envelope.workspaceId` at the shared mirror core (M-2), and
// its bootstrap snapshot is fetched scoped to the workspace via
// `oh.sync.snapshotX, { workspaceId }` (M-1). Cross-workspace
// contamination is structurally inexpressible.

const filesSyncMirrorRegistry = createWorkspaceMirrorRegistry<FilesSyncMirror>(
  (workspaceId) => createFilesSyncMirror(workspaceId),
);

export function getFilesSyncMirrorForWorkspace(workspaceId: string): FilesSyncMirror {
  return filesSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeFilesSyncMirrorForWorkspace(workspaceId: string): void {
  filesSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllFilesSyncMirrors(): void {
  filesSyncMirrorRegistry.disposeAll();
}
