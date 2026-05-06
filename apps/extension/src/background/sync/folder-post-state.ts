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
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { projectCollection } from '@/shared/sync/collection-projection';
import { projectFolder } from '@/shared/sync/folder-projection';
import {
  type FolderTreeKinds,
  projectAllFoldersGeneric,
  projectFolderByUidGeneric,
  projectFolderPostStateGeneric,
} from './folder-tree-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems'>;

const KINDS: FolderTreeKinds<typeof COLLECTION_ENTITY_TYPE, typeof FOLDER_ENTITY_TYPE> = {
  collectionType: COLLECTION_ENTITY_TYPE,
  folderType: FOLDER_ENTITY_TYPE,
  childrenPath: FOLDER_CHILDREN_PATH,
  projectCollection,
  projectFolder,
};

export function projectFolderPostState(oracle: Reads, envelope: MutationEnvelope): SyncFolderPostState | null {
  return projectFolderPostStateGeneric(oracle, envelope, KINDS);
}

export function projectFolderByUid(oracle: Reads, folderUid: string): SyncFolderPostState | null {
  return projectFolderByUidGeneric(oracle, folderUid, KINDS);
}

export function projectAllFolders(oracle: Reads): V5.Folder[] {
  return projectAllFoldersGeneric(oracle, KINDS);
}
