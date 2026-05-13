import { FolderOpenOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import type { useVariableResolver } from '@hooks/useVariableResolver';
import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Request, TreeNode as CoreTreeNode } from '@openheaders/core/types';
import { isRequestComplete, isRequestResolvable } from '@openheaders/core/utils';
import { useCallback, useMemo } from 'react';
import type { WorkbenchTab } from '../../types';
import { exportNodeFields } from './export-fields';
import { composeBadge, iconEl, methodTag } from './icons';
import { containerActionMenuItems, containerAddMenuItems } from './menus';
import type { TreeNode } from './types';

interface UseRequestTreeNodesParams {
  requestCollectionTrees: readonly { uid: string; name: string; path: string; tree: CoreTreeNode[] }[];
  requestCollections: readonly { uid: string; path: string }[];
  allRequests: readonly Request[];
  resolver: ReturnType<typeof useVariableResolver>;
  dirtyRequestUids?: ReadonlySet<string>;
  /** Post-import: imported request uids whose scripts the user hasn't
   *  reviewed in the inspector yet. Surfaces as a "scripts" badge that
   *  clears on first inspector open. */
  scriptsReviewPendingUids?: ReadonlySet<string>;
  draftsByLocationRequest: Map<string, WorkbenchTab[]>;
  buildRequestDraftNode: (tab: WorkbenchTab, depth: number, parentId: string) => TreeNode;
  expandedKeys: ReadonlySet<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (key: string) => void;
  setRenamingId: (id: string | null) => void;
  filterText: string;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  updateRequestData: (uid: string, patch: Partial<Request>) => Promise<unknown> | unknown;
  deleteRequest: (uid: string) => Promise<unknown> | unknown;
  createRequestFolderRpc: (
    name: string,
    parentPath: string,
  ) => Promise<{ uid: string; path: string; name: string } | null>;
  renameRequestFolderRpc: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteRequestFolderRpc: (uid: string) => Promise<unknown> | unknown;
  renameRequestCollectionRpc: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteRequestCollectionRpc: (uid: string) => Promise<unknown> | unknown;
  onSelectRequest?: (uid: string, name: string, method?: string, autoRename?: boolean) => void;
  onCreateRequest?: (context?: { collectionId?: string; folderPath?: string }) => void;
  onExportEntity?: (entity: import('../../App').SidebarExportEntity) => void;
  /** Open the request-collection variables editor tab. */
  onOpenCollectionVariables?: (uid: string, name: string) => void;
  /** Open the request-collection overview tab (matches the rule-collection
   *  precedent: clicking the collection row opens its overview). */
  onOpenRequestCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open the request-folder overview tab (matches the rule-folder + template-
   *  folder precedent: clicking a folder row both expands the tree node AND
   *  opens its overview tab). */
  onOpenRequestFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
}

export function useRequestTreeNodes(p: UseRequestTreeNodesParams): TreeNode[] {
  const lowerFilter = p.filterText.toLowerCase();

  const walkRequestTree = useCallback(
    (v5Nodes: CoreTreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];
      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `req-folder-${node.uid}`;
          const isExpanded = p.expandedKeys.has(fid) || lowerFilter !== '';
          const onAddFolder = () => {
            void p.createRequestFolderRpc('New Folder', node.path).then((f) => {
              if (f) {
                p.setExpandedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(fid);
                  return next;
                });
                p.onOpenRequestFolderOverview?.(f.uid, f.name, true);
              }
            });
          };
          const onAddRequest = () => {
            p.setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(fid);
              return next;
            });
            p.onCreateRequest?.({ collectionId, folderPath: node.path });
          };
          items.push({
            id: fid,
            kind: 'folder',
            label: node.name,
            depth,
            expandable: true,
            parentId,
            icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
            canRename: true,
            canDelete: true,
            canAddChild: true,
            onOpen: () => {
              p.toggleExpand(fid);
              p.onOpenRequestFolderOverview?.(node.uid, node.name);
            },
            onRename: async (name: string) => {
              void p.renameRequestFolderRpc(node.uid, name);
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteRequestFolderRpc(node.uid);
              }),
            addMenuItems: containerAddMenuItems({
              onAddRequest,
              onAddFolder,
            }),
            actionMenuItems: containerActionMenuItems({
              onRename: () => p.setRenamingId(fid),
              onDelete: () =>
                p.confirmDelete(node.name, () => {
                  void p.deleteRequestFolderRpc(node.uid);
                }),
              kind: 'folder',
              ...(p.onExportEntity
                ? { onExport: () => p.onExportEntity?.({ kind: 'folder', uid: node.uid, name: node.name }) }
                : {}),
            }),
            ...exportNodeFields({ kind: 'folder', uid: node.uid, name: node.name }, p.onExportEntity),
            awareness: { entityType: REQUEST_FOLDER_ENTITY_TYPE, entityId: node.uid },
          });
          if (isExpanded) {
            const children = walkRequestTree(node.children, depth + 1, fid, collectionId);
            const folderDrafts = p.draftsByLocationRequest.get(`${collectionId}|${node.path}`) ?? [];
            const folderDraftNodes = folderDrafts.map((d) => p.buildRequestDraftNode(d, depth + 1, fid));
            items.push(...children, ...folderDraftNodes);
          }
        } else if (node.type === 'request') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const rid = `request-${node.uid}`;
          const fullRequest = p.allRequests.find((r) => r.uid === node.uid);
          const complete = fullRequest ? isRequestComplete(fullRequest) : true;
          let requestResolvable = true;
          if (fullRequest && complete) {
            const ownerCollection = p.requestCollections.find((c) => fullRequest.path.startsWith(`${c.path}/`));
            const context = ownerCollection ? { collectionId: ownerCollection.uid } : undefined;
            requestResolvable = isRequestResolvable(
              fullRequest,
              (name) => p.resolver.resolve(name, context),
              (name, ns) => p.resolver.resolveScopedWithDiagnostics(name, ns, context),
            );
          }
          const textBadge: { label: string; color: string } | null = !complete
            ? { label: 'draft', color: 'var(--ant-color-text-tertiary, #999)' }
            : !requestResolvable
              ? { label: 'unresolved', color: 'var(--ant-color-error, #ff4d4f)' }
              : null;
          const hasScripts =
            !!fullRequest &&
            ((fullRequest.preRequestScript && fullRequest.preRequestScript.length > 0) ||
              (fullRequest.postResponseScript && fullRequest.postResponseScript.length > 0));
          const scriptsPending = hasScripts && (p.scriptsReviewPendingUids?.has(node.uid) ?? false);
          const extras = scriptsPending
            ? [
                {
                  label: 'scripts',
                  color: 'var(--ant-color-warning, #faad14)',
                  title: 'This imported request will execute JavaScript when run. Open it to review the scripts.',
                },
              ]
            : undefined;
          const badge = composeBadge(textBadge, p.dirtyRequestUids?.has(node.uid) ?? false, extras);
          items.push({
            id: rid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon: methodTag(node.method, !complete || !requestResolvable),
            badge,
            canRename: true,
            canDelete: true,
            canAddChild: false,
            onOpen: () => p.onSelectRequest?.(node.uid, node.name, node.method),
            onRename: async (name: string) => {
              void p.updateRequestData(node.uid, { name });
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteRequest(node.uid);
              }),
            ...exportNodeFields({ kind: 'request', uid: node.uid, name: node.name }, p.onExportEntity),
            awareness: { entityType: REQUEST_ENTITY_TYPE, entityId: node.uid },
          });
        }
      }
      return items;
    },
    [
      p.allRequests,
      p.requestCollections,
      p.resolver,
      p.expandedKeys,
      lowerFilter,
      p.toggleExpand,
      p.updateRequestData,
      p.deleteRequest,
      p.createRequestFolderRpc,
      p.renameRequestFolderRpc,
      p.deleteRequestFolderRpc,
      p.confirmDelete,
      p.onSelectRequest,
      p.onCreateRequest,
      p.dirtyRequestUids,
      p.scriptsReviewPendingUids,
      p.draftsByLocationRequest,
      p.buildRequestDraftNode,
      p.setExpandedKeys,
      p.setRenamingId,
      p.onExportEntity,
      p.onOpenRequestFolderOverview,
    ],
  );

  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    const hasRequestMatch = (nodes: CoreTreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.type === 'request' && n.name.toLowerCase().includes(lowerFilter)) return true;
        if (n.type === 'folder') {
          if (n.name.toLowerCase().includes(lowerFilter)) return true;
          if (hasRequestMatch(n.children)) return true;
        }
      }
      return false;
    };

    for (const collection of p.requestCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        if (!hasRequestMatch(collection.tree)) continue;
      }

      const colId = `req-col-${collection.uid}`;
      const isExpanded = p.expandedKeys.has(colId) || lowerFilter !== '';
      const onAddRequest = () => {
        p.setExpandedKeys((prev) => {
          const next = new Set(prev);
          next.add(colId);
          return next;
        });
        p.onCreateRequest?.({ collectionId: collection.uid });
      };
      const onAddFolder = () => {
        void p.createRequestFolderRpc('New Folder', collection.path).then((f) => {
          if (f) {
            p.setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(colId);
              return next;
            });
            p.onOpenRequestFolderOverview?.(f.uid, f.name, true);
          }
        });
      };

      items.push({
        id: colId,
        kind: 'group',
        label: collection.name,
        depth: 0,
        expandable: true,
        icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
        canRename: true,
        canDelete: true,
        canAddChild: true,
        ...exportNodeFields({ kind: 'collection', uid: collection.uid, name: collection.name }, p.onExportEntity),
        onOpen: () => {
          p.toggleExpand(colId);
          p.onOpenRequestCollectionOverview?.(collection.uid, collection.name);
        },
        onRename: async (name) => {
          void p.renameRequestCollectionRpc(collection.uid, name);
        },
        onDelete: () =>
          p.confirmDelete(collection.name, () => {
            void p.deleteRequestCollectionRpc(collection.uid);
          }),
        addMenuItems: containerAddMenuItems({
          onAddRequest,
          onAddFolder,
        }),
        actionMenuItems: containerActionMenuItems({
          onRename: () => p.setRenamingId(colId),
          onDelete: () =>
            p.confirmDelete(collection.name, () => {
              void p.deleteRequestCollectionRpc(collection.uid);
            }),
          kind: 'collection',
          ...(p.onExportEntity
            ? { onExport: () => p.onExportEntity?.({ kind: 'collection', uid: collection.uid, name: collection.name }) }
            : {}),
          ...(p.onOpenCollectionVariables
            ? { onOpenVariables: () => p.onOpenCollectionVariables?.(collection.uid, collection.name) }
            : {}),
        }),
        awareness: { entityType: REQUEST_COLLECTION_ENTITY_TYPE, entityId: collection.uid },
      });

      if (isExpanded) {
        const children = walkRequestTree(collection.tree, 1, colId, collection.uid);
        const rootDrafts = p.draftsByLocationRequest.get(`${collection.uid}|`) ?? [];
        const rootDraftNodes = rootDrafts.map((d) => p.buildRequestDraftNode(d, 1, colId));
        if (children.length > 0 || rootDraftNodes.length > 0) {
          items.push(...children, ...rootDraftNodes);
        } else {
          items.push({
            id: `${colId}-empty`,
            kind: 'placeholder',
            label: '',
            depth: 1,
            expandable: false,
            icon: null,
            canRename: false,
            canDelete: false,
            canAddChild: false,
            placeholderTitle: 'No requests yet',
            placeholderMessage: 'Add a request or folder to get started.',
            placeholderActions: [
              {
                label: 'Add request',
                icon: iconEl(PlusOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: onAddRequest,
              },
              {
                label: 'Add folder',
                icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: onAddFolder,
              },
            ],
          });
        }
      }
    }

    return items;
  }, [
    p.requestCollectionTrees,
    lowerFilter,
    p.expandedKeys,
    p.toggleExpand,
    walkRequestTree,
    p.createRequestFolderRpc,
    p.renameRequestCollectionRpc,
    p.deleteRequestCollectionRpc,
    p.confirmDelete,
    p.onCreateRequest,
    p.draftsByLocationRequest,
    p.buildRequestDraftNode,
    p.setExpandedKeys,
    p.setRenamingId,
    p.onExportEntity,
    p.onOpenCollectionVariables,
    p.onOpenRequestCollectionOverview,
    p.onOpenRequestFolderOverview,
  ]);
}
