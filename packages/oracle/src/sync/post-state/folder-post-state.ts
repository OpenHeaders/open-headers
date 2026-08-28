/**
 * Per-envelope folder post-state projection (Phase B Folder).
 *
 * Thin adapter over `folder-tree-post-state.ts` — supplies the
 * collection/folder entity-type pair + projector functions for the
 * "rules collection" tree. Same shape as `request-folder-post-state` /
 * `template-folder-post-state`.
 */

import type { SyncFolderPostState } from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import { projectCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { projectFolder } from '@openheaders/core/sync-builders/projections/folder-projection';
import type { Folder } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import {
  type FolderTreeKinds,
  projectAllFoldersGeneric,
  projectFolderByUidGeneric,
  projectFolderPostStateGeneric,
} from './folder-tree-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

/** The rules tree — shared by the folder, rule and collection projections. */
export const RULE_TREE: FolderTreeKinds<typeof COLLECTION_ENTITY_TYPE, typeof FOLDER_ENTITY_TYPE> = {
  collectionType: COLLECTION_ENTITY_TYPE,
  folderType: FOLDER_ENTITY_TYPE,
  childrenPath: FOLDER_CHILDREN_PATH,
  itemsPath: FOLDER_ITEMS_PATH,
  projectCollection,
  projectFolder,
};

export function projectFolderPostState(oracle: Reads, envelope: MutationEnvelope): SyncFolderPostState | null {
  return projectFolderPostStateGeneric(oracle, envelope, RULE_TREE);
}

export function projectFolderByUid(oracle: Reads, folderUid: string): SyncFolderPostState | null {
  return projectFolderByUidGeneric(oracle, folderUid, RULE_TREE);
}

export function projectAllFolders(oracle: Reads): Folder[] {
  return projectAllFoldersGeneric(oracle, RULE_TREE);
}
