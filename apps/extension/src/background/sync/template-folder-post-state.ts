/**
 * Per-envelope template-folder post-state projection.
 *
 * Thin adapter over `folder-tree-post-state.ts`.
 */

import type { SyncTemplateFolderPostState } from '@openheaders/core/protocol';
import {
  type MutationEnvelope,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Folder } from '@openheaders/core/types';
import { projectTemplateCollection } from '@/shared/sync/template-collection-projection';
import { projectTemplateFolder } from '@/shared/sync/template-folder-projection';
import {
  type FolderTreeKinds,
  projectAllFoldersGeneric,
  projectFolderByUidGeneric,
  projectFolderPostStateGeneric,
} from './folder-tree-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems'>;

const KINDS: FolderTreeKinds<typeof TEMPLATE_COLLECTION_ENTITY_TYPE, typeof TEMPLATE_FOLDER_ENTITY_TYPE> = {
  collectionType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  folderType: TEMPLATE_FOLDER_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  projectCollection: projectTemplateCollection,
  projectFolder: projectTemplateFolder,
};

export function projectTemplateFolderPostState(
  oracle: Reads,
  envelope: MutationEnvelope,
): SyncTemplateFolderPostState | null {
  return projectFolderPostStateGeneric(oracle, envelope, KINDS);
}

export function projectTemplateFolderByUid(oracle: Reads, folderUid: string): SyncTemplateFolderPostState | null {
  return projectFolderByUidGeneric(oracle, folderUid, KINDS);
}

export function projectAllTemplateFolders(oracle: Reads): Folder[] {
  return projectAllFoldersGeneric(oracle, KINDS);
}
