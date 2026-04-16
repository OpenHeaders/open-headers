/**
 * InspectorTabBar — IDE-style tab strip for the DevTools panel.
 * Same pattern as the workspace TabBar but with native CSS (no antd).
 *
 * Features:
 *   - dnd-kit drag-to-reorder via SortableContext
 *   - Right-click native context menu (Close, Close Other, Split, etc.)
 *   - Tab search dropdown with keyboard nav
 *   - Horizontal wheel scroll + auto-scroll active tab into view
 *   - Cross-leaf insertion markers via DragIntentContext
 */

import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type React from 'react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useDragIntent } from '../data/drag-intent';
import type { ClosedTab, InspectorTab } from '../data/inspector-tab';

// ── Drag data contract ──────────────────────────────────────────

export interface EditorTabDragData {
  kind: 'editor-tab';
  leafId: string;
  tabId: string;
}

// ── Method badge ────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

function methodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] ?? '#999';
}

// ── Label helpers ───────────────────────────────────────────────

const TAB_LABEL_MAX = 24;

function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}\u2026${text.slice(text.length - half)}`;
}

// ── Context menu ────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  tabId: string;
  tabIndex: number;
}

interface ContextMenuProps {
  state: ContextMenuState;
  tabCount: number;
  canUnsplit: boolean;
  canUnsplitAll: boolean;
  onClose: () => void;
  onCloseTab: (tabId: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  onSplitRight: (tabId: string) => void;
  onSplitLeft: (tabId: string) => void;
  onSplitDown: (tabId: string) => void;
  onSplitUp: (tabId: string) => void;
  onMoveOpposite?: (tabId: string) => void;
  onChangeOrientation?: () => void;
  onUnsplit?: () => void;
  onUnsplitAll?: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  state,
  tabCount,
  canUnsplit,
  canUnsplitAll,
  onClose,
  onCloseTab,
  onCloseOther,
  onCloseAll,
  onCloseToLeft,
  onCloseToRight,
  onSplitRight,
  onSplitLeft,
  onSplitDown,
  onSplitUp,
  onMoveOpposite,
  onChangeOrientation,
  onUnsplit,
  onUnsplitAll,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [splitOpen, setSplitOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const item = (label: string, action: () => void, disabled = false) => (
    <button
      type="button"
      className={`dt-ctx-item${disabled ? ' disabled' : ''}`}
      onClick={() => {
        if (!disabled) {
          action();
          onClose();
        }
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );

  const splitDisabled = tabCount < 2;

  return (
    <div ref={menuRef} className="dt-ctx-menu" style={{ left: state.x, top: state.y }}>
      {item('Close', () => onCloseTab(state.tabId))}
      {item('Close Other Tabs', () => onCloseOther(state.tabId), tabCount <= 1)}
      {item('Close All Tabs', () => onCloseAll())}
      <div className="dt-ctx-sep" />
      {item('Close Tabs to the Left', () => onCloseToLeft(state.tabId), state.tabIndex === 0)}
      {item('Close Tabs to the Right', () => onCloseToRight(state.tabId), state.tabIndex === tabCount - 1)}
      <div className="dt-ctx-sep" />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
      <div
        className={`dt-ctx-item dt-ctx-sub${splitDisabled ? ' disabled' : ''}`}
        onMouseEnter={() => !splitDisabled && setSplitOpen(true)}
        onMouseLeave={() => setSplitOpen(false)}
      >
        Split and Move {'\u25B8'}
        {splitOpen && !splitDisabled && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Right', () => onSplitRight(state.tabId))}
            {item('Left', () => onSplitLeft(state.tabId))}
            {item('Down', () => onSplitDown(state.tabId))}
            {item('Up', () => onSplitUp(state.tabId))}
          </div>
        )}
      </div>
      {onMoveOpposite && item('Move to Opposite Group', () => onMoveOpposite(state.tabId))}
      {item('Change Splitter Orientation', () => onChangeOrientation?.(), !canUnsplit)}
      {item('Unsplit', () => onUnsplit?.(), !canUnsplit)}
      {canUnsplitAll && item('Unsplit All', () => onUnsplitAll?.())}
    </div>
  );
};

// ── Sortable tab pill ──────────────────────────────────────────

interface SortableTabProps {
  leafId: string;
  isFocusedLeaf: boolean;
  tab: InspectorTab;
  isActive: boolean;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, tabId: string, index: number) => void;
  tabIndex: number;
}

const SortableTab: React.FC<SortableTabProps> = ({
  leafId,
  isFocusedLeaf,
  tab,
  isActive,
  onSwitch,
  onClose,
  onContextMenu,
  tabIndex,
}) => {
  const dragIntent = useDragIntent();
  const data: EditorTabDragData = { kind: 'editor-tab', leafId, tabId: tab.id };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${leafId}::${tab.id}`,
    data,
  });

  const isOverForeignLeaf = dragIntent.insertion !== null && dragIntent.insertion.leafId !== leafId;
  const hidePlaceholder =
    isDragging && dragIntent.draggingTabId === tab.id && (dragIntent.overDropZone || isOverForeignLeaf);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(hidePlaceholder ? { visibility: 'hidden' as const } : null),
  };

  const cls = [
    'dt-editor-tab',
    isActive ? 'active' : '',
    isDragging ? 'dragging' : '',
    isActive && isFocusedLeaf ? 'focused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cls}
      data-tab-id={tab.id}
      style={sortableStyle}
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      title={tab.url}
      onClick={() => onSwitch(tab.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, tab.id, tabIndex);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSwitch(tab.id);
      }}
    >
      <span className="dt-method-badge" style={{ color: methodColor(tab.method) }}>
        {tab.method}
      </span>
      <span className="dt-editor-tab-label">{truncateMiddle(tab.label.replace(/^[A-Z]+ /, ''), TAB_LABEL_MAX)}</span>
      {tab.statusCode != null && (
        <span className={`dt-editor-tab-status${tab.statusCode >= 400 ? ' error' : ''}`}>{tab.statusCode}</span>
      )}
      <button
        type="button"
        className="dt-editor-tab-close"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        aria-label="Close tab"
      >
        {'\u00d7'}
      </button>
    </div>
  );
};

// ── Cross-leaf insertion marker ─────────────────────────────────

const CrossLeafInsertionMarker: React.FC<{ tab: InspectorTab }> = ({ tab }) => (
  <div aria-hidden="true" className="dt-editor-tab dt-editor-tab-insertion" style={{ pointerEvents: 'none' }}>
    <span className="dt-method-badge" style={{ color: methodColor(tab.method), visibility: 'hidden' }}>
      {tab.method}
    </span>
    <span className="dt-editor-tab-label" style={{ visibility: 'hidden' }}>
      {truncateMiddle(tab.label.replace(/^[A-Z]+ /, ''), TAB_LABEL_MAX)}
    </span>
  </div>
);

// ── Tab search ─────────────────────────────────────────────────

interface TabSearchProps {
  open: boolean;
  onClose: () => void;
  tabs: InspectorTab[];
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
  const [search, setSearch] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [closedExpanded, setClosedExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch('');
      setFocusedIndex(0);
      setClosedExpanded(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  const lc = search.toLowerCase();
  const filtered = tabs.filter((t) => t.label.toLowerCase().includes(lc) || t.url.toLowerCase().includes(lc));
  const filteredClosed = recentlyClosed.filter(
    (c) => c.tab.label.toLowerCase().includes(lc) || c.tab.url.toLowerCase().includes(lc),
  );
  const total = filtered.length + (closedExpanded ? filteredClosed.length : 0);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, total - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex < filtered.length) {
        onSwitch(filtered[focusedIndex].id);
        onClose();
      } else if (closedExpanded) {
        const ci = focusedIndex - filtered.length;
        if (filteredClosed[ci]) {
          onReopen(filteredClosed[ci]);
          onClose();
        }
      }
    }
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
      <div className="dt-tab-search-backdrop" onClick={onClose} />
      <div className="dt-tab-search-dropdown">
        <div style={{ padding: '6px 6px 2px' }}>
          <input
            ref={inputRef}
            type="text"
            className="dt-tab-search-input"
            placeholder={`Search tabs\u2026`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setFocusedIndex(0);
            }}
            onKeyDown={handleKey}
          />
        </div>
        <div className="dt-tab-search-list">
          {filtered.map((tab, idx) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents: handled by input
            // biome-ignore lint/a11y/noStaticElementInteractions: tab search item
            <div
              key={tab.id}
              className={`dt-tab-search-item${idx === focusedIndex ? ' focused' : ''}${tab.id === activeTabId ? ' active' : ''}`}
              onClick={() => {
                onSwitch(tab.id);
                onClose();
              }}
            >
              <span className="dt-method-badge" style={{ color: methodColor(tab.method), fontSize: 9 }}>
                {tab.method}
              </span>
              <span className="dt-tab-search-item-label">{tab.label}</span>
            </div>
          ))}
          {recentlyClosed.length > 0 && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: toggle */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: toggle */}
              <div className="dt-tab-search-section" onClick={() => setClosedExpanded((v) => !v)}>
                {closedExpanded ? '\u25BC' : '\u25B6'} Recently Closed ({recentlyClosed.length})
              </div>
              {closedExpanded &&
                filteredClosed.map((closed, idx) => {
                  const gi = filtered.length + idx;
                  return (
                    // biome-ignore lint/a11y/useKeyWithClickEvents: handled by input
                    // biome-ignore lint/a11y/noStaticElementInteractions: item
                    <div
                      key={`closed-${closed.tab.id}-${closed.closedAt}`}
                      className={`dt-tab-search-item${gi === focusedIndex ? ' focused' : ''}`}
                      style={{ opacity: 0.7 }}
                      onClick={() => {
                        onReopen(closed);
                        onClose();
                      }}
                    >
                      <span className="dt-method-badge" style={{ color: methodColor(closed.tab.method), fontSize: 9 }}>
                        {closed.tab.method}
                      </span>
                      <span className="dt-tab-search-item-label">{closed.tab.label}</span>
                    </div>
                  );
                })}
            </>
          )}
          {filtered.length === 0 && filteredClosed.length === 0 && (
            <div className="dt-tab-search-empty">No matching tabs</div>
          )}
        </div>
      </div>
    </>
  );
};

// ── Props ────────────────────────────────────────────────────────

interface InspectorTabBarProps {
  leafId: string;
  isFocusedLeaf: boolean;
  tabs: InspectorTab[];
  activeTabId: string | null;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
  onReopenTab: (closed: ClosedTab) => void;
  onSplitAndMoveRight?: (tabId: string) => void;
  onSplitAndMoveLeft?: (tabId: string) => void;
  onSplitAndMoveDown?: (tabId: string) => void;
  onSplitAndMoveUp?: (tabId: string) => void;
  onMoveToOppositeGroup?: (tabId: string) => void;
  onChangeSplitterOrientation?: () => void;
  onUnsplit?: () => void;
  onUnsplitAll?: () => void;
  canUnsplit?: boolean;
  canUnsplitAll?: boolean;
}

// ── Main component ──────────────────────────────────────────────

const InspectorTabBar: React.FC<InspectorTabBarProps> = ({
  leafId,
  isFocusedLeaf,
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onCloseOther,
  onCloseAll,
  onCloseToLeft,
  onCloseToRight,
  recentlyClosed,
  onReopenTab,
  onSplitAndMoveRight,
  onSplitAndMoveLeft,
  onSplitAndMoveDown,
  onSplitAndMoveUp,
  onMoveToOppositeGroup,
  onChangeSplitterOrientation,
  onUnsplit,
  onUnsplitAll,
  canUnsplit = false,
  canUnsplitAll = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  // Auto-scroll active tab into view
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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string, tabIndex: number) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, tabId, tabIndex });
  }, []);

  const sortableIds = tabs.map((t) => `${leafId}::${t.id}`);

  const dragIntentForBar = useDragIntent();
  const insertionIndex = dragIntentForBar.insertion?.leafId === leafId ? dragIntentForBar.insertion.index : null;
  const insertionTab = insertionIndex !== null ? dragIntentForBar.draggingTab : null;

  return (
    <div className="dt-editor-tab-bar">
      <div className="dt-editor-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab, index) => (
            <Fragment key={tab.id}>
              {insertionIndex === index && insertionTab && <CrossLeafInsertionMarker tab={insertionTab} />}
              <SortableTab
                leafId={leafId}
                isFocusedLeaf={isFocusedLeaf}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSwitch={onSwitch}
                onClose={onClose}
                onContextMenu={handleContextMenu}
                tabIndex={index}
              />
            </Fragment>
          ))}
          {insertionIndex === tabs.length && insertionTab && <CrossLeafInsertionMarker tab={insertionTab} />}
        </SortableContext>
      </div>

      {/* Tab search chevron */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          type="button"
          className="dt-editor-tab-action"
          onClick={() => setTabSearchOpen((v) => !v)}
          aria-label="Search tabs"
          title="Search tabs"
        >
          {'\u25BE'}
        </button>
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

      {/* Context menu portal */}
      {ctxMenu && (
        <ContextMenu
          state={ctxMenu}
          tabCount={tabs.length}
          canUnsplit={canUnsplit}
          canUnsplitAll={canUnsplitAll}
          onClose={() => setCtxMenu(null)}
          onCloseTab={onClose}
          onCloseOther={onCloseOther}
          onCloseAll={onCloseAll}
          onCloseToLeft={onCloseToLeft}
          onCloseToRight={onCloseToRight}
          onSplitRight={(id) => onSplitAndMoveRight?.(id)}
          onSplitLeft={(id) => onSplitAndMoveLeft?.(id)}
          onSplitDown={(id) => onSplitAndMoveDown?.(id)}
          onSplitUp={(id) => onSplitAndMoveUp?.(id)}
          onMoveOpposite={onMoveToOppositeGroup}
          onChangeOrientation={onChangeSplitterOrientation}
          onUnsplit={onUnsplit}
          onUnsplitAll={onUnsplitAll}
        />
      )}
    </div>
  );
};

export default InspectorTabBar;
