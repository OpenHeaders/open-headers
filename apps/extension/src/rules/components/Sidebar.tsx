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
  AimOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
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
import { isRuleComplete } from '@openheaders/core/utils';
import { useRules } from '@hooks/useRules';
import { App, Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  onCreateRule: (type: string, context?: { collectionId: string; folderPath?: string }) => void;
  onDeleteRule?: (uid: string) => void;
  onOpenCollectionOverview?: (uid: string, name: string) => void;
  onOpenFolderOverview?: (uid: string, name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTabId, onSelectRule, onCreateRule, onDeleteRule, onOpenCollectionOverview, onOpenFolderOverview }) => {
  const { token } = theme.useToken();
  const {
    rules, localCollectionTrees, isConnected,
    updateLocalRule, deleteLocalRule, deleteLocalCollection,
    createLocalFolder, renameLocalFolder, deleteLocalFolder,
    renameLocalCollection, createLocalCollection,
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
  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(true);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);


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
    const collectKeys = (nodes: V5.TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          allKeys.add(`folder-${n.uid}`);
          collectKeys(n.children);
        }
      }
    };
    for (const col of localCollectionTrees) {
      allKeys.add(`col-${col.uid}`);
      collectKeys(col.tree);
    }
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
    (v5Nodes: V5.TreeNode[], depth: number, parentId: string, collectionId: string): TreeNode[] => {
      const items: TreeNode[] = [];

      for (const node of v5Nodes) {
        if (node.type === 'folder') {
          const fid = `folder-${node.uid}`;
          const isExpanded = expandedKeys.has(fid);
          const onAddRule = () => onCreateRule('header', { collectionId, folderPath: node.path });
          const onAddFolder = () => {
            void createLocalFolder('New Folder', node.path).then((f) => {
              if (f) {
                setExpandedKeys((prev) => { const next = new Set(prev); next.add(fid); return next; });
                onOpenFolderOverview?.(f.uid, f.name);
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
            onOpen: () => toggleExpand(fid),
            onRename: async (name: string) => { void renameLocalFolder(node.uid, name); },
            onDelete: () => confirmDelete(node.name, () => { void deleteLocalFolder(node.uid); }),
            onAddItem: onAddRule,
            addMenuItems: folderMenuItems(onAddRule, onAddFolder, () => setRenamingId(fid), () => confirmDelete(node.name, () => { void deleteLocalFolder(node.uid); })),
          });
          if (isExpanded) {
            const children = walkV5Tree(node.children, depth + 1, fid, collectionId);
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
                placeholderMessage: 'Add a rule or folder to get started.',
                placeholderActions: [
                  { label: 'Add rule', icon: iconEl(ThunderboltOutlined, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddRule },
                  { label: 'Add folder', icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddFolder },
                ],
              });
            }
          }
        } else if (node.type === 'rule') {
          if (lowerFilter && !node.name.toLowerCase().includes(lowerFilter)) continue;
          const rid = `rule-${node.uid}`;
          const isLocal = node.uid.startsWith('local-');
          const fullRule = rules.find((r) => r.uid === node.uid);
          const complete = fullRule ? isRuleComplete(fullRule) : true;
          const color = node.enabled && complete
            ? 'var(--ant-color-primary, #1677ff)'
            : 'var(--ant-color-text-tertiary, #999)';

          // Badge: "draft" for incomplete rules, "off" for disabled complete rules
          let badge: React.ReactNode;
          if (!complete) {
            badge = createElement('span', { style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)', marginLeft: 'auto' } }, 'draft');
          } else if (!node.enabled) {
            badge = createElement('span', { style: { fontSize: 9, color: 'var(--ant-color-text-tertiary, #999)', marginLeft: 'auto' } }, 'off');
          }

          items.push({
            id: rid,
            kind: 'leaf',
            label: node.name,
            depth,
            expandable: false,
            parentId,
            icon: iconEl(ThunderboltOutlined, color),
            badge,
            canRename: isLocal,
            canDelete: isLocal,
            canAddChild: false,
            hoverAction: node.enabled
              ? { icon: iconEl(StopOutlined, 'var(--ant-color-text-tertiary, #999)', 11), tooltip: 'Disable rule', onClick: () => handleToggleRule(node.uid, false) }
              : { icon: iconEl(CheckCircleOutlined, 'var(--ant-color-text-tertiary, #999)', 11), tooltip: 'Enable rule', onClick: () => handleToggleRule(node.uid, true) },
            onOpen: () => onSelectRule(node.uid),
            onRename: isLocal && fullRule ? async (name: string) => { void updateLocalRule(node.uid, { name }); } : undefined,
            onDelete: isLocal ? () => confirmDelete(node.name, () => { onDeleteRule?.(node.uid); }) : undefined,
          });
        }
      }

      return items;
    },
    [expandedKeys, lowerFilter, rules, toggleExpand, onCreateRule, onSelectRule, onDeleteRule, handleToggleRule, updateLocalRule, createLocalFolder, renameLocalFolder, deleteLocalFolder, confirmDelete, onOpenFolderOverview],
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
      const onAddRule = () => onCreateRule('header', { collectionId: collection.uid });
      const onAddFolder = () => {
        void createLocalFolder('New Folder', collection.path).then((f) => {
          if (f) {
            setExpandedKeys((prev) => { const next = new Set(prev); next.add(colId); return next; });
            onOpenFolderOverview?.(f.uid, f.name);
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
        onOpen: () => toggleExpand(colId),
        onRename: async (name) => { void renameLocalCollection(collection.uid, name); },
        onDelete: () => confirmDelete(collection.name, () => { void deleteLocalCollection(collection.uid); }),
        onAddItem: onAddRule,
        addMenuItems: collectionMenuItems(onAddRule, onAddFolder, () => setRenamingId(colId), () => confirmDelete(collection.name, () => { void deleteLocalCollection(collection.uid); })),
      });

      if (isExpanded) {
        const children = walkV5Tree(collection.tree, 1, colId, collection.uid);
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
            placeholderMessage: 'Add a rule or folder to get started.',
            placeholderActions: [
              { label: 'Add rule', icon: iconEl(ThunderboltOutlined, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddRule },
              { label: 'Add folder', icon: iconEl(FolderOutlined, 'var(--ant-color-text-tertiary, #999)'), onClick: onAddFolder },
            ],
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
      if (!alwaysSelectOpened || !activeTabId) return false;
      // Direct match: col-{uid}, folder-{uid} tabs match their sidebar node IDs
      if (activeTabId === id) return true;
      // Rule tabs: edit-{uid} matches rule-{uid} sidebar node
      if (id.startsWith('rule-') && activeTabId === `edit-${id.replace('rule-', '')}`) return true;
      return false;
    },
    [activeTabId, alwaysSelectOpened],
  );

  const isFocused = useCallback((id: string) => focusedId === id, [focusedId]);

  const shouldOpenOnSingleClick = useCallback(
    (node: TreeNode) => {
      if (node.kind === 'group') return openCollectionsWithSingleClick;
      if (node.kind === 'folder') return openFoldersWithSingleClick;
      return openWithSingleClick;
    },
    [openWithSingleClick, openCollectionsWithSingleClick, openFoldersWithSingleClick],
  );

  const handleItemClick = useCallback(
    (node: TreeNode) => {
      setFocusedId(node.id);
      if (shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
  );

  const handleItemDoubleClick = useCallback(
    (node: TreeNode) => {
      if (!shouldOpenOnSingleClick(node)) node.onOpen?.();
    },
    [shouldOpenOnSingleClick],
  );

  // Select Opened Tab — expand ancestors, focus, and scroll to the active tab's sidebar node.
  // Returns true if the node was found and selected, false otherwise.
  const selectOpenedFile = useCallback((): boolean => {
    if (!activeTabId) return false;

    // Determine which sidebar node ID corresponds to this tab
    let nodeId: string | null = null;
    if (activeTabId.startsWith('edit-')) {
      nodeId = `rule-${activeTabId.replace('edit-', '')}`;
    } else if (activeTabId.startsWith('col-') || activeTabId.startsWith('folder-')) {
      nodeId = activeTabId; // collection/folder overview tabs match sidebar IDs directly
    }
    if (!nodeId) return false;

    // For collection nodes, just ensure the section is open
    if (nodeId.startsWith('col-')) {
      setSectionsExpanded((prev) => ({ ...prev, rules: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }

    // For rule/folder nodes, find ancestors and expand them
    const targetUid = nodeId.startsWith('rule-') ? nodeId.replace('rule-', '') : nodeId.replace('folder-', '');
    const targetType = nodeId.startsWith('rule-') ? 'rule' : 'folder';

    for (const col of localCollectionTrees) {
      const colKey = `col-${col.uid}`;
      const findInTree = (nodes: V5.TreeNode[], ancestors: string[]): string[] | null => {
        for (const n of nodes) {
          if (n.type === targetType && n.uid === targetUid) return ancestors;
          if (n.type === 'folder') {
            const found = findInTree(n.children, [...ancestors, `folder-${n.uid}`]);
            if (found) return found;
          }
        }
        return null;
      };
      const ancestors = findInTree(col.tree, [colKey]);
      if (ancestors) {
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          for (const k of ancestors) next.add(k);
          return next;
        });
        setSectionsExpanded((prev) => ({ ...prev, rules: true }));
        setFocusedId(nodeId);
        setTimeout(() => {
          containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
        }, 50);
        return true;
      }
    }
    return false;
  }, [activeTabId, localCollectionTrees]);

  // Auto-select on active tab change, with retry when tree data arrives async
  const prevActiveTabRef = useRef(activeTabId);
  const pendingSelectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!alwaysSelectOpened || !activeTabId) return;

    const tabChanged = prevActiveTabRef.current !== activeTabId;
    prevActiveTabRef.current = activeTabId;

    if (tabChanged) {
      // Tab just changed — attempt selection, mark pending if rule not found yet
      const found = selectOpenedFile();
      pendingSelectRef.current = found ? null : activeTabId;
    } else if (pendingSelectRef.current === activeTabId) {
      // Tree data updated — retry pending selection
      const found = selectOpenedFile();
      if (found) pendingSelectRef.current = null;
    }
  }, [alwaysSelectOpened, activeTabId, selectOpenedFile, localCollectionTrees]);

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

  // Create a new collection — appears collapsed, opens overview tab with breadcrumb rename
  const createNewCollection = useCallback(async () => {
    const col = await createLocalCollection('New Collection');
    if (col) {
      setSectionsExpanded((prev) => ({ ...prev, rules: true }));
      onOpenCollectionOverview?.(col.uid, col.name);
    }
  }, [createLocalCollection, onOpenCollectionOverview]);

  const createMenuItems = [
    { key: 'header', icon: <SwapOutlined />, label: 'Modify Headers', onClick: () => onCreateRule('header') },
    { key: 'block', icon: <StopOutlined />, label: 'Block Requests', onClick: () => onCreateRule('block') },
    { key: 'redirect', icon: <SendOutlined />, label: 'Redirect Requests', onClick: () => onCreateRule('redirect') },
    { key: 'query-param', icon: <LinkOutlined />, label: 'Modify Query Params', onClick: () => onCreateRule('query-param') },
    { key: 'inject', icon: <CodeOutlined />, label: 'Inject Scripts/CSS', onClick: () => onCreateRule('inject') },
    { type: 'divider' as const, key: 'div-1' },
    { key: 'collection', icon: <FolderOpenOutlined />, label: 'Collection', onClick: () => void createNewCollection() },
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
        onDoubleClick={() => handleItemDoubleClick(node)}
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
        <Tooltip title="Select Opened Tab" placement="bottom">
          <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={selectOpenedFile}><AimOutlined /></div>
        </Tooltip>
        <Tooltip title="Expand All" placement="bottom"><div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={expandAll}><ExpandOutlined /></div></Tooltip>
        <Tooltip title="Collapse All" placement="bottom"><div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={collapseAll}><NodeCollapseOutlined /></div></Tooltip>
        <Dropdown
          menu={{
            items: [
              {
                key: 'behavior',
                label: 'Behavior',
                children: [
                  { key: 'single-click', label: `${openWithSingleClick ? '✓ ' : ''}Open Entries with Single Click`, onClick: () => setOpenWithSingleClick((v) => !v) },
                  { key: 'collections-single-click', label: `${openCollectionsWithSingleClick ? '✓ ' : ''}Open Collections with Single Click`, onClick: () => setOpenCollectionsWithSingleClick((v) => !v) },
                  { key: 'folders-single-click', label: `${openFoldersWithSingleClick ? '✓ ' : ''}Open Folders with Single Click`, onClick: () => setOpenFoldersWithSingleClick((v) => !v) },
                  { key: 'always-select', label: `${alwaysSelectOpened ? '✓ ' : ''}Always Select Opened Tab`, onClick: () => setAlwaysSelectOpened((v) => !v) },
                ],
              },
            ],
          }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setOptionsMenuOpen}
        >
          <Tooltip title="Options" placement="bottom" open={optionsMenuOpen ? false : undefined}>
            <div className="rules-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}><EllipsisOutlined /></div>
          </Tooltip>
        </Dropdown>
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
        {sectionsExpanded.rules && <div style={{ flex: 1, overflowY: 'auto' }}>{renderNodes(rulesNodes, () => void createNewCollection())}</div>}

        <SectionHeader title="ENVIRONMENTS" expanded={sectionsExpanded.environments} onToggle={() => toggleSection('environments')} />
        {sectionsExpanded.environments && <div className="rules-sidebar-empty" style={{ color: token.colorTextTertiary }}>{isConnected ? 'Environments are managed in the desktop app.' : 'Connect to desktop app to see environments.'}</div>}
      </div>
    </div>
  );
};

export default Sidebar;
