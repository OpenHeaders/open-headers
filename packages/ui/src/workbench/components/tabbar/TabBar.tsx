/**
 * TabBar — IDE-style tab strip for workbench.html.
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

import { CopyOutlined, DownOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LiveWorkflow, Request, Rule, Template } from '@openheaders/core/types';
import { Dropdown, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { scratchLabelForMode } from '../../breadcrumbs';
import { useDragIntent } from '../../drag-intent';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';
import type { ClosedTab, WorkbenchTab } from '../../types';
import LayoutMenuIcon from '../shell/LayoutMenuIcon';
import { menuItemLabel } from '../shared/MenuItemShortcutLabel';
import TabPillContent from './TabPillContent';
import TabSearchDropdown from './TabSearchDropdown';
import { EMPTY_SET, emptyPlaceholderStyle, tabIcon } from './tab-format';

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

// ── Props ────────────────────────────────────────────────────────

interface TabBarProps {
  /** Which editor group this tab strip belongs to. */
  leafId: string;
  /** True when this leaf currently owns editor focus. Drives blue vs
   *  grey active-tab highlighting. */
  isFocusedLeaf: boolean;
  tabs: WorkbenchTab[];
  activeTabId: string | null;
  rules: Rule[];
  templates: Template[];
  /** Persisted API requests — feeds `isRequestComplete` so the tab
   *  method-icon greys out when a saved request is incomplete (mirrors
   *  the rule-draft treatment). */
  requests: Request[];
  /** Effective paused uids — drives the yellow tab icon for paused
   *  rules, collection-overviews, and folder-overviews. */
  pausedUids: ReadonlySet<string>;
  /** Rule uids whose templates have unresolved refs — drives greyed
   *  method tag on rule tabs, same treatment as `paused`. Defaults to
   *  an empty set so older callers (and `tabIcon`'s stand-alone
   *  invocation from the drag preview) stay source-compatible. */
  unresolvableRuleUids?: ReadonlySet<string>;
  /** Request uids whose templates have unresolved refs — drives
   *  greyed method tag on request tabs. */
  unresolvableRequestUids?: ReadonlySet<string>;
  /** Live workflows — drives state-based icon color on workflow tabs. */
  liveWorkflows?: LiveWorkflow[];
  /** Workflow uids whose step requests have unresolved refs. */
  unresolvableWorkflowUids?: ReadonlySet<string>;
  /** Breadcrumb path for a tab (workspace excluded) — drives the hover
   *  tooltip so users see where a tab lives without opening it. */
  getTabPath?: (tab: WorkbenchTab) => string[];
  /** Live-derived display label for a tab. Replaces direct reads of
   *  `tab.label` so renames in another surface land here without an
   *  imperative sync hook. Caller wires this to `tabDisplayLabel(tab,
   *  lookups)` from `tab-display.ts`. Falls back to `tab.label` if
   *  unwired (older callers that don't pass it remain source-compatible). */
  getDisplayLabel?: (tab: WorkbenchTab) => string;
  onSwitch: (tabId: string) => void;
  onClose: (tabId: string) => void;
  /** Double-click on any tab — App wires this to zen-mode toggle. */
  onTabDoubleClick?: (tabId: string) => void;
  /** Duplicate a rule/request tab into a fresh scratch.
   *  Absent / inert for non-rule/request tabs — the menu item only
   *  renders for duplicable modes. */
  onDuplicate?: (tabId: string) => void;
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
  /**
   * Registers the tab-search toggle function with the host (App.tsx)
   * so the workspace shortcut registry can invoke it via the
   * `onTabSearch` handler. TabBar owns the `tabSearchOpen` state; the
   * host owns the shortcut dispatch.
   */
  registerTabSearchToggle?: (toggle: () => void) => void;
}

// ── Cross-leaf insertion marker ───────────────────────────────────
//
// A read-only pill rendered into the target leaf's tab list while a
// tab from another leaf is being dragged over it. Uses the shared
// empty-placeholder style so it's visually identical to the source
// placeholder, and renders TabPillContent in hidden mode so its
// width matches the dragged tab's natural size.

interface CrossLeafInsertionMarkerProps {
  tab: WorkbenchTab;
  displayLabel: string;
  rules: Rule[];
  templates: Template[];
  requests: Request[];
  pausedUids: ReadonlySet<string>;
  unresolvableRuleUids: ReadonlySet<string>;
  unresolvableRequestUids: ReadonlySet<string>;
  liveWorkflows: LiveWorkflow[];
  unresolvableWorkflowUids: ReadonlySet<string>;
  token: ReturnType<typeof theme.useToken>['token'];
}

const CrossLeafInsertionMarker: React.FC<CrossLeafInsertionMarkerProps> = ({
  tab,
  displayLabel,
  rules,
  templates,
  requests,
  pausedUids,
  unresolvableRuleUids,
  unresolvableRequestUids,
  liveWorkflows,
  unresolvableWorkflowUids,
  token,
}) => (
  <div
    aria-hidden="true"
    className="rules-tab"
    style={{ ...emptyPlaceholderStyle(token), pointerEvents: 'none', flexShrink: 0 }}
  >
    <TabPillContent
      tab={tab}
      displayLabel={displayLabel}
      rules={rules}
      templates={templates}
      requests={requests}
      pausedUids={pausedUids}
      unresolvableRuleUids={unresolvableRuleUids}
      unresolvableRequestUids={unresolvableRequestUids}
      liveWorkflows={liveWorkflows}
      unresolvableWorkflowUids={unresolvableWorkflowUids}
      closeIconColor={token.colorTextTertiary}
      hidden
    />
  </div>
);

// ── Sortable tab ─────────────────────────────────────────────────

interface SortableTabProps {
  leafId: string;
  isFocusedLeaf: boolean;
  tab: WorkbenchTab;
  displayLabel: string;
  isActive: boolean;
  rules: Rule[];
  templates: Template[];
  requests: Request[];
  pausedUids: ReadonlySet<string>;
  unresolvableRuleUids: ReadonlySet<string>;
  unresolvableRequestUids: ReadonlySet<string>;
  liveWorkflows: LiveWorkflow[];
  unresolvableWorkflowUids: ReadonlySet<string>;
  tabPath?: string[];
  contextMenu: { items: ItemType[] };
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onDoubleClick?: (id: string) => void;
}

const SortableTab: React.FC<SortableTabProps> = ({
  leafId,
  isFocusedLeaf,
  tab,
  displayLabel,
  isActive,
  rules,
  templates,
  requests,
  pausedUids,
  unresolvableRuleUids,
  unresolvableRequestUids,
  liveWorkflows,
  unresolvableWorkflowUids,
  tabPath,
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

  // Active tabs render as a tinted rounded pill; inactive sit flat on
  // the bar and gain a neutral grey pill on hover (CSS). Focused-leaf
  // active tabs use the primary tint so you can tell which editor
  // group owns focus at a glance; unfocused active tabs use a neutral
  // fill so two splits don't fight for attention.
  const visualStyle: React.CSSProperties = isDragging
    ? emptyPlaceholderStyle(token)
    : isActive && isFocusedLeaf
      ? { color: token.colorPrimary, background: token.colorPrimaryBg }
      : isActive
        ? { color: token.colorText, background: token.colorFillSecondary }
        : { color: token.colorTextSecondary };

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
        displayLabel={displayLabel}
        rules={rules}
        templates={templates}
        requests={requests}
        pausedUids={pausedUids}
        unresolvableRuleUids={unresolvableRuleUids}
        unresolvableRequestUids={unresolvableRequestUids}
        liveWorkflows={liveWorkflows}
        unresolvableWorkflowUids={unresolvableWorkflowUids}
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

  // Hover tooltip shows the tab's breadcrumb path (workspace excluded).
  // Root segment stays plain text; folders carry a neutral folder glyph;
  // entity segments mirror the tab's own icon so type is always readable.
  // Scratch tabs (create modes before first save — the entity doesn't
  // exist in storage yet) inject a grey "Scratch" segment between root
  // and entity. "Scratch" is chosen over "Draft" because persisted
  // entities can also carry a draft state and the two would collide.
  type TooltipSegmentKind = 'root' | 'folder' | 'scratch' | 'entity';
  const scratchLabel = scratchLabelForMode(tab.mode);
  const tooltipSegments: { label: string; kind: TooltipSegmentKind }[] = [];
  if (tabPath && tabPath.length > 0) {
    tooltipSegments.push({ label: tabPath[0], kind: 'root' });
    for (let i = 1; i < tabPath.length - 1; i++) {
      tooltipSegments.push({ label: tabPath[i], kind: 'folder' });
    }
    if (tabPath.length >= 2) {
      if (scratchLabel) tooltipSegments.push({ label: scratchLabel, kind: 'scratch' });
      tooltipSegments.push({ label: tabPath[tabPath.length - 1], kind: 'entity' });
    }
  }
  const tooltipTitle =
    tooltipSegments.length > 0 ? (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', lineHeight: 1.4 }}>
        {tooltipSegments.map((s, i) => {
          const icon =
            s.kind === 'folder' ? (
              <FolderOpenOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
            ) : s.kind === 'entity' ? (
              tabIcon(
                tab,
                rules,
                templates,
                pausedUids,
                requests,
                unresolvableRequestUids,
                unresolvableRuleUids,
                liveWorkflows,
                unresolvableWorkflowUids,
                { compact: true },
              )
            ) : null;
          const color = s.kind === 'scratch' ? token.colorTextTertiary : token.colorText;
          // Each segment groups with its leading chevron into a single
          // nowrap inline-flex so wrap never breaks between a chevron
          // and the label it precedes — breaks only happen between
          // whole segments.
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: path segments are inherently positional
            <span
              key={`${s.label}-${i}`}
              style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', color }}
            >
              {i > 0 && <span style={{ color: token.colorTextTertiary, margin: '0 5px' }}>{'›'}</span>}
              {icon && <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 4 }}>{icon}</span>}
              <span>{s.label}</span>
            </span>
          );
        })}
      </span>
    ) : (
      displayLabel
    );

  return (
    <Dropdown menu={contextMenu} trigger={['contextMenu']} onOpenChange={setContextMenuOpen}>
      <Tooltip
        title={tooltipTitle}
        color={token.colorBgElevated}
        overlayClassName="rules-tab-path-tooltip"
        overlayInnerStyle={{
          color: token.colorText,
          fontSize: 11,
          padding: '3px 8px',
          border: `1px solid ${token.colorBorderSecondary}`,
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.06)',
        }}
        placement="bottomLeft"
        // Offset the tooltip 6 px further from the tab so it clears
        // the bar's bottom scrollbar gutter on hover. Without the
        // offset the tooltip's top edge would sit right next to the
        // hover-revealed scrollbar thumb, reading as visual clutter.
        align={{ offset: [0, 6] }}
        arrow={false}
        mouseEnterDelay={0.5}
        mouseLeaveDelay={0}
        destroyTooltipOnHide
        open={contextMenuOpen ? false : undefined}
      >
        {content}
      </Tooltip>
    </Dropdown>
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
  requests,
  pausedUids,
  unresolvableRuleUids = EMPTY_SET,
  unresolvableRequestUids = EMPTY_SET,
  liveWorkflows = [],
  unresolvableWorkflowUids = EMPTY_SET,
  getTabPath,
  getDisplayLabel,
  onSwitch,
  onClose,
  onTabDoubleClick,
  onDuplicate,
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
  registerTabSearchToggle,
}) => {
  const { token } = theme.useToken();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tabSearchOpen, setTabSearchOpen] = useState(false);

  // Stable lookup for the live display label. Older callers that don't
  // wire `getDisplayLabel` fall back to the seed `tab.label`, keeping
  // the source-compatibility contract spelled out on the prop.
  const resolveDisplayLabel = useCallback(
    (tab: WorkbenchTab) => getDisplayLabel?.(tab) ?? tab.label,
    [getDisplayLabel],
  );

  // ── Auto-scroll active tab into view ───────────────────────────
  // When the last tab is active, scroll to the end so the "+" button is also visible.
  useEffect(() => {
    if (!activeTabId || !scrollRef.current) return;
    const container = scrollRef.current;
    const isLastTab = tabs.length > 0 && tabs[tabs.length - 1].id === activeTabId;

    // Instant, not smooth: selecting a tab (e.g. from the sidebar)
    // should snap the strip to it. A smooth scroll across many tabs
    // reads as a sluggish "rubber band" between click and arrival.
    if (isLastTab) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'instant' });
    } else {
      const el = container.querySelector(`[data-tab-id="${activeTabId}"]`);
      el?.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTabId, tabs]);

  // ── Horizontal wheel scroll ────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (scrollRef.current) scrollRef.current.scrollLeft += e.deltaY;
  }, []);

  // ── Register tab-search toggle with the workspace shortcut host ──
  //
  // The workspace shortcut registry owns chord dispatch; TabBar owns the
  // `tabSearchOpen` state. We bridge the two by publishing a toggle
  // function upward on mount, so pressing the `tab-search` chord (user-
  // rebindable) invokes the SAME setState that the click affordance
  // does — instead of the old hardcoded `Shift+Cmd+A` window listener
  // that never reflected user rebinds.
  useEffect(() => {
    if (!registerTabSearchToggle) return;
    registerTabSearchToggle(() => setTabSearchOpen((v) => !v));
    return () => registerTabSearchToggle(() => undefined);
  }, [registerTabSearchToggle]);
  const tabSearchLabel = useShortcutLabel('tab-search');
  const newRuleLabel = useShortcutLabel('new-rule');

  // ── Context menu builder ───────────────────────────────────────
  const menuIconWrap = useCallback(
    (node: React.ReactNode) => (
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
    ),
    [],
  );

  const buildContextMenu = useCallback(
    (tab: WorkbenchTab, tabIndex: number): { items: ItemType[] } => {
      const splitDisabled = tabs.length < 2;
      // "Duplicate Tab" only applies to Rules and Requests — the copy
      // lands as a scratch (never live, never a stored draft) regardless
      // of whether the source was published or still drafting.
      const isDuplicable =
        tab.mode === 'edit' ||
        tab.mode === 'rule-create' ||
        tab.mode === 'request-edit' ||
        tab.mode === 'request-create';
      return {
        items: [
          ...(isDuplicable && onDuplicate
            ? [
                {
                  key: 'duplicate',
                  label: 'Duplicate Tab',
                  icon: menuIconWrap(<CopyOutlined />),
                  onClick: () => onDuplicate(tab.id),
                } satisfies ItemType,
                { type: 'divider' as const },
              ]
            : []),
          { key: 'close', label: menuItemLabel('Close', 'close-tab'), onClick: () => onClose(tab.id) },
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
      menuIconWrap,
      onDuplicate,
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

  // Track whether the tabs strip is actually overflowing so the
  // edge-fade mask is only painted when there's content beyond the
  // visible window. With `flex: 0 1 auto` the strip is content-sized
  // when the tabs fit, so an unconditional mask would fade the
  // rightmost tab's edge for no reason. `useLayoutEffect` with no
  // deps re-checks after every render — cheap DOM read against
  // `scrollWidth`/`clientWidth`, only triggers a re-render when the
  // boolean actually flips.
  const [hasOverflow, setHasOverflow] = useState(false);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.scrollWidth > el.clientWidth + 1;
    if (next !== hasOverflow) setHasOverflow(next);
  });

  // Cross-leaf insertion marker — rendered in this bar only when the
  // published drag intent targets this leaf. Published from
  // EditorGroupRenderer via DragIntentContext; consumed here directly
  // so TabBar doesn't need a new prop.
  const dragIntentForBar = useDragIntent();
  const insertionIndex = dragIntentForBar.insertion?.leafId === leafId ? dragIntentForBar.insertion.index : null;
  const insertionTab = insertionIndex !== null ? dragIntentForBar.draggingTab : null;

  return (
    <div className="rules-tabs-bar" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      {/* Scrollable tabs — content-sized when tabs fit, shrinks when
          they overflow. The `+` button lives OUTSIDE this element
          (sibling below) so it stays anchored at the right edge of
          the strip when the user scrolls horizontally — same pattern
          as the JetBrains IDE / VS Code editor tabs. */}
      <div className={`rules-tabs-scroll${hasOverflow ? ' is-overflow' : ''}`} ref={scrollRef} onWheel={handleWheel}>
        <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
          {tabs.map((tab, index) => (
            <Fragment key={tab.id}>
              {insertionIndex === index && insertionTab && (
                <CrossLeafInsertionMarker
                  tab={insertionTab}
                  displayLabel={resolveDisplayLabel(insertionTab)}
                  rules={rules}
                  templates={templates}
                  requests={requests}
                  pausedUids={pausedUids}
                  unresolvableRuleUids={unresolvableRuleUids}
                  unresolvableRequestUids={unresolvableRequestUids}
                  liveWorkflows={liveWorkflows}
                  unresolvableWorkflowUids={unresolvableWorkflowUids}
                  token={token}
                />
              )}
              <SortableTab
                leafId={leafId}
                isFocusedLeaf={isFocusedLeaf}
                tab={tab}
                displayLabel={resolveDisplayLabel(tab)}
                isActive={tab.id === activeTabId}
                rules={rules}
                templates={templates}
                requests={requests}
                pausedUids={pausedUids}
                unresolvableRuleUids={unresolvableRuleUids}
                unresolvableRequestUids={unresolvableRequestUids}
                liveWorkflows={liveWorkflows}
                unresolvableWorkflowUids={unresolvableWorkflowUids}
                tabPath={getTabPath?.(tab)}
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
              displayLabel={resolveDisplayLabel(insertionTab)}
              rules={rules}
              templates={templates}
              requests={requests}
              pausedUids={pausedUids}
              unresolvableRuleUids={unresolvableRuleUids}
              unresolvableRequestUids={unresolvableRequestUids}
              liveWorkflows={liveWorkflows}
              unresolvableWorkflowUids={unresolvableWorkflowUids}
              token={token}
            />
          )}
        </SortableContext>
      </div>

      {/* + button — sits IMMEDIATELY after the tabs strip in the bar's
          flex layout, never inside the scroll container. When tabs
          fit, the strip is content-sized so + sits right after the
          last tab; when tabs overflow, the strip shrinks and + stays
          anchored at the strip's right edge (visually "sticky"). */}
      <Dropdown
        menu={{ items: createMenuItems }}
        trigger={['click']}
        placement="bottomRight"
        open={createMenuOpen}
        onOpenChange={(v) => onCreateMenuOpenChange?.(v)}
      >
        <Tooltip
          title={<ShortcutHintTitle label={newRuleLabel}>New rule</ShortcutHintTitle>}
          placement="bottom"
          open={createMenuOpen ? false : undefined}
        >
          <div className="rules-tab-action rules-tab-action-create" style={{ color: token.colorTextSecondary }}>
            <PlusOutlined style={{ fontSize: 12 }} />
          </div>
        </Tooltip>
      </Dropdown>

      {/* Tab search chevron (always visible, outside scroll). The
          `marginLeft: auto` pushes the chevron to the bar's right
          edge in the fit case (creating breathing room between `+`
          and the chevron) and collapses to 0 in the overflow case
          (everything packed right). */}
      <div style={{ position: 'relative', flexShrink: 0, marginLeft: 'auto' }}>
        <Tooltip
          title={<ShortcutHintTitle label={tabSearchLabel}>Search tabs</ShortcutHintTitle>}
          placement="bottom"
          open={tabSearchOpen ? false : undefined}
        >
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
          requests={requests}
          pausedUids={pausedUids}
          unresolvableRuleUids={unresolvableRuleUids}
          unresolvableRequestUids={unresolvableRequestUids}
          liveWorkflows={liveWorkflows}
          unresolvableWorkflowUids={unresolvableWorkflowUids}
          getTabPath={getTabPath}
          getDisplayLabel={resolveDisplayLabel}
          onSwitch={onSwitch}
          recentlyClosed={recentlyClosed}
          onReopen={onReopenTab}
        />
      </div>
    </div>
  );
};

export default TabBar;
