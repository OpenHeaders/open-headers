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

import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import { horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import type { LiveWorkflow, Request, Rule, Template } from '@openheaders/core/types';
import { Dropdown, Tooltip, theme } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import type React from 'react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { ApiRequestsIcon } from '@openheaders/ui/shared/icons';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';
import { useDragIntent } from '../../drag-intent';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { buildRuleTypeMenuItems } from '../../rule-type-menu';
import type { ClosedTab, WorkbenchTab } from '../../types';
import CappedMenuPopup from '../shared/CappedMenuPopup';
import CrossLeafInsertionMarker from './CrossLeafInsertionMarker';
import OverlayScrollThumb from './OverlayScrollThumb';
import SortableTab from './SortableTab';
import TabSearchDropdown from './TabSearchDropdown';
import { buildTabContextMenu } from './build-tab-context-menu';
import { EMPTY_SET } from './tab-format';

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
  /** "Create API Request" row at the top of the + create menu. */
  onCreateRequest: () => void;
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
  onCreateRequest,
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
  const t = useT();
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
  // Only translate predominantly-vertical wheel gestures; a horizontal
  // trackpad pan already scrolls the strip natively via deltaX, and
  // adding its stray deltaY component on top fights the native scroll
  // (a rubber-band feel on slow pans, most visible in Firefox).
  //
  // Deltas are normalized to pixels first: Chromium always reports
  // pixels (deltaMode 0), but Firefox reports physical mouse-wheel
  // ticks in lines (deltaMode 1, ~3 per notch) — raw `+= deltaY`
  // there moves the strip ~3 px per notch, i.e. not at all.
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
    const el = scrollRef.current;
    if (!el) return;
    const unit =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
    el.scrollLeft += e.deltaY * unit;
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
  const buildContextMenu = useCallback(
    (tab: WorkbenchTab, tabIndex: number): { items: ItemType[] } =>
      buildTabContextMenu(
        {
          tab,
          tabIndex,
          tabCount: tabs.length,
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
        },
        t,
      ),
    [
      tabs.length,
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
      t,
    ],
  );

  // Viewport fit for the create menu — caps the menu to the room below
  // the `+` trigger so it shrinks + scrolls internally (persistent
  // scrollbar) instead of getting clipped on short windows. Measured via
  // effect (not the Dropdown's onOpenChange) because the menu can also
  // be opened externally through the `createMenuOpen` prop.
  const {
    triggerRef: createTriggerRef,
    onOpenChange: measureCreateMenu,
    maxHeight: createMenuMaxHeight,
  } = usePopoverViewportFit<HTMLDivElement>();
  // Horizontal side: open rightward by default (`bottomLeft`), flip to
  // extend leftward only when the right side lacks room — with the
  // sidebar collapsed the `+` sits near the viewport's left edge, where
  // a left-extending menu would run off-screen. Width is an estimate of
  // the widest row since the menu isn't rendered at measure time.
  const [createMenuPlacement, setCreateMenuPlacement] = useState<'bottomLeft' | 'bottomRight'>('bottomLeft');
  useEffect(() => {
    measureCreateMenu(createMenuOpen === true);
    if (createMenuOpen !== true) return;
    const rect = createTriggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const CREATE_MENU_WIDTH_PX = 320;
    setCreateMenuPlacement(window.innerWidth - rect.left >= CREATE_MENU_WIDTH_PX ? 'bottomLeft' : 'bottomRight');
  }, [createMenuOpen, measureCreateMenu, createTriggerRef]);

  // "Create API Request" leads the menu; the fixed-width icon slot
  // matches the rule rows' 48px code badges so labels stay aligned.
  const createMenuItems: ItemType[] = [
    {
      key: 'api-request',
      icon: (
        <span style={{ display: 'inline-flex', width: 48, flexShrink: 0 }}>
          <ApiRequestsIcon />
        </span>
      ),
      label: t('workbench.tabbar.createApiRequest'),
      onClick: onCreateRequest,
    },
    { type: 'divider' },
    ...buildRuleTypeMenuItems(onCreateRule, t),
  ];
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
          as IDE editor tabs. */}
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

      {/* Gecko-only stand-in for the 3px webkit scroll thumb (Firefox
          has no native sub-`thin` scrollbar, so the native one is
          hidden and this mirrors it). Renders null on Chromium. */}
      <OverlayScrollThumb scrollRef={scrollRef} />

      {/* + button — sits IMMEDIATELY after the tabs strip in the bar's
          flex layout, never inside the scroll container. When tabs
          fit, the strip is content-sized so + sits right after the
          last tab; when tabs overflow, the strip shrinks and + stays
          anchored at the strip's right edge (visually "sticky"). */}
      <Dropdown
        menu={{ items: createMenuItems }}
        popupRender={(menu) => <CappedMenuPopup menu={menu} maxHeight={createMenuMaxHeight} />}
        trigger={['click']}
        placement={createMenuPlacement}
        autoAdjustOverflow={false}
        open={createMenuOpen}
        onOpenChange={(v) => onCreateMenuOpenChange?.(v)}
      >
        <Tooltip
          title={<ShortcutHintTitle label={newRuleLabel}>{t('workbench.tabbar.createItem')}</ShortcutHintTitle>}
          placement="bottom"
          open={createMenuOpen ? false : undefined}
        >
          <div
            className="rules-tab-action rules-tab-action-create"
            ref={createTriggerRef}
            style={{ color: token.colorTextSecondary }}
          >
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
          title={<ShortcutHintTitle label={tabSearchLabel}>{t('workbench.tabbar.searchTabs')}</ShortcutHintTitle>}
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
