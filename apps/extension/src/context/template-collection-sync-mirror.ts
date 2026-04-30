/**
 * Renderer-side template-collection sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Catalog ships
 * rename-only at v1 — entries carry the materialized `V5.Collection`
 * only.
 */

import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';

export interface TemplateCollectionMirrorEntry {
  collection: V5.Collection;
  /** Per-set ordered `(itemId, orderKey)` pairs. Carries the parent's
   *  `folders` set; read via `liveOrderedSetItems`. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export type TemplateCollectionMirrorListener = (collectionUid: string) => void;

export interface TemplateCollectionSyncMirror {
  getTemplateCollectionMirror(collectionUid: string): TemplateCollectionMirrorEntry | null;
  listTemplateCollections(): V5.Collection[];
  liveOrderedSetItems(
    collectionUid: string,
    setPath: string,
  ): Array<{ itemId: string; orderKey: string }>;
  subscribeTemplateCollectionMirror(
    collectionUid: string,
    listener: TemplateCollectionMirrorListener,
  ): () => void;
  subscribeAny(listener: TemplateCollectionMirrorListener): () => void;
  dispose(): void;
}

export type CreateTemplateCollectionSyncMirrorOptions = CreateFlatMirrorOptions;

export function createTemplateCollectionSyncMirror(
  options: CreateTemplateCollectionSyncMirrorOptions = {},
): TemplateCollectionSyncMirror {
  const core = createFlatEntityMirror<TemplateCollectionMirrorEntry>(
    {
      loggerTag: 'TemplateCollectionSyncMirror',
      extractFromBroadcast: (event) => {
        const { envelope, templateCollectionPostState } = event;
        if (envelope.body.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!templateCollectionPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            collection: templateCollectionPostState.collection,
            setOrderKeys: templateCollectionPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotTemplateCollections');
        return resp.entries.map((e) => ({
          uid: e.collection.uid,
          entry: { collection: e.collection, setOrderKeys: e.setOrderKeys },
        }));
      },
    },
    options,
  );
  return {
    getTemplateCollectionMirror: core.get,
    listTemplateCollections: () =>
      core
        .list()
        .map((e) => e.collection)
        .sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)),
    liveOrderedSetItems: (uid, setPath) => core.get(uid)?.setOrderKeys[setPath] ?? [],
    subscribeTemplateCollectionMirror: core.subscribe,
    subscribeAny: core.subscribeAny,
    dispose: core.dispose,
  };
}

let active: TemplateCollectionSyncMirror | null = null;

export function getActiveTemplateCollectionSyncMirror(): TemplateCollectionSyncMirror {
  if (!active) active = createTemplateCollectionSyncMirror();
  return active;
}

export function disposeActiveTemplateCollectionSyncMirror(): void {
  if (!active) return;
  active.dispose();
  active = null;
}
