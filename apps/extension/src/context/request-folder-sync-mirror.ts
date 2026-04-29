/**
 * Renderer-side request-folder sync mirror (Phase B).
 *
 * Mirrors `folder-sync-mirror.ts` but routed through the
 * request-folder entity type. Folder envelopes whose
 * `requestFolderPostState` is undefined indicate either a tombstoned
 * folder or a folder whose parent linkage hasn't resolved yet — drop
 * the entry; the next broadcast that does carry post-state restores
 * it.
 */

import { type MutationEnvelope, REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface RequestFolderMirrorEntry {
  folder: V5.Folder;
}

export type RequestFolderMirrorListener = (folderUid: string) => void;

export interface RequestFolderSyncMirror {
  getRequestFolderMirror(folderUid: string): RequestFolderMirrorEntry | null;
  listRequestFolders(): V5.Folder[];
  subscribeRequestFolderMirror(
    folderUid: string,
    listener: RequestFolderMirrorListener,
  ): () => void;
  subscribeAny(listener: RequestFolderMirrorListener): () => void;
  dispose(): void;
}

export interface CreateRequestFolderSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createRequestFolderSyncMirror(
  options: CreateRequestFolderSyncMirrorOptions = {},
): RequestFolderSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, RequestFolderMirrorEntry>();
  const perUidListeners = new Map<string, Set<RequestFolderMirrorListener>>();
  const anyListeners = new Set<RequestFolderMirrorListener>();
  const seenSinceMount = new Set<string>();

  const handleEnvelope = (envelope: MutationEnvelope, folder: V5.Folder | null): void => {
    if (envelope.body.type !== REQUEST_FOLDER_ENTITY_TYPE) return;
    const folderUid = envelope.body.id;
    seenSinceMount.add(folderUid);
    if (!folder) {
      if (entries.delete(folderUid)) notify(perUidListeners, anyListeners, folderUid);
      return;
    }
    entries.set(folderUid, { folder });
    notify(perUidListeners, anyListeners, folderUid);
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, requestFolderPostState } = event;
    handleEnvelope(envelope, requestFolderPostState?.folder ?? null);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotRequestFolders')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.folder.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { folder: entry.folder });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('RequestFolderSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getRequestFolderMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listRequestFolders() {
      return Array.from(entries.values())
        .map((e) => e.folder)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeRequestFolderMirror(uid, listener) {
      let bucket = perUidListeners.get(uid);
      if (!bucket) {
        bucket = new Set();
        perUidListeners.set(uid, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = perUidListeners.get(uid);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) perUidListeners.delete(uid);
      };
    },
    subscribeAny(listener) {
      anyListeners.add(listener);
      return () => {
        anyListeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      entries.clear();
      perUidListeners.clear();
      anyListeners.clear();
    },
  };
}

function notify(
  perUid: Map<string, Set<RequestFolderMirrorListener>>,
  any: Set<RequestFolderMirrorListener>,
  folderUid: string,
): void {
  const bucket = perUid.get(folderUid);
  if (bucket) {
    for (const l of bucket) {
      try {
        l(folderUid);
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  }
  for (const l of any) {
    try {
      l(folderUid);
    } catch {
      // Same.
    }
  }
}

// ── Module-level singleton ───────────────────────────────────────────

let active: RequestFolderSyncMirror | null = null;

export function getActiveRequestFolderSyncMirror(): RequestFolderSyncMirror {
  if (!active) active = createRequestFolderSyncMirror();
  return active;
}

export function disposeActiveRequestFolderSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
