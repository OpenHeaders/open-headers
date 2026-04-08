/**
 * useTreeData — transforms V5 CollectionTree[] into flat TreeNode[] for sidebar rendering.
 *
 * V5 collections already have their tree structure (CollectionTree.tree: TreeNode[]).
 * This hook walks those trees and produces flat, depth-annotated nodes for the sidebar.
 */

import {
  ApiOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  GlobalOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import type { ItemType } from 'antd/es/menu/interface';
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

type CollectionSection = 'requests' | 'rules';

function containerMenuItems(
  section: CollectionSection,
  onAddItem: () => void,
  onRename: () => void,
  onDelete: () => void,
  options?: { onOpenVariables?: () => void },
): ItemType[] {
  const itemLabel = section === 'requests' ? 'Add Request' : 'Add Rule';
  const ItemIcon = section === 'requests' ? ApiOutlined : ThunderboltOutlined;
  const items: ItemType[] = [
    { key: 'add-item', icon: createElement(ItemIcon), label: itemLabel, onClick: onAddItem },
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddItem },
  ];
  if (options?.onOpenVariables) {
    items.push({
      key: 'collection-variables',
      icon: createElement(GlobalOutlined),
      label: 'Collection Variables',
      onClick: options.onOpenVariables,
    });
  }
  items.push(
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  );
  return items;
}

// ── Props ────────────────────────────────────────────────────────

interface OpenTabRequest {
  id: string;
  type: 'request' | 'rule' | 'environment' | 'collection' | 'collection-overview' | 'folder' | 'folder-overview';
  label: string;
  icon?: string;
  entityId?: string;
}

export interface UseTreeDataProps {
  requestCollections: V5.CollectionTree[];
  ruleCollections: V5.CollectionTree[];
  rules: V5.Rule[];
  environments: V5.Environment[];
  activeEnvironment: string | null;
  expandedKeys: Set<string>;
  filter: string;
  onOpenTab: (tab: OpenTabRequest) => void;
  onToggleExpand: (key: string) => void;
  onStartRename: (id: string) => void;
  onNewRequest: (opts?: { collectionId?: string }) => void;
  onNewRule: (opts?: { collectionId?: string }) => void;
  onNewEnvironment: () => void;
  switchEnvironment: (envName: string | null) => void;
  deleteEnvironment: (envName: string) => void;
  updateCollection: (section: 'requests' | 'rules', uid: string, updates: Partial<V5.Collection>) => Promise<boolean>;
  removeCollection: (section: 'requests' | 'rules', uid: string) => Promise<boolean>;
  confirmDelete: (name: string, onConfirm: () => void) => void;
  onOpenCollectionVariables?: (collectionId: string) => void;
  // Item CRUD callbacks (from domain hooks)
  removeRequest: (uid: string) => Promise<boolean>;
  updateRequest: (uid: string, updates: { name?: string }) => Promise<boolean>;
  toggleRule: (uid: string, enabled: boolean) => Promise<boolean>;
  removeRule: (uid: string) => Promise<boolean>;
  updateRule: (uid: string, updates: { name?: string }) => Promise<boolean>;
  renameFolder: (section: 'requests' | 'rules', uid: string, newName: string) => Promise<boolean>;
  removeFolder: (section: 'requests' | 'rules', uid: string) => Promise<boolean>;
  updateEnvironment: (oldName: string, updates: { name?: string }) => Promise<boolean>;
}

export interface UseTreeDataReturn {
  requestsNodes: TreeNode[];
  rulesNodes: TreeNode[];
  environmentsNodes: TreeNode[];
}

// ── Hook ─────────────────────────────────────────────────────────

export function useTreeData(props: UseTreeDataProps): UseTreeDataReturn {
  const {
    requestCollections,
    ruleCollections,
    rules,
    environments,
    activeEnvironment,
    expandedKeys,
    filter,
    onOpenTab,
    onToggleExpand,
    onStartRename,
    onNewRequest,
    onNewRule,
    onNewEnvironment,
    switchEnvironment,
    deleteEnvironment,
    updateCollection,
    removeCollection,
    confirmDelete,
    onOpenCollectionVariables,
    removeRequest,
    updateRequest,
    toggleRule,
    removeRule,
    updateRule,
    renameFolder,
    removeFolder,
    updateEnvironment,
  } = props;

  const lowerFilter = filter.toLowerCase();

  // ── Walk V5 tree nodes ──────────────────────────────────────

  function walkTreeNodes(nodes: V5.TreeNode[], depth: number, parentId: string, section: CollectionSection): TreeNode[] {
    const items: TreeNode[] = [];
    for (const node of nodes) {
      if (node.type === 'folder') {
        const fid = `folder-${node.uid}`;
        const isExpanded = expandedKeys.has(fid);
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
          onOpen: () => onToggleExpand(fid),
          onRename: async (name: string) => { void renameFolder(section, node.uid, name); },
          onDelete: () => confirmDelete(node.name, () => { void removeFolder(section, node.uid); }),
        });
        if (isExpanded) {
          items.push(...walkTreeNodes(node.children, depth + 1, fid, section));
        }
      } else if (node.type === 'request') {
        if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
        const rid = `request-${node.uid}`;
        items.push({
          id: rid,
          kind: 'leaf',
          label: node.name || 'Untitled',
          depth,
          expandable: false,
          parentId,
          icon: methodBadge(node.method),
          canRename: true,
          canDelete: true,
          canAddChild: false,
          onOpen: () =>
            onOpenTab({
              id: rid,
              type: 'request',
              label: node.name || 'Untitled',
              icon: node.method || 'GET',
              entityId: node.uid,
            }),
          onRename: async (name: string) => { void updateRequest(node.uid, { name }); },
          onDelete: () => confirmDelete(node.name, () => { void removeRequest(node.uid); }),
        });
      }
    }
    return items;
  }

  // ── Collection node builder ──────────────────────────────────

  function buildCollectionNodes(collections: V5.CollectionTree[], section: CollectionSection): TreeNode[] {
    const items: TreeNode[] = [];

    for (const col of collections) {
      if (lowerFilter && !col.name.toLowerCase().includes(lowerFilter)) {
        // Check if any child matches
        const hasMatch = col.tree.some((n) => n.name.toLowerCase().includes(lowerFilter));
        if (!hasMatch) continue;
      }

      const colId = `col-${col.uid}`;
      const isExpanded = expandedKeys.has(colId);

      const onAddItem = () => {
        if (section === 'requests') onNewRequest({ collectionId: col.uid });
        else onNewRule({ collectionId: col.uid });
      };

      items.push({
        id: colId,
        kind: 'group',
        label: col.name,
        depth: 0,
        expandable: true,
        icon: iconEl(FolderOpenOutlined, 'var(--ant-color-text-tertiary, #999)'),
        canRename: true,
        canDelete: true,
        canAddChild: true,
        onOpen: () => onToggleExpand(colId),
        onRename: async (name) => {
          await updateCollection(section, col.uid, { name });
        },
        onDelete: () =>
          confirmDelete(col.name, () => {
            void removeCollection(section, col.uid);
          }),
        onAddItem,
        addMenuItems: containerMenuItems(
          section,
          onAddItem,
          () => onStartRename(colId),
          () =>
            confirmDelete(col.name, () => {
              void removeCollection(section, col.uid);
            }),
          {
            onOpenVariables: onOpenCollectionVariables ? () => onOpenCollectionVariables(col.uid) : undefined,
          },
        ),
      });

      if (isExpanded) {
        const children = walkTreeNodes(col.tree, 1, colId, section);
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
            placeholderTitle: 'Collection is empty',
            placeholderMessage: `Add a ${section === 'requests' ? 'request' : 'rule'} to get started.`,
            placeholderActions: [
              {
                label: section === 'requests' ? 'Add request' : 'Add rule',
                icon: iconEl(section === 'requests' ? ApiOutlined : ThunderboltOutlined, 'var(--ant-color-text-tertiary, #999)'),
                onClick: onAddItem,
              },
            ],
          });
        }
      }
    }

    return items;
  }

  // ── Rules section — also show ungrouped rules ───────────────

  function buildRulesNodes(): TreeNode[] {
    const items = buildCollectionNodes(ruleCollections, 'rules');

    // Rules not in any collection (flat list)
    if (ruleCollections.length === 0) {
      const filtered = lowerFilter ? rules.filter((r) => r.name.toLowerCase().includes(lowerFilter)) : rules;
      for (const rule of filtered) {
        items.push(buildRuleNode(rule, 0));
      }
    }

    return items;
  }

  function buildRuleNode(rule: V5.Rule, depth: number, parentId?: string): TreeNode {
    const rid = `rule-${rule.uid}`;
    const color = rule.enabled ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-tertiary, #999)';
    return {
      id: rid,
      kind: 'leaf',
      label: rule.name,
      depth,
      expandable: false,
      parentId,
      icon: iconEl(ThunderboltOutlined, color),
      canRename: true,
      canDelete: true,
      canAddChild: false,
      hoverAction: rule.enabled
        ? {
            icon: iconEl(StopOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
            tooltip: 'Disable',
            onClick: () => { void toggleRule(rule.uid, false); },
          }
        : {
            icon: iconEl(CheckCircleOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
            tooltip: 'Enable',
            onClick: () => { void toggleRule(rule.uid, true); },
          },
      onOpen: () => onOpenTab({ id: rid, type: 'rule', label: rule.name, icon: 'rule', entityId: rule.uid }),
      onRename: async (name: string) => { void updateRule(rule.uid, { name }); },
      onDelete: () => confirmDelete(rule.name, () => { void removeRule(rule.uid); }),
    };
  }

  // ── Environments section ─────────────────────────────────────

  function buildEnvironmentsNodes(): TreeNode[] {
    const filtered = lowerFilter
      ? environments.filter((e) => e.name.toLowerCase().includes(lowerFilter))
      : environments;

    const items: TreeNode[] = [];
    for (const env of filtered) {
      const eid = `env-${env.name}`;
      const isActive = env.name === activeEnvironment;
      const color = isActive ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-tertiary, #999)';
      items.push({
        id: eid,
        kind: 'leaf',
        label: env.name,
        depth: 0,
        expandable: false,
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
        hoverAction: isActive
          ? {
              icon: iconEl(StopOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
              tooltip: 'Deactivate',
              onClick: () => switchEnvironment(null),
            }
          : {
              icon: iconEl(CheckCircleOutlined, 'var(--ant-color-text-tertiary, #999)', 11),
              tooltip: 'Set Active',
              onClick: () => switchEnvironment(env.name),
            },
        onOpen: () =>
          onOpenTab({ id: eid, type: 'environment', label: env.name, icon: 'environment', entityId: env.name }),
        onRename: async (name: string) => { void updateEnvironment(env.name, { name }); },
        onDelete: () => confirmDelete(env.name, () => deleteEnvironment(env.name)),
      });
    }
    return items;
  }

  // ── Build ────────────────────────────────────────────────────

  return {
    requestsNodes: buildCollectionNodes(requestCollections, 'requests'),
    rulesNodes: buildRulesNodes(),
    environmentsNodes: buildEnvironmentsNodes(),
  };
}
