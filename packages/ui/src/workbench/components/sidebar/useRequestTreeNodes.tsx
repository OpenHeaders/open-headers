import { FolderOpenOutlined, FolderOutlined, PlusOutlined } from '@ant-design/icons';
import type { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import {
  GRPC_REQUEST_ENTITY_TYPE,
  GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ENTITY_TYPE,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type {
  GrpcRequest,
  GrpcResponseExample,
  Request,
  ResponseExample,
  TreeNode as CoreTreeNode,
  WebSocketRequest,
} from '@openheaders/core/types';
import { isRequestComplete, isRequestResolvable } from '@openheaders/core/utils';
import { useCallback, useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { WorkbenchTab } from '../../types';
import { exportNodeFields } from './export-fields';
import { composeBadge, exampleTag, grpcTag, iconEl, methodTag, websocketTag } from './icons';
import { containerActionMenuItems, containerAddMenuItems } from './menus';
import type { TreeNode } from './types';
import type { SidebarExportEntity } from '../workspace-export/build-export-scope';

interface UseRequestTreeNodesParams {
  requestCollectionTrees: readonly { uid: string; name: string; path: string; tree: CoreTreeNode[] }[];
  requestCollections: readonly { uid: string; path: string }[];
  allRequests: readonly Request[];
  allGrpcRequests: readonly GrpcRequest[];
  allWebSocketRequests: readonly WebSocketRequest[];
  resolver: ReturnType<typeof useVariableResolver>;
  dirtyRequestUids?: ReadonlySet<string>;
  /** Post-import: imported request uids whose scripts the user hasn't
   *  reviewed in the inspector yet. Surfaces as a "scripts" badge that
   *  clears on first inspector open. */
  scriptsReviewPendingUids?: ReadonlySet<string>;
  /** Saved response examples grouped by parent request uid, capture order. */
  responseExamplesByRequest: ReadonlyMap<string, ResponseExample[]>;
  renameResponseExample: (uid: string, name: string) => Promise<unknown> | unknown;
  duplicateResponseExample: (uid: string) => Promise<unknown> | unknown;
  deleteResponseExample: (uid: string) => Promise<unknown> | unknown;
  /** Saved gRPC examples grouped by parent gRPC request uid, capture order. */
  grpcResponseExamplesByRequest: ReadonlyMap<string, GrpcResponseExample[]>;
  renameGrpcResponseExample: (uid: string, name: string) => Promise<unknown> | unknown;
  duplicateGrpcResponseExample: (uid: string) => Promise<unknown> | unknown;
  deleteGrpcResponseExample: (uid: string) => Promise<unknown> | unknown;
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
  updateGrpcRequestData: (uid: string, patch: Partial<GrpcRequest>) => Promise<unknown> | unknown;
  deleteGrpcRequest: (uid: string) => Promise<unknown> | unknown;
  updateWebSocketRequestData: (uid: string, patch: Partial<WebSocketRequest>) => Promise<unknown> | unknown;
  deleteWebSocketRequest: (uid: string) => Promise<unknown> | unknown;
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
  onSelectGrpcRequest?: (uid: string, name: string, autoRename?: boolean) => void;
  onCreateGrpcRequest?: (context: { collectionId?: string; folderPath?: string }) => void;
  onSelectWebSocketRequest?: (uid: string, name: string, flavor?: 'raw' | 'socketio', autoRename?: boolean) => void;
  /** Context-create with the pre-set flavor — the creation menu's two
   *  entries (WebSocket / Socket.IO) both land here. */
  onCreateWebSocketRequest?: (context: {
    collectionId?: string;
    folderPath?: string;
    flavor: 'raw' | 'socketio';
  }) => void;
  /** Open a saved response example in its read-only viewer tab. */
  onSelectResponseExample?: (uid: string, name: string, requestUid: string) => void;
  /** Open a saved gRPC response example in its viewer tab. */
  onSelectGrpcResponseExample?: (uid: string, name: string, grpcRequestUid: string) => void;
  onExportEntity?: (entity: SidebarExportEntity) => void;
  /** Open the request-collection variables editor tab. */
  onOpenCollectionVariables?: (uid: string, name: string) => void;
  /** Open the request-collection overview tab (matches the rule-collection
   *  precedent: clicking the collection row opens its overview). */
  onOpenRequestCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open the request-folder overview tab (matches the rule-folder + template-
   *  folder precedent: clicking a folder row both expands the tree node AND
   *  opens its overview tab). */
  onOpenRequestFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** "Create Workflow…" on a container's `⋯` — opens the request picker
   *  that seeds a Live Workflow draft from the container's subtree. */
  onCreateWorkflowFromContainer?: (target: { name: string; tree: CoreTreeNode[] }) => void;
}

export function useRequestTreeNodes(p: UseRequestTreeNodesParams): TreeNode[] {
  const t = useT();
  const lowerFilter = p.filterText.toLowerCase();

  const walkRequestTree = useCallback(
    (v5Nodes: CoreTreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];
      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `req-folder-${node.uid}`;
          const isExpanded = p.expandedKeys.has(fid) || lowerFilter !== '';
          const onAddFolder = () => {
            void p.createRequestFolderRpc(t('workbench.sidebar.defaults.newFolder'), node.path).then((f) => {
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
          const onAddGrpcRequest = () => {
            p.setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(fid);
              return next;
            });
            p.onCreateGrpcRequest?.({ collectionId, folderPath: node.path });
          };
          const onAddWebSocketRequest = (flavor: 'raw' | 'socketio') => {
            p.setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(fid);
              return next;
            });
            p.onCreateWebSocketRequest?.({ collectionId, folderPath: node.path, flavor });
          };
          // Post-import ancestor-script review badge — same treatment
          // as request rows: warning chip until the user opens the
          // folder's Scripts editor.
          const folderScriptsPending = p.scriptsReviewPendingUids?.has(node.uid) ?? false;
          items.push({
            id: fid,
            kind: 'folder',
            label: node.name,
            depth,
            expandable: true,
            parentId,
            icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
            ...(folderScriptsPending
              ? {
                  badge: composeBadge(
                    null,
                    false,
                    [
                      {
                        label: t('workbench.sidebar.badge.scripts'),
                        color: 'var(--ant-color-warning, #faad14)',
                        title: t('workbench.sidebar.badge.scriptsTooltip'),
                      },
                    ],
                    t,
                  ),
                }
              : {}),
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
            addMenuItems: containerAddMenuItems(
              {
                onAddRequest,
                ...(p.onCreateGrpcRequest ? { onAddGrpcRequest } : {}),
                ...(p.onCreateWebSocketRequest
                  ? {
                      onAddWebSocketRequest: () => onAddWebSocketRequest('raw'),
                      onAddSocketIoRequest: () => onAddWebSocketRequest('socketio'),
                    }
                  : {}),
                onAddFolder,
              },
              t,
            ),
            actionMenuItems: containerActionMenuItems(
              {
                onRename: () => p.setRenamingId(fid),
                onDelete: () =>
                  p.confirmDelete(node.name, () => {
                    void p.deleteRequestFolderRpc(node.uid);
                  }),
                kind: 'folder',
                ...(p.onExportEntity
                  ? { onExport: () => p.onExportEntity?.({ kind: 'folder', uid: node.uid, name: node.name }) }
                  : {}),
                ...(p.onCreateWorkflowFromContainer
                  ? {
                      onCreateWorkflow: () =>
                        p.onCreateWorkflowFromContainer?.({ name: node.name, tree: node.children }),
                    }
                  : {}),
              },
              t,
            ),
            ...exportNodeFields({ kind: 'folder', uid: node.uid, name: node.name }, p.onExportEntity),
            awareness: { entityType: REQUEST_FOLDER_ENTITY_TYPE, entityId: node.uid },
          });
          if (isExpanded) {
            const children = walkRequestTree(node.children, depth + 1, fid, collectionId);
            const folderDrafts = p.draftsByLocationRequest.get(`${collectionId}|${node.path}`) ?? [];
            const folderDraftNodes = folderDrafts.map((d) => p.buildRequestDraftNode(d, depth + 1, fid));
            items.push(...children, ...folderDraftNodes);
          }
        } else if (node.type === 'grpc-request') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const gid = `grpc-request-${node.uid}`;
          const fullGrpc = p.allGrpcRequests.find((r) => r.uid === node.uid);
          // A gRPC request is complete once it has a target and a
          // picked rpc — until then it renders as a draft, mirroring
          // the HTTP request's completeness treatment.
          const grpcComplete = !fullGrpc || (fullGrpc.url.trim().length > 0 && fullGrpc.method !== undefined);
          const grpcBadge = composeBadge(
            grpcComplete ? null : { label: t('workbench.sidebar.badge.draft'), color: 'var(--ant-color-text-tertiary, #999)' },
            p.dirtyRequestUids?.has(node.uid) ?? false,
            undefined,
            t,
          );
          const grpcExamples = p.grpcResponseExamplesByRequest.get(node.uid) ?? [];
          const hasGrpcExamples = grpcExamples.length > 0;
          items.push({
            id: gid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: hasGrpcExamples,
            parentId,
            icon: grpcTag(!grpcComplete),
            badge: grpcBadge,
            canRename: true,
            canDelete: true,
            canAddChild: false,
            // Same idiom as request rows: opening also toggles the
            // example children when the request has any.
            onOpen: () => {
              if (hasGrpcExamples) p.toggleExpand(gid);
              p.onSelectGrpcRequest?.(node.uid, node.name);
            },
            onRename: async (name: string) => {
              void p.updateGrpcRequestData(node.uid, { name });
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteGrpcRequest(node.uid);
              }),
            awareness: { entityType: GRPC_REQUEST_ENTITY_TYPE, entityId: node.uid },
          });
          if (hasGrpcExamples && (p.expandedKeys.has(gid) || lowerFilter !== '')) {
            for (const example of grpcExamples) {
              items.push({
                id: `grpc-example-${example.uid}`,
                kind: 'leaf',
                label: example.name,
                depth: depth + 1,
                expandable: false,
                parentId: gid,
                icon: exampleTag(),
                canRename: true,
                canDelete: true,
                canAddChild: false,
                onOpen: () => {
                  p.onSelectGrpcResponseExample?.(example.uid, example.name, example.grpcRequestUid);
                },
                onRename: async (name: string) => {
                  void p.renameGrpcResponseExample(example.uid, name);
                },
                onDuplicate: () => {
                  void p.duplicateGrpcResponseExample(example.uid);
                },
                onDelete: () =>
                  p.confirmDelete(example.name, () => {
                    void p.deleteGrpcResponseExample(example.uid);
                  }),
                awareness: { entityType: GRPC_RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: example.uid },
              });
            }
          }
        } else if (node.type === 'websocket-request') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const wid = `websocket-request-${node.uid}`;
          const fullWs = p.allWebSocketRequests.find((r) => r.uid === node.uid);
          // A WebSocket request is complete once it has a target URL —
          // until then it renders as a draft, mirroring the sibling
          // request kinds' completeness treatment.
          const wsComplete = !fullWs || fullWs.url.trim().length > 0;
          const wsBadge = composeBadge(
            wsComplete ? null : { label: t('workbench.sidebar.badge.draft'), color: 'var(--ant-color-text-tertiary, #999)' },
            p.dirtyRequestUids?.has(node.uid) ?? false,
            undefined,
            t,
          );
          items.push({
            id: wid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon: websocketTag(node.flavor, !wsComplete),
            badge: wsBadge,
            canRename: true,
            canDelete: true,
            canAddChild: false,
            onOpen: () => {
              p.onSelectWebSocketRequest?.(node.uid, node.name, node.flavor);
            },
            onRename: async (name: string) => {
              void p.updateWebSocketRequestData(node.uid, { name });
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteWebSocketRequest(node.uid);
              }),
            awareness: { entityType: WEBSOCKET_REQUEST_ENTITY_TYPE, entityId: node.uid },
          });
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
            ? { label: t('workbench.sidebar.badge.draft'), color: 'var(--ant-color-text-tertiary, #999)' }
            : !requestResolvable
              ? { label: t('workbench.sidebar.badge.unresolved'), color: 'var(--ant-color-error, #ff4d4f)' }
              : null;
          const hasScripts =
            !!fullRequest &&
            ((fullRequest.preRequestScript && fullRequest.preRequestScript.length > 0) ||
              (fullRequest.postResponseScript && fullRequest.postResponseScript.length > 0));
          const scriptsPending = hasScripts && (p.scriptsReviewPendingUids?.has(node.uid) ?? false);
          const extras = scriptsPending
            ? [
                {
                  label: t('workbench.sidebar.badge.scripts'),
                  color: 'var(--ant-color-warning, #faad14)',
                  title: t('workbench.sidebar.badge.scriptsTooltip'),
                },
              ]
            : undefined;
          const badge = composeBadge(textBadge, p.dirtyRequestUids?.has(node.uid) ?? false, extras, t);
          const examples = p.responseExamplesByRequest.get(node.uid) ?? [];
          const hasExamples = examples.length > 0;
          items.push({
            id: rid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: hasExamples,
            parentId,
            icon: methodTag(node.method, !complete || !requestResolvable),
            badge,
            canRename: true,
            canDelete: true,
            canAddChild: false,
            // Same idiom as folder rows: opening also toggles the
            // example children when the request has any.
            onOpen: () => {
              if (hasExamples) p.toggleExpand(rid);
              p.onSelectRequest?.(node.uid, node.name, node.method);
            },
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
          if (hasExamples && (p.expandedKeys.has(rid) || lowerFilter !== '')) {
            for (const example of examples) {
              items.push({
                id: `resp-example-${example.uid}`,
                kind: 'leaf',
                label: example.name,
                depth: depth + 1,
                expandable: false,
                parentId: rid,
                icon: exampleTag(),
                canRename: true,
                canDelete: true,
                canAddChild: false,
                onOpen: () => {
                  p.onSelectResponseExample?.(example.uid, example.name, example.requestUid);
                },
                onRename: async (name: string) => {
                  void p.renameResponseExample(example.uid, name);
                },
                onDuplicate: () => {
                  void p.duplicateResponseExample(example.uid);
                },
                onDelete: () =>
                  p.confirmDelete(example.name, () => {
                    void p.deleteResponseExample(example.uid);
                  }),
                awareness: { entityType: RESPONSE_EXAMPLE_ENTITY_TYPE, entityId: example.uid },
              });
            }
          }
        }
      }
      return items;
    },
    [
      p.allRequests,
      p.allGrpcRequests,
      p.allWebSocketRequests,
      p.updateGrpcRequestData,
      p.deleteGrpcRequest,
      p.onSelectGrpcRequest,
      p.onCreateGrpcRequest,
      p.updateWebSocketRequestData,
      p.deleteWebSocketRequest,
      p.onSelectWebSocketRequest,
      p.onCreateWebSocketRequest,
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
      p.onSelectResponseExample,
      p.onSelectGrpcResponseExample,
      p.dirtyRequestUids,
      p.scriptsReviewPendingUids,
      p.responseExamplesByRequest,
      p.renameResponseExample,
      p.duplicateResponseExample,
      p.deleteResponseExample,
      p.grpcResponseExamplesByRequest,
      p.renameGrpcResponseExample,
      p.duplicateGrpcResponseExample,
      p.deleteGrpcResponseExample,
      p.draftsByLocationRequest,
      p.buildRequestDraftNode,
      p.setExpandedKeys,
      p.setRenamingId,
      p.onExportEntity,
      p.onOpenRequestFolderOverview,
      p.onCreateWorkflowFromContainer,
      t,
    ],
  );

  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    const hasRequestMatch = (nodes: CoreTreeNode[]): boolean => {
      for (const n of nodes) {
        if (
          (n.type === 'request' || n.type === 'grpc-request' || n.type === 'websocket-request') &&
          n.name.toLowerCase().includes(lowerFilter)
        )
          return true;
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
      const onAddGrpcRequest = () => {
        p.setExpandedKeys((prev) => {
          const next = new Set(prev);
          next.add(colId);
          return next;
        });
        p.onCreateGrpcRequest?.({ collectionId: collection.uid });
      };
      const onAddWebSocketRequest = (flavor: 'raw' | 'socketio') => {
        p.setExpandedKeys((prev) => {
          const next = new Set(prev);
          next.add(colId);
          return next;
        });
        p.onCreateWebSocketRequest?.({ collectionId: collection.uid, flavor });
      };
      const onAddFolder = () => {
        void p.createRequestFolderRpc(t('workbench.sidebar.defaults.newFolder'), collection.path).then((f) => {
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

      // Post-import ancestor-script review badge — same treatment as
      // request rows: warning chip until the user opens the
      // collection's Scripts editor.
      const collectionScriptsPending = p.scriptsReviewPendingUids?.has(collection.uid) ?? false;
      items.push({
        id: colId,
        kind: 'group',
        label: collection.name,
        depth: 0,
        expandable: true,
        icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
        ...(collectionScriptsPending
          ? {
              badge: composeBadge(
                null,
                false,
                [
                  {
                    label: t('workbench.sidebar.badge.scripts'),
                    color: 'var(--ant-color-warning, #faad14)',
                    title: t('workbench.sidebar.badge.scriptsTooltip'),
                  },
                ],
                t,
              ),
            }
          : {}),
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
        addMenuItems: containerAddMenuItems(
          {
            onAddRequest,
            ...(p.onCreateGrpcRequest ? { onAddGrpcRequest } : {}),
            ...(p.onCreateWebSocketRequest
              ? {
                  onAddWebSocketRequest: () => onAddWebSocketRequest('raw'),
                  onAddSocketIoRequest: () => onAddWebSocketRequest('socketio'),
                }
              : {}),
            onAddFolder,
          },
          t,
        ),
        actionMenuItems: containerActionMenuItems(
          {
            onRename: () => p.setRenamingId(colId),
            onDelete: () =>
              p.confirmDelete(collection.name, () => {
                void p.deleteRequestCollectionRpc(collection.uid);
              }),
            kind: 'collection',
            ...(p.onExportEntity
              ? {
                  onExport: () =>
                    p.onExportEntity?.({ kind: 'collection', uid: collection.uid, name: collection.name }),
                }
              : {}),
            ...(p.onOpenCollectionVariables
              ? { onOpenVariables: () => p.onOpenCollectionVariables?.(collection.uid, collection.name) }
              : {}),
            ...(p.onCreateWorkflowFromContainer
              ? {
                  onCreateWorkflow: () =>
                    p.onCreateWorkflowFromContainer?.({ name: collection.name, tree: collection.tree }),
                }
              : {}),
          },
          t,
        ),
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
            placeholderTitle: t('workbench.sidebar.placeholder.requestsEmptyTitle'),
            placeholderMessage: t('workbench.sidebar.placeholder.addRequestOrFolder'),
            placeholderActions: [
              {
                label: t('workbench.sidebar.placeholder.addRequest'),
                icon: iconEl(PlusOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: onAddRequest,
              },
              {
                label: t('workbench.sidebar.placeholder.addFolder'),
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
    p.onCreateGrpcRequest,
    p.draftsByLocationRequest,
    p.buildRequestDraftNode,
    p.setExpandedKeys,
    p.setRenamingId,
    p.onExportEntity,
    p.onOpenCollectionVariables,
    p.onOpenRequestCollectionOverview,
    p.onOpenRequestFolderOverview,
    p.onCreateWorkflowFromContainer,
    t,
  ]);
}
