/**
 * Renderer-side folder sync mirror (Phase B).
 *
 * Mirrors `collection-sync-mirror.ts`: subscribes once to the SW's
 * `syncBroadcast` channel and folds every `folderPostState` payload
 * into a `Map<folderUid, { folder }>`. Renderer write helpers + the
 * sidebar tree consume this mirror so they can read post-commit state
 * without round-tripping the SW (§19.4). On construction the mirror
 * fires `oh.sync.snapshotFolders` so it has a starting view before
 * any broadcast lands.
 *
 * The mirror also tracks tombstones — folder envelopes whose
 * `folderPostState` is undefined indicate either a tombstoned folder
 * (delete) or a folder whose parent linkage hasn't resolved yet. The
 * conservative policy is to drop the entry; the next broadcast that
 * does carry post-state restores it.
 */

import { FOLDER_ENTITY_TYPE, type MutationEnvelope } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface FolderMirrorEntry {
  folder: V5.Folder;
}

export type FolderMirrorListener = (folderUid: string) => void;

export interface FolderSyncMirror {
  getFolderMirror(folderUid: string): FolderMirrorEntry | null;
  /** Snapshot of every known folder, in stable uid order. */
  listFolders(): V5.Folder[];
  subscribeFolderMirror(folderUid: string, listener: FolderMirrorListener): () => void;
  /** Subscribe to *any* folder change — the listener receives the
   *  folderUid of the entry that moved. */
  subscribeAny(listener: FolderMirrorListener): () => void;
  dispose(): void;
}

export interface CreateFolderSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createFolderSyncMirror(
  options: CreateFolderSyncMirrorOptions = {},
): FolderSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, FolderMirrorEntry>();
  const perUidListeners = new Map<string, Set<FolderMirrorListener>>();
  const anyListeners = new Set<FolderMirrorListener>();
  const seenSinceMount = new Set<string>();

  const handleEnvelope = (envelope: MutationEnvelope, postState: V5.Folder | null): void => {
    if (envelope.body.type !== FOLDER_ENTITY_TYPE) return;
    const folderUid = envelope.body.id;
    seenSinceMount.add(folderUid);
    if (!postState) {
      if (entries.delete(folderUid)) notify(perUidListeners, anyListeners, folderUid);
      return;
    }
    entries.set(folderUid, { folder: postState });
    notify(perUidListeners, anyListeners, folderUid);
  };

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, folderPostState } = event;
    handleEnvelope(envelope, folderPostState?.folder ?? null);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotFolders')
      .then((resp) => {
        for (const entry of resp.entries) {
          const folderUid = entry.folder.uid;
          if (seenSinceMount.has(folderUid)) continue;
          entries.set(folderUid, { folder: entry.folder });
          notify(perUidListeners, anyListeners, folderUid);
        }
      })
      .catch((err: Error) => {
        logger.info('FolderSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getFolderMirror(folderUid) {
      return entries.get(folderUid) ?? null;
    },
    listFolders() {
      return Array.from(entries.values())
        .map((e) => e.folder)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeFolderMirror(folderUid, listener) {
      let bucket = perUidListeners.get(folderUid);
      if (!bucket) {
        bucket = new Set();
        perUidListeners.set(folderUid, bucket);
      }
      bucket.add(listener);
      return () => {
        const b = perUidListeners.get(folderUid);
        if (!b) return;
        b.delete(listener);
        if (b.size === 0) perUidListeners.delete(folderUid);
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
  perUid: Map<string, Set<FolderMirrorListener>>,
  any: Set<FolderMirrorListener>,
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
      // Same as above.
    }
  }
}

// ── Module-level singleton ───────────────────────────────────────────

let active: FolderSyncMirror | null = null;

export function getActiveFolderSyncMirror(): FolderSyncMirror {
  if (!active) active = createFolderSyncMirror();
  return active;
}

export function disposeActiveFolderSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
