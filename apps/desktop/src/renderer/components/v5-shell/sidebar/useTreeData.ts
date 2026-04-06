/**
 * useTreeData — transforms collections, folders, and entities into TreeNode[] per section.
 *
 * Every section follows the same pattern:
 *   Collections (group nodes) → Folders (nested) → Leaf items
 */

import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FolderOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type {
  Collection,
  CollectionSection,
  Environment,
  Folder,
  FolderSection,
  HeaderRule,
  Source,
  SourceUpdate,
} from '@openheaders/core';
import type { MenuItemType } from 'antd/es/menu/interface';
import { createElement } from 'react';
import type { TreeNode } from './types';

// ── Icons ────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

function methodBadge(method?: string): React.ReactNode {
  const m = method || 'GET';
  return createElement(
    'span',
    {
      style: {
        fontSize: 8,
        fontWeight: 700,
        color: 'white',
        background: METHOD_COLORS[m] || '#999',
        padding: '1px 3px',
        borderRadius: 2,
        flexShrink: 0,
      },
    },
    m,
  );
}

function iconEl(Icon: typeof ApiOutlined, color: string, size = 12): React.ReactNode {
  return createElement(Icon, { style: { color, fontSize: size } });
}

// ── Menu items for folders/collections ───────────────────────────

function containerMenuItems(
  section: CollectionSection,
  onAddItem: () => void,
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
  isSubFolder?: boolean,
): MenuItemType[] {
  const itemLabel = section === 'requests' ? 'Add Request' : section === 'rules' ? 'Add Rule' : 'Add Environment';
  const ItemIcon = section === 'requests' ? ApiOutlined : section === 'rules' ? ThunderboltOutlined : GlobalOutlined;
  return [
    { key: 'add-item', icon: createElement(ItemIcon), label: itemLabel, onClick: onAddItem },
    {
      key: 'add-folder',
      icon: createElement(FolderOutlined),
      label: isSubFolder ? 'Add Sub-folder' : 'Add Folder',
      onClick: onAddFolder,
    },
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  ] as MenuItemType[];
}

// ── Props ────────────────────────────────────────────────────────

interface OpenTabRequest {
  id: string;
  type: 'rule' | 'environment' | 'collection' | 'collection-overview' | 'folder' | 'folder-overview';
  label: string;
  icon?: string;
  entityId?: string;
}

export interface UseTreeDataProps {
  collections: Collection[];
  sources: Source[];
  rules: HeaderRule[];
  environments: Environment[];
  activeEnvironment: string | null;
  folders: Folder[];
  expandedKeys: Set<string>;
  filter: string;
  onOpenTab: (tab: OpenTabRequest) => void;
  onToggleExpand: (key: string) => void;
  onStartRename: (id: string) => void;
  onNewRequest: (opts?: { collectionId?: string; folderId?: string }) => void;
  onNewRule: (opts?: { collectionId?: string; folderId?: string }) => void;
  onNewEnvironment: (opts?: { collectionId?: string; folderId?: string }) => void;
  updateSource: (sourceId: string, updates: SourceUpdate) => Promise<Source | null>;
  removeSource: (sourceId: string) => Promise<boolean>;
  updateRule: (ruleId: string, updates: Partial<HeaderRule>) => void;
  removeRule: (ruleId: string) => void;
  updateEnvironment: (environmentId: string, updates: { name?: string }) => Promise<boolean> | void;
  deleteEnvironment: (environmentId: string) => void;
  /** Centralized folder creation — handles expand, open tab, trigger rename */
  createNewFolder: (section: FolderSection, collectionId: string, parentFolderId: string | null) => Promise<void>;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => Promise<boolean>;
  removeCollection: (id: string) => Promise<boolean>;
  confirmDelete: (name: string, onConfirm: () => void) => void;
}

export interface UseTreeDataReturn {
  requestsNodes: TreeNode[];
  rulesNodes: TreeNode[];
  environmentsNodes: TreeNode[];
}

// ── Hook ─────────────────────────────────────────────────────────

export function useTreeData(props: UseTreeDataProps): UseTreeDataReturn {
  const {
    collections,
    sources,
    rules,
    environments,
    activeEnvironment,
    folders,
    expandedKeys,
    filter,
    onOpenTab,
    onToggleExpand,
    onStartRename,
    onNewRequest,
    onNewRule,
    onNewEnvironment,
    updateSource,
    removeSource,
    updateRule,
    removeRule,
    updateEnvironment,
    deleteEnvironment,
    createNewFolder,
    renameFolder,
    deleteFolder,
    updateCollection,
    removeCollection,
    confirmDelete,
  } = props;

  const lowerFilter = filter.toLowerCase();
  const sectionToFolder: Record<CollectionSection, FolderSection> = {
    requests: 'requests',
    rules: 'rules',
    environments: 'environments',
    recordings: 'recordings',
  };

  // ── Folder node builder ──────────────────────────────────────

  function buildFolderNode(
    folder: Folder,
    depth: number,
    section: CollectionSection,
    parentNodeId: string | undefined,
    getChildren: (parentFolderId: string, parentNodeId: string) => TreeNode[],
  ): TreeNode[] {
    const fid = `folder-${folder.id}`;
    const isExpanded = expandedKeys.has(fid);
    const folderSection = sectionToFolder[section];

    const onAddItem = () => {
      if (section === 'requests') onNewRequest({ collectionId: folder.collectionId, folderId: folder.id });
      else if (section === 'rules') onNewRule({ collectionId: folder.collectionId, folderId: folder.id });
      else onNewEnvironment({ collectionId: folder.collectionId, folderId: folder.id });
    };

    const node: TreeNode = {
      id: fid,
      kind: 'folder',
      label: folder.name,
      depth,
      expandable: true,
      parentId: parentNodeId,
      icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
      canRename: true,
      canDelete: true,
      canAddChild: true,
      onOpen: () => onToggleExpand(fid),
      onRename: (name) => renameFolder(folder.id, name),
      onDelete: () => confirmDelete(folder.name, () => deleteFolder(folder.id)),
      onAddItem,
      addMenuItems: containerMenuItems(
        section,
        onAddItem,
        () => createNewFolder(folderSection, folder.collectionId, folder.id),
        () => onStartRename(fid),
        () => confirmDelete(folder.name, () => deleteFolder(folder.id)),
        true,
      ),
    };

    const items: TreeNode[] = [node];
    if (isExpanded) {
      const children = getChildren(folder.id, fid);
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
          placeholderMessage: 'Add a request, a folder, or drag items here to group them together.',
          placeholderActions: [
            {
              label: 'Add request',
              icon: iconEl(ApiOutlined, 'var(--ant-color-text-tertiary, #999)'),
              onClick: onAddItem,
            },
            {
              label: 'Add folder',
              icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
              onClick: () => createNewFolder(folderSection, folder.collectionId, folder.id),
            },
          ],
        });
      }
    }
    return items;
  }

  // ── Collection node builder ──────────────────────────────────

  function buildCollectionNode(
    collection: Collection,
    section: CollectionSection,
    buildChildren: (collectionId: string, collectionNodeId: string) => TreeNode[],
  ): TreeNode[] {
    const colId = `col-${collection.id}`;
    const isExpanded = expandedKeys.has(collection.id);
    const folderSection = sectionToFolder[section];

    const onAddItem = () => {
      if (section === 'requests') onNewRequest({ collectionId: collection.id });
      else if (section === 'rules') onNewRule({ collectionId: collection.id });
      else onNewEnvironment({ collectionId: collection.id });
    };

    const node: TreeNode = {
      id: colId,
      kind: 'group',
      label: collection.name,
      depth: 0,
      expandable: true,
      icon: iconEl(ApiOutlined, 'var(--ant-color-text-tertiary, #999)'),
      canRename: true,
      canDelete: true,
      canAddChild: true,
      onOpen: () => onToggleExpand(collection.id),
      onRename: async (name) => {
        await updateCollection(collection.id, { name });
      },
      onDelete: () =>
        confirmDelete(collection.name, () => {
          removeCollection(collection.id);
        }),
      onAddItem,
      addMenuItems: containerMenuItems(
        section,
        onAddItem,
        () => createNewFolder(folderSection, collection.id, null),
        () => onStartRename(colId),
        () =>
          confirmDelete(collection.name, () => {
            removeCollection(collection.id);
          }),
      ),
    };

    const items: TreeNode[] = [node];
    if (isExpanded) {
      const children = buildChildren(collection.id, colId);
      if (children.length > 0) {
        items.push(...children);
      } else {
        const itemLabel = section === 'requests' ? 'Add request' : section === 'rules' ? 'Add rule' : 'Add environment';
        const ItemIcon =
          section === 'requests' ? ApiOutlined : section === 'rules' ? ThunderboltOutlined : GlobalOutlined;
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
          placeholderMessage: `Add a ${section === 'requests' ? 'request' : section === 'rules' ? 'rule' : 'environment'} or folder to structure your workflow.`,
          placeholderActions: [
            { label: itemLabel, icon: iconEl(ItemIcon, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddItem },
            {
              label: 'Add folder',
              icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'),
              onClick: () => createNewFolder(folderSection, collection.id, null),
            },
          ],
        });
      }
    }
    return items;
  }

  // ── API Requests section ─────────────────────────────────────

  function buildRequestsNodes(): TreeNode[] {
    const sectionCollections = collections.filter((c) => c.section === 'requests');
    if (sectionCollections.length === 0 && !lowerFilter) return [];

    const items: TreeNode[] = [];

    for (const col of sectionCollections) {
      if (lowerFilter && !col.name.toLowerCase().includes(lowerFilter)) {
        // Check if any source in this collection matches
        const hasMatch = sources.some(
          (s) => s.collectionId === col.id && (s.sourceName || s.sourcePath || '').toLowerCase().includes(lowerFilter),
        );
        if (!hasMatch) continue;
      }

      items.push(
        ...buildCollectionNode(col, 'requests', (collectionId, colNodeId) => {
          const colSources = sources.filter((s) => s.collectionId === col.id);
          const colFolders = folders.filter((f) => f.collectionId === collectionId);

          const childrenOf = (parentFolderId: string | null, parentNodeId: string): TreeNode[] => {
            const childItems: TreeNode[] = [];
            for (const folder of colFolders.filter((f) => f.parentFolderId === parentFolderId)) {
              const depth = parentFolderId === null ? 1 : getDepth(folder, colFolders) + 1;
              childItems.push(
                ...buildFolderNode(folder, depth, 'requests', parentNodeId, (pId, pNodeId) => childrenOf(pId, pNodeId)),
              );
            }
            for (const source of colSources.filter((s) => (s.folderId ?? null) === parentFolderId)) {
              const depth = parentFolderId === null ? 1 : getDepth({ parentFolderId } as Folder, colFolders) + 1;
              childItems.push(buildSourceNode(source, depth, parentNodeId));
            }
            return childItems;
          };

          return childrenOf(null, colNodeId);
        }),
      );
    }

    return items;
  }

  function buildSourceNode(source: Source, depth: number, parentId?: string): TreeNode {
    const label = source.sourceName || source.sourcePath || 'Untitled';
    const sid = `source-${source.sourceId}`;
    return {
      id: sid,
      kind: 'leaf',
      label,
      depth,
      expandable: false,
      parentId,
      icon:
        source.sourceType === 'http'
          ? methodBadge(source.sourceMethod)
          : iconEl(FileOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
      canRename: true,
      canDelete: true,
      canAddChild: false,
      onOpen: () =>
        onOpenTab({
          id: sid,
          type: 'collection',
          label,
          icon: source.sourceMethod || source.sourceType,
          entityId: source.sourceId,
        }),
      onRename: async (name) => {
        await updateSource(source.sourceId, { sourceName: name });
      },
      onDelete: () =>
        confirmDelete(label, () => {
          removeSource(source.sourceId);
        }),
    };
  }

  // ── Rules section ────────────────────────────────────────────

  function buildRulesNodes(): TreeNode[] {
    const sectionCollections = collections.filter((c) => c.section === 'rules');
    const filtered = lowerFilter
      ? rules.filter((r) => (r.name || r.headerName).toLowerCase().includes(lowerFilter))
      : rules;

    // For now, rules without a collection go into a flat list
    // Once rules have collectionId, this will use the same collection pattern
    const items: TreeNode[] = [];

    for (const col of sectionCollections) {
      items.push(
        ...buildCollectionNode(col, 'rules', (collectionId, colNodeId) => {
          const colFolders = folders.filter((f) => f.collectionId === collectionId);

          const childrenOf = (parentFolderId: string | null, depth: number, parentNodeId: string): TreeNode[] => {
            const childItems: TreeNode[] = [];
            for (const folder of colFolders.filter((f) => f.parentFolderId === parentFolderId)) {
              childItems.push(
                ...buildFolderNode(folder, depth, 'rules', parentNodeId, (pId, pNodeId) =>
                  childrenOf(pId, depth + 1, pNodeId),
                ),
              );
            }
            const levelRules = filtered.filter(
              (r) => (r.collectionId ?? null) === collectionId && (r.folderId ?? null) === parentFolderId,
            );
            for (const rule of levelRules) {
              childItems.push(buildRuleNode(rule, depth, parentNodeId));
            }
            return childItems;
          };

          return childrenOf(null, 1, colNodeId);
        }),
      );
    }

    // Rules not in any collection
    const ungroupedRules = filtered.filter((r) => !r.collectionId);
    if (ungroupedRules.length > 0 && sectionCollections.length === 0) {
      for (const rule of ungroupedRules) {
        items.push(buildRuleNode(rule, 0));
      }
    }

    return items;
  }

  function buildRuleNode(rule: HeaderRule, depth: number, parentId?: string): TreeNode {
    const label = rule.name || rule.headerName;
    const rid = `rule-${rule.id}`;
    const color = rule.isEnabled ? 'var(--ant-color-success, #52c41a)' : 'var(--ant-color-text-tertiary, #999)';
    return {
      id: rid,
      kind: 'leaf',
      label,
      depth,
      expandable: false,
      parentId,
      icon: iconEl(ThunderboltOutlined, color),
      badge: !rule.isEnabled
        ? createElement(
            'span',
            { style: { fontSize: 9, color: 'var(--ant-color-text-secondary, #666)', marginLeft: 'auto' } },
            'off',
          )
        : undefined,
      canRename: true,
      canDelete: true,
      canAddChild: false,
      onOpen: () => onOpenTab({ id: rid, type: 'rule', label, icon: 'rule', entityId: rule.id }),
      onRename: (name) => updateRule(rule.id, { name }),
      onDelete: () => confirmDelete(label, () => removeRule(rule.id)),
    };
  }

  // ── Environments section ─────────────────────────────────────

  function buildEnvironmentsNodes(): TreeNode[] {
    const sectionCollections = collections.filter((c) => c.section === 'environments');
    const filtered = lowerFilter
      ? environments.filter((e) => e.name.toLowerCase().includes(lowerFilter))
      : environments;

    const items: TreeNode[] = [];

    for (const col of sectionCollections) {
      items.push(
        ...buildCollectionNode(col, 'environments', (collectionId, colNodeId) => {
          const colFolders = folders.filter((f) => f.collectionId === collectionId);

          const childrenOf = (parentFolderId: string | null, depth: number, parentNodeId: string): TreeNode[] => {
            const childItems: TreeNode[] = [];
            for (const folder of colFolders.filter((f) => f.parentFolderId === parentFolderId)) {
              childItems.push(
                ...buildFolderNode(folder, depth, 'environments', parentNodeId, (pId, pNodeId) =>
                  childrenOf(pId, depth + 1, pNodeId),
                ),
              );
            }
            const levelEnvs = filtered.filter(
              (env) => (env.collectionId ?? null) === collectionId && (env.folderId ?? null) === parentFolderId,
            );
            for (const env of levelEnvs) {
              childItems.push(buildEnvNode(env, depth, parentNodeId));
            }
            return childItems;
          };

          return childrenOf(null, 1, colNodeId);
        }),
      );
    }

    // Environments not in any collection (ungrouped)
    if (sectionCollections.length === 0) {
      for (const env of filtered) {
        items.push(buildEnvNode(env, 0));
      }
    }

    return items;
  }

  function buildEnvNode(env: Environment, depth: number, parentId?: string): TreeNode {
    const eid = `env-${env.id}`;
    const isActive = env.id === activeEnvironment;
    const color = isActive ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-tertiary, #999)';
    return {
      id: eid,
      kind: 'leaf',
      label: env.name,
      depth,
      expandable: false,
      parentId,
      icon: iconEl(GlobalOutlined, color),
      badge: isActive
        ? createElement(
            'span',
            { style: { fontSize: 9, color: 'var(--ant-color-primary, #1677ff)', marginLeft: 'auto' } },
            'active',
          )
        : undefined,
      canRename: true,
      canDelete: true,
      canAddChild: false,
      onOpen: () => onOpenTab({ id: eid, type: 'environment', label: env.name, icon: 'environment', entityId: env.id }),
      onRename: async (name) => {
        await updateEnvironment(env.id, { name });
      },
      onDelete: () => confirmDelete(env.name, () => deleteEnvironment(env.id)),
    };
  }

  // ── Build ────────────────────────────────────────────────────

  return {
    requestsNodes: buildRequestsNodes(),
    rulesNodes: buildRulesNodes(),
    environmentsNodes: buildEnvironmentsNodes(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function getDepth(folder: Pick<Folder, 'parentFolderId'>, allFolders: Folder[]): number {
  let depth = 0;
  let current = folder;
  while (current.parentFolderId) {
    depth++;
    const parent = allFolders.find((f) => f.id === current.parentFolderId);
    if (!parent) break;
    current = parent;
  }
  return depth;
}
