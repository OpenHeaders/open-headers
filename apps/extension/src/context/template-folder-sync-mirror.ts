/**
 * Renderer-side template-folder sync mirror (Phase B).
 *
 * Mirrors `request-folder-sync-mirror.ts` but routed through the
 * template-folder entity type.
 */

import { type MutationEnvelope, TEMPLATE_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

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

export interface CreateTemplateFolderSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createTemplateFolderSyncMirror(
  options: CreateTemplateFolderSyncMirrorOptions = {},
): TemplateFolderSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, TemplateFolderMirrorEntry>();
  const perUidListeners = new Map<string, Set<TemplateFolderMirrorListener>>();
  const anyListeners = new Set<TemplateFolderMirrorListener>();
  const seenSinceMount = new Set<string>();

  const handleEnvelope = (envelope: MutationEnvelope, folder: V5.Folder | null): void => {
    if (envelope.body.type !== TEMPLATE_FOLDER_ENTITY_TYPE) return;
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
    const { envelope, templateFolderPostState } = event;
    handleEnvelope(envelope, templateFolderPostState?.folder ?? null);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotTemplateFolders')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.folder.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, { folder: entry.folder });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('TemplateFolderSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getTemplateFolderMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listTemplateFolders() {
      return Array.from(entries.values())
        .map((e) => e.folder)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    subscribeTemplateFolderMirror(uid, listener) {
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
  perUid: Map<string, Set<TemplateFolderMirrorListener>>,
  any: Set<TemplateFolderMirrorListener>,
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
