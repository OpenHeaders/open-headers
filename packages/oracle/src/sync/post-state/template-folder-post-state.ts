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
  TEMPLATE_FOLDER_ITEMS_PATH,
} from '@openheaders/core/sync';
import { projectTemplateCollection } from '@openheaders/core/sync-builders/projections/template-collection-projection';
import { projectTemplateFolder } from '@openheaders/core/sync-builders/projections/template-folder-projection';
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

/** The templates tree — shared by the folder, template and collection projections. */
export const TEMPLATE_TREE: FolderTreeKinds<
  typeof TEMPLATE_COLLECTION_ENTITY_TYPE,
  typeof TEMPLATE_FOLDER_ENTITY_TYPE
> = {
  collectionType: TEMPLATE_COLLECTION_ENTITY_TYPE,
  folderType: TEMPLATE_FOLDER_ENTITY_TYPE,
  childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
  itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
  projectCollection: projectTemplateCollection,
  projectFolder: projectTemplateFolder,
};

export function projectTemplateFolderPostState(
  oracle: Reads,
  envelope: MutationEnvelope,
): SyncTemplateFolderPostState | null {
  return projectFolderPostStateGeneric(oracle, envelope, TEMPLATE_TREE);
}

export function projectTemplateFolderByUid(oracle: Reads, folderUid: string): SyncTemplateFolderPostState | null {
  return projectFolderByUidGeneric(oracle, folderUid, TEMPLATE_TREE);
}

export function projectAllTemplateFolders(oracle: Reads): Folder[] {
  return projectAllFoldersGeneric(oracle, TEMPLATE_TREE);
}
