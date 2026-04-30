/**
 * Renderer-side files sync mirror.
 *
 * Thin adapter over {@link createSingletonEntityMirror}. Renderer
 * write helpers consult this mirror to compute `FileRef` lookups
 * synchronously (§19.4).
 */

import type { FileRef } from '@openheaders/core/files';
import { FILES_ENTITY_TYPE } from '@openheaders/core/sync';
import { call } from '@utils/bridge';
import {
  createSingletonEntityMirror,
  type CreateSingletonMirrorOptions,
} from './singleton-entity-mirror';

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
  dispose(): void;
}

export type CreateFilesSyncMirrorOptions = CreateSingletonMirrorOptions;

export function createFilesSyncMirror(
  options: CreateFilesSyncMirrorOptions = {},
): FilesSyncMirror {
  const core = createSingletonEntityMirror<FilesMirrorEntry>(
    {
      loggerTag: 'FilesSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, filesPostState } = event;
        if (envelope.body.type !== FILES_ENTITY_TYPE) return null;
        if (!filesPostState) return 'tombstone';
        return { refs: filesPostState.refs, fileIds: filesPostState.fileIds };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotFiles');
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
    dispose: core.dispose,
  };
}

// ── Module-level singleton ───────────────────────────────────────────

let active: FilesSyncMirror | null = null;

export function getActiveFilesSyncMirror(): FilesSyncMirror {
  if (!active) active = createFilesSyncMirror();
  return active;
}

export function disposeActiveFilesSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
