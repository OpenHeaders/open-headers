/**
 * TabBar — IDE-style tab strip for workspace.html.
 *
 * Features ported from desktop V5Shell TabBar:
 *   - Right-click context menu (Close, Close Other, Close All, etc.)
 *   - Drag-to-reorder with left/right drop indicator
 *   - Tab search dropdown (chevron, right-aligned) with recently closed
 *   - Shift+Cmd+A shortcut for tab search
 *   - Horizontal wheel scroll
 *   - Auto-scroll active tab into view
 */

import {
  CloseOutlined,
  CodeOutlined,
  DownOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  LinkOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { InputRef } from 'antd';
import { Dropdown, Input, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClosedTab, RulesTab } from '../types';

// ── Icon map ─────────────────────────────────────────────────────

const RULE_TYPE_ICONS: Record<string, React.ReactNode> = {
  header: <SwapOutlined style={{ fontSize: 12, color: '#1890ff' }} />,
  block: <StopOutlined style={{ fontSize: 12, color: '#f5222d' }} />,
  redirect: <SendOutlined style={{ fontSize: 12, color: '#fa8c16' }} />,
  'query-param': <LinkOutlined style={{ fontSize: 12, color: '#52c41a' }} />,
  inject: <CodeOutlined style={{ fontSize: 12, color: '#722ed1' }} />,
};

function tabIcon(tab: RulesTab): React.ReactNode {
  if (tab.mode === 'collection-overview') return <FolderOpenOutlined style={{ fontSize: 12, color: '#999' }} />;
  if (tab.mode === 'folder-overview') return <FolderOutlined style={{ fontSize: 12, color: '#999' }} />;
  return RULE_TYPE_ICONS[tab.ruleType] ?? <ThunderboltOutlined style={{ fontSize: 12 }} />;
}

const TAB_LABEL_MAX = 20;
function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}\u2026${text.slice(text.length - half)}`;
}

// ── Props ────────────────────────────────────────────────────────

interface TabBarProps {
  tabs: RulesTab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCreateRule: (type: string) => void;
  onReorder: (fromId: string, toId: string, side: 'left' | 'right') => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
  onReopenTab: (closed: ClosedTab) => void;
}

// ── Tab Search Dropdown ──────────────────────────────────────────

interface TabSearchProps {
  open: boolean;
  onClose: () => void;
  tabs: RulesTab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
  onReopen: (closed: ClosedTab) => void;
}

const TabSearchDropdown: React.FC<TabSearchProps> = ({
  open,
  onClose,
  tabs,
  activeTabId,
  onSwitch,
  recentlyClosed,
  onReopen,
}) => {
  const { token } = theme.useToken();
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusedIndex(0);
      setClosedExpanded(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const lowerSearch = search.toLowerCase();
  const filteredTabs = tabs.filter((t) => t.label.toLowerCase().includes(lowerSearch));
  const filteredClosed = recentlyClosed.filter((c) => c.tab.label.toLowerCase().includes(lowerSearch));
  const totalItems = filteredTabs.length + (closedExpanded ? filteredClosed.length : 0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, totalItems - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex < filteredTabs.length) {
        onSwitch(filteredTabs[focusedIndex].id);
        onClose();
      } else if (closedExpanded) {
        const closedIdx = focusedIndex - filteredTabs.length;
        if (filteredClosed[closedIdx]) {
          onReopen(filteredClosed[closedIdx]);
          onClose();
        }
      }
    }
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss */}
      <div className="rules-tab-search-backdrop" onClick={onClose} />
      <div
        className="rules-tab-search-dropdown"
        style={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ padding: '8px 8px 4px' }}>
          <Input
            ref={inputRef}
            size="small"
            placeholder="Search tabs..."
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            allowClear
            variant="borderless"
            style={{ fontSize: 12 }}
          />
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '0 4px 4px' }}>
          {/* Open tabs */}
          {filteredTabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            const isFocused = idx === focusedIndex;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: handled by parent onKeyDown
              // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
              <div
                key={tab.id}
                className="rules-tab-search-item"
                style={{
                  background: isFocused ? token.colorFillSecondary : 'transparent',
                  fontWeight: isActive ? 500 : 400,
                }}
                onClick={() => {
                  onSwitch(tab.id);
                  onClose();
                }}
              >
                <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: 'center' }}>{tabIcon(tab)}</span>
                <span
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}
                >
                  {tab.label}
                </span>
                {(tab.dirty || tab.mode === 'create') && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: tab.mode === 'create' ? '#999' : '#ff7875',
                      flexShrink: 0,
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* Recently closed section */}
          {recentlyClosed.length > 0 && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: toggle section */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: toggle section */}
              <div
                className="rules-tab-search-item"
                style={{ fontSize: 11, fontWeight: 600, color: token.colorTextSecondary, marginTop: 4 }}
                onClick={() => setClosedExpanded((v) => !v)}
              >
                <span style={{ fontSize: 9, marginRight: 4 }}>{closedExpanded ? '\u25BC' : '\u25B6'}</span>
                Recently Closed ({recentlyClosed.length})
              </div>
              {closedExpanded &&
                filteredClosed.map((closed, idx) => {
                  const globalIdx = filteredTabs.length + idx;
                  const isFocused = globalIdx === focusedIndex;
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: handled by parent onKeyDown
                    // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
                    <div
                      key={`closed-${closed.tab.id}-${closed.closedAt}`}
                      className="rules-tab-search-item"
                      style={{ background: isFocused ? token.colorFillSecondary : 'transparent', opacity: 0.7 }}
                      onClick={() => {
                        onReopen(closed);
                        onClose();
                      }}
                    >
                      <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: 'center' }}>
                        {tabIcon(closed.tab)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                        }}
                      >
                        {closed.tab.label}
                      </span>
                    </div>
                  );
                })}
            </>
          )}

          {filteredTabs.length === 0 && filteredClosed.length === 0 && (
            <div style={{ padding: '12px 8px', fontSize: 12, color: token.colorTextTertiary, textAlign: 'center' }}>
              No matching tabs
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Main TabBar ─────────────────────────────────────────────────

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onCreateRule,
  onReorder,
  onCloseOther,
  onCloseAll,
  onCloseUnmodified,
  onCloseToLeft,
  onCloseToRight,
  recentlyClosed,
  onReopenTab,
}) => {
  const { token } = theme.useToken();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);

  // ── Drag state ──────────────────────────────────────────────────
  const dragSourceRef = useRef<string | null>(null);
  const dragSideRef = useRef<'left' | 'right'>('right');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSide, setDragSide] = useState<'left' | 'right'>('right');

  // ── Auto-scroll active tab into view ───────────────────────────
  // When the last tab is active, scroll to the end so the "+" button is also visible.
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;
    const container = scrollRef.current;
    const isLastTab = tabs.length > 0 && tabs[tabs.length - 1].id === activeTabId;

    if (isLastTab) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    } else {
      const el = container.querySelector(`[data-tab-id="${activeTabId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId, tabs]);

  // ── Horizontal wheel scroll ────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY;
  }, []);

  // ── Keyboard shortcut: Shift+Cmd+A ────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setTabSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    dragSourceRef.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const side = e.clientX < midX ? 'left' : 'right';
    dragSideRef.current = side;
    setDragOverId(tabId);
    setDragSide(side);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.preventDefault();
      if (dragSourceRef.current && dragSourceRef.current !== tabId) {
        onReorder(dragSourceRef.current, tabId, dragSideRef.current);
      }
      dragSourceRef.current = null;
      setDragOverId(null);
    },
    [onReorder],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragOverId(null);
  }, []);

  // ── Context menu builder ───────────────────────────────────────
  const buildContextMenu = useCallback(
    (tab: RulesTab, tabIndex: number) => ({
      items: [
        { key: 'close', label: 'Close', onClick: () => onClose(tab.id) },
        {
          key: 'close-other',
          label: 'Close Other Tabs',
          disabled: tabs.length <= 1,
          onClick: () => onCloseOther(tab.id),
        },
        { key: 'close-all', label: 'Close All Tabs', onClick: () => onCloseAll() },
        { key: 'close-unmodified', label: 'Close Unmodified Tabs', onClick: () => onCloseUnmodified() },
        { type: 'divider' as const },
        {
          key: 'close-left',
          label: 'Close Tabs to the Left',
          disabled: tabIndex === 0,
          onClick: () => onCloseToLeft(tab.id),
        },
        {
          key: 'close-right',
          label: 'Close Tabs to the Right',
          disabled: tabIndex === tabs.length - 1,
          onClick: () => onCloseToRight(tab.id),
        },
      ],
    }),
    [tabs.length, onClose, onCloseOther, onCloseAll, onCloseUnmodified, onCloseToLeft, onCloseToRight],
  );

  const createMenuItems = [
    { key: 'header', icon: <SwapOutlined />, label: 'Modify Headers', onClick: () => onCreateRule('header') },
    { key: 'block', icon: <StopOutlined />, label: 'Block Requests', onClick: () => onCreateRule('block') },
    { key: 'redirect', icon: <SendOutlined />, label: 'Redirect Requests', onClick: () => onCreateRule('redirect') },
    {
      key: 'query-param',
      icon: <LinkOutlined />,
      label: 'Modify Query Params',
      onClick: () => onCreateRule('query-param'),
    },
    { key: 'inject', icon: <CodeOutlined />, label: 'Inject Scripts/CSS', onClick: () => onCreateRule('inject') },
  ];

  return (
    <div
      className="rules-tabs-bar"
      style={{ background: token.colorBgLayout, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
    >
      {/* Scrollable tabs */}
      <div className="rules-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isDragTarget = dragOverId === tab.id && dragSourceRef.current !== tab.id;

          return (
            <Tooltip key={tab.id} title={tab.label} placement="bottom" mouseEnterDelay={0.5}>
              <Dropdown menu={buildContextMenu(tab, index)} trigger={['contextMenu']}>
                <div
                  className={`rules-tab${isActive ? ' active' : ''}`}
                  data-tab-id={tab.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tab.id)}
                  onDragOver={(e) => handleDragOver(e, tab.id)}
                  onDrop={(e) => handleDrop(e, tab.id)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => setDragOverId(null)}
                  style={{
                    color: isActive ? token.colorText : token.colorTextSecondary,
                    borderBottomColor: isActive ? token.colorPrimary : 'transparent',
                    background: isActive ? token.colorBgContainer : 'transparent',
                    borderLeft: isDragTarget && dragSide === 'left' ? `2px solid ${token.colorPrimary}` : undefined,
                    borderRight: isDragTarget && dragSide === 'right' ? `2px solid ${token.colorPrimary}` : undefined,
                  }}
                  onClick={() => onSwitch(tab.id)}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSwitch(tab.id);
                  }}
                >
                  <span className="rules-type-badge">{tabIcon(tab)}</span>
                  <span className="rules-tab-label" style={tab.mode === 'create' ? { fontStyle: 'italic' } : undefined}>
                    {truncateMiddle(tab.label, TAB_LABEL_MAX)}
                  </span>
                  {(tab.dirty || tab.mode === 'create') && (
                    <span
                      className="rules-tab-unsaved"
                      style={{ background: tab.mode === 'create' ? '#999' : '#ff7875' }}
                    />
                  )}
                  <CloseOutlined
                    className="rules-tab-close"
                    style={{ fontSize: 10, color: token.colorTextTertiary }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(tab.id);
                    }}
                  />
                </div>
              </Dropdown>
            </Tooltip>
          );
        })}

        {/* + button: inside scroll area, right after last tab */}
        <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
          <div className="rules-tab-action" style={{ color: token.colorTextSecondary, flexShrink: 0 }}>
            <PlusOutlined style={{ fontSize: 12 }} />
          </div>
        </Dropdown>
      </div>

      {/* Tab search chevron (always visible, outside scroll) */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Tooltip title="Search tabs (Shift+Cmd+A)" placement="bottom">
          <div
            className="rules-tab-action"
            style={{ color: token.colorTextSecondary }}
            onClick={() => setTabSearchOpen((v) => !v)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setTabSearchOpen((v) => !v);
            }}
          >
            <DownOutlined style={{ fontSize: 10 }} />
          </div>
        </Tooltip>
        <TabSearchDropdown
          open={tabSearchOpen}
          onClose={() => setTabSearchOpen(false)}
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={onSwitch}
          recentlyClosed={recentlyClosed}
          onReopen={onReopenTab}
        />
      </div>
    </div>
  );
};

export default TabBar;
