/**
 * Template-folder cache + persistence sink. Thin adapter over
 * `folder-tree-cache.ts` for the template-collection folder tree.
 */

import {
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import type { Collection, Folder } from '@openheaders/core/types';
import { type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildCreateTemplateFolderBatch } from '@/shared/sync/template-folder-mutations';
import type { InMemoryBroadcast } from './broadcast';
import { createFolderTreeCache, type FolderTreeCacheConfig } from './folder-tree-cache';
import type { EntityOracle } from './oracle';
import type { SwMutatorContextFactory } from './sw-context';
import { projectAllTemplateFolders } from './template-folder-post-state';

export type TemplateFolderCacheListener = () => void;

export interface TemplateFolderCache {
  readonly workspaceId: string;
  getTemplateFolders(): Folder[];
  seedFromPersistedTemplateFolders(folders: PersistedLocalFolder[], collections: Collection[]): Promise<void>;
  hydrateFromStorage(): Promise<void>;
  onChange(listener: TemplateFolderCacheListener): () => void;
  dispose(): void;
}

const KINDS: FolderTreeCacheConfig<TemplateFolderParentRef> = {
  collectionType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  folderType: TEMPLATE_FOLDER_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  loggerTag: 'TemplateFolderCache',
  storageKey: (ws) => wsKeys(ws).templateFolders,
  collectionStorageKey: (ws) => wsKeys(ws).templateCollections,
  hydrationBatchPrefix: 'boot-template-folders',
  projectAllFolders: projectAllTemplateFolders,
  buildCreateBatch: buildCreateTemplateFolderBatch,
  parentFor: (type, uid) => ({ type, uid }) as TemplateFolderParentRef,
};

export function createTemplateFolderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TemplateFolderCache {
  const core = createFolderTreeCache(workspaceId, oracle, broadcast, contextFactory, KINDS);
  return {
    workspaceId: core.workspaceId,
    getTemplateFolders: core.getFolders,
    seedFromPersistedTemplateFolders: core.seedFromPersisted,
    hydrateFromStorage: core.hydrateFromStorage,
    onChange: core.onChange,
    dispose: core.dispose,
  };
}
