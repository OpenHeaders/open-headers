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
import type { V5 } from '@openheaders/core/types';
import { type PersistedLocalFolder, wsKeys } from '@/shared/storage';
import { buildCreateTemplateFolderBatch } from '@/shared/sync/template-folder-mutations';
import type { InMemoryBroadcast } from './broadcast';
import {
  createFolderTreeCache,
  type FolderTreeCacheConfig,
} from './folder-tree-cache';
import type { EntityOracle } from './oracle';
import { projectAllTemplateFolders } from './template-folder-post-state';
import type { SwMutatorContextFactory } from './sw-context';

export type TemplateFolderCacheListener = () => void;

export interface TemplateFolderCache {
  readonly workspaceId: string;
  getTemplateFolders(): V5.Folder[];
  seedFromPersistedTemplateFolders(
    folders: PersistedLocalFolder[],
    collections: V5.Collection[],
  ): Promise<void>;
  onChange(listener: TemplateFolderCacheListener): () => void;
  dispose(): void;
}

const KINDS: FolderTreeCacheConfig<TemplateFolderParentRef> = {
  collectionType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  folderType: TEMPLATE_FOLDER_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  loggerTag: 'TemplateFolderCache',
  storageKey: (ws) => wsKeys(ws).templateFolders,
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
    onChange: core.onChange,
    dispose: core.dispose,
  };
}

let active: TemplateFolderCache | null = null;

export function setActiveTemplateFolderCache(cache: TemplateFolderCache | null): void {
  active = cache;
}

export function getActiveTemplateFolderCache(): TemplateFolderCache | null {
  return active;
}
