/**
 * Per-envelope request-folder post-state projection.
 *
 * Thin adapter over `folder-tree-post-state.ts`.
 */

import type { SyncRequestFolderPostState } from '@openheaders/core/protocol';
import {
  type MutationEnvelope,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Folder } from '@openheaders/core/types';
import { projectRequestCollection } from '@openheaders/core/sync-builders/request-collection-projection';
import { projectRequestFolder } from '@openheaders/core/sync-builders/request-folder-projection';
import {
  type FolderTreeKinds,
  projectAllFoldersGeneric,
  projectFolderByUidGeneric,
  projectFolderPostStateGeneric,
} from './folder-tree-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems'>;

const KINDS: FolderTreeKinds<typeof REQUEST_COLLECTION_ENTITY_TYPE, typeof REQUEST_FOLDER_ENTITY_TYPE> = {
  collectionType: REQUEST_COLLECTION_ENTITY_TYPE,
  folderType: REQUEST_FOLDER_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
  projectCollection: projectRequestCollection,
  projectFolder: projectRequestFolder,
};

export function projectRequestFolderPostState(
  oracle: Reads,
  envelope: MutationEnvelope,
): SyncRequestFolderPostState | null {
  return projectFolderPostStateGeneric(oracle, envelope, KINDS);
}

export function projectRequestFolderByUid(oracle: Reads, folderUid: string): SyncRequestFolderPostState | null {
  return projectFolderByUidGeneric(oracle, folderUid, KINDS);
}

export function projectAllRequestFolders(oracle: Reads): Folder[] {
  return projectAllFoldersGeneric(oracle, KINDS);
}
