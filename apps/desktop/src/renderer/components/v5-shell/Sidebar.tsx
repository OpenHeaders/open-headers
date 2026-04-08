/**
 * Sidebar — IDE-style tree panel with selection, keyboard navigation, and toolbar.
 *
 * Architecture:
 *   - **TreeNode model** (sidebar/types.ts): every item is a generic TreeNode
 *   - **useTreeData**: transforms entities → TreeNode[] per section
 *   - **useFolderActions**: folder CRUD
 *   - **TreeNodeRow**: renders any node uniformly
 *   - **This file**: slim orchestrator — toolbar, section layout, keyboard nav
 */

import {
  AimOutlined,
  ApiOutlined,
  EllipsisOutlined,
  ExpandOutlined,
  GlobalOutlined,
  NodeCollapseOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Allotment } from 'allotment';
import { Dropdown, Input, Modal, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useCollections,
  useEnvironments,
  useHeaderRules,
  useSources,
} from '@/renderer/hooks/useCentralizedWorkspace';
import { TreeNodeRow } from './sidebar/TreeNodeRow';
import type { TreeNode } from './sidebar/types';
import { useFolderActions } from './sidebar/useFolderActions';
import { useTreeData } from './sidebar/useTreeData';
import type { ActivityPanel } from './V5Shell';

// ── Section header ──────────────────────────────────────────────

function SectionHeader({ title, expanded, onToggle }: { title: string; expanded: boolean; onToggle: () => void }) {
  const { token } = theme.useToken();
  return (
    <div
      className="v5-sidebar-section"
      style={{ color: token.colorTextSecondary, cursor: 'pointer', flexShrink: 0 }}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onToggle();
      }}
      role="button"
      tabIndex={-1}
    >
      <span className="v5-sidebar-section-title">
        <span
          style={{
            display: 'inline-block',
            fontSize: 10,
            marginRight: 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        {title}
      </span>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────

interface OpenTabRequest {
  id: string;
  type: 'rule' | 'environment' | 'collection' | 'collection-overview' | 'folder' | 'folder-overview';
  label: string;
  icon?: string;
  entityId?: string;
}

interface SidebarProps {
  activePanel: ActivityPanel;
  onOpenTab?: (tab: OpenTabRequest) => void;
  onNewRequest?: (options?: { collectionId?: string; folderId?: string }) => void;
  onNewRule?: (options?: { collectionId?: string; folderId?: string }) => void;
  onNewEnvironment?: (options?: { collectionId?: string; folderId?: string }) => void;
  /** Draft creation (no collection context) — used by toolbar create menu */
  onNewDraftEnvironment?: () => void;
  onOpenWorkspaceVariables?: () => void;
  onOpenCollectionVariables?: (collectionId: string) => void;
  expandedSections?: string[];
  onExpandedSectionsChange?: (sections: string[]) => void;
  expandedKeys: Set<string>;
  ensureExpanded: (...keys: string[]) => void;
  toggleExpand: (key: string) => void;
  setAllExpanded: (keys: string[]) => void;
  activeTabId?: string | null;
  activeWorkspaceId?: string;
  /** Signal to V5Shell that a newly created tab should start in breadcrumb rename mode */
  onPendingRename?: (tabId: string) => void;
}

// ── Placeholder panels ──────────────────────────────────────────

function RecordingsPanel() {
  const { token } = theme.useToken();
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <SectionHeader title="RECORDINGS" expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      {expanded && (
        <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
          No recordings yet.
        </div>
      )}
    </>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  const { token } = theme.useToken();
  return (
    <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary, paddingTop: 24 }}>
      {title} — coming soon.
    </div>
  );
}

// ── Main Sidebar ─────────────────────────────────────────────────

export function Sidebar({
  activePanel,
  onOpenTab,
  onNewRequest,
  onNewRule,
  onNewEnvironment,
  onNewDraftEnvironment,
  onOpenWorkspaceVariables,
  onOpenCollectionVariables,
  expandedSections: expandedSectionsProp,
  onExpandedSectionsChange,
  expandedKeys,
  ensureExpanded,
  toggleExpand,
  setAllExpanded,
  activeTabId,
  onPendingRename,
}: SidebarProps) {
  const { token } = theme.useToken();
  const { sources, requestCollections } = useSources();
  const { rules, ruleCollections } = useHeaderRules();
  const { environments, activeEnvironment, switchEnvironment, deleteEnvironment } =
    useEnvironments();
  const { collections, addCollection, updateCollection, removeCollection } = useCollections();

  const [filterText, setFilterText] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [openCollectionsWithSingleClick, setOpenCollectionsWithSingleClick] = useState(false);
  const [openFoldersWithSingleClick, setOpenFoldersWithSingleClick] = useState(false);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectOpenedFileRef = useRef<(() => void) | null>(null);

  // ── Expanded state ───────────────────────────────────────────
  // expandedKeys, ensureExpanded, toggleExpand come from props (useSidebarExpansion hook)
  const expandedSectionsSet = useMemo(() => new Set(expandedSectionsProp ?? []), [expandedSectionsProp]);

  const toggleSection = useCallback(
    (section: string) => {
      const next = new Set(expandedSectionsSet);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      onExpandedSectionsChange?.([...next]);
    },
    [expandedSectionsSet, onExpandedSectionsChange],
  );

  const collectionsExpanded = expandedSectionsSet.has('collections');
  const rulesExpanded = expandedSectionsSet.has('rules');
  const envsExpanded = expandedSectionsSet.has('environments');

  // ── Confirm delete dialog ────────────────────────────────────
  const confirmDelete = useCallback((name: string, onConfirm: () => void) => {
    Modal.confirm({
      title: <span style={{ fontSize: 13, fontWeight: 600 }}>Delete item?</span>,
      width: 380,
      content: (
        <p style={{ fontSize: 12, margin: '4px 0 0' }}>
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </p>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true, size: 'small' },
      cancelButtonProps: { size: 'small' },
      onOk: onConfirm,
    });
  }, []);

  // ── Folder CRUD ──────────────────────────────────────────────
  const folderActions = useFolderActions();

  // ── Create folder (stubbed — V5 folders are in collection trees) ──
  const _createNewFolder = useCallback(
    async (
      _section: string,
      _collectionId: string,
      _parentFolderId: string | null,
    ) => {
      // TODO: add folder via IPC
    },
    [],
  );

  // ── Tree data ────────────────────────────────────────────────
  const treeData = useTreeData({
    requestCollections,
    ruleCollections,
    rules,
    environments,
    activeEnvironment,
    expandedKeys,
    filter: filterText,
    onOpenTab: onOpenTab ?? (() => {}),
    onToggleExpand: toggleExpand,
    onStartRename: setRenamingId,
    onNewRequest: onNewRequest ?? (() => {}),
    onNewRule: onNewRule ?? (() => {}),
    onNewEnvironment: onNewEnvironment ?? (() => {}),
    switchEnvironment,
    deleteEnvironment,
    updateCollection,
    removeCollection,
    confirmDelete,
    onOpenCollectionVariables,
  });

  // ── Flat items for keyboard nav ──────────────────────────────
  const allFlatItems = useMemo(() => {
    const items: TreeNode[] = [];
    if (collectionsExpanded) items.push(...treeData.requestsNodes);
    if (rulesExpanded) items.push(...treeData.rulesNodes);
    if (envsExpanded) items.push(...treeData.environmentsNodes);
    return items;
  }, [collectionsExpanded, rulesExpanded, envsExpanded, treeData]);

  // ── Selected/focused logic ───────────────────────────────────
  const focusIsElsewhere = focusedId != null && focusedId !== activeTabId;

  const isSelected = useCallback(
    (id: string) => activeTabId === id && !focusIsElsewhere,
    [activeTabId, focusIsElsewhere],
  );

  const isFocused = useCallback((id: string) => focusedId === id, [focusedId]);

  // ── Item interaction ─────────────────────────────────────────
  const openItem = useCallback((node: TreeNode) => {
    node.onOpen?.();
  }, []);

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
      if (shouldOpenOnSingleClick(node)) openItem(node);
    },
    [shouldOpenOnSingleClick, openItem],
  );

  const handleItemDoubleClick = useCallback(
    (node: TreeNode) => {
      if (!shouldOpenOnSingleClick(node)) openItem(node);
    },
    [openItem, shouldOpenOnSingleClick],
  );

  // ── Keyboard navigation ──────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = allFlatItems.findIndex((n) => n.id === focusedId);
        const nextIdx =
          e.key === 'ArrowDown'
            ? currentIdx < allFlatItems.length - 1
              ? currentIdx + 1
              : 0
            : currentIdx > 0
              ? currentIdx - 1
              : allFlatItems.length - 1;
        const next = allFlatItems[nextIdx];
        if (next) {
          setFocusedId(next.id);
          if (shouldOpenOnSingleClick(next)) openItem(next);
          setTimeout(() => {
            containerRef.current?.querySelector(`[data-item-id="${next.id}"]`)?.scrollIntoView({ block: 'nearest' });
          }, 0);
        }
      } else if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node) openItem(node);
      } else if (e.key === 'ArrowRight' && focusedId) {
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable) {
          e.preventDefault();
          const ek = node.id;
          if (!expandedKeys.has(ek)) toggleExpand(ek);
        }
      } else if (e.key === 'ArrowLeft' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.expandable) {
          const ek = node.id;
          if (expandedKeys.has(ek)) {
            // Collapse this node
            toggleExpand(ek);
            return;
          }
        }
        // Move focus to parent
        if (node?.parentId) {
          setFocusedId(node.parentId);
          setTimeout(() => {
            containerRef.current
              ?.querySelector(`[data-item-id="${node.parentId}"]`)
              ?.scrollIntoView({ block: 'nearest' });
          }, 0);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.onDelete) node.onDelete();
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        const node = allFlatItems.find((n) => n.id === focusedId);
        if (node?.canRename) setRenamingId(focusedId);
      }
    },
    [allFlatItems, focusedId, openItem, expandedKeys, toggleExpand, shouldOpenOnSingleClick],
  );

  // ── Select opened file ───────────────────────────────────────
  const selectOpenedFile = useCallback(() => {
    if (!activeTabId) return;
    const sections = new Set(expandedSectionsSet);
    if (activeTabId.startsWith('source-')) {
      sections.add('collections');
      // Expand the containing collection (and folder)
      const request = sources.find((s) => `source-${s.uid}` === activeTabId);
      if (request) {
        // TODO: derive collection key from request path
        sections.add('collections');
      }
    } else if (activeTabId.startsWith('rule-')) {
      sections.add('rules');
    } else if (activeTabId.startsWith('env-')) {
      sections.add('environments');
    }
    onExpandedSectionsChange?.([...sections]);
    setFocusedId(activeTabId);
    setTimeout(() => {
      containerRef.current?.querySelector(`[data-item-id="${activeTabId}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 50);
  }, [activeTabId, expandedSectionsSet, sources, ensureExpanded, onExpandedSectionsChange]);

  selectOpenedFileRef.current = selectOpenedFile;

  // Auto-select on active tab change
  const prevActiveTabRef = useRef(activeTabId);
  useEffect(() => {
    if (prevActiveTabRef.current === activeTabId) return;
    prevActiveTabRef.current = activeTabId;
    if (alwaysSelectOpened && activeTabId) selectOpenedFile();
  }, [alwaysSelectOpened, activeTabId, selectOpenedFile]);

  // ── Toolbar actions ──────────────────────────────────────────
  const expandAll = useCallback(() => {
    onExpandedSectionsChange?.(['collections', 'rules', 'environments']);
    const allKeys: string[] = [];
    // All collection keys
    for (const c of collections) allKeys.push(`col-${c.uid}`);
    setAllExpanded?.(allKeys);
  }, [collections, onExpandedSectionsChange, setAllExpanded]);

  const collapseAll = useCallback(() => {
    onExpandedSectionsChange?.([]);
    setAllExpanded?.([]);
  }, [onExpandedSectionsChange, setAllExpanded]);

  const createNewCollection = useCallback(
    async (section: 'requests' | 'rules') => {
      const col = await addCollection(section, { name: 'New Collection', description: '', variables: [] });
      if (col) {
        ensureExpanded(`col-${col.uid}`);
        const tabId = `col-${col.uid}`;
        onOpenTab?.({
          id: tabId,
          type: 'collection-overview',
          label: col.name,
          icon: 'collection',
          entityId: col.uid,
        });
        onPendingRename?.(tabId);
      }
    },
    [addCollection, ensureExpanded, onOpenTab, onPendingRename],
  );

  const createMenuItems = [
    { key: 'request', icon: <ApiOutlined />, label: 'HTTP Request', onClick: () => onNewRequest?.() },
    { key: 'rule', icon: <ThunderboltOutlined />, label: 'Rule', onClick: () => onNewRule?.() },
    { type: 'divider' as const, key: 'div-1' },
    {
      key: 'collection',
      icon: <ApiOutlined />,
      label: 'Collection',
      onClick: () => void createNewCollection('requests'),
    },
    { key: 'environment', icon: <GlobalOutlined />, label: 'Environment', onClick: () => onNewDraftEnvironment?.() },
    { type: 'divider' as const, key: 'div-2' },
    {
      key: 'workspace-variables',
      icon: <GlobalOutlined />,
      label: 'Workspace Variables',
      onClick: () => onOpenWorkspaceVariables?.(),
    },
  ];

  // ── Render section ───────────────────────────────────────────
  const renderNodes = (nodes: TreeNode[], onCreate?: () => void) => {
    if (nodes.length === 0) {
      return (
        <div className="v5-sidebar-empty-state">
          <span style={{ color: token.colorTextSecondary, fontSize: 12, fontWeight: 600 }}>No items in this panel</span>
          {onCreate && (
            <button
              type="button"
              className="v5-sidebar-create-btn"
              style={{ color: token.colorText }}
              onClick={onCreate}
            >
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
        onStartRename={() => {
          if (renamingId === node.id) setRenamingId(null);
          else setRenamingId(node.id);
        }}
      />
    ));
  };

  // ── Allotment sizing ─────────────────────────────────────────
  // The key forces Allotment to remount with correct defaultSizes when sections toggle.
  const sectionKey = `${collectionsExpanded}-${rulesExpanded}-${envsExpanded}`;
  const HEADER_HEIGHT = 28;
  const expandedCount = [collectionsExpanded, rulesExpanded, envsExpanded].filter(Boolean).length;
  const computeSizes = () => {
    const expandedSize = 999;
    return [
      collectionsExpanded ? expandedSize : HEADER_HEIGHT,
      rulesExpanded ? expandedSize : HEADER_HEIGHT,
      envsExpanded ? expandedSize : HEADER_HEIGHT,
    ];
  };

  // ── Render ───────────────────────────────────────────────────
  if (activePanel !== 'items') {
    return (
      <div className="v5-sidebar" style={{ background: token.colorBgLayout }}>
        <div className="v5-sidebar-content">
          {activePanel === 'recordings' && <RecordingsPanel />}
          {activePanel === 'history' && <PlaceholderPanel title="History" />}
          {activePanel === 'files' && <PlaceholderPanel title="Local Files" />}
        </div>
      </div>
    );
  }

  return (
    <div className="v5-sidebar" style={{ background: token.colorBgLayout }}>
      {/* Toolbar */}
      <div className="v5-sidebar-toolbar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          size="small"
          placeholder="Filter"
          prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          allowClear
          style={{ flex: 1, fontSize: 11 }}
          variant="borderless"
        />
        <Dropdown
          menu={{ items: createMenuItems }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setNewMenuOpen}
        >
          <Tooltip title="New item" placement="bottom" open={newMenuOpen ? false : undefined}>
            <div className="v5-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
              <PlusOutlined />
            </div>
          </Tooltip>
        </Dropdown>
        <Tooltip title="Select Opened Tab" placement="bottom">
          <div
            className="v5-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary }}
            onClick={() => selectOpenedFileRef.current?.()}
          >
            <AimOutlined />
          </div>
        </Tooltip>
        <Tooltip title="Expand All" placement="bottom">
          <div className="v5-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={expandAll}>
            <ExpandOutlined />
          </div>
        </Tooltip>
        <Tooltip title="Collapse All" placement="bottom">
          <div className="v5-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }} onClick={collapseAll}>
            <NodeCollapseOutlined />
          </div>
        </Tooltip>
        <Dropdown
          menu={{
            items: [
              {
                key: 'behavior',
                label: 'Behavior',
                children: [
                  {
                    key: 'single-click',
                    label: `${openWithSingleClick ? '✓ ' : ''}Open Entries with Single Click`,
                    onClick: () => setOpenWithSingleClick((v) => !v),
                  },
                  {
                    key: 'collections-single-click',
                    label: `${openCollectionsWithSingleClick ? '✓ ' : ''}Open Collections with Single Click`,
                    onClick: () => setOpenCollectionsWithSingleClick((v) => !v),
                  },
                  {
                    key: 'folders-single-click',
                    label: `${openFoldersWithSingleClick ? '✓ ' : ''}Open Folders with Single Click`,
                    onClick: () => setOpenFoldersWithSingleClick((v) => !v),
                  },
                  {
                    key: 'always-select',
                    label: `${alwaysSelectOpened ? '✓ ' : ''}Always Select Opened Tab`,
                    onClick: () => setAlwaysSelectOpened((v) => !v),
                  },
                ],
              },
            ],
          }}
          trigger={['click']}
          placement="bottomRight"
          onOpenChange={setOptionsMenuOpen}
        >
          <Tooltip title="Options" placement="bottom" open={optionsMenuOpen ? false : undefined}>
            <div className="v5-sidebar-toolbar-icon" style={{ color: token.colorTextSecondary }}>
              <EllipsisOutlined />
            </div>
          </Tooltip>
        </Dropdown>
      </div>

      {/* Tree content */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard navigation requires focus */}
      <div
        ref={containerRef}
        className="v5-sidebar-content"
        onKeyDown={handleKeyDown}
        tabIndex={0}
        style={{ outline: 'none' }}
      >
        <Allotment key={sectionKey} vertical proportionalLayout={expandedCount > 1} defaultSizes={computeSizes()}>
          <Allotment.Pane minSize={HEADER_HEIGHT}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <SectionHeader
                title="API REQUESTS"
                expanded={collectionsExpanded}
                onToggle={() => toggleSection('collections')}
              />
              {collectionsExpanded && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {renderNodes(treeData.requestsNodes, () => void createNewCollection('requests'))}
                </div>
              )}
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={HEADER_HEIGHT}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <SectionHeader title="RULES" expanded={rulesExpanded} onToggle={() => toggleSection('rules')} />
              {rulesExpanded && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {renderNodes(treeData.rulesNodes, () => void createNewCollection('rules'))}
                </div>
              )}
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={HEADER_HEIGHT}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <SectionHeader
                title="ENVIRONMENTS"
                expanded={envsExpanded}
                onToggle={() => toggleSection('environments')}
              />
              {envsExpanded && (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {renderNodes(treeData.environmentsNodes, () => onNewEnvironment?.())}
                </div>
              )}
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
}
