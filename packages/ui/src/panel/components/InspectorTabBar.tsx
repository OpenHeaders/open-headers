/**
 * InspectorTabBar — IDE-style tab strip for the DevTools panel.
 * Same pattern as the workspace TabBar, sharing its antd Dropdown +
 * LayoutMenuIcon context-menu so the two surfaces stay visually aligned.
 *
 * Features:
 *   - dnd-kit drag-to-reorder via SortableContext
 *   - Right-click context menu (Close, Close Other, Split, etc.) with
 *     layout-aware icons from `@openheaders/ui/shared/dock-layout/LayoutMenuIcon`
 *   - Tab search dropdown with keyboard nav
 *   - Horizontal wheel scroll + auto-scroll active tab into view
 *   - Cross-leaf insertion markers via DragIntentContext
 */

import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dropdown } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type EditorTabDragData, LayoutMenuIcon } from '@openheaders/ui/shared/dock-layout';
import { useDragIntent } from '../data/drag-intent';
import type { ClosedTab, InspectorTab } from '../data/inspector-tab';

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
  return `${text.slice(0, half)}…${text.slice(text.length - half)}`;
}

// ── Menu icon wrapper ───────────────────────────────────────────
// Tighter than the workspace equivalent — DevTools panels traditionally
// use an 11px compact type scale, so the icons and row gutter shrink to
// match. `MENU_ICON_SIZE` pairs with the padding/font-size tokens on
// `.dt-tab-ctx-menu` in panel.css so the end result reads like Chrome
// DevTools' own context menus rather than a full-app antd menu.

const MENU_ICON_SIZE = 13;

function menuIconWrap(node: React.ReactNode): React.ReactNode {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 14,
      }}
    >
      {node}
    </span>
  );
}

// ── Sortable tab pill ──────────────────────────────────────────

interface SortableTabProps {
  leafId: string;
  isFocusedLeaf: boolean;
  tab: InspectorTab;
  isActive: boolean;
  contextMenu: { items: ItemType[] };
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({
  leafId,
  isFocusedLeaf,
  tab,
  isActive,
  contextMenu,
  onSwitch,
  onClose,
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

  const content = (
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
        {'×'}
      </button>
    </div>
  );

  // While dragging, skip the Dropdown wrapper — it would steal pointer
  // capture from dnd-kit's overlay portal.
  if (isDragging) return content;

  return (
    <Dropdown menu={contextMenu} trigger={['contextMenu']} overlayClassName="dt-tab-ctx-menu">
      {content}
    </Dropdown>
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
            placeholder={`Search tabs…`}
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
                {closedExpanded ? '▼' : '▶'} Recently Closed ({recentlyClosed.length})
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
  /** Direction the parent split would travel when "Move to Opposite
   *  Group" fires — drives the direction icon on that menu item. */
  oppositeDirection?: 'right' | 'left' | 'up' | 'down' | null;
  /** Current parent-split orientation — drives the orientation/unsplit
   *  icons so they reflect what the click actually does. */
  parentOrientation?: 'horizontal' | 'vertical' | null;
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
  oppositeDirection,
  parentOrientation,
  canUnsplit = false,
  canUnsplitAll = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);

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

  const buildContextMenu = useCallback(
    (tab: InspectorTab, tabIndex: number): { items: ItemType[] } => {
      const splitDisabled = tabs.length < 2;
      return {
        items: [
          { key: 'close', label: 'Close', onClick: () => onClose(tab.id) },
          {
            key: 'close-other',
            label: 'Close Other Tabs',
            disabled: tabs.length <= 1,
            onClick: () => onCloseOther(tab.id),
          },
          { key: 'close-all', label: 'Close All Tabs', onClick: () => onCloseAll() },
          { type: 'divider' as const, key: 'div-1' },
          {
            key: 'close-left',
            label: 'Close Tabs to the Left',
            icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-left" size={MENU_ICON_SIZE} />),
            disabled: tabIndex === 0,
            onClick: () => onCloseToLeft(tab.id),
          },
          {
            key: 'close-right',
            label: 'Close Tabs to the Right',
            icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-right" size={MENU_ICON_SIZE} />),
            disabled: tabIndex === tabs.length - 1,
            onClick: () => onCloseToRight(tab.id),
          },
          { type: 'divider' as const, key: 'div-2' },
          {
            key: 'split-and-move',
            label: 'Split and Move',
            disabled: splitDisabled,
            children: [
              {
                key: 'split-move-right',
                label: 'Right',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-right" size={MENU_ICON_SIZE} />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveRight?.(tab.id),
              },
              {
                key: 'split-move-left',
                label: 'Left',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-left" size={MENU_ICON_SIZE} />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveLeft?.(tab.id),
              },
              {
                key: 'split-move-down',
                label: 'Down',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-down" size={MENU_ICON_SIZE} />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveDown?.(tab.id),
              },
              {
                key: 'split-move-up',
                label: 'Up',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-up" size={MENU_ICON_SIZE} />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveUp?.(tab.id),
              },
            ],
          },
          ...(oppositeDirection
            ? ([
                {
                  key: 'move-opposite',
                  label: 'Move To Opposite Group',
                  icon: menuIconWrap(
                    <LayoutMenuIcon
                      kind={
                        oppositeDirection === 'right'
                          ? 'split-right'
                          : oppositeDirection === 'left'
                            ? 'split-left'
                            : oppositeDirection === 'down'
                              ? 'split-down'
                              : 'split-up'
                      }
                      size={MENU_ICON_SIZE}
                    />,
                  ),
                  onClick: () => onMoveToOppositeGroup?.(tab.id),
                },
              ] satisfies ItemType[])
            : []),
          {
            key: 'flip-orientation',
            label: 'Change Splitter Orientation',
            icon: parentOrientation
              ? menuIconWrap(
                  <LayoutMenuIcon
                    kind={parentOrientation === 'horizontal' ? 'split-horizontal' : 'split-vertical'}
                    size={MENU_ICON_SIZE}
                  />,
                )
              : undefined,
            disabled: !canUnsplit,
            onClick: () => onChangeSplitterOrientation?.(),
          },
          {
            key: 'unsplit',
            label: 'Unsplit',
            icon: parentOrientation
              ? menuIconWrap(
                  <LayoutMenuIcon
                    kind={parentOrientation === 'horizontal' ? 'unsplit-horizontal' : 'unsplit-vertical'}
                    size={MENU_ICON_SIZE}
                  />,
                )
              : undefined,
            disabled: !canUnsplit,
            onClick: () => onUnsplit?.(),
          },
          ...(canUnsplitAll
            ? ([
                {
                  key: 'unsplit-all',
                  label: 'Unsplit All',
                  icon: menuIconWrap(<LayoutMenuIcon kind="unsplit-all" size={MENU_ICON_SIZE} />),
                  onClick: () => onUnsplitAll?.(),
                },
              ] satisfies ItemType[])
            : []),
        ],
      };
    },
    [
      tabs.length,
      onClose,
      onCloseOther,
      onCloseAll,
      onCloseToLeft,
      onCloseToRight,
      onSplitAndMoveRight,
      onSplitAndMoveLeft,
      onSplitAndMoveDown,
      onSplitAndMoveUp,
      onMoveToOppositeGroup,
      oppositeDirection,
      parentOrientation,
      onChangeSplitterOrientation,
      onUnsplit,
      onUnsplitAll,
      canUnsplit,
      canUnsplitAll,
    ],
  );

  const sortableIds = useMemo(() => tabs.map((t) => `${leafId}::${t.id}`), [tabs, leafId]);

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
                contextMenu={buildContextMenu(tab, index)}
                onSwitch={onSwitch}
                onClose={onClose}
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
          {'▾'}
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
    </div>
  );
};

export default InspectorTabBar;
