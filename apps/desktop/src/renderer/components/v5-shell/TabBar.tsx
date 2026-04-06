/**
 * TabBar — horizontal tab strip for editor tabs.
 *
 * Uses custom CSS tabs instead of antd Tabs to avoid EllipsisMeasure crashes
 * inside Allotment panes.
 *
 * Features: method-colored labels, unsaved dot, close on X, pinned tabs,
 * drag-and-drop reorder, right-click context menu, horizontal scroll,
 * + button (new Request/Rule), chevron dropdown (search/select open tabs).
 */

import {
  ApiOutlined,
  CloseOutlined,
  DownOutlined,
  PlusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Dropdown, Input, type InputRef, Tooltip, theme } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tab } from './hooks/useTabs';

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onTogglePin: (tabId: string) => void;
  onReorder: (fromId: string, toId: string, side: 'left' | 'right') => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onNewRequest?: () => void;
  onNewRule?: () => void;
  getTabTooltip?: (tab: Tab) => string;
}

function MethodBadge({ method, size = 'normal' }: { method: string; size?: 'normal' | 'small' }) {
  const color = METHOD_COLORS[method] || '#999';
  const fontSize = size === 'small' ? 7 : 8;
  return (
    <span
      style={{
        background: color,
        color: 'white',
        fontSize,
        fontWeight: 700,
        padding: '1px 3px',
        borderRadius: 2,
        flexShrink: 0,
        lineHeight: '14px',
      }}
    >
      {method}
    </span>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  const { token } = theme.useToken();

  if (tab.type === 'request' || tab.type === 'collection') {
    const method = tab.icon || 'GET';
    const color = METHOD_COLORS[method] || token.colorPrimary;
    return (
      <span className="v5-method-badge" style={{ background: color }}>
        {method}
      </span>
    );
  }
  if (tab.type === 'rule') {
    return <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 12 }} />;
  }
  if (tab.type === 'environment') {
    return (
      <span
        style={{
          background: '#52c41a',
          color: 'white',
          fontSize: 9,
          fontWeight: 700,
          padding: '0 4px',
          borderRadius: 3,
          lineHeight: '16px',
        }}
      >
        E
      </span>
    );
  }
  if (tab.type === 'settings') {
    return <span style={{ fontSize: 11 }}>&#x2699;</span>;
  }
  return null;
}

// ── Tab search/select dropdown ──────────────────────────────────

function TabSearchDropdown({
  open,
  onClose,
  tabs,
  activeTabId,
  onSwitch,
}: {
  open: boolean;
  onClose: () => void;
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
}) {
  const { token } = theme.useToken();
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset focused index when search changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [search]);

  if (!open) return null;

  const filter = search.toLowerCase();
  const filtered = tabs.filter(
    (t) => t.type !== 'welcome' && (t.label.toLowerCase().includes(filter) || (t.icon || '').toLowerCase().includes(filter)),
  );

  const selectFocused = () => {
    if (filtered.length > 0 && focusedIndex < filtered.length) {
      onSwitch(filtered[focusedIndex].id);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
      // Scroll focused item into view
      setTimeout(() => {
        listRef.current?.querySelector('[data-focused="true"]')?.scrollIntoView({ block: 'nearest' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      setTimeout(() => {
        listRef.current?.querySelector('[data-focused="true"]')?.scrollIntoView({ block: 'nearest' });
      }, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectFocused();
    }
  };

  return (
    <>
      <div className="v5-tab-search-backdrop" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} role="presentation" />
      <div
        className="v5-tab-search-dropdown"
        style={{ background: token.colorBgElevated, border: `1px solid ${token.colorBorderSecondary}` }}
      >
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${token.colorBorderSecondary}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Input
            ref={inputRef}
            placeholder="Search tabs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="borderless"
            size="small"
            style={{ flex: 1, fontSize: 12 }}
            onKeyDown={handleKeyDown}
          />
          <span style={{ fontSize: 10, color: token.colorTextTertiary, whiteSpace: 'nowrap' }}>&#x21E7;&#x2318;A</span>
        </div>
        <div ref={listRef} style={{ maxHeight: 300, overflowY: 'auto' }}>
          {filtered.length > 0 ? (
            filtered.map((tab, index) => (
              <div
                key={tab.id}
                className="v5-tab-search-item"
                data-focused={index === focusedIndex}
                style={{
                  color: token.colorText,
                  background: index === focusedIndex ? token.colorBgTextHover : undefined,
                }}
                onClick={() => {
                  onSwitch(tab.id);
                  onClose();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                role="button"
                tabIndex={-1}
              >
                {(tab.type === 'request' || tab.type === 'collection') && <MethodBadge method={tab.icon || 'GET'} />}
                {tab.type === 'rule' && <ThunderboltOutlined style={{ color: '#1890ff', fontSize: 11 }} />}
                {tab.type === 'environment' && (
                  <span style={{ background: '#52c41a', color: 'white', fontSize: 8, fontWeight: 700, padding: '0 3px', borderRadius: 2 }}>E</span>
                )}
                {tab.type === 'settings' && <span style={{ fontSize: 10 }}>&#x2699;</span>}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tab.label}
                </span>
                {tab.unsaved && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff7875', flexShrink: 0 }} />}
              </div>
            ))
          ) : (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: token.colorTextTertiary }}>
              No matching tabs
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── TabBar ──────────────────────────────────────────────────────

export function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onReorder,
  onCloseOther,
  onCloseAll,
  onCloseUnmodified,
  onCloseToLeft,
  onCloseToRight,
  onNewRequest,
  onNewRule,
  getTabTooltip,
}: TabBarProps) {
  const { token } = theme.useToken();
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragSide, setDragSide] = useState<'left' | 'right' | null>(null);
  const dragSourceRef = useRef<string | null>(null);
  const dragSideRef = useRef<'left' | 'right' | null>(null);
  dragSideRef.current = dragSide;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!scrollRef.current || !activeTabId) return;
    const container = scrollRef.current;
    const activeEl = container.querySelector(`[data-tab-id="${activeTabId}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId]);

  // Horizontal wheel scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // ⇧⌘A hotkey for tab search
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

  const handleDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    dragSourceRef.current = tabId;
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSourceRef.current === tabId) {
      setDragOverId(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    setDragOverId(tabId);
    setDragSide(e.clientX < midX ? 'left' : 'right');
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, tabId: string) => {
      e.preventDefault();
      if (dragSourceRef.current && dragSourceRef.current !== tabId) {
        onReorder(dragSourceRef.current, tabId, dragSideRef.current || 'right');
      }
      dragSourceRef.current = null;
      setDragOverId(null);
      setDragSide(null);
    },
    [onReorder],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragOverId(null);
    setDragSide(null);
  }, []);

  const buildContextMenu = useCallback(
    (tab: Tab, tabIndex: number) => ({
      items: [
        {
          key: 'close',
          label: 'Close',
          onClick: () => onClose(tab.id),
          disabled: tab.pinned,
        },
        {
          key: 'close-others',
          label: 'Close Other Tabs',
          onClick: () => onCloseOther(tab.id),
          disabled: tabs.length <= 1,
        },
        {
          key: 'close-all',
          label: 'Close All Tabs',
          onClick: () => onCloseAll(),
        },
        {
          key: 'close-unmodified',
          label: 'Close Unmodified Tabs',
          onClick: () => onCloseUnmodified(),
        },
        { type: 'divider' as const, key: 'd1' },
        {
          key: 'close-left',
          label: 'Close Tabs to the Left',
          onClick: () => onCloseToLeft(tab.id),
          disabled: tabIndex === 0,
        },
        {
          key: 'close-right',
          label: 'Close Tabs to the Right',
          onClick: () => onCloseToRight(tab.id),
          disabled: tabIndex === tabs.length - 1,
        },
      ],
    }),
    [tabs, onClose, onCloseOther, onCloseAll, onCloseUnmodified, onCloseToLeft, onCloseToRight],
  );

  const createMenuItems = [
    { key: 'request', icon: <ApiOutlined />, label: 'New Request', onClick: onNewRequest },
    { key: 'rule', icon: <ThunderboltOutlined />, label: 'New Rule', onClick: onNewRule },
  ];

  if (tabs.length === 0) return null;

  return (
    <div
      className="v5-tabs-bar"
      style={{
        background: token.colorBgLayout,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <div className="v5-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeTabId;
          const isDragOver = dragOverId === tab.id;
          const dropIndicatorStyle: React.CSSProperties | undefined =
            isDragOver && dragSide
              ? { [dragSide === 'left' ? 'borderLeft' : 'borderRight']: `2px solid ${token.colorPrimary}` }
              : undefined;

          const tooltipText = getTabTooltip?.(tab) ?? tab.label;

          return (
            <Tooltip key={tab.id} title={tooltipText} placement="bottom" mouseEnterDelay={0.5}>
              <Dropdown menu={buildContextMenu(tab, index)} trigger={['contextMenu']}>
                <div
                  className={`v5-tab${isActive ? ' active' : ''}`}
                data-tab-id={tab.id}
                style={{
                  color: isActive ? token.colorText : token.colorTextSecondary,
                  borderBottomColor: isActive ? token.colorPrimary : 'transparent',
                  background: isActive ? token.colorBgContainer : undefined,
                  ...dropIndicatorStyle,
                }}
                onClick={() => onSwitch(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSwitch(tab.id);
                }}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                draggable
                onDragStart={(e) => handleDragStart(e, tab.id)}
                onDragOver={(e) => handleDragOver(e, tab.id)}
                onDrop={(e) => handleDrop(e, tab.id)}
                onDragEnd={handleDragEnd}
                onDragLeave={() => {
                  if (dragOverId === tab.id) setDragOverId(null);
                }}
              >
                <TabIcon tab={tab} />
                <span className="v5-tab-label">{tab.label}</span>
                {tab.unsaved && <span className="v5-tab-unsaved" style={{ background: '#ff7875' }} />}
                {!tab.pinned && (
                  <CloseOutlined
                    className="v5-tab-close"
                    style={{ fontSize: 10, color: token.colorTextTertiary }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(tab.id);
                    }}
                  />
                )}
                </div>
              </Dropdown>
            </Tooltip>
          );
        })}
      </div>

      {/* + button */}
      <Dropdown menu={{ items: createMenuItems }} trigger={['click']} placement="bottomRight">
        <div className="v5-tab-action" style={{ color: token.colorTextSecondary }}>
          <PlusOutlined style={{ fontSize: 12 }} />
        </div>
      </Dropdown>

      {/* Tab search/select chevron */}
      <div
        className="v5-tab-action"
        style={{ color: token.colorTextSecondary }}
        onClick={() => setTabSearchOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setTabSearchOpen((v) => !v);
        }}
        role="button"
        tabIndex={0}
      >
        <DownOutlined style={{ fontSize: 10 }} />
      </div>

      {/* Tab search dropdown — anchored to the tab bar */}
      <TabSearchDropdown
        open={tabSearchOpen}
        onClose={() => setTabSearchOpen(false)}
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitch={onSwitch}
      />
    </div>
  );
}
