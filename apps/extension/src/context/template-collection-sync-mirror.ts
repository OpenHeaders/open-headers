/**
 * Renderer-side template-collection sync mirror.
 *
 * Thin adapter over {@link createFlatEntityMirror}. Each entry carries
 * the materialized `V5.Collection`, the live `varUids` (set-member
 * identity for template-collection vars), and the parent-owned `folders`
 * set order keys.
 */

import { TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { call } from '@utils/bridge';
import {
  createFlatEntityMirror,
  type CreateFlatMirrorOptions,
} from './flat-entity-mirror';
import { createWorkspaceMirrorRegistry } from './per-workspace-mirror-registry';

export interface TemplateCollectionMirrorEntry {
  collection: V5.Collection;
  /** Live variable uids — set-member identity for template-collection vars. */
  varUids: string[];
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
  hydrated: Promise<void>;
  dispose(): void;
}

export type CreateTemplateCollectionSyncMirrorOptions = CreateFlatMirrorOptions;

export function createTemplateCollectionSyncMirror(
  workspaceId: string,
  options: CreateTemplateCollectionSyncMirrorOptions = {},
): TemplateCollectionSyncMirror {
  const core = createFlatEntityMirror<TemplateCollectionMirrorEntry>(
    {
      loggerTag: 'TemplateCollectionSyncMirror',
      workspaceId,
      extractFromBroadcast: (event) => {
        const { envelope, templateCollectionPostState } = event;
        if (envelope.body.type !== TEMPLATE_COLLECTION_ENTITY_TYPE) return null;
        const uid = envelope.body.id;
        if (!templateCollectionPostState) return { uid, entry: null };
        return {
          uid,
          entry: {
            collection: templateCollectionPostState.collection,
            varUids: templateCollectionPostState.varUids,
            setOrderKeys: templateCollectionPostState.setOrderKeys,
          },
        };
      },
      fetchSnapshot: async () => {
        const resp = await call('oh.sync.snapshotTemplateCollections', { workspaceId });
        return resp.entries.map((e) => ({
          uid: e.collection.uid,
          entry: { collection: e.collection, varUids: e.varUids, setOrderKeys: e.setOrderKeys },
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

const templateCollectionSyncMirrorRegistry = createWorkspaceMirrorRegistry<TemplateCollectionSyncMirror>(
  (workspaceId) => createTemplateCollectionSyncMirror(workspaceId),
);

export function getTemplateCollectionSyncMirrorForWorkspace(workspaceId: string): TemplateCollectionSyncMirror {
  return templateCollectionSyncMirrorRegistry.getOrCreate(workspaceId);
}

export function disposeTemplateCollectionSyncMirrorForWorkspace(workspaceId: string): void {
  templateCollectionSyncMirrorRegistry.dispose(workspaceId);
}

export function disposeAllTemplateCollectionSyncMirrors(): void {
  templateCollectionSyncMirrorRegistry.disposeAll();
}
