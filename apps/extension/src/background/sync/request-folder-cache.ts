/**
 * Request-folder cache + persistence sink. Thin adapter over
 * `folder-tree-cache.ts` for the request-collection folder tree.
 */

import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
} from '@openheaders/core/sync';
import type { Collection, Folder } from '@openheaders/core/types';
import { type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildCreateRequestFolderBatch } from '@/shared/sync/request-folder-mutations';
import type { InMemoryBroadcast } from './broadcast';
import { createFolderTreeCache, type FolderTreeCacheConfig } from './folder-tree-cache';
import type { EntityOracle } from './oracle';
import { projectAllRequestFolders } from './request-folder-post-state';
import type { SwMutatorContextFactory } from './sw-context';

export type RequestFolderCacheListener = () => void;

export interface RequestFolderCache {
  readonly workspaceId: string;
  getRequestFolders(): Folder[];
  seedFromPersistedRequestFolders(folders: PersistedLocalFolder[], collections: Collection[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: RequestFolderCacheListener): () => void;
  dispose(): void;
}

const KINDS: FolderTreeCacheConfig<RequestFolderParentRef> = {
  collectionType: REQUEST_COLLECTION_ENTITY_TYPE,
  folderType: REQUEST_FOLDER_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
  loggerTag: 'RequestFolderCache',
  storageKey: (ws) => wsKeys(ws).requestFolders,
  collectionStorageKey: (ws) => wsKeys(ws).requestCollections,
  hydrationBatchPrefix: 'boot-request-folders',
  projectAllFolders: projectAllRequestFolders,
  buildCreateBatch: buildCreateRequestFolderBatch,
  parentFor: (type, uid) => ({ type, uid }) as RequestFolderParentRef,
};

export function createRequestFolderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): RequestFolderCache {
  const core = createFolderTreeCache(workspaceId, oracle, broadcast, contextFactory, KINDS);
  return {
    workspaceId: core.workspaceId,
    getRequestFolders: core.getFolders,
    seedFromPersistedRequestFolders: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
