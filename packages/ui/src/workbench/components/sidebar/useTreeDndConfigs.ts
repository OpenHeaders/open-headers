/**
 * useTreeDndConfigs — one `TreeDndConfig` per sidebar tree (rules /
 * requests / templates).
 *
 * The three trees share an identical dnd shape and vary only along
 * the id prefixes and leaf kinds, the two entity-type discriminators
 * (folded into `toParentRef`), the container-mirror pair and roots
 * set consulted for live order, and the folder move mutator.
 * `buildTreeDndConfig` captures the shared structure; one descriptor
 * per tree supplies the varying pieces. Leaf and collection moves go
 * through the one tree-move mutator. A drop's placements apply one by
 * one (each is its own batch — the catalogs' verbs — so a peer sees
 * every row land where it was put); the toast reports how many rows
 * moved, and a failure among them.
 */

import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  type FolderParentRef,
  GRPC_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_ENTITY_TYPE,
  mergeOrderedEntries,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  type RequestFolderParentRef,
  RULE_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ENTITY_TYPE,
  TEMPLATE_FOLDER_ITEMS_PATH,
  type TemplateFolderParentRef,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import {
  getCollectionSyncMirrorForWorkspace,
  getFolderSyncMirrorForWorkspace,
  getRequestCollectionSyncMirrorForWorkspace,
  getRequestFolderSyncMirrorForWorkspace,
  getTemplateCollectionSyncMirrorForWorkspace,
  getTemplateFolderSyncMirrorForWorkspace,
  getWorkspaceRootsSyncMirrorForWorkspace,
} from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useFolderMutator } from '@openheaders/ui/shared/hooks/mutators/useFolderMutator';
import { useRequestFolderMutator } from '@openheaders/ui/shared/hooks/mutators/useRequestFolderMutator';
import { useTemplateFolderMutator } from '@openheaders/ui/shared/hooks/mutators/useTemplateFolderMutator';
import {
  type UseTreeMoveMutatorApi,
  useTreeMoveMutator,
} from '@openheaders/ui/shared/hooks/mutators/useTreeMoveMutator';
import type { TreeId } from '@openheaders/ui/shared/sync/tree-move-write-client';
import { App } from 'antd';
import { useMemo } from 'react';
import type { TreeDndConfig } from './TreeDnd';
import type { TreeDndLeafKind, TreeDndParent } from './tree-dnd-ids';
import type { DropPlacement } from './tree-dnd-placement';

/** Live container-mirror lookup: the ordered slots under a parent, per set (merged by the config). */
type ContainerMirrorGetter = (workspaceId: string) => {
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
};

interface TreeDndDescriptor<TParentRef extends TreeDndParentRef> {
  tree: TreeId;
  collectionIdPrefix: string;
  folderIdPrefix: string;
  leafKinds: ReadonlyArray<TreeDndLeafKind>;
  childrenPath: string;
  itemsPath: string;
  rootsPath: string;
  collectionMirror: ContainerMirrorGetter;
  folderMirror: ContainerMirrorGetter;
  /** Map a generic drop-parent to this tree's typed parent-ref. */
  toParentRef: (parent: TreeDndParent) => TParentRef;
  moveFolder: (input: {
    folderUid: string;
    newParent: TParentRef;
    orderKey: string;
    oldParent?: TParentRef;
  }) => Promise<{ ok: boolean }>;
}

/** Reports the outcome of one drop to the user. */
interface MoveReporter {
  moved(count: number): void;
  failed(): void;
}

type TreeDndParentRef = FolderParentRef | RequestFolderParentRef | TemplateFolderParentRef;

function buildTreeDndConfig<TParentRef extends TreeDndParentRef>(
  descriptor: TreeDndDescriptor<TParentRef>,
  moves: UseTreeMoveMutatorApi,
  report: MoveReporter,
  activeWorkspaceId: string | null,
): TreeDndConfig {
  const apply = (placement: DropPlacement): Promise<{ ok: boolean }> => {
    if (placement.kind === 'folder') {
      return descriptor.moveFolder({
        folderUid: placement.folderUid,
        newParent: descriptor.toParentRef(placement.parent),
        orderKey: placement.orderKey,
        ...(placement.oldParent ? { oldParent: descriptor.toParentRef(placement.oldParent) } : {}),
      });
    }
    if (placement.kind === 'leaf') {
      return moves.moveLeaf({
        entityType: placement.entityType,
        uid: placement.uid,
        newParent: descriptor.toParentRef(placement.parent),
        orderKey: placement.orderKey,
        ...(placement.oldParent ? { oldParent: descriptor.toParentRef(placement.oldParent) } : {}),
      });
    }
    return moves.moveCollection({ tree: descriptor.tree, uid: placement.uid, orderKey: placement.orderKey });
  };
  const run = async (placements: DropPlacement[]): Promise<void> => {
    let moved = 0;
    for (const placement of placements) {
      const result = await apply(placement);
      if (result.ok) moved += 1;
    }
    if (moved === placements.length) report.moved(moved);
    else report.failed();
  };
  const mirrorFor = (parent: TreeDndParent) =>
    parent.kind === 'collection'
      ? descriptor.collectionMirror(activeWorkspaceId ?? '')
      : descriptor.folderMirror(activeWorkspaceId ?? '');
  return {
    collectionIdPrefix: descriptor.collectionIdPrefix,
    folderIdPrefix: descriptor.folderIdPrefix,
    leafKinds: descriptor.leafKinds,
    lookupChildren: (parent) => {
      if (!activeWorkspaceId) return [];
      const mirror = mirrorFor(parent);
      return mergeOrderedEntries(
        mirror.liveOrderedSetItems(parent.uid, descriptor.childrenPath),
        mirror.liveOrderedSetItems(parent.uid, descriptor.itemsPath),
        (slot) => slot.orderKey,
        (slot) => slot.itemId,
      );
    },
    lookupCollections: () =>
      activeWorkspaceId
        ? getWorkspaceRootsSyncMirrorForWorkspace(activeWorkspaceId).liveOrderedSetItems(descriptor.rootsPath)
        : [],
    move: (placements) => {
      if (placements.length > 0) void run(placements);
    },
  };
}

export interface UseTreeDndConfigsParams {
  activeWorkspaceId: string | null;
}

export interface TreeDndConfigs {
  rulesDndConfig: TreeDndConfig;
  requestDndConfig: TreeDndConfig;
  templateDndConfig: TreeDndConfig;
}

const RULE_LEAF_KINDS: ReadonlyArray<TreeDndLeafKind> = [{ idPrefix: 'rule-', entityType: RULE_ENTITY_TYPE }];
const REQUEST_LEAF_KINDS: ReadonlyArray<TreeDndLeafKind> = [
  { idPrefix: 'request-', entityType: REQUEST_ENTITY_TYPE },
  { idPrefix: 'grpc-request-', entityType: GRPC_REQUEST_ENTITY_TYPE },
  { idPrefix: 'websocket-request-', entityType: WEBSOCKET_REQUEST_ENTITY_TYPE },
  { idPrefix: 'mqtt-request-', entityType: MQTT_REQUEST_ENTITY_TYPE },
];
const TEMPLATE_LEAF_KINDS: ReadonlyArray<TreeDndLeafKind> = [{ idPrefix: 'tpl-', entityType: TEMPLATE_ENTITY_TYPE }];

/**
 * Build the three tree dnd configs (rules / requests / templates).
 * Each memoizes on its own mutators + the active workspace.
 */
export function useTreeDndConfigs({ activeWorkspaceId }: UseTreeDndConfigsParams): TreeDndConfigs {
  const { moveFolder: moveRulesFolder } = useFolderMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const { moveRequestFolder } = useRequestFolderMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const { moveTemplateFolder } = useTemplateFolderMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const moves = useTreeMoveMutator({ workspaceId: activeWorkspaceId, surfaceId: 'workbench' });
  const t = useT();
  const { message } = App.useApp();
  const report = useMemo<MoveReporter>(
    () => ({
      moved: (count) => void message.success(t('workbench.sidebar.toast.itemsMoved', { count })),
      failed: () => void message.error(t('workbench.sidebar.toast.moveFailed')),
    }),
    [message, t],
  );

  const rulesDndConfig = useMemo(
    () =>
      buildTreeDndConfig<FolderParentRef>(
        {
          tree: 'rules',
          collectionIdPrefix: 'col-',
          folderIdPrefix: 'folder-',
          leafKinds: RULE_LEAF_KINDS,
          childrenPath: FOLDER_CHILDREN_PATH,
          itemsPath: FOLDER_ITEMS_PATH,
          rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
          collectionMirror: getCollectionSyncMirrorForWorkspace,
          folderMirror: getFolderSyncMirrorForWorkspace,
          toParentRef: (parent) => ({
            type: parent.kind === 'collection' ? COLLECTION_ENTITY_TYPE : FOLDER_ENTITY_TYPE,
            uid: parent.uid,
          }),
          moveFolder: moveRulesFolder,
        },
        moves,
        report,
        activeWorkspaceId,
      ),
    [moveRulesFolder, moves, report, activeWorkspaceId],
  );

  const requestDndConfig = useMemo(
    () =>
      buildTreeDndConfig<RequestFolderParentRef>(
        {
          tree: 'requests',
          collectionIdPrefix: 'req-col-',
          folderIdPrefix: 'req-folder-',
          leafKinds: REQUEST_LEAF_KINDS,
          childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
          itemsPath: REQUEST_FOLDER_ITEMS_PATH,
          rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
          collectionMirror: getRequestCollectionSyncMirrorForWorkspace,
          folderMirror: getRequestFolderSyncMirrorForWorkspace,
          toParentRef: (parent) => ({
            type: parent.kind === 'collection' ? REQUEST_COLLECTION_ENTITY_TYPE : REQUEST_FOLDER_ENTITY_TYPE,
            uid: parent.uid,
          }),
          moveFolder: moveRequestFolder,
        },
        moves,
        report,
        activeWorkspaceId,
      ),
    [moveRequestFolder, moves, report, activeWorkspaceId],
  );

  const templateDndConfig = useMemo(
    () =>
      buildTreeDndConfig<TemplateFolderParentRef>(
        {
          tree: 'templates',
          collectionIdPrefix: 'tpl-col-',
          folderIdPrefix: 'tpl-folder-',
          leafKinds: TEMPLATE_LEAF_KINDS,
          childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
          itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
          rootsPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
          collectionMirror: getTemplateCollectionSyncMirrorForWorkspace,
          folderMirror: getTemplateFolderSyncMirrorForWorkspace,
          toParentRef: (parent) => ({
            type: parent.kind === 'collection' ? TEMPLATE_COLLECTION_ENTITY_TYPE : TEMPLATE_FOLDER_ENTITY_TYPE,
            uid: parent.uid,
          }),
          moveFolder: moveTemplateFolder,
        },
        moves,
        report,
        activeWorkspaceId,
      ),
    [moveTemplateFolder, moves, report, activeWorkspaceId],
  );

  return { rulesDndConfig, requestDndConfig, templateDndConfig };
}
