/**
 * Renderer-side files sync mirror (Phase B).
 *
 * Mirrors `pause-markers-sync-mirror.ts` for the singleton files
 * entity. Subscribes once to the SW's `syncBroadcast` channel and
 * folds every `filesPostState` payload into a single mutable record.
 * Renderer write helpers read this mirror to compute `FileRef` lookups
 * without an SW round-trip per write (§19.4). On construction the
 * mirror fires `oh.sync.snapshotFiles` so it has a starting view
 * before any broadcast arrives. The subscription is registered first
 * so any concurrent broadcast that lands mid-flight wins.
 */

import type { FileRef } from '@openheaders/core/files';
import { FILES_ENTITY_TYPE } from '@openheaders/core/sync';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface FilesMirrorEntry {
  refs: FileRef[];
  fileIds: string[];
}

export type FilesMirrorListener = () => void;

export interface FilesSyncMirror {
  getMirror(): FilesMirrorEntry | null;
  /** Live fileIds — `[]` when uninitialized. */
  liveFileIds(): string[];
  /** Live FileRefs convenience — empty list when uninitialized. */
  liveRefs(): FileRef[];
  subscribeMirror(listener: FilesMirrorListener): () => void;
  dispose(): void;
}

export interface CreateFilesSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createFilesSyncMirror(
  options: CreateFilesSyncMirrorOptions = {},
): FilesSyncMirror {
  const { bootstrap = true } = options;
  let entry: FilesMirrorEntry | null = null;
  const listeners = new Set<FilesMirrorListener>();
  let sawBroadcast = false;

  const notify = (): void => {
    for (const l of listeners) {
      try {
        l();
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, filesPostState } = event;
    if (envelope.body.type !== FILES_ENTITY_TYPE) return;
    sawBroadcast = true;

    if (!filesPostState) {
      if (entry !== null) {
        entry = null;
        notify();
      }
      return;
    }

    entry = { refs: filesPostState.refs, fileIds: filesPostState.fileIds };
    notify();
  });

  if (bootstrap) {
    void call('oh.sync.snapshotFiles')
      .then((resp) => {
        if (sawBroadcast) return;
        const first = resp.entries[0];
        if (!first) return;
        entry = { refs: first.refs, fileIds: first.fileIds };
        notify();
      })
      .catch((err: Error) => {
        logger.info('FilesSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getMirror() {
      return entry;
    },
    liveFileIds() {
      return entry?.fileIds ?? [];
    },
    liveRefs() {
      return entry?.refs ?? [];
    },
    subscribeMirror(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entry = null;
      listeners.clear();
    },
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
