/**
 * TabBar — IDE-style tab strip for workspace.html.
 *
 * Features:
 *   - Right-click context menu (Close, Close Other, Close All, etc.)
 *   - dnd-kit drag-to-reorder that subscribes to the shell's top-level
 *     DndContext. Sortables publish `{ kind: 'editor-tab', tabId }` so
 *     ShellLayout's unified drag handlers can route them without any
 *     ambiguity against tool-window drags.
 *   - Tab search dropdown (chevron, right-aligned) with recently closed
 *   - Shift+Cmd+A shortcut for tab search
 *   - Horizontal wheel scroll
 *   - Auto-scroll active tab into view
 */

import {
  ApartmentOutlined,
  CloseOutlined,
  DownOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { V5 } from '@openheaders/core/types';
import { isRuleComplete } from '@openheaders/core/utils';
import type { InputRef } from 'antd';
import { Dropdown, Input, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useDragIntent } from '../drag-intent';
import { buildRuleTypeMenuItems } from '../rule-type-menu';
import type { ClosedTab, RulesTab } from '../types';
import LayoutMenuIcon from './LayoutMenuIcon';
import { buildRuleIcon } from './shared/rule-icon';
import { renderTwoToneIcon } from './TwoToneIconPicker';

// ── Editor tab drag data contract ───────────────────────────────
// Exported so ShellLayout's shared DndContext can type-narrow drag
// events and decide whether they belong to editor tabs or tool windows.
// `leafId` identifies the source editor group so cross-leaf moves and
// split-drop operations can resolve the origin without extra lookup.

export interface EditorTabDragData {
  kind: 'editor-tab';
  leafId: string;
  tabId: string;
}

// ── Icon helper ─────────────────────────────────────────────────────

const TAB_ICON_GRAY = '#999';
const TAB_ICON_YELLOW = 'var(--ant-color-warning, #faad14)';

export function tabIcon(
  tab: RulesTab,
  rules: V5.Rule[],
  templates: V5.Template[],
  pausedUids: ReadonlySet<string>,
): React.ReactNode {
  if (tab.mode === 'rule-flow') return <ApartmentOutlined style={{ fontSize: 12, color: '#1677ff' }} />;
  if (tab.mode === 'run-report') return <ExperimentOutlined style={{ fontSize: 12, color: '#1677ff' }} />;
  if (tab.mode === 'collection-overview') {
    const paused = tab.entityId ? pausedUids.has(tab.entityId) : false;
    return <FolderOpenOutlined style={{ fontSize: 12, color: paused ? TAB_ICON_YELLOW : TAB_ICON_GRAY }} />;
  }
  if (tab.mode === 'folder-overview') {
    const paused = tab.entityId ? pausedUids.has(tab.entityId) : false;
    return <FolderOutlined style={{ fontSize: 12, color: paused ? TAB_ICON_YELLOW : TAB_ICON_GRAY }} />;
  }
  if (tab.mode === 'template-edit' && tab.templateUid) {
    const tpl = templates.find((t) => t.uid === tab.templateUid);
    return (
      renderTwoToneIcon(tpl?.icon ?? '', { fontSize: 12 }) || (
        <FileTextOutlined style={{ fontSize: 12, color: TAB_ICON_GRAY }} />
      )
    );
  }
  // Rule tabs — use the same rich icon as the sidebar
  const rule = tab.ruleUid ? rules.find((r) => r.uid === tab.ruleUid) : undefined;
  const paused = tab.ruleUid ? pausedUids.has(tab.ruleUid) : false;
  const isActive = rule ? rule.enabled && isRuleComplete(rule) && !paused : false;
  return buildRuleIcon({ ruleType: tab.ruleType, rule, isActive, paused });
}

const TAB_LABEL_MAX = 20;
function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const half = Math.floor((max - 1) / 2);
  return `${text.slice(0, half)}\u2026${text.slice(text.length - half)}`;
}

/**
 * Truncate a tab label, preserving a fixed prefix. Used by run-report
 * tabs whose label is `Test Run · <owner name>` — the prefix carries
 * the kind of tab it is, so we end-truncate the owner name suffix
 * instead of running middle-truncation across the whole label and
 * eating the prefix. Returns the original text if it fits.
 */
function truncateLabelWithPrefix(text: string, prefix: string, max: number): string {
  if (text.length <= max) return text;
  if (!text.startsWith(prefix)) return truncateMiddle(text, max);
  const suffix = text.slice(prefix.length);
  const budget = Math.max(1, max - prefix.length - 1); // 1 char for ellipsis
  return `${prefix}${suffix.slice(0, budget)}\u2026`;
}

export function renderTabLabel(tab: RulesTab): string {
  if (tab.mode === 'run-report') return truncateLabelWithPrefix(tab.label, 'Test Run · ', TAB_LABEL_MAX);
  return truncateMiddle(tab.label, TAB_LABEL_MAX);
}

// ── Props ────────────────────────────────────────────────────────

interface TabBarProps {
  /** Which editor group this tab strip belongs to. */
  leafId: string;
  /** True when this leaf currently owns editor focus. Drives blue vs
   *  grey active-tab highlighting. */
  isFocusedLeaf: boolean;
  tabs: RulesTab[];
  activeTabId: string | null;
  rules: V5.Rule[];
  templates: V5.Template[];
  /** Effective paused uids — drives the yellow tab icon for paused
   *  rules, collection-overviews, and folder-overviews. */
  pausedUids: ReadonlySet<string>;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  /** Double-click on any tab — App wires this to zen-mode toggle. */
  onTabDoubleClick?: (tabId: string) => void;
  onCreateRule: (type: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
  onReopenTab: (closed: ClosedTab) => void;
  /** Split operations (surfaced on the tab context menu). Every split
   *  MOVES the tab into the new group — our tabs are editor instances
   *  so duplicating them across groups would be meaningless. */
  onSplitAndMoveRight?: (tabId: string) => void;
  onSplitAndMoveLeft?: (tabId: string) => void;
  onSplitAndMoveDown?: (tabId: string) => void;
  onSplitAndMoveUp?: (tabId: string) => void;
  onMoveToOppositeGroup?: (tabId: string) => void;
  /** Direction the tab would move when going to the opposite group. Drives the
   *  prefix icon on the "Move To Opposite Group" menu item. */
  oppositeDirection?: 'left' | 'right' | 'up' | 'down' | null;
  /** Current orientation of this leaf's parent split. Drives the prefix icon
   *  on the "Change Splitter Orientation" menu item. */
  parentOrientation?: 'horizontal' | 'vertical' | null;
  onChangeSplitterOrientation?: () => void;
  onUnsplit?: () => void;
  onUnsplitAll?: () => void;
  /** True when this leaf has a parent split — enables Unsplit/orientation items. */
  canUnsplit?: boolean;
  /** True when any split exists in the whole tree — enables "Unsplit All". */
  canUnsplitAll?: boolean;
  /** Controlled open state for the + create menu (e.g. triggered by ⌥N). */
  createMenuOpen?: boolean;
  onCreateMenuOpenChange?: (open: boolean) => void;
}

// ── Tab visual (pill) ────────────────────────────────────────────
//
// Pure presentational content for a tab: icon, label, unsaved dot,
// optional close affordance. Used by both the interactive
// `SortableTab` wrapper and the read-only cross-leaf insertion marker
// so they share a single source of truth for tab layout/sizing.
//
// `hidden` renders the content with `visibility: hidden` so its width
// and height still contribute to layout but nothing paints — that's
// how SortableTab's in-place placeholder and the cross-leaf insertion
// marker both look like a pure blue dashed rectangle while keeping
// the same footprint as a real tab.

interface TabPillContentProps {
  tab: RulesTab;
  rules: V5.Rule[];
  templates: V5.Template[];
  pausedUids: ReadonlySet<string>;
  onClose?: (id: string) => void;
  closeIconColor: string;
  hidden?: boolean;
}

const TabPillContent: React.FC<TabPillContentProps> = ({
  tab,
  rules,
  templates,
  pausedUids,
  onClose,
  closeIconColor,
  hidden,
}) => {
  const inner = (
    <>
      <span className="rules-type-badge">{tabIcon(tab, rules, templates, pausedUids)}</span>
      <span className="rules-tab-label" style={tab.mode === 'create' ? { fontStyle: 'italic' } : undefined}>
        {renderTabLabel(tab)}
      </span>
      {(tab.dirty || tab.mode === 'create') && (
        <span className="rules-tab-unsaved" style={{ background: tab.mode === 'create' ? '#999' : '#ff7875' }} />
      )}
      {onClose && (
        <CloseOutlined
          className="rules-tab-close"
          style={{ fontSize: 10, color: closeIconColor }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
        />
      )}
    </>
  );
  if (!hidden) return inner;
  return (
    <span style={{ display: 'contents', visibility: 'hidden' }} aria-hidden="true">
      {inner}
    </span>
  );
};

// ── Shared empty-placeholder style ───────────────────────────────
//
// Both the in-place source placeholder (inside SortableTab while
// isDragging) and the cross-leaf insertion marker share this exact
// visual so the user sees ONE consistent "where the tab will land"
// affordance across panels: a blue-tinted rectangle with a dashed
// primary outline, no content painted.

function emptyPlaceholderStyle(token: ReturnType<typeof theme.useToken>['token']): React.CSSProperties {
  return {
    background: token.colorPrimaryBg,
    outline: `1px dashed ${token.colorPrimary}`,
    outlineOffset: -2,
    borderBottomColor: 'transparent',
  };
}

// ── Cross-leaf insertion marker ───────────────────────────────────
//
// A read-only pill rendered into the target leaf's tab list while a
// tab from another leaf is being dragged over it. Uses the shared
// empty-placeholder style so it's visually identical to the source
// placeholder, and renders TabPillContent in hidden mode so its
// width matches the dragged tab's natural size.

interface CrossLeafInsertionMarkerProps {
  tab: RulesTab;
  rules: V5.Rule[];
  templates: V5.Template[];
  pausedUids: ReadonlySet<string>;
  token: ReturnType<typeof theme.useToken>['token'];
}

const CrossLeafInsertionMarker: React.FC<CrossLeafInsertionMarkerProps> = ({
  tab,
  rules,
  templates,
  pausedUids,
  token,
}) => (
  <div
    aria-hidden="true"
    className="rules-tab"
    style={{ ...emptyPlaceholderStyle(token), pointerEvents: 'none', flexShrink: 0 }}
  >
    <TabPillContent
      tab={tab}
      rules={rules}
      templates={templates}
      pausedUids={pausedUids}
      closeIconColor={token.colorTextTertiary}
      hidden
    />
  </div>
);

// ── Sortable tab ─────────────────────────────────────────────────

interface SortableTabProps {
  leafId: string;
  isFocusedLeaf: boolean;
  tab: RulesTab;
  isActive: boolean;
  rules: V5.Rule[];
  templates: V5.Template[];
  pausedUids: ReadonlySet<string>;
  contextMenu: { items: ItemType[] };
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({
  leafId,
  isFocusedLeaf,
  tab,
  isActive,
  rules,
  templates,
  pausedUids,
  contextMenu,
  onSwitch,
  onClose,
  onDoubleClick,
}) => {
  const { token } = theme.useToken();
  const dragIntent = useDragIntent();
  const data: EditorTabDragData = { kind: 'editor-tab', leafId, tabId: tab.id };
  // Sortable ids must be unique across ALL SortableContexts that share a
  // parent DndContext. Prefixing with the leaf id lets the shell host
  // multiple tab strips side-by-side without collisions.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${leafId}::${tab.id}`,
    data,
  });

  // Hide the dragged tab's source placeholder whenever the drop intent
  // has moved somewhere OTHER than this tab bar:
  //   - over a leaf-drop zone (center/edge split preview)
  //   - over a tab in a DIFFERENT leaf (cross-leaf insert)
  // In both cases the destination leaf already shows its own preview
  // (overlay or insertion marker), and keeping the source placeholder
  // visible would make the tab appear in two places at once.
  //
  // Visibility: hidden keeps the slot in layout so dnd-kit's rect
  // tracking stays in sync — the placeholder snaps back the instant
  // the cursor returns to this tab bar, no sortable resync needed.
  const isOverForeignLeaf = dragIntent.insertion !== null && dragIntent.insertion.leafId !== leafId;
  const hidePlaceholder =
    isDragging && dragIntent.draggingTabId === tab.id && (dragIntent.overDropZone || isOverForeignLeaf);

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(hidePlaceholder ? { visibility: 'hidden' as const } : null),
  };

  // Every leaf's active tab sits on the container background so it's
  // clearly distinguishable from inactive siblings. The focused leaf
  // additionally paints its active tab in the blue accent (text + bottom
  // border) so you can always tell which group currently owns focus.
  const visualStyle: React.CSSProperties = isDragging
    ? emptyPlaceholderStyle(token)
    : isActive && isFocusedLeaf
      ? {
          color: token.colorPrimary,
          borderBottomColor: token.colorPrimary,
          background: token.colorBgContainer,
        }
      : isActive
        ? {
            color: token.colorText,
            borderBottomColor: token.colorBorder,
            background: token.colorBgContainer,
          }
        : {
            color: token.colorTextSecondary,
            borderBottomColor: 'transparent',
            background: 'transparent',
          };

  const content = (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`rules-tab${isActive ? ' active' : ''}${isDragging ? ' dragging' : ''}`}
      data-tab-id={tab.id}
      style={{ ...sortableStyle, ...visualStyle }}
      role="tab"
      tabIndex={0}
      aria-selected={isActive}
      onClick={() => onSwitch(tab.id)}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(tab.id) : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSwitch(tab.id);
      }}
    >
      <TabPillContent
        tab={tab}
        rules={rules}
        templates={templates}
        pausedUids={pausedUids}
        onClose={onClose}
        closeIconColor={token.colorTextTertiary}
        hidden={isDragging}
      />
    </div>
  );

  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  // While dragging, skip Tooltip/Dropdown wrappers so they don't
  // interfere with dnd-kit's overlay portal.
  if (isDragging) return content;

  return (
    <Dropdown menu={contextMenu} trigger={['contextMenu']} onOpenChange={setContextMenuOpen}>
      <Tooltip
        title={tab.label}
        placement="bottom"
        mouseEnterDelay={0.5}
        open={contextMenuOpen ? false : undefined}
      >
        {content}
      </Tooltip>
    </Dropdown>
  );
};

// ── Tab Search Dropdown ──────────────────────────────────────────

interface TabSearchProps {
  open: boolean;
  onClose: () => void;
  tabs: RulesTab[];
  activeTabId: string | null;
  rules: V5.Rule[];
  templates: V5.Template[];
  pausedUids: ReadonlySet<string>;
  onSwitch: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
  onReopen: (closed: ClosedTab) => void;
}

const TabSearchDropdown: React.FC<TabSearchProps> = ({
  open,
  onClose,
  tabs,
  activeTabId,
  rules,
  templates,
  pausedUids,
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
                <span style={{ fontSize: 13, flexShrink: 0, width: 16, textAlign: 'center' }}>
                  {tabIcon(tab, rules, templates, pausedUids)}
                </span>
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
                        {tabIcon(closed.tab, rules, templates, pausedUids)}
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
  leafId,
  isFocusedLeaf,
  tabs,
  activeTabId,
  rules,
  templates,
  pausedUids,
  onSwitch,
  onClose,
  onTabDoubleClick,
  onCreateRule,
  onCloseOther,
  onCloseAll,
  onCloseUnmodified,
  onCloseToLeft,
  onCloseToRight,
  recentlyClosed,
  onReopenTab,
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
  createMenuOpen,
  onCreateMenuOpenChange,
}) => {
  const { token } = theme.useToken();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);

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

  // ── Context menu builder ───────────────────────────────────────
  const menuIconWrap = (node: React.ReactNode) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 18,
      }}
    >
      {node}
    </span>
  );

  const buildContextMenu = useCallback(
    (tab: RulesTab, tabIndex: number): { items: ItemType[] } => {
      const splitDisabled = tabs.length < 2;
      return {
        items: [
          { key: 'close', label: 'Close', onClick: () => onClose(tab.id) },
          {
            key: 'close-other',
            label: 'Close Other Tabs',
            icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-other" />),
            disabled: tabs.length <= 1,
            onClick: () => onCloseOther(tab.id),
          },
          { key: 'close-all', label: 'Close All Tabs', onClick: () => onCloseAll() },
          { key: 'close-unmodified', label: 'Close Unmodified Tabs', onClick: () => onCloseUnmodified() },
          { type: 'divider' as const },
          {
            key: 'close-left',
            label: 'Close Tabs to the Left',
            icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-left" />),
            disabled: tabIndex === 0,
            onClick: () => onCloseToLeft(tab.id),
          },
          {
            key: 'close-right',
            label: 'Close Tabs to the Right',
            icon: menuIconWrap(<LayoutMenuIcon kind="close-tabs-right" />),
            disabled: tabIndex === tabs.length - 1,
            onClick: () => onCloseToRight(tab.id),
          },
          { type: 'divider' as const },
          {
            key: 'split-and-move',
            label: 'Split and Move',
            disabled: splitDisabled,
            children: [
              {
                key: 'split-move-right',
                label: 'Right',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-right" />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveRight?.(tab.id),
              },
              {
                key: 'split-move-left',
                label: 'Left',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-left" />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveLeft?.(tab.id),
              },
              {
                key: 'split-move-down',
                label: 'Down',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-down" />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveDown?.(tab.id),
              },
              {
                key: 'split-move-up',
                label: 'Up',
                icon: menuIconWrap(<LayoutMenuIcon kind="split-up" />),
                disabled: splitDisabled,
                onClick: () => onSplitAndMoveUp?.(tab.id),
              },
            ],
          },
          ...(oppositeDirection
            ? [
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
                    />,
                  ),
                  onClick: () => onMoveToOppositeGroup?.(tab.id),
                } satisfies ItemType,
              ]
            : []),
          {
            key: 'flip-orientation',
            label: 'Change Splitter Orientation',
            icon: parentOrientation
              ? menuIconWrap(
                  <LayoutMenuIcon kind={parentOrientation === 'horizontal' ? 'split-horizontal' : 'split-vertical'} />,
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
                  />,
                )
              : undefined,
            disabled: !canUnsplit,
            onClick: () => onUnsplit?.(),
          },
          ...(canUnsplitAll
            ? [
                {
                  key: 'unsplit-all',
                  label: 'Unsplit All',
                  icon: menuIconWrap(<LayoutMenuIcon kind="unsplit-all" />),
                  onClick: () => onUnsplitAll?.(),
                } satisfies ItemType,
              ]
            : []),
        ],
      };
    },
    [
      tabs.length,
      onClose,
      onCloseOther,
      onCloseAll,
      onCloseUnmodified,
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

  const createMenuItems = buildRuleTypeMenuItems(onCreateRule);
  const sortableIds = tabs.map((t) => `${leafId}::${t.id}`);

  // Cross-leaf insertion marker — rendered in this bar only when the
  // published drag intent targets this leaf. Published from
  // EditorGroupRenderer via DragIntentContext; consumed here directly
  // so TabBar doesn't need a new prop.
  const dragIntentForBar = useDragIntent();
  const insertionIndex =
    dragIntentForBar.insertion?.leafId === leafId ? dragIntentForBar.insertion.index : null;
  const insertionTab = insertionIndex !== null ? dragIntentForBar.draggingTab : null;

  return (
    <div
      className="rules-tabs-bar"
      style={{ background: token.colorBgLayout, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
    >
      {/* Scrollable tabs */}
      <div className="rules-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab, index) => (
            <Fragment key={tab.id}>
              {insertionIndex === index && insertionTab && (
                <CrossLeafInsertionMarker
                  tab={insertionTab}
                  rules={rules}
                  templates={templates}
                  pausedUids={pausedUids}
                  token={token}
                />
              )}
              <SortableTab
                leafId={leafId}
                isFocusedLeaf={isFocusedLeaf}
                tab={tab}
                isActive={tab.id === activeTabId}
                rules={rules}
                templates={templates}
                pausedUids={pausedUids}
                contextMenu={buildContextMenu(tab, index)}
                onSwitch={onSwitch}
                onClose={onClose}
                onDoubleClick={onTabDoubleClick}
              />
            </Fragment>
          ))}
          {insertionIndex === tabs.length && insertionTab && (
            <CrossLeafInsertionMarker
              tab={insertionTab}
              rules={rules}
              templates={templates}
              pausedUids={pausedUids}
              token={token}
            />
          )}
        </SortableContext>

        {/* + button: inside scroll area, right after last tab */}
        <Dropdown
          menu={{ items: createMenuItems }}
          trigger={['click']}
          placement="bottomRight"
          open={createMenuOpen}
          onOpenChange={(v) => onCreateMenuOpenChange?.(v)}
        >
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
          rules={rules}
          templates={templates}
          pausedUids={pausedUids}
          onSwitch={onSwitch}
          recentlyClosed={recentlyClosed}
          onReopen={onReopenTab}
        />
      </div>
    </div>
  );
};

export default TabBar;
