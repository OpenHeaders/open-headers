/**
 * Sidebar — IDE-style tree panel with selection, keyboard navigation, and toolbar.
 *
 * Architecture:
 *   - **Selected item**: corresponds to the active tab (highlighted background)
 *   - **Focused item**: the item with keyboard focus (border outline), moves with arrow keys
 *   - **Flat item list**: computed from visible (expanded) tree nodes for keyboard navigation
 *   - Enter on focused item → opens it in a tab
 *   - Arrow keys move focus through the flat list
 *   - Toolbar: + (new), ⊙ (select opened file), ⬆⬇ (expand/collapse), ✕ (collapse all), ⋮ (behavior), — (minimize)
 */

import {
  AimOutlined,
  ApiOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EllipsisOutlined,
  ExpandOutlined,
  FileOutlined,
  GlobalOutlined,
  MoreOutlined,
  NodeCollapseOutlined,
  PlusOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Allotment } from 'allotment';
import { Button, Dropdown, Input, type MenuProps, Modal, Tooltip, Typography, theme } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEnvironments, useHeaderRules, useSources } from '@/renderer/hooks/useCentralizedWorkspace';
import type { ActivityPanel } from './V5Shell';

const { Text } = Typography;

interface OpenTabRequest {
  id: string;
  type: 'rule' | 'environment' | 'collection';
  label: string;
  icon?: string;
  entityId?: string;
}

// ── Tree item model for keyboard navigation ──────────────────────

interface TreeItem {
  /** Unique ID matching the tab id pattern (source-X, rule-X, env-X, or collection-tag:X) */
  id: string;
  /** Type for opening tabs */
  type: 'source' | 'rule' | 'environment' | 'collection-header' | 'section-header';
  /** Whether this is an expandable node */
  expandable: boolean;
  /** Depth for indentation (0 = top, 1 = nested) */
  depth: number;
}

interface SidebarProps {
  activePanel: ActivityPanel;
  onOpenTab?: (tab: OpenTabRequest) => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onNewEnvironment?: () => void;
  expandedSections?: string[];
  onExpandedSectionsChange?: (sections: string[]) => void;
  expandedCollections?: string[];
  onExpandedCollectionsChange?: (collections: string[]) => void;
  /** Currently active tab ID — drives selected state in sidebar */
  activeTabId?: string | null;
}

// ── Shared subcomponents ─────────────────────────────────────────

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
        <CaretRightOutlined
          style={{
            fontSize: 10,
            marginRight: 4,
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        />
        {title}
      </span>
    </div>
  );
}

function SourceMethodBadge({ method }: { method?: string }) {
  const colors: Record<string, string> = {
    GET: '#61affe',
    POST: '#49cc90',
    PUT: '#fca130',
    PATCH: '#50e3c2',
    DELETE: '#f93e3e',
  };
  const m = method || 'GET';
  return (
    <span
      style={{
        fontSize: 8,
        fontWeight: 700,
        color: 'white',
        background: colors[m] || '#999',
        padding: '1px 3px',
        borderRadius: 2,
        flexShrink: 0,
      }}
    >
      {m}
    </span>
  );
}

function InlineRenameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (n: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);
  return (
    <input
      autoFocus
      className="v5-sidebar-rename-input"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== value) onCommit(t);
        else onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          const t = text.trim();
          if (t && t !== value) onCommit(t);
          else onCancel();
        } else if (e.key === 'Escape') onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function ItemContextMenu({
  onRename,
  onDelete,
  disableRename,
  children,
}: {
  onRename?: () => void;
  onDelete: () => void;
  disableRename?: boolean;
  children: React.ReactNode;
}) {
  const items = [
    { key: 'rename', icon: <EditOutlined />, label: 'Rename', disabled: disableRename, onClick: () => onRename?.() },
    { key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicate', disabled: true },
    { type: 'divider' as const, key: 'divider' },
    { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: onDelete },
  ];
  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      {children}
    </Dropdown>
  );
}

// ── Items Panel (the main tree) ──────────────────────────────────

function ItemsPanel({
  onOpenTab,
  onNewRequest,
  onNewRule,
  onNewEnvironment,
  filterText = '',
  expandedSections: expandedSectionsProp,
  onExpandedSectionsChange,
  expandedCollections: expandedCollectionsProp,
  onExpandedCollectionsChange,
  activeTabId,
  selectOpenedFileRef,
  expandAllRef,
  openWithSingleClick = true,
  alwaysSelectOpened = true,
}: {
  onOpenTab?: (tab: OpenTabRequest) => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  onNewEnvironment?: () => void;
  filterText?: string;
  expandedSections?: string[];
  onExpandedSectionsChange?: (sections: string[]) => void;
  expandedCollections?: string[];
  onExpandedCollectionsChange?: (collections: string[]) => void;
  activeTabId?: string | null;
  selectOpenedFileRef?: React.MutableRefObject<(() => void) | null>;
  expandAllRef?: React.MutableRefObject<(() => void) | null>;
  openWithSingleClick?: boolean;
  alwaysSelectOpened?: boolean;
}) {
  const { token } = theme.useToken();
  const { sources, updateSource, removeSource } = useSources();
  const { rules, updateRule, removeRule } = useHeaderRules();
  const { environments, activeEnvironment, deleteEnvironment } = useEnvironments();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRenameSource = useCallback(
    async (sourceId: string, newName: string) => {
      await updateSource(sourceId, { sourceName: newName });
      setRenamingId(null);
    },
    [updateSource],
  );
  const handleRenameRule = useCallback(
    async (ruleId: string, newName: string) => {
      await updateRule(ruleId, { name: newName });
      setRenamingId(null);
    },
    [updateRule],
  );

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

  const expandedSectionsSet = useMemo(() => new Set(expandedSectionsProp ?? []), [expandedSectionsProp]);
  const toggleSection = (section: string) => {
    const next = new Set(expandedSectionsSet);
    if (next.has(section)) next.delete(section);
    else next.add(section);
    onExpandedSectionsChange?.([...next]);
  };

  const filter = filterText.toLowerCase();

  const collections = useMemo(() => {
    const grouped = new Map<string, typeof sources>();
    for (const source of sources) {
      const label = source.sourceName || source.sourcePath || '';
      if (filter && !label.toLowerCase().includes(filter) && !(source.sourceTag || '').toLowerCase().includes(filter))
        continue;
      const tag = source.sourceTag || 'Ungrouped';
      const existing = grouped.get(tag) ?? [];
      existing.push(source);
      grouped.set(tag, existing);
    }
    return grouped;
  }, [sources, filter]);

  const filteredRules = useMemo(() => {
    if (!filter) return rules;
    return rules.filter((r) => (r.name || r.headerName).toLowerCase().includes(filter));
  }, [rules, filter]);

  const filteredEnvNames = useMemo(() => {
    const names = Object.keys(environments);
    if (!filter) return names;
    return names.filter((n) => n.toLowerCase().includes(filter));
  }, [environments, filter]);

  const expandedCollections = useMemo(() => new Set(expandedCollectionsProp ?? []), [expandedCollectionsProp]);
  const toggleCollection = (tag: string) => {
    const next = new Set(expandedCollections);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    onExpandedCollectionsChange?.([...next]);
  };

  const collectionsExpanded = expandedSectionsSet.has('collections');
  const rulesExpanded = expandedSectionsSet.has('rules');
  const envsExpanded = expandedSectionsSet.has('environments');

  // ── Flat item list for keyboard navigation ──────────────────
  const flatItems = useMemo(() => {
    const items: TreeItem[] = [];
    if (collectionsExpanded) {
      for (const [tag, tagSources] of collections) {
        items.push({ id: `col-${tag}`, type: 'collection-header', expandable: true, depth: 0 });
        if (expandedCollections.has(tag)) {
          for (const s of tagSources) {
            items.push({ id: `source-${s.sourceId}`, type: 'source', expandable: false, depth: 1 });
          }
        }
      }
    }
    if (rulesExpanded) {
      for (const r of filteredRules) {
        items.push({ id: `rule-${r.id}`, type: 'rule', expandable: false, depth: 0 });
      }
    }
    if (envsExpanded) {
      for (const name of filteredEnvNames) {
        items.push({ id: `env-${name}`, type: 'environment', expandable: false, depth: 0 });
      }
    }
    return items;
  }, [
    collectionsExpanded,
    collections,
    expandedCollections,
    rulesExpanded,
    filteredRules,
    envsExpanded,
    filteredEnvNames,
  ]);

  // Open the focused item as a tab
  const openItem = useCallback(
    (itemId: string) => {
      if (itemId.startsWith('source-')) {
        const sourceId = itemId.slice(7);
        const source = sources.find((s) => s.sourceId === sourceId);
        if (source)
          onOpenTab?.({
            id: itemId,
            type: 'collection',
            label: source.sourceName || source.sourcePath || 'Untitled',
            icon: source.sourceMethod || source.sourceType,
            entityId: sourceId,
          });
      } else if (itemId.startsWith('rule-')) {
        const ruleId = itemId.slice(5);
        const rule = rules.find((r) => r.id === ruleId);
        if (rule)
          onOpenTab?.({
            id: itemId,
            type: 'rule',
            label: rule.name || rule.headerName,
            icon: 'rule',
            entityId: ruleId,
          });
      } else if (itemId.startsWith('env-')) {
        const name = itemId.slice(4);
        onOpenTab?.({ id: itemId, type: 'environment', label: name, icon: 'environment', entityId: name });
      } else if (itemId.startsWith('col-')) {
        toggleCollection(itemId.slice(4));
      }
    },
    [sources, rules, onOpenTab, toggleCollection],
  );

  // Select opened file: expand the containing section + collection, then scroll to and focus
  const selectOpenedFile = useCallback(() => {
    if (!activeTabId) return;

    // Determine which section to expand
    const sections = new Set(expandedSectionsSet);
    if (activeTabId.startsWith('source-')) {
      sections.add('collections');
      // Find which collection tag contains this source
      const sourceId = activeTabId.slice(7);
      for (const [tag, tagSources] of collections) {
        if (tagSources.some((s) => s.sourceId === sourceId)) {
          const next = new Set(expandedCollections);
          next.add(tag);
          onExpandedCollectionsChange?.([...next]);
          break;
        }
      }
    } else if (activeTabId.startsWith('rule-')) {
      sections.add('rules');
    } else if (activeTabId.startsWith('env-')) {
      sections.add('environments');
    }
    onExpandedSectionsChange?.([...sections]);

    setFocusedId(activeTabId);
    // Wait for DOM to update after expanding, then scroll
    setTimeout(() => {
      containerRef.current?.querySelector(`[data-item-id="${activeTabId}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 50);
  }, [
    activeTabId,
    expandedSectionsSet,
    collections,
    expandedCollections,
    onExpandedSectionsChange,
    onExpandedCollectionsChange,
  ]);

  // Expand all sections and all collection sub-nodes
  const expandAllItems = useCallback(() => {
    onExpandedSectionsChange?.(['collections', 'rules', 'environments']);
    onExpandedCollectionsChange?.([...collections.keys()]);
  }, [collections, onExpandedSectionsChange, onExpandedCollectionsChange]);

  // Expose for toolbar
  if (selectOpenedFileRef) selectOpenedFileRef.current = selectOpenedFile;
  if (expandAllRef) expandAllRef.current = expandAllItems;

  // Auto-select: when active tab changes, expand its parent and scroll to it.
  // Skip initial mount to avoid triggering Allotment remount during first render.
  const prevActiveTabRef = useRef(activeTabId);
  useEffect(() => {
    if (prevActiveTabRef.current === activeTabId) return;
    prevActiveTabRef.current = activeTabId;
    if (alwaysSelectOpened && activeTabId) {
      selectOpenedFile();
    }
  }, [alwaysSelectOpened, activeTabId, selectOpenedFile]);

  // Item click handler — respects openWithSingleClick behavior
  const handleItemClick = useCallback(
    (itemId: string) => {
      setFocusedId(itemId);
      if (openWithSingleClick) openItem(itemId);
    },
    [openWithSingleClick, openItem],
  );

  const handleItemDoubleClick = useCallback(
    (itemId: string) => {
      if (!openWithSingleClick) openItem(itemId);
    },
    [openWithSingleClick, openItem],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentIdx = flatItems.findIndex((item) => item.id === focusedId);
        let nextIdx: number;
        if (e.key === 'ArrowDown') {
          nextIdx = currentIdx < flatItems.length - 1 ? currentIdx + 1 : 0;
        } else {
          nextIdx = currentIdx > 0 ? currentIdx - 1 : flatItems.length - 1;
        }
        const nextId = flatItems[nextIdx]?.id;
        if (nextId) {
          setFocusedId(nextId);
          if (openWithSingleClick && !nextId.startsWith('col-')) openItem(nextId);
          setTimeout(() => {
            containerRef.current?.querySelector(`[data-item-id="${nextId}"]`)?.scrollIntoView({ block: 'nearest' });
          }, 0);
        }
      } else if (e.key === 'Enter' && focusedId) {
        e.preventDefault();
        openItem(focusedId);
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && focusedId) {
        // Expand/collapse collection headers
        if (focusedId.startsWith('col-')) {
          e.preventDefault();
          const tag = focusedId.slice(4);
          if (e.key === 'ArrowRight' && !expandedCollections.has(tag)) toggleCollection(tag);
          if (e.key === 'ArrowLeft' && expandedCollections.has(tag)) toggleCollection(tag);
        }
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && focusedId) {
        e.preventDefault();
        if (focusedId.startsWith('source-')) {
          const s = sources.find((src) => src.sourceId === focusedId.slice(7));
          confirmDelete(s?.sourceName || s?.sourcePath || 'this source', () => removeSource(focusedId.slice(7)));
        } else if (focusedId.startsWith('rule-')) {
          const r = rules.find((rule) => rule.id === focusedId.slice(5));
          confirmDelete(r?.name || r?.headerName || 'this rule', () => removeRule(focusedId.slice(5)));
        } else if (focusedId.startsWith('env-')) {
          const name = focusedId.slice(4);
          confirmDelete(name, () => deleteEnvironment(name));
        }
      } else if (e.key === 'F2' && focusedId) {
        e.preventDefault();
        if (focusedId.startsWith('source-') || focusedId.startsWith('rule-')) {
          setRenamingId(focusedId);
        }
      }
    },
    [
      flatItems,
      focusedId,
      openItem,
      expandedCollections,
      toggleCollection,
      removeSource,
      removeRule,
      deleteEnvironment,
    ],
  );

  // Helper to build className.
  // When focus has moved away from the active tab (user is browsing the tree),
  // dim the "selected" highlight so only the focused item stands out.
  const focusIsElsewhere = focusedId != null && focusedId !== activeTabId;
  const itemClass = (itemId: string) => {
    const parts = ['v5-sidebar-item'];
    if (activeTabId === itemId && !focusIsElsewhere) parts.push('selected');
    if (focusedId === itemId) parts.push('focused');
    return parts.join(' ');
  };

  const expandKey = `${collectionsExpanded}-${rulesExpanded}-${envsExpanded}`;
  const expandedCount = [collectionsExpanded, rulesExpanded, envsExpanded].filter(Boolean).length;
  const HEADER_HEIGHT = 28;
  const computeSizes = () => {
    const expandedSize = 999;
    return [
      collectionsExpanded ? expandedSize : HEADER_HEIGHT,
      rulesExpanded ? expandedSize : HEADER_HEIGHT,
      envsExpanded ? expandedSize : HEADER_HEIGHT,
    ];
  };

  // ── Render ────────────────────────────────────────────────────

  const collectionsContent =
    collections.size > 0 ? (
      [...collections.entries()].map(([tag, tagSources]) => {
        const isExpanded = expandedCollections.has(tag);
        const colId = `col-${tag}`;
        return (
          <div key={tag}>
            <div
              className={itemClass(colId)}
              data-item-id={colId}
              style={{ color: token.colorText }}
              onClick={() => {
                setFocusedId(colId);
                toggleCollection(tag);
              }}
            >
              <CaretRightOutlined
                style={{
                  color: token.colorTextTertiary,
                  fontSize: 10,
                  transition: 'transform 0.2s',
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              />
              <ApiOutlined style={{ color: token.colorTextTertiary, fontSize: 12 }} />
              <span className="v5-sidebar-item-label">{tag}</span>
              <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>
                {tagSources.length}
              </Text>
            </div>
            {isExpanded &&
              tagSources.map((source) => {
                const sourceLabel = source.sourceName || source.sourcePath || 'Untitled';
                const isRenaming = renamingId === `source-${source.sourceId}`;
                const sid = `source-${source.sourceId}`;
                return (
                  <div
                    key={source.sourceId}
                    className={`${itemClass(sid)} v5-sidebar-item-nested`}
                    data-item-id={sid}
                    style={{ color: token.colorText }}
                    onClick={() => {
                      if (!isRenaming) handleItemClick(sid);
                    }}
                    onDoubleClick={() => {
                      if (!isRenaming) handleItemDoubleClick(sid);
                    }}
                  >
                    {source.sourceType === 'http' ? (
                      <SourceMethodBadge method={source.sourceMethod} />
                    ) : (
                      <FileOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />
                    )}
                    {isRenaming ? (
                      <InlineRenameInput
                        value={sourceLabel}
                        onCommit={(name) => handleRenameSource(source.sourceId, name)}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <>
                        <span className="v5-sidebar-item-label">{sourceLabel}</span>
                        <ItemContextMenu
                          onRename={() => setRenamingId(sid)}
                          onDelete={() => confirmDelete(sourceLabel, () => removeSource(source.sourceId))}
                        >
                          <MoreOutlined className="v5-sidebar-item-menu" onClick={(e) => e.stopPropagation()} />
                        </ItemContextMenu>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })
    ) : (
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No collections yet.
      </div>
    );

  const rulesContent =
    filteredRules.length > 0 ? (
      filteredRules.map((rule) => {
        const ruleLabel = rule.name || rule.headerName;
        const isRenaming = renamingId === `rule-${rule.id}`;
        const rid = `rule-${rule.id}`;
        return (
          <div
            key={rule.id}
            className={itemClass(rid)}
            data-item-id={rid}
            style={{ color: token.colorText }}
            onClick={() => {
              if (!isRenaming) handleItemClick(rid);
            }}
            onDoubleClick={() => {
              if (!isRenaming) handleItemDoubleClick(rid);
            }}
          >
            <ThunderboltOutlined
              style={{ color: rule.isEnabled ? token.colorSuccess : token.colorTextTertiary, fontSize: 12 }}
            />
            {isRenaming ? (
              <InlineRenameInput
                value={ruleLabel}
                onCommit={(name) => handleRenameRule(rule.id, name)}
                onCancel={() => setRenamingId(null)}
              />
            ) : (
              <>
                <span className="v5-sidebar-item-label">{ruleLabel}</span>
                {!rule.isEnabled && (
                  <Text type="secondary" style={{ fontSize: 9, marginLeft: 'auto' }}>
                    off
                  </Text>
                )}
                <ItemContextMenu
                  onRename={() => setRenamingId(rid)}
                  onDelete={() => confirmDelete(ruleLabel, () => removeRule(rule.id))}
                >
                  <MoreOutlined className="v5-sidebar-item-menu" onClick={(e) => e.stopPropagation()} />
                </ItemContextMenu>
              </>
            )}
          </div>
        );
      })
    ) : (
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        <ThunderboltOutlined /> No rules.
      </div>
    );

  const envsContent =
    filteredEnvNames.length > 0 ? (
      filteredEnvNames.map((name) => {
        const eid = `env-${name}`;
        return (
          <div
            key={name}
            className={itemClass(eid)}
            data-item-id={eid}
            style={{ color: token.colorText }}
            onClick={() => handleItemClick(eid)}
            onDoubleClick={() => handleItemDoubleClick(eid)}
          >
            <GlobalOutlined
              style={{ color: name === activeEnvironment ? token.colorPrimary : token.colorTextTertiary, fontSize: 12 }}
            />
            <span className="v5-sidebar-item-label">{name}</span>
            {name === activeEnvironment && (
              <Text type="secondary" style={{ fontSize: 9, marginLeft: 'auto', color: token.colorPrimary }}>
                active
              </Text>
            )}
            <ItemContextMenu disableRename onDelete={() => confirmDelete(name, () => deleteEnvironment(name))}>
              <MoreOutlined className="v5-sidebar-item-menu" onClick={(e) => e.stopPropagation()} />
            </ItemContextMenu>
          </div>
        );
      })
    ) : (
      <div className="v5-sidebar-empty" style={{ color: token.colorTextTertiary }}>
        No environments.
      </div>
    );

  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: sidebar tree needs focus for keyboard nav
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ outline: 'none', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <Allotment key={expandKey} vertical proportionalLayout={expandedCount > 1} defaultSizes={computeSizes()}>
        <Allotment.Pane minSize={HEADER_HEIGHT}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <SectionHeader
              title="COLLECTIONS"
              expanded={collectionsExpanded}
              onToggle={() => toggleSection('collections')}
            />
            {collectionsExpanded && <div style={{ flex: 1, overflowY: 'auto' }}>{collectionsContent}</div>}
          </div>
        </Allotment.Pane>
        <Allotment.Pane minSize={HEADER_HEIGHT}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <SectionHeader title="RULES" expanded={rulesExpanded} onToggle={() => toggleSection('rules')} />
            {rulesExpanded && <div style={{ flex: 1, overflowY: 'auto' }}>{rulesContent}</div>}
          </div>
        </Allotment.Pane>
        <Allotment.Pane minSize={HEADER_HEIGHT}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <SectionHeader
              title="ENVIRONMENTS"
              expanded={envsExpanded}
              onToggle={() => toggleSection('environments')}
            />
            {envsExpanded && <div style={{ flex: 1, overflowY: 'auto' }}>{envsContent}</div>}
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
}

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
  expandedSections,
  onExpandedSectionsChange,
  expandedCollections,
  onExpandedCollectionsChange,
  activeTabId,
}: SidebarProps) {
  const { token } = theme.useToken();
  const [filterText, setFilterText] = useState('');
  const selectOpenedFileRef = useRef<(() => void) | null>(null);
  const expandAllRef = useRef<(() => void) | null>(null);
  const [openWithSingleClick, setOpenWithSingleClick] = useState(true);
  const [alwaysSelectOpened, setAlwaysSelectOpened] = useState(true);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);

  const createMenuItems = [
    { key: 'request', icon: <ApiOutlined />, label: 'HTTP Request', onClick: onNewRequest },
    { key: 'rule', icon: <ThunderboltOutlined />, label: 'Rule', onClick: onNewRule },
    { key: 'environment', icon: <GlobalOutlined />, label: 'Environment', onClick: onNewEnvironment },
  ];

  const collapseAll = useCallback(() => {
    onExpandedSectionsChange?.([]);
    onExpandedCollectionsChange?.([]);
  }, [onExpandedSectionsChange, onExpandedCollectionsChange]);

  return (
    <div className="v5-sidebar" style={{ background: token.colorBgLayout }}>
      {/* Toolbar: Search + action icons */}
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
          <div
            className="v5-sidebar-toolbar-icon"
            style={{ color: token.colorTextSecondary }}
            onClick={() => expandAllRef.current?.()}
          >
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
                    label: `${openWithSingleClick ? '✓ ' : ''}Open Items with Single Click`,
                    onClick: () => setOpenWithSingleClick((v) => !v),
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

      <div className="v5-sidebar-content">
        {activePanel === 'items' && (
          <ItemsPanel
            onOpenTab={onOpenTab}
            onNewRequest={onNewRequest}
            onNewRule={onNewRule}
            onNewEnvironment={onNewEnvironment}
            filterText={filterText}
            expandedSections={expandedSections}
            onExpandedSectionsChange={onExpandedSectionsChange}
            expandedCollections={expandedCollections}
            onExpandedCollectionsChange={onExpandedCollectionsChange}
            activeTabId={activeTabId}
            selectOpenedFileRef={selectOpenedFileRef}
            expandAllRef={expandAllRef}
            openWithSingleClick={openWithSingleClick}
            alwaysSelectOpened={alwaysSelectOpened}
          />
        )}
        {activePanel === 'recordings' && <RecordingsPanel />}
        {activePanel === 'history' && <PlaceholderPanel title="History" />}
        {activePanel === 'files' && <PlaceholderPanel title="Local Files" />}
      </div>
    </div>
  );
}
