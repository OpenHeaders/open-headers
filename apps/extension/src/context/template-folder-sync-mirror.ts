/**
 * Renderer-side template-folder sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror} routed through the
 * template-folder entity type.
 */

import { TEMPLATE_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface TemplateFolderMirrorEntry {
  folder: V5.Folder;
  /** Per-set ordered `(itemId, orderKey)` pairs. Carries the folder's
   *  own `folders` set; read via `liveOrderedSetItems`. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type TemplateFolderMirrorListener = (folderUid: string) => void;

export interface TemplateFolderSyncMirror {
  getTemplateFolderMirror(folderUid: string): TemplateFolderMirrorEntry | null;
  listTemplateFolders(): V5.Folder[];
  liveOrderedSetItems(
    folderUid: string,
    setPath: string,
  ): Array<{ itemId: string; orderKey: string }>;
  subscribeTemplateFolderMirror(
    folderUid: string,
    listener: TemplateFolderMirrorListener,
  ): () => void;
  subscribeAny(listener: TemplateFolderMirrorListener): () => void;
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateTemplateFolderSyncMirrorOptions = CreateFlatMirrorOptions;

export function createTemplateFolderSyncMirror(
  workspaceId: string,
  options: CreateTemplateFolderSyncMirrorOptions = {},
): TemplateFolderSyncMirror {
  const core = createFlatEntityMirror<TemplateFolderMirrorEntry>(
    {
      loggerTag: 'TemplateFolderSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, templateFolderPostState } = event;
        if (envelope.body.type !== TEMPLATE_FOLDER_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!templateFolderPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            folder: templateFolderPostState.folder,
            setOrderKeys: templateFolderPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotTemplateFolders', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.folder.uid,
          entry: { folder: e.folder, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getTemplateFolderMirror: core.get,
    listTemplateFolders: () =>
      core
        .list()
        .map((e) => e.folder)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeTemplateFolderMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
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

const templateFolderSyncMirrorRegistry = createWorkspaceMirrorRegistry<TemplateFolderSyncMirror>(
  (workspaceId) => createTemplateFolderSyncMirror(workspaceId),
);

export function getTemplateFolderSyncMirrorForWorkspace(workspaceId: string): TemplateFolderSyncMirror {
  return templateFolderSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeTemplateFolderSyncMirrorForWorkspace(workspaceId: string): void {
  templateFolderSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllTemplateFolderSyncMirrors(): void {
  templateFolderSyncMirrorRegistry.disposeAll();
}
