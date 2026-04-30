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

export interface TemplateFolderMirrorEntry {
  folder: V5.Folder;
}

export type TemplateFolderMirrorListener = (folderUid: string) => void;

export interface TemplateFolderSyncMirror {
  getTemplateFolderMirror(folderUid: string): TemplateFolderMirrorEntry | null;
  listTemplateFolders(): V5.Folder[];
  subscribeTemplateFolderMirror(
    folderUid: string,
    listener: TemplateFolderMirrorListener,
  ): () => void;
  subscribeAny(listener: TemplateFolderMirrorListener): () => void;
  dispose(): void;
}

export type CreateTemplateFolderSyncMirrorOptions = CreateFlatMirrorOptions;

export function createTemplateFolderSyncMirror(
  options: CreateTemplateFolderSyncMirrorOptions = {},
): TemplateFolderSyncMirror {
  const core = createFlatEntityMirror<TemplateFolderMirrorEntry>(
    {
      loggerTag: 'TemplateFolderSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, templateFolderPostState } = event;
        if (envelope.body.type !== TEMPLATE_FOLDER_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!templateFolderPostState) return { uid, entry: null };
        return { uid, entry: { folder: templateFolderPostState.folder } };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotTemplateFolders');
        return resp.entries.map((e) => ({ uid: e.folder.uid, entry: { folder: e.folder } }));
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
    subscribeTemplateFolderMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    dispose: core.dispose,
  };
}

let active: TemplateFolderSyncMirror | null = null;

export function getActiveTemplateFolderSyncMirror(): TemplateFolderSyncMirror {
  if (!active) active = createTemplateFolderSyncMirror();
  return active;
}

export function disposeActiveTemplateFolderSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
