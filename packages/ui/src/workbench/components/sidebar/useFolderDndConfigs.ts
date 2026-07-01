/**
 * useFolderDndConfigs — one `FolderDndConfig` per sidebar folder tree
 * (rules / requests / templates).
 *
 * The three trees share an identical dnd shape and vary only along
 * five axes: the id prefixes, the two entity-type discriminators
 * (folded into `toParentRef`), the parent-mirror pair consulted for
 * live sibling order, and the entity-specific move mutator.
 * `buildFolderDndConfig` captures the shared structure; one descriptor
 * per tree supplies the varying pieces.
 *
 * Owns the three folder-move mutator hooks — nothing else in the
 * sidebar consumes them, so they live here beside the configs they
 * bind.
 */

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_ENTITY_TYPE,
  type FolderParentRef,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  type RequestFolderParentRef,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  type TemplateFolderParentRef,
} from '@openheaders/core/sync';
import { getCollectionSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getFolderSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getRequestCollectionSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getRequestFolderSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getTemplateCollectionSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { getTemplateFolderSyncMirrorForWorkspace } from '@openheaders/ui/context';
import { useFolderMutator } from '@openheaders/ui/shared/hooks/useFolderMutator';
import { useRequestFolderMutator } from '@openheaders/ui/shared/hooks/useRequestFolderMutator';
import { useTemplateFolderMutator } from '@openheaders/ui/shared/hooks/useTemplateFolderMutator';
import { useMemo } from 'react';
import type { FolderDndConfig, FolderDndParent } from './FolderDndTree';

/** Live parent-mirror lookup: given a workspace, exposes the ordered
 *  child-folder slots under a parent. Both the collection-level and
 *  folder-level sync mirrors satisfy this shape. */
type FolderSiblingMirrorGetter = (workspaceId: string) => {
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
};

interface FolderDndTreeDescriptor<TParentRef> {
  collectionIdPrefix: string;
  folderIdPrefix: string;
  /** Parent mirror consulted when the drop parent is a collection. */
  collectionMirror: FolderSiblingMirrorGetter;
  /** Parent mirror consulted when the drop parent is a folder. */
  folderMirror: FolderSiblingMirrorGetter;
  /** Map a generic drop-parent to this tree's typed parent-ref. */
  toParentRef: (parent: FolderDndParent) => TParentRef;
  /** Fire the entity-specific move mutator. */
  move: (input: { folderUid: string; newParent: TParentRef; orderKey: string; oldParent?: TParentRef }) => void;
}

function buildFolderDndConfig<TParentRef>(
  descriptor: FolderDndTreeDescriptor<TParentRef>,
  activeWorkspaceId: string | null,
): FolderDndConfig {
  return {
    collectionIdPrefix: descriptor.collectionIdPrefix,
    folderIdPrefix: descriptor.folderIdPrefix,
    lookupSiblings: (parent) => {
      if (!activeWorkspaceId) return [];
      const mirror =
        parent.kind === 'collection'
          ? descriptor.collectionMirror(activeWorkspaceId)
          : descriptor.folderMirror(activeWorkspaceId);
      return mirror.liveOrderedSetItems(parent.uid, 'folders');
    },
    moveFolder: ({ folderUid, parent, orderKey, oldParent }) => {
      descriptor.move({
        folderUid,
        newParent: descriptor.toParentRef(parent),
        orderKey,
        ...(oldParent ? { oldParent: descriptor.toParentRef(oldParent) } : {}),
      });
    },
  };
}

export interface UseFolderDndConfigsParams {
  activeWorkspaceId: string | null;
}

export interface FolderDndConfigs {
  rulesFolderDndConfig: FolderDndConfig;
  requestFolderDndConfig: FolderDndConfig;
  templateFolderDndConfig: FolderDndConfig;
}

/**
 * Build the three folder-reorder dnd configs (rules / requests /
 * templates). Each memoizes on its own move mutator + the active
 * workspace, matching the pre-extraction per-config dependency sets.
 */
export function useFolderDndConfigs({ activeWorkspaceId }: UseFolderDndConfigsParams): FolderDndConfigs {
  const { moveFolder: moveRulesFolder } = useFolderMutator({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
  });
  const { moveRequestFolder } = useRequestFolderMutator({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
  });
  const { moveTemplateFolder } = useTemplateFolderMutator({
    workspaceId: activeWorkspaceId,
    surfaceId: 'workbench',
  });

  const rulesFolderDndConfig = useMemo(
    () =>
      buildFolderDndConfig<FolderParentRef>(
        {
          collectionIdPrefix: 'col-',
          folderIdPrefix: 'folder-',
          collectionMirror: getCollectionSyncMirrorForWorkspace,
          folderMirror: getFolderSyncMirrorForWorkspace,
          toParentRef: (parent) => ({
            type: parent.kind === 'collection' ? COLLECTION_ENTITY_TYPE : FOLDER_ENTITY_TYPE,
            uid: parent.uid,
          }),
          move: moveRulesFolder,
        },
        activeWorkspaceId,
      ),
    [moveRulesFolder, activeWorkspaceId],
  );

  const requestFolderDndConfig = useMemo(
    () =>
      buildFolderDndConfig<RequestFolderParentRef>(
        {
          collectionIdPrefix: 'req-col-',
          folderIdPrefix: 'req-folder-',
          collectionMirror: getRequestCollectionSyncMirrorForWorkspace,
          folderMirror: getRequestFolderSyncMirrorForWorkspace,
          toParentRef: (parent) => ({
            type: parent.kind === 'collection' ? REQUEST_COLLECTION_ENTITY_TYPE : REQUEST_FOLDER_ENTITY_TYPE,
            uid: parent.uid,
          }),
          move: moveRequestFolder,
        },
        activeWorkspaceId,
      ),
    [moveRequestFolder, activeWorkspaceId],
  );

  const templateFolderDndConfig = useMemo(
    () =>
      buildFolderDndConfig<TemplateFolderParentRef>(
        {
          collectionIdPrefix: 'tpl-col-',
          folderIdPrefix: 'tpl-folder-',
          collectionMirror: getTemplateCollectionSyncMirrorForWorkspace,
          folderMirror: getTemplateFolderSyncMirrorForWorkspace,
          toParentRef: (parent) => ({
            type: parent.kind === 'collection' ? TEMPLATE_COLLECTION_ENTITY_TYPE : TEMPLATE_FOLDER_ENTITY_TYPE,
            uid: parent.uid,
          }),
          move: moveTemplateFolder,
        },
        activeWorkspaceId,
      ),
    [moveTemplateFolder, activeWorkspaceId],
  );

  return { rulesFolderDndConfig, requestFolderDndConfig, templateFolderDndConfig };
}
