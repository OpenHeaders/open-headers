import { DeleteOutlined, EditOutlined, FolderOpenOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import type { useVariableResolver } from '@hooks/useVariableResolver';
import type { V5 } from '@openheaders/core/types';
import { isRequestComplete, isRequestResolvable } from '@openheaders/core/utils';
import { createElement, useCallback, useMemo } from 'react';
import type { WorkbenchTab } from '../../types';
import { composeBadge, iconEl, methodTag } from './icons';
import type { TreeNode } from './types';

interface UseRequestTreeNodesParams {
  requestCollectionTrees: readonly { uid: string; name: string; path: string; tree: V5.TreeNode[] }[];
  requestCollections: readonly { uid: string; path: string }[];
  allRequests: readonly V5.Request[];
  resolver: ReturnType<typeof useVariableResolver>;
  dirtyRequestUids?: ReadonlySet<string>;
  draftsByLocationRequest: Map<string, WorkbenchTab[]>;
  buildRequestDraftNode: (tab: WorkbenchTab, depth: number, parentId: string) => TreeNode;
  expandedKeys: ReadonlySet<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (key: string) => void;
  setRenamingId: (id: string | null) => void;
  filterText: string;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  updateRequestData: (uid: string, patch: Partial<V5.Request>) => Promise<unknown> | unknown;
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
}

export function useRequestTreeNodes(p: UseRequestTreeNodesParams): TreeNode[] {
  const lowerFilter = p.filterText.toLowerCase();

  const walkRequestTree = useCallback(
    (v5Nodes: V5.TreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];
      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `req-folder-${node.uid}`;
          const isExpanded = p.expandedKeys.has(fid);
          const onAddFolder = () => {
            void p.createRequestFolderRpc('New Folder', node.path).then((f) => {
              if (f) {
                p.setExpandedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(fid);
                  return next;
                });
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
            onOpen: () => p.toggleExpand(fid),
            onRename: async (name: string) => {
              void p.renameRequestFolderRpc(node.uid, name);
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteRequestFolderRpc(node.uid);
              }),
            addMenuItems: [
              {
                key: 'add-request',
                icon: createElement(PlusOutlined),
                label: 'Add Request',
                onClick: onAddRequest,
              },
              {
                key: 'add-folder',
                icon: createElement(FolderOutlined),
                label: 'Add Folder',
                onClick: onAddFolder,
              },
              { type: 'divider' as const, key: 'div' },
              {
                key: 'rename',
                icon: createElement(EditOutlined),
                label: 'Rename',
                onClick: () => p.setRenamingId(fid),
              },
              {
                key: 'delete',
                icon: createElement(DeleteOutlined),
                label: 'Delete',
                danger: true,
                onClick: () =>
                  p.confirmDelete(node.name, () => {
                    void p.deleteRequestFolderRpc(node.uid);
                  }),
              },
            ],
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
          const badge = composeBadge(textBadge, p.dirtyRequestUids?.has(node.uid) ?? false);
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
      p.draftsByLocationRequest,
      p.buildRequestDraftNode,
      p.setExpandedKeys,
      p.setRenamingId,
    ],
  );

  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const collection of p.requestCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        const hasMatch = collection.tree.some(
          (n) => n.type === 'request' && n.name.toLowerCase().includes(lowerFilter),
        );
        if (!hasMatch) continue;
      }

      const colId = `req-col-${collection.uid}`;
      const isExpanded = p.expandedKeys.has(colId);
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
        onOpen: () => p.toggleExpand(colId),
        onRename: async (name) => {
          void p.renameRequestCollectionRpc(collection.uid, name);
        },
        onDelete: () =>
          p.confirmDelete(collection.name, () => {
            void p.deleteRequestCollectionRpc(collection.uid);
          }),
        addMenuItems: [
          {
            key: 'add-request',
            icon: createElement(PlusOutlined),
            label: 'Add Request',
            onClick: onAddRequest,
          },
          {
            key: 'add-folder',
            icon: createElement(FolderOutlined),
            label: 'Add Folder',
            onClick: onAddFolder,
          },
          { type: 'divider' as const, key: 'div' },
          {
            key: 'rename',
            icon: createElement(EditOutlined),
            label: 'Rename',
            onClick: () => p.setRenamingId(colId),
          },
          {
            key: 'delete',
            icon: createElement(DeleteOutlined),
            label: 'Delete',
            danger: true,
            onClick: () =>
              p.confirmDelete(collection.name, () => {
                void p.deleteRequestCollectionRpc(collection.uid);
              }),
          },
        ],
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
  ]);
}
