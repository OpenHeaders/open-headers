/**
 * Renderer-side template sync mirror (Phase B).
 *
 * Mirrors `request-sync-mirror.ts`: subscribes once to the SW's
 * `syncBroadcast` channel and folds every `templatePostState` payload
 * into a `Map<templateUid, { template, setItemIds }>`. Renderer write
 * helpers consult this mirror to:
 *
 *   1. Read the canonical template shape synchronously (§19.4).
 *   2. Enumerate live `itemId`s at the set-modeled `conditions` path.
 *      Set replacement requires these — `buildUpdateBatch` emits
 *      `removeFromSet` per existing itemId and `addToSet` per new
 *      member.
 *
 * On construction the mirror fires `oh.sync.snapshotTemplates` so the
 * starting view is populated before the first broadcast lands; any
 * concurrent broadcast that arrives mid-flight wins.
 */

import { TEMPLATE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call, subscribe } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface TemplateMirrorEntry {
  template: V5.Template;
  /** Map keyed by set path (e.g. `conditions`). */
  setItemIds: Record<string, string[]>;
  /** Per-set ordered `(itemId, orderKey)` pairs for synthesizer-driven writes. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type TemplateMirrorListener = (uid: string) => void;

export interface TemplateSyncMirror {
  getTemplateMirror(uid: string): TemplateMirrorEntry | null;
  listTemplates(): V5.Template[];
  liveSetItems(uid: string, setPath: string): string[];
  /** Live `(itemId, orderKey)` pairs at a set path on the template, in
   *  canonical sort order. Returns `[]` when unknown. The renderer
   *  write-client feeds these into `synthesizeSetDiff` so save-time
   *  gestures emit the minimum envelope set. */
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  subscribeTemplateMirror(uid: string, listener: TemplateMirrorListener): () => void;
  subscribeAny(listener: TemplateMirrorListener): () => void;
  dispose(): void;
}

export interface CreateTemplateSyncMirrorOptions {
  bootstrap?: boolean;
}

export function createTemplateSyncMirror(
  options: CreateTemplateSyncMirrorOptions = {},
): TemplateSyncMirror {
  const { bootstrap = true } = options;
  const entries = new Map<string, TemplateMirrorEntry>();
  const perUidListeners = new Map<string, Set<TemplateMirrorListener>>();
  const anyListeners = new Set<TemplateMirrorListener>();
  const seenSinceMount = new Set<string>();

  const unsubscribe = subscribe('syncBroadcast', (event) => {
    const { envelope, templatePostState } = event;
    const uid = envelope.body.id;
    if (!templatePostState && envelope.body.type !== TEMPLATE_ENTITY_TYPE) return;

    seenSinceMount.add(uid);
    if (!templatePostState) {
      if (entries.delete(uid)) notify(perUidListeners, anyListeners, uid);
      return;
    }
    entries.set(uid, {
      template: templatePostState.template,
      setItemIds: templatePostState.setItemIds,
      setOrderKeys: templatePostState.setOrderKeys,
    });
    notify(perUidListeners, anyListeners, uid);
  });

  if (bootstrap) {
    void call('oh.sync.snapshotTemplates')
      .then((resp) => {
        for (const entry of resp.entries) {
          const uid = entry.template.uid;
          if (seenSinceMount.has(uid)) continue;
          entries.set(uid, {
            template: entry.template,
            setItemIds: entry.setItemIds,
            setOrderKeys: entry.setOrderKeys,
          });
          notify(perUidListeners, anyListeners, uid);
        }
      })
      .catch((err: Error) => {
        logger.info('TemplateSyncMirror', `bootstrap snapshot failed: ${err.message}`);
      });
  }

  return {
    getTemplateMirror(uid) {
      return entries.get(uid) ?? null;
    },
    listTemplates() {
      return Array.from(entries.values())
        .map((e) => e.template)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
    },
    liveSetItems(uid, setPath) {
      const entry = entries.get(uid);
      if (!entry) return [];
      return entry.setItemIds[setPath] ?? [];
    },
    liveOrderedSetItems(uid, setPath) {
      const entry = entries.get(uid);
      if (!entry) return [];
      return entry.setOrderKeys[setPath] ?? [];
    },
    subscribeTemplateMirror(uid, listener) {
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
  perUid: Map<string, Set<TemplateMirrorListener>>,
  any: Set<TemplateMirrorListener>,
  uid: string,
): void {
  const bucket = perUid.get(uid);
  if (bucket) {
    for (const l of bucket) {
      try {
        l(uid);
      } catch {
        // Listener errors must not tear down the broadcast pipe.
      }
    }
  }
  for (const l of any) {
    try {
      l(uid);
    } catch {
      // Same as above.
    }
  }
}

// ── Module-level singleton ───────────────────────────────────────────

let active: TemplateSyncMirror | null = null;

export function getActiveTemplateSyncMirror(): TemplateSyncMirror {
  if (!active) active = createTemplateSyncMirror();
  return active;
}

export function disposeActiveTemplateSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
