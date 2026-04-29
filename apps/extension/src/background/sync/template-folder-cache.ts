/**
 * Template-folder cache + persistence sink.
 *
 * Mirrors {@link request-folder-cache.ts}. Subscribes to the oracle's
 * broadcast bus and re-projects the full folder list whenever an
 * envelope can change either:
 *
 *   1. Folder data — `body.type === TEMPLATE_FOLDER_ENTITY_TYPE`.
 *   2. Parent linkage — any envelope whose body targets the
 *      `TEMPLATE_FOLDER_CHILDREN_PATH` set on either a
 *      template-collection or another template-folder.
 *
 * Cache reads cross template-collection + template-folder state, but
 * never reads from the template-collection cache directly — the oracle
 * holds both in one document store, so `materializeOne` /
 * `liveSetItems` against the shared oracle is the only cross-entity
 * read primitive needed.
 *
 * Hydration: `seedFromPersistedTemplateFolders(folders, collections)`
 * accepts the legacy flat snapshot and emits one
 * `createTemplateFolder` batch per folder — that mints both the folder
 * entity and the parent slot in one atomic batch.
 */

import {
  newBatchId,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { logger } from '@utils/logger';
import { extensionStorage, type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildCreateTemplateFolderBatch } from '@/shared/sync/template-folder-mutations';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityOracle } from './oracle';
import { projectAllTemplateFolders } from './template-folder-post-state';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateFolderCacheListener = () => void;

export interface TemplateFolderCache {
  readonly workspaceId: string;
  /** Snapshot of the cached template folders in stable (uid) order. */
  getTemplateFolders(): V5.Folder[];
  /** Replace the cache from the legacy persisted folder + collection
   *  snapshot and seed the oracle. */
  seedFromPersistedTemplateFolders(
    folders: PersistedLocalFolder[],
    collections: V5.Collection[],
  ): Promise<void>;
  onChange(listener: TemplateFolderCacheListener): () => void;
  dispose(): void;
}

export function createTemplateFolderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateFolderCache {
  let folders: V5.Folder[] = [];
  const listeners = new Set<TemplateFolderCacheListener>();

  const refreshFromOracle = (): void => {
    const next = projectAllTemplateFolders(oracle);
    folders = next;
    void persist(workspaceId, next);
    for (const l of listeners) {
      try {
        l();
      } catch (err) {
        logger.info('TemplateFolderCache', 'listener threw:', (err as Error).message);
      }
    }
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!affectsFolders(event)) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getTemplateFolders: () => folders,

    async seedFromPersistedTemplateFolders(
      persistedFolders: PersistedLocalFolder[],
      collections: V5.Collection[],
    ): Promise<void> {
      const ordered = sortByDepth(persistedFolders);
      const parentByPath = buildParentLookup(collections, persistedFolders);

      const batchId = `boot-template-folders-${newBatchId()}`;
      for (const folder of ordered) {
        const parentPath = parentPathOf(folder.path);
        const parent = parentPath ? parentByPath.get(parentPath) : undefined;
        if (!parent) {
          logger.info(
            'TemplateFolderCache',
            `seed: skipping folder ${folder.uid} — parent for path ${folder.path} not resolvable`,
          );
          continue;
        }
        const segment = lastSegmentOf(folder.path);
        const ctx = { ...contextFactory(), batchId };
        const intent = buildCreateTemplateFolderBatch(
          {
            folderUid: folder.uid,
            parent,
            name: folder.name,
            ...(segment ? { pathSegment: segment } : {}),
          },
          ctx,
        );
        const result = await oracle.apply(intent.batch, intent.sideEffects);
        if (!result.ok) {
          logger.info(
            'TemplateFolderCache',
            `seed: folder ${folder.uid} failed (${result.failure?.status} — ${result.failure?.detail ?? 'no detail'})`,
          );
        }
      }
      refreshFromOracle();
      logger.info(
        'TemplateFolderCache',
        `Seeded ${persistedFolders.length} template folders for ws=${workspaceId}`,
      );
    },

    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      unsubscribe();
      listeners.clear();
    },
  };
}

// ── module-level singleton glue ───────────────────────────────────

let active: TemplateFolderCache | null = null;

export function setActiveTemplateFolderCache(cache: TemplateFolderCache | null): void {
  active = cache;
}

export function getActiveTemplateFolderCache(): TemplateFolderCache | null {
  return active;
}

// ── helpers ───────────────────────────────────────────────────────

function affectsFolders(event: BroadcastEvent): boolean {
  const body = event.envelope.body;
  if (body.type === TEMPLATE_FOLDER_ENTITY_TYPE) return true;
  if (
    body.type === TEMPLATE_COLLECTION_ENTITY_TYPE ||
    body.type === TEMPLATE_FOLDER_ENTITY_TYPE
  ) {
    if ('path' in body && body.path === TEMPLATE_FOLDER_CHILDREN_PATH) return true;
  }
  return false;
}

async function persist(workspaceId: string, folders: V5.Folder[]): Promise<void> {
  try {
    const persisted: PersistedLocalFolder[] = folders.map((f) => ({
      schemaVersion: f.schemaVersion,
      uid: f.uid,
      path: f.path,
      name: f.name,
    }));
    await extensionStorage.set(wsKeys(workspaceId).templateFolders, persisted);
  } catch (err) {
    logger.info(
      'TemplateFolderCache',
      `persist failed (ws=${workspaceId}):`,
      (err as Error).message,
    );
  }
}

function buildParentLookup(
  collections: readonly V5.Collection[],
  folders: readonly PersistedLocalFolder[],
): Map<string, TemplateFolderParentRef> {
  const out = new Map<string, TemplateFolderParentRef>();
  for (const collection of collections) {
    out.set(collection.path, { type: TEMPLATE_COLLECTION_ENTITY_TYPE, uid: collection.uid });
  }
  for (const folder of folders) {
    out.set(folder.path, { type: TEMPLATE_FOLDER_ENTITY_TYPE, uid: folder.uid });
  }
  return out;
}

function sortByDepth(folders: readonly PersistedLocalFolder[]): PersistedLocalFolder[] {
  const depth = (f: PersistedLocalFolder): number => f.path.split('/').length;
  return [...folders].sort((a, b) => depth(a) - depth(b));
}

function parentPathOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx <= 0) return null;
  return path.slice(0, idx);
}

function lastSegmentOf(path: string): string | null {
  const idx = path.lastIndexOf('/');
  if (idx < 0) return path || null;
  const tail = path.slice(idx + 1);
  return tail.length > 0 ? tail : null;
}
