/**
 * Sidebar — IDE-style tree panel with 3 collapsible sections.
 *
 * Mirrors desktop v5-shell/Sidebar.tsx exactly:
 * - Toolbar: filter, +create, expand/collapse all
 * - 3 collapsible sections (API Requests read-only, Rules functional, Environments read-only)
 * - Full TreeNodeRow rendering from V5.CollectionTree (collection → folder → rule)
 * - Keyboard navigation, inline rename, confirm delete
 */

import {
  CheckCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LinkOutlined,
  NodeCollapseOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import { useRules } from '@hooks/useRules';
import { App, Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { createElement, useCallback, useMemo, useRef, useState } from 'react';
import { TreeNodeRow } from './sidebar/TreeNodeRow';
import type { TreeNode } from './sidebar/types';

// ── Icon helpers ───────────────────────────────────────────────────

function iconEl(Icon: typeof ThunderboltOutlined, color: string, size = 12): React.ReactNode {
  return createElement(Icon, { style: { color, fontSize: size } });
}

function collectionMenuItems(
  onAddRule: () => void,
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
): ItemType[] {
  return [
    { key: 'add-item', icon: createElement(ThunderboltOutlined), label: 'Add Rule', onClick: onAddRule },
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  ];
}

function folderMenuItems(
  onAddRule: () => void,
  onAddFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
): ItemType[] {
  return [
    { key: 'add-item', icon: createElement(ThunderboltOutlined), label: 'Add Rule', onClick: onAddRule },
    { key: 'add-folder', icon: createElement(FolderOutlined), label: 'Add Folder', onClick: onAddFolder },
    { type: 'divider' as const, key: 'div' },
    { key: 'rename', icon: createElement(EditOutlined), label: 'Rename', onClick: onRename },
    { key: 'delete', icon: createElement(DeleteOutlined), label: 'Delete', danger: true, onClick: onDelete },
  ];
}

// ── Section header ─────────────────────────────────────────────────

function SectionHeader({
  title,
  expanded,
  onToggle,
  actions,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  const { token } = theme.useToken();
  return (
    <div
      className="rules-sidebar-section"
      style={{ color: token.colorTextSecondary }}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === 'Enter') onToggle(); }}
      role="button"
      tabIndex={-1}
    >
      <span className="rules-sidebar-section-title">
        <span style={{ display: 'inline-block', fontSize: 10, marginRight: 4, transition: 'transform 0.2s ease', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>&#9654;</span>
        {title}
      </span>
      {actions && <span onClick={(e) => e.stopPropagation()} onKeyDown={() => {}}>{actions}</span>}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────

interface SidebarProps {
  activeTabId?: string | null;
  onSelectRule: (uid: string) => void;
  onCreateRule: (type: string) => void;
  onDeleteRule?: (uid: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTabId, onSelectRule, onCreateRule, onDeleteRule }) => {
  const { token } = theme.useToken();
  const {
    rules, localCollectionTrees, isConnected,
    updateLocalRule, deleteLocalRule, deleteLocalCollection,
    createLocalFolder, renameLocalFolder, deleteLocalFolder,
    renameLocalCollection,
  } = useRules();
  const { message } = App.useApp();

  const [filterText, setFilterText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [sectionsExpanded, setSectionsExpanded] = useState<Record<string, boolean>>({
    requests: false,
    rules: true,
    environments: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-expand new collections
  const prevCollectionCount = useRef(0);
  if (localCollectionTrees.length > prevCollectionCount.current) {
    const newKeys = new Set(expandedKeys);
    for (const col of localCollectionTrees) newKeys.add(`col-${col.uid}`);
    if (newKeys.size !== expandedKeys.size) setExpandedKeys(newKeys);
  }
  prevCollectionCount.current = localCollectionTrees.length;

  const toggleSection = useCallback((key: string) => {
    setSectionsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setSectionsExpanded({ requests: true, rules: true, environments: true });
    const allKeys = new Set<string>();
    for (const col of localCollectionTrees) allKeys.add(`col-${col.uid}`);
    setExpandedKeys(allKeys);
  }, [localCollectionTrees]);

  const collapseAll = useCallback(() => {
    setSectionsExpanded({ requests: false, rules: false, environments: false });
    setExpandedKeys(new Set());
  }, []);

  const confirmDelete = useCallback((name: string, onConfirm: () => void) => {
    Modal.confirm({
      title: <span style={{ fontSize: 13, fontWeight: 600 }}>Delete item?</span>,
      width: 380,
      content: <p style={{ fontSize: 12, margin: '4px 0 0' }}>Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.</p>,
      okText: 'Delete',
      okButtonProps: { danger: true, size: 'small' },
      cancelButtonProps: { size: 'small' },
      onOk: onConfirm,
    });
  }, []);

  const handleToggleRule = useCallback(
    (ruleUid: string, enabled: boolean) => {
      chrome.runtime.sendMessage({ type: 'toggleRule', ruleId: ruleUid, enabled }, (response: unknown) => {
        if (!(response as { success?: boolean } | undefined)?.success) message.error('Failed to toggle rule');
      });
    },
    [message],
  );

  // ── Build tree nodes from V5.CollectionTree[] ────────────────

  const lowerFilter = filterText.toLowerCase();

  /** Walk V5.TreeNode[] (folder/rule) and produce sidebar TreeNode[] */
  const walkV5Tree = useCallback(
    (v5Nodes: V5.TreeNode[], depth: number, parentId: string): TreeNode[] => {
      const items: TreeNode[] = [];

      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `folder-${node.uid}`;
          const isExpanded = expandedKeys.has(fid);
          const onAddRule = () => onCreateRule('header');
          const onAddFolder = () => { void createLocalFolder('New Folder', node.path); };

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
            onOpen: () => toggleExpand(fid),
            onRename: async (name: string) => { void renameLocalFolder(node.uid, name); },
            onDelete: () => confirmDelete(node.name, () => { void deleteLocalFolder(node.uid); }),
            onAddItem: onAddRule,
            addMenuItems: folderMenuItems(onAddRule, onAddFolder, () => setRenamingId(fid), () => confirmDelete(node.name, () => { void deleteLocalFolder(node.uid); })),
          });
          if (isExpanded) {
            const children = walkV5Tree(node.children, depth + 1, fid);
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
                placeholderMessage: 'Add a rule to get started.',
                placeholderActions: [{ label: 'Add rule', icon: iconEl(ThunderboltOutlined, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddRule }],
              });
            }
          }
        } else if (node.type === 'rule') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const rid = `rule-${node.uid}`;
          const isLocal = node.uid.startsWith('local-');
          const color = node.enabled ? 'var(--ant-color-primary, #1677ff)' : 'var(--ant-color-text-tertiary, #999)';
          const fullRule = rules.find((r) => r.uid === node.uid);

          items.push({
            id: rid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon: iconEl(ThunderboltOutlined, color),
            badge: !node.enabled ? createElement('span', { style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)', marginLeft: 'auto' } }, 'off') : undefined,
            canRename: isLocal,
            canDelete: isLocal,
            canAddChild: false,
            hoverAction: node.enabled
              ? { icon: iconEl(StopOutlined, 'var(--ant-color-text-tertiary, #999)', 11), tooltip: 'Disable', onClick: () => handleToggleRule(node.uid, false) }
              : { icon: iconEl(CheckCircleOutlined, 'var(--ant-color-text-tertiary, #999)', 11), tooltip: 'Enable', onClick: () => handleToggleRule(node.uid, true) },
            onOpen: () => onSelectRule(node.uid),
            onRename: isLocal && fullRule ? async (name: string) => { void updateLocalRule(node.uid, { name }); } : undefined,
            onDelete: isLocal ? () => confirmDelete(node.name, () => { onDeleteRule?.(node.uid); }) : undefined,
          });
        }
      }

      return items;
    },
    [expandedKeys, lowerFilter, rules, toggleExpand, onCreateRule, onSelectRule, onDeleteRule, handleToggleRule, updateLocalRule, createLocalFolder, renameLocalFolder, deleteLocalFolder, confirmDelete],
  );

  const rulesNodes = useMemo((): TreeNode[] => {
    const items: TreeNode[] = [];

    for (const collection of localCollectionTrees) {
      if (lowerFilter && !collection.name.toLowerCase().includes(lowerFilter)) {
        // Check if any rule in tree matches
        const hasMatch = collection.tree.some((n) => n.type === 'rule' && n.name.toLowerCase().includes(lowerFilter));
        if (!hasMatch) continue;
      }

      const colId = `col-${collection.uid}`;
      const isExpanded = expandedKeys.has(colId);
      const onAddRule = () => onCreateRule('header');
      const onAddFolder = () => { void createLocalFolder('New Folder', collection.path); };

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
        onOpen: () => toggleExpand(colId),
        onRename: async (name) => { void renameLocalCollection(collection.uid, name); },
        onDelete: () => confirmDelete(collection.name, () => { void deleteLocalCollection(collection.uid); }),
        onAddItem: onAddRule,
        addMenuItems: collectionMenuItems(onAddRule, onAddFolder, () => setRenamingId(colId), () => confirmDelete(collection.name, () => { void deleteLocalCollection(collection.uid); })),
      });

      if (isExpanded) {
        const children = walkV5Tree(collection.tree, 1, colId);
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
            placeholderMessage: 'Add a rule to get started.',
            placeholderActions: [{ label: 'Add rule', icon: iconEl(ThunderboltOutlined, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddRule }],
          });
        }
      }
    }

    return items;
  }, [localCollectionTrees, lowerFilter, expandedKeys, toggleExpand, onCreateRule, walkV5Tree, renameLocalCollection, deleteLocalCollection, createLocalFolder, confirmDelete]);

  // ── Flat items for keyboard nav ──────────────────────────────

  const allFlatItems = useMemo(() => sectionsExpanded.rules ? rulesNodes : [], [sectionsExpanded.rules, rulesNodes]);

  const isSelected = useCallback(
    (id: string) => {
      if (!activeTabId) return false;
      return activeTabId === id || `edit-${id.replace('rule-', '')}` === activeTabId;
    },
    [activeTabId],
  );

  const isFocused = useCallback((id: string) => focusedId === id, [focusedId]);

  const handleItemClick = useCallback((node: TreeNode) => { setFocusedId(node.id); node.onOpen?.(); }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = allFlatItems.findIndex((n) => n.id === focusedId);
        const nextIdx = e.key === 'ArrowDown' ? Math.min(currentIdx + 1, allFlatItems.length - 1) : Math.max(currentIdx - 1, 0);
        const next = allFlatItems[nextIdx];
        if (next) { setFocusedId(next.id); setTimeout(() => containerRef.current?.querySelector(`[data-item-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' }), 0); }
      } else if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onOpen?.();
      } else if (e.key === 'ArrowRight' && focusedId) {
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && !expandedKeys.has(node.id)) { e.preventDefault(); toggleExpand(node.id); }
      } else if (e.key === 'ArrowLeft' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable && expandedKeys.has(node.id)) toggleExpand(node.id);
        else if (node?.parentId) setFocusedId(node.parentId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        allFlatItems.find((n) => n.id === focusedId)?.onDelete?.();
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.canRename) setRenamingId(focusedId);
      }
    },
    [allFlatItems, focusedId, expandedKeys, toggleExpand],
  );

  const createMenuItems = [
    { key: 'header', icon: <SwapOutlined />, label: 'Modify Headers', onClick: () => onCreateRule('header') },
    { key: 'block', icon: <StopOutlined />, label: 'Block Requests', onClick: () => onCreateRule('block') },
    { key: 'redirect', icon: <SendOutlined />, label: 'Redirect Requests', onClick: () => onCreateRule('redirect') },
    { key: 'query-param', icon: <LinkOutlined />, label: 'Modify Query Params', onClick: () => onCreateRule('query-param') },
    { key: 'inject', icon: <CodeOutlined />, label: 'Inject Scripts/CSS', onClick: () => onCreateRule('inject') },
  ];

  const renderNodes = (nodes: TreeNode[], emptyCreate?: () => void) => {
    if (nodes.length === 0) {
      return (
        <div className="rules-sidebar-empty-state">
          <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>No items in this panel</span>
          {emptyCreate && (
            <button type="button" className="rules-sidebar-create-btn" style={{ color: token.colorText }} onClick={emptyCreate}>
              <PlusOutlined style={{ fontSize: 10 }} /> Create
            </button>
          )}
        </div>
      );
    }
    return nodes.map((node) => (
      <TreeNodeRow
        key={node.id}
        node={node}
        isSelected={isSelected(node.id)}
        isFocused={isFocused(node.id)}
        isRenaming={renamingId === node.id}
        isExpanded={node.expandable ? expandedKeys.has(node.id) : undefined}
        onClick={() => handleItemClick(node)}
        onDoubleClick={() => node.onOpen?.()}
        onStartRename={() => { if (renamingId === node.id) setRenamingId(null); else setRenamingId(node.id); }}
      />
    ));
  };

  return (
    <div className="rules-sidebar" style={{ background: token.colorBgLayout }}>
      <div className="rules-sidebar-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input size="small" placeholder="Filter" prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />} value={filterText} onChange={(e) => setFilterText(e.target.value)} allowClear style={{ flex: 1, fontSize: 11 }} variant="borderless" />
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <Tooltip title="New rule" placement="bottom"><div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}><PlusOutlined /></div></Tooltip>
        </Dropdown>
        <Tooltip title="Expand All" placement="bottom"><div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={expandAll}><ExpandOutlined /></div></Tooltip>
        <Tooltip title="Collapse All" placement="bottom"><div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={collapseAll}><NodeCollapseOutlined /></div></Tooltip>
      </div>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard navigation */}
      <div ref={containerRef} className="rules-sidebar-content" onKeyDown={handleKeyDown} tabIndex={0} style={{ outline: 'none' }}>
        <SectionHeader title="API REQUESTS" expanded={sectionsExpanded.requests} onToggle={() => toggleSection('requests')} />
        {sectionsExpanded.requests && <div className="rules-sidebar-empty" style={{ color: token.colorTextTertiary }}>{isConnected ? 'API requests are managed in the desktop app.' : 'Connect to desktop app to see API requests.'}</div>}

        <SectionHeader title="RULES" expanded={sectionsExpanded.rules} onToggle={() => toggleSection('rules')} actions={
          <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
            <PlusOutlined style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'pointer' }} onClick={(e) => e.stopPropagation()} />
          </Dropdown>
        } />
        {sectionsExpanded.rules && <div style={{ flex: 1, overflowY: 'auto' }}>{renderNodes(rulesNodes, () => onCreateRule('header'))}</div>}

        <SectionHeader title="ENVIRONMENTS" expanded={sectionsExpanded.environments} onToggle={() => toggleSection('environments')} />
        {sectionsExpanded.environments && <div className="rules-sidebar-empty" style={{ color: token.colorTextTertiary }}>{isConnected ? 'Environments are managed in the desktop app.' : 'Connect to desktop app to see environments.'}</div>}
      </div>
    </div>
  );
};

export default Sidebar;
