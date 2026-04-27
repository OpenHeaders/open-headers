import { FileTextOutlined, FolderOpenOutlined, FolderOutlined } from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { createElement, useCallback, useMemo } from 'react';
import { TEMPLATES_BY_TYPE } from '../../rule-templates';
import { renderTwoToneIcon } from '../TwoToneIconPicker';
import { iconEl } from './icons';
import { DEFAULT_TEMPLATE_COLLECTION, templateCollectionMenuItems, templateFolderMenuItems } from './menus';
import type { TreeNode } from './types';

const RULE_TYPE_LABEL: Record<string, string> = {
  header: 'Header',
  block: 'Block',
  redirect: 'Redirect',
  'query-param': 'Query Param',
  inject: 'Inject',
  delay: 'Delay',
  body: 'API Request Body',
  mock: 'API Response',
};

interface UseTemplateTreeNodesParams {
  templateCollectionTrees: readonly { uid: string; name: string; path: string; tree: V5.TreeNode[] }[];
  expandedKeys: ReadonlySet<string>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleExpand: (key: string) => void;
  setRenamingId: (id: string | null) => void;
  filterText: string;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  createTemplateFolder: (
    name: string,
    parentPath: string,
  ) => Promise<{ uid: string; path: string; name: string } | null>;
  renameTemplateFolder: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteTemplateFolder: (uid: string) => Promise<unknown> | unknown;
  renameTemplateCollection: (uid: string, name: string) => Promise<unknown> | unknown;
  deleteTemplateCollection: (uid: string) => Promise<unknown> | unknown;
  updateTemplate: (uid: string, patch: Partial<V5.Template>) => Promise<unknown> | unknown;
  deleteTemplate: (uid: string) => Promise<unknown> | unknown;
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }, templateKey?: string) => void;
  onSelectTemplate?: (uid: string) => void;
  onOpenTemplateCollectionOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onOpenTemplateFolderOverview?: (uid: string, name: string, autoRename?: boolean) => void;
  onExportEntity?: (entity: import('../../App').SidebarExportEntity) => void;
}

export function useTemplateTreeNodes(p: UseTemplateTreeNodesParams): {
  systemTemplateNodes: TreeNode[];
  templateNodes: TreeNode[];
} {
  const lowerFilter = p.filterText.toLowerCase();

  const walkTemplateTree = useCallback(
    (v5Nodes: V5.TreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];

      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `tpl-folder-${node.uid}`;
          const isExpanded = p.expandedKeys.has(fid);
          const onAddFolder = () => {
            void p.createTemplateFolder('New Folder', node.path).then((f) => {
              if (f) {
                p.setExpandedKeys((prev) => {
                  const next = new Set(prev);
                  next.add(fid);
                  return next;
                });
                p.onOpenTemplateFolderOverview?.(f.uid, f.name, true);
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
            icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
            canRename: true,
            canDelete: true,
            canAddChild: true,
            onOpen: () => {
              p.toggleExpand(fid);
              p.onOpenTemplateFolderOverview?.(node.uid, node.name);
            },
            onRename: async (name: string) => {
              void p.renameTemplateFolder(node.uid, name);
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteTemplateFolder(node.uid);
              }),
            addMenuItems: templateFolderMenuItems(
              onAddFolder,
              () => p.setRenamingId(fid),
              () =>
                p.confirmDelete(node.name, () => {
                  void p.deleteTemplateFolder(node.uid);
                }),
              p.onExportEntity ? () => p.onExportEntity?.({ kind: 'folder', uid: node.uid, name: node.name }) : undefined,
            ),
          });
          if (isExpanded) {
            const children = walkTemplateTree(node.children, depth + 1, fid, collectionId);
            if (children.length > 0) {
              items.push(...children);
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
                placeholderMessage: 'Save a rule as template to populate.',
              });
            }
          }
        } else if (node.type === 'template') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const tid = `tpl-${node.uid}`;
          const tplNode = node as V5.TemplateNode;

          items.push({
            id: tid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon:
              renderTwoToneIcon(tplNode.icon, { fontSize: 12 }) ||
              iconEl(FileTextOutlined, 'var(--ant-color-text-tertiary, #999)'),
            canRename: true,
            canDelete: true,
            canAddChild: false,
            onOpen: () => p.onSelectTemplate?.(node.uid),
            onRename: async (name: string) => {
              void p.updateTemplate(node.uid, { name });
            },
            onDelete: () =>
              p.confirmDelete(node.name, () => {
                void p.deleteTemplate(node.uid);
              }),
            ...(p.onExportEntity
              ? { onExport: () => p.onExportEntity?.({ kind: 'template', uid: node.uid, name: node.name }) }
              : {}),
          });
        }
      }

      return items;
    },
    [
      p.expandedKeys,
      lowerFilter,
      p.toggleExpand,
      p.createTemplateFolder,
      p.renameTemplateFolder,
      p.deleteTemplateFolder,
      p.updateTemplate,
      p.deleteTemplate,
      p.confirmDelete,
      p.onSelectTemplate,
      p.onOpenTemplateFolderOverview,
      p.setExpandedKeys,
      p.setRenamingId,
      p.onExportEntity,
    ],
  );

  const systemTemplateNodes = useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];
    const colId = 'sys-tpl-col';
    const isExpanded = p.expandedKeys.has(colId);

    items.push({
      id: colId,
      kind: 'group',
      label: 'System Templates',
      depth: 0,
      expandable: true,
      icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
      canRename: false,
      canDelete: false,
      canAddChild: false,
      onOpen: () => p.toggleExpand(colId),
    });

    if (isExpanded) {
      for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
        if (tpls.length === 0) continue;
        const filteredTpls = lowerFilter ? tpls.filter((t) => t.name.toLowerCase().includes(lowerFilter)) : tpls;
        if (lowerFilter && filteredTpls.length === 0) continue;

        const folderId = `sys-tpl-${ruleType}`;
        const folderExpanded = p.expandedKeys.has(folderId);

        items.push({
          id: folderId,
          kind: 'folder',
          label: RULE_TYPE_LABEL[ruleType] ?? ruleType,
          depth: 1,
          expandable: true,
          parentId: colId,
          icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
          canRename: false,
          canDelete: false,
          canAddChild: false,
          onOpen: () => p.toggleExpand(folderId),
        });

        if (folderExpanded) {
          for (const tpl of filteredTpls) {
            items.push({
              id: `sys-tpl-item-${tpl.key}`,
              kind: 'leaf',
              label: tpl.name,
              depth: 2,
              expandable: false,
              parentId: folderId,
              icon: createElement('span', { style: { fontSize: 12 } }, tpl.icon),
              canRename: false,
              canDelete: false,
              canAddChild: false,
              onOpen: () => p.onCreateRule(ruleType, undefined, tpl.key),
            });
          }
        }
      }
    }

    return items;
  }, [p.expandedKeys, lowerFilter, p.toggleExpand, p.onCreateRule]);

  const templateNodes = useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const collection of p.templateCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        const hasMatch = collection.tree.some(
          (n) => n.type === 'template' && n.name.toLowerCase().includes(lowerFilter),
        );
        if (!hasMatch) continue;
      }

      const colId = `tpl-col-${collection.uid}`;
      const isExpanded = p.expandedKeys.has(colId);
      const isDefault = collection.name === DEFAULT_TEMPLATE_COLLECTION;
      const onAddFolder = () => {
        void p.createTemplateFolder('New Folder', collection.path).then((f) => {
          if (f) {
            p.setExpandedKeys((prev) => {
              const next = new Set(prev);
              next.add(colId);
              return next;
            });
            p.onOpenTemplateFolderOverview?.(f.uid, f.name, true);
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
        canRename: !isDefault,
        canDelete: !isDefault,
        canAddChild: true,
        onOpen: () => {
          p.toggleExpand(colId);
          p.onOpenTemplateCollectionOverview?.(collection.uid, collection.name);
        },
        onRename: !isDefault
          ? async (name) => {
              void p.renameTemplateCollection(collection.uid, name);
            }
          : undefined,
        onDelete: !isDefault
          ? () =>
              p.confirmDelete(collection.name, () => {
                void p.deleteTemplateCollection(collection.uid);
              })
          : undefined,
        addMenuItems: templateCollectionMenuItems(
          onAddFolder,
          () => p.setRenamingId(colId),
          () =>
            p.confirmDelete(collection.name, () => {
              void p.deleteTemplateCollection(collection.uid);
            }),
          isDefault,
          p.onExportEntity
            ? () => p.onExportEntity?.({ kind: 'collection', uid: collection.uid, name: collection.name })
            : undefined,
        ),
      });

      if (isExpanded) {
        const children = walkTemplateTree(collection.tree, 1, colId, collection.uid);
        if (children.length > 0) {
          items.push(...children);
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
            placeholderTitle: 'No templates yet',
            placeholderMessage: 'Save a rule as template from the editor.',
          });
        }
      }
    }

    return items;
  }, [
    p.templateCollectionTrees,
    lowerFilter,
    p.expandedKeys,
    p.toggleExpand,
    walkTemplateTree,
    p.renameTemplateCollection,
    p.deleteTemplateCollection,
    p.createTemplateFolder,
    p.confirmDelete,
    p.onOpenTemplateCollectionOverview,
    p.onOpenTemplateFolderOverview,
    p.setExpandedKeys,
    p.setRenamingId,
    p.onExportEntity,
  ]);

  return { systemTemplateNodes, templateNodes };
}
