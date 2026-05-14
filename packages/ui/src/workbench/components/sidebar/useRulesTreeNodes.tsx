import { CheckCircleOutlined, FolderOpenOutlined, FolderOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { COLLECTION_ENTITY_TYPE, FOLDER_ENTITY_TYPE, RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule, TreeNode as CoreTreeNode } from '@openheaders/core/types';
import { hasNestedPauseMarkers, isRuleComplete, type PauseMarkers } from '@openheaders/core/utils';
import { useCallback, useMemo } from 'react';
import type { WorkbenchTab } from '../../types';
import { buildRuleIcon } from '../shared/rule-icon';
import { exportNodeFields } from './export-fields';
import { composeBadge, iconEl } from './icons';
import { containerActionMenuItems, containerAddMenuItems } from './menus';
import type { TreeNode } from './types';

interface UseRulesTreeNodesParams {
  rules: readonly Rule[];
  localCollections: readonly { uid: string; path: string }[];
  localCollectionTrees: readonly { uid: string; name: string; path: string; tree: CoreTreeNode[] }[];
  pauseMarkers: PauseMarkers;
  pausedUids: ReadonlySet<string>;
  unresolvableRuleUids: ReadonlySet<string>;
  dirtyRuleUids?: ReadonlySet<string>;
  draftsByLocationRule: Map<string, WorkbenchTab[]>;
  buildRuleDraftNode: (tab: WorkbenchTab, depth: number, parentId: string) => TreeNode;
  expandedKeys: ReadonlySet<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (key: string) => void;
  setRenamingId: (id: string | null) => void;
  filterText: string;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  handleToggleRule: (uid: string, enabled: boolean) => void;
  togglePause: (path: string) => void;
  clearPauseOverride: (path: string) => void;
  clearNestedPauseOverrides: (path: string) => void;
  updateLocalRule: (uid: string, patch: Partial<Rule>) => Promise<unknown> | unknown;
  createLocalFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string; name: string } | null>;
  renameLocalFolder: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteLocalFolder: (uid: string) => Promise<unknown> | unknown;
  renameLocalCollection: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteLocalCollection: (uid: string) => Promise<unknown> | unknown;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  onSelectRule: (uid: string) => void;
  onDeleteRule?: (uid: string) => void;
  /**
   * Open the workspace-export modal scoped to a single sidebar entity.
   * Used by the rule leaf, the collection group, and the folder row.
   * Resolution from `(kind, uid, name)` → `ExportModalScope` lives in
   * `App.tsx`'s `buildEntityExportScope` so this hook stays UI-only.
   */
  onExportEntity?: (entity: import('../../App').SidebarExportEntity) => void;
  onOpenCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  /** Open the rule-collection variables editor tab. */
  onOpenCollectionVariables?: (uid: string, name: string) => void;
}

export function useRulesTreeNodes(p: UseRulesTreeNodesParams): TreeNode[] {
  const lowerFilter = p.filterText.toLowerCase();

  const walkV5Tree = useCallback(
    (v5Nodes: CoreTreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];

      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `folder-${node.uid}`;
          const isExpanded = p.expandedKeys.has(fid) || lowerFilter !== '';
          const folderPaused = p.pausedUids.has(node.uid);
          const folderHasOwnMarker = p.pauseMarkers.has(node.path);
          const folderHasNestedMarkers = hasNestedPauseMarkers(node.path, p.pauseMarkers);
          const onAddRule = (type: string) => p.onCreateRule(type, { collectionId, folderPath: node.path });
          const onAddFolder = () => {
            void p.createLocalFolder('New Folder', node.path).then((f) => {
              if (f) {
                p.setExpandedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(fid);
                  return next;
                });
                p.onOpenFolderOverview?.(f.uid, f.name, true);
              }
            });
          };

          items.push({
            id: fid,
            kind: 'folder',
            label: node.name,
            depth,
            expandable: true,
            parentId,
            icon: iconEl(
              FolderOutlined,
              folderPaused ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-text-tertiary, #999)',
            ),
            canRename: true,
            canDelete: true,
            canAddChild: true,
            ...exportNodeFields({ kind: 'folder', uid: node.uid, name: node.name }, p.onExportEntity),
            onOpen: () => {
              p.toggleExpand(fid);
              p.onOpenFolderOverview?.(node.uid, node.name);
            },
            onRename: async (name: string) => {
              void p.renameLocalFolder(node.uid, name);
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteLocalFolder(node.uid);
              }),
            addMenuItems: containerAddMenuItems({
              onAddRule,
              onAddFolder,
            }),
            actionMenuItems: containerActionMenuItems({
              onRename: () => p.setRenamingId(fid),
              onDelete: () =>
                p.confirmDelete(node.name, () => {
                  void p.deleteLocalFolder(node.uid);
                }),
              effectivelyPaused: folderPaused,
              hasOwnMarker: folderHasOwnMarker,
              hasNestedMarkers: folderHasNestedMarkers,
              onTogglePause: () => p.togglePause(node.path),
              onClearOverride: () => p.clearPauseOverride(node.path),
              onClearNested: () => p.clearNestedPauseOverrides(node.path),
              kind: 'folder',
              ...(p.onExportEntity
                ? { onExport: () => p.onExportEntity?.({ kind: 'folder', uid: node.uid, name: node.name }) }
                : {}),
            }),
            awareness: { entityType: FOLDER_ENTITY_TYPE, entityId: node.uid },
          });
          if (isExpanded) {
            const children = walkV5Tree(node.children, depth + 1, fid, collectionId);
            const folderDrafts = p.draftsByLocationRule.get(`${collectionId}|${node.path}`) ?? [];
            const folderDraftNodes = folderDrafts.map((d) => p.buildRuleDraftNode(d, depth + 1, fid));
            if (children.length > 0 || folderDraftNodes.length > 0) {
              items.push(...children, ...folderDraftNodes);
            } else {
              items.push({
                id: `${fid}-empty`,
                kind: 'placeholder',
                label: '',
                depth: depth + 1,
                expandable: false,
                icon: null,
                canRename: false,
                canDelete: false,
                canAddChild: false,
                placeholderTitle: 'Folder is empty',
                placeholderMessage: 'Add a rule or folder to get started.',
                placeholderActions: [
                  {
                    label: 'Add rule',
                    icon: iconEl(PlusOutlined, 'var(--ant-color-text-tertiary, #999)'),
                    onClick: () => onAddRule('header'),
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
        } else if (node.type === 'rule') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const rid = `rule-${node.uid}`;
          const fullRule = p.rules.find((r) => r.uid === node.uid);
          const complete = fullRule ? isRuleComplete(fullRule) : true;
          const rulePaused = p.pausedUids.has(node.uid);
          const isUnresolved = complete && p.unresolvableRuleUids.has(node.uid);
          const isActive = node.enabled && complete && !rulePaused && !isUnresolved;

          let textBadge: { label: string; color: string } | null = null;
          if (rulePaused) {
            textBadge = { label: 'paused', color: 'var(--ant-color-warning, #faad14)' };
          } else if (!complete) {
            textBadge = { label: 'draft', color: 'var(--ant-color-text-tertiary, #999)' };
          } else if (isUnresolved) {
            textBadge = { label: 'unresolved', color: 'var(--ant-color-error, #ff4d4f)' };
          } else if (!node.enabled) {
            textBadge = { label: 'off', color: 'var(--ant-color-text-tertiary, #999)' };
          }
          const badge = composeBadge(textBadge, p.dirtyRuleUids?.has(node.uid) ?? false);

          items.push({
            id: rid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon: buildRuleIcon({ ruleType: node.ruleType, rule: fullRule, isActive, paused: rulePaused }),
            badge,
            canRename: true,
            canDelete: true,
            canAddChild: false,
            hoverActions: [
              node.enabled
                ? {
                    icon: iconEl(StopOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
                    tooltip: 'Disable rule',
                    onClick: () => p.handleToggleRule(node.uid, false),
                  }
                : {
                    icon: iconEl(CheckCircleOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
                    tooltip: 'Enable rule',
                    onClick: () => p.handleToggleRule(node.uid, true),
                  },
            ],
            onOpen: () => p.onSelectRule(node.uid),
            onRename: fullRule
              ? async (name: string) => {
                  void p.updateLocalRule(node.uid, { name });
                }
              : undefined,
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                p.onDeleteRule?.(node.uid);
              }),
            // Awareness identity for the rule leaf — TreeNodeRow wraps
            // the inline-rename input with `<EntityField path="name">`
            // when present, so renaming a rule from the sidebar
            // publishes presence on the same path the editor / breadcrumb
            // consume. Future entity types populate this in their
            // respective `useXTreeNodes` hooks.
            awareness: { entityType: RULE_ENTITY_TYPE, entityId: node.uid },
            ...exportNodeFields({ kind: 'rule', uid: node.uid, name: node.name }, p.onExportEntity),
          });
        }
      }

      return items;
    },
    [
      p.expandedKeys,
      lowerFilter,
      p.rules,
      p.pauseMarkers,
      p.pausedUids,
      p.togglePause,
      p.clearPauseOverride,
      p.clearNestedPauseOverrides,
      p.toggleExpand,
      p.onCreateRule,
      p.onSelectRule,
      p.onDeleteRule,
      p.onExportEntity,
      p.handleToggleRule,
      p.updateLocalRule,
      p.createLocalFolder,
      p.renameLocalFolder,
      p.deleteLocalFolder,
      p.confirmDelete,
      p.onOpenFolderOverview,
      p.unresolvableRuleUids,
      p.dirtyRuleUids,
      p.draftsByLocationRule,
      p.buildRuleDraftNode,
      p.setExpandedKeys,
      p.setRenamingId,
    ],
  );

  return useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    const hasRuleMatch = (nodes: CoreTreeNode[]): boolean => {
      for (const n of nodes) {
        if (n.type === 'rule' && n.name.toLowerCase().includes(lowerFilter)) return true;
        if (n.type === 'folder') {
          if (n.name.toLowerCase().includes(lowerFilter)) return true;
          if (hasRuleMatch(n.children)) return true;
        }
      }
      return false;
    };

    for (const collection of p.localCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        if (!hasRuleMatch(collection.tree)) continue;
      }

      const colId = `col-${collection.uid}`;
      const isExpanded = p.expandedKeys.has(colId) || lowerFilter !== '';
      const onAddRule = (type: string) => p.onCreateRule(type, { collectionId: collection.uid });
      const onAddFolder = () => {
        void p.createLocalFolder('New Folder', collection.path).then((f) => {
          if (f) {
            p.setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(colId);
              return next;
            });
            p.onOpenFolderOverview?.(f.uid, f.name, true);
          }
        });
      };

      const colPaused = p.pausedUids.has(collection.uid);
      const colHasOwnMarker = p.pauseMarkers.has(collection.path);
      const colHasNestedMarkers = hasNestedPauseMarkers(collection.path, p.pauseMarkers);
      items.push({
        id: colId,
        kind: 'group',
        label: collection.name,
        depth: 0,
        expandable: true,
        icon: iconEl(
          FolderOpenOutlined,
          colPaused ? 'var(--ant-color-warning, #faad14)' : 'var(--ant-color-text-tertiary, #999)',
        ),
        canRename: true,
        canDelete: true,
        canAddChild: true,
        ...exportNodeFields({ kind: 'collection', uid: collection.uid, name: collection.name }, p.onExportEntity),
        onOpen: () => {
          p.toggleExpand(colId);
          p.onOpenCollectionOverview?.(collection.uid, collection.name);
        },
        onRename: async (name) => {
          void p.renameLocalCollection(collection.uid, name);
        },
        onDelete: () =>
          p.confirmDelete(collection.name, () => {
            void p.deleteLocalCollection(collection.uid);
          }),
        addMenuItems: containerAddMenuItems({
          onAddRule,
          onAddFolder,
        }),
        actionMenuItems: containerActionMenuItems({
          onRename: () => p.setRenamingId(colId),
          onDelete: () =>
            p.confirmDelete(collection.name, () => {
              void p.deleteLocalCollection(collection.uid);
            }),
          effectivelyPaused: colPaused,
          hasOwnMarker: colHasOwnMarker,
          hasNestedMarkers: colHasNestedMarkers,
          onTogglePause: () => p.togglePause(collection.path),
          onClearOverride: () => p.clearPauseOverride(collection.path),
          onClearNested: () => p.clearNestedPauseOverrides(collection.path),
          kind: 'collection',
          ...(p.onExportEntity
            ? { onExport: () => p.onExportEntity?.({ kind: 'collection', uid: collection.uid, name: collection.name }) }
            : {}),
          ...(p.onOpenCollectionVariables
            ? { onOpenVariables: () => p.onOpenCollectionVariables?.(collection.uid, collection.name) }
            : {}),
        }),
        awareness: { entityType: COLLECTION_ENTITY_TYPE, entityId: collection.uid },
      });

      if (isExpanded) {
        const children = walkV5Tree(collection.tree, 1, colId, collection.uid);
        const rootDrafts = p.draftsByLocationRule.get(`${collection.uid}|`) ?? [];
        const rootDraftNodes = rootDrafts.map((d) => p.buildRuleDraftNode(d, 1, colId));
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
            placeholderTitle: 'Collection is empty',
            placeholderMessage: 'Add a rule or folder to get started.',
            placeholderActions: [
              {
                label: 'Add rule',
                icon: iconEl(PlusOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: () => onAddRule('header'),
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
    p.localCollectionTrees,
    lowerFilter,
    p.expandedKeys,
    p.pauseMarkers,
    p.pausedUids,
    p.togglePause,
    p.clearPauseOverride,
    p.clearNestedPauseOverrides,
    p.toggleExpand,
    p.onCreateRule,
    walkV5Tree,
    p.renameLocalCollection,
    p.deleteLocalCollection,
    p.createLocalFolder,
    p.confirmDelete,
    p.onOpenCollectionOverview,
    p.onOpenFolderOverview,
    p.draftsByLocationRule,
    p.buildRuleDraftNode,
    p.setExpandedKeys,
    p.setRenamingId,
    p.onExportEntity,
    p.onOpenCollectionVariables,
  ]);
}
