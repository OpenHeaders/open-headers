/**
 * Folder cache + persistence sink (Phase B Folder). Thin adapter over
 * `folder-tree-cache.ts` for the rules-collection folder tree.
 */

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  type FolderParentRef,
} from '@openheaders/core/sync';
import type { Collection, Folder } from '@openheaders/core/types';
import { type PersistedLocalFolder, wsKeys } from '@openheaders/oracle/storage';
import { buildCreateFolderBatch } from '@openheaders/core/sync-builders/mutations/folder-mutations';
import type { InMemoryBroadcast } from './broadcast';
import { projectAllFolders } from './folder-post-state';
import { createFolderTreeCache, type FolderTreeCacheConfig } from './folder-tree-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';

export type FolderCacheListener = () => void;

export interface FolderCache {
  readonly workspaceId: string;
  getFolders(): Folder[];
  seedFromPersistedFolders(folders: PersistedLocalFolder[], collections: Collection[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: FolderCacheListener): () => void;
  dispose(): void;
}

const KINDS: FolderTreeCacheConfig<FolderParentRef> = {
  collectionType: COLLECTION_ENTITY_TYPE,
  folderType: FOLDER_ENTITY_TYPE,
  childrenPath: FOLDER_CHILDREN_PATH,
  loggerTag: 'FolderCache',
  storageKey: (ws) => wsKeys(ws).folders,
  collectionStorageKey: (ws) => wsKeys(ws).collections,
  hydrationBatchPrefix: 'boot-folders',
  projectAllFolders,
  buildCreateBatch: buildCreateFolderBatch,
  parentFor: (type, uid) => ({ type, uid }) as FolderParentRef,
};

export function createFolderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): FolderCache {
  const core = createFolderTreeCache(workspaceId, oracle, broadcast, contextFactory, KINDS);
  return {
    workspaceId: core.workspaceId,
    getFolders: core.getFolders,
    seedFromPersistedFolders: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
