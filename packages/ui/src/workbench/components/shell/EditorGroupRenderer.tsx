/**
 * EditorGroupRenderer — recursive renderer for the split editor
 * group tree.
 *
 * Drop-zone model:
 * while a tab is being dragged we track the live cursor position via a
 * single window pointermove listener, hit-test it against every leaf's
 * bounding rect, and compute one of five zones per leaf: center, left,
 * right, top, bottom. An edge zone is selected only when the cursor is
 * within 25% of that edge and that edge is the closest one. Otherwise
 * the whole leaf is the "center" target.
 *
 * The visual highlight ALWAYS covers half the panel (edge) or the whole
 * panel (center), matching a typical split-editor drag preview —
 * the 25% hit region and the 50% highlight geometry are deliberately
 * different.
 *
 * Drop dispatch runs inside this component via useDndMonitor:
 *   - over = editor-tab droppable → same-leaf reorder OR cross-leaf
 *     insert at that tab's index.
 *   - over = none (or not a tab) but hoverState is set → leaf center
 *     move, or splitLeafWithDrop for edge zones.
 * ShellLayout no longer routes editor-tab drops — it only renders the
 * drag preview overlay.
 */

import { useDndMonitor } from '@dnd-kit/core';
import type { LiveWorkflow, Request, Rule, Template } from '@openheaders/core/types';
import { Allotment } from 'allotment';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TabActiveProvider } from '@openheaders/ui/shared/awareness/TabActiveContext';
import { type DragIntent, DragIntentContext } from '../../drag-intent';
import { useFocusedRegion } from '../../stores/focus-region-store';
import { allLeaves, type EditorLeaf, type EditorNode, findLeaf, findParentSplitLink } from '../../editor-groups';
import type { UseEditorGroupsApi } from '../../hooks/useEditorGroups';
import type { ClosedTab, WorkbenchTab } from '../../types';
import TabBar from '../tabbar/TabBar';

// ── Drop zone math ───────────────────────────────────────────────

export type LeafDropZone = 'center' | 'left' | 'right' | 'top' | 'bottom';

interface LeafHover {
  leafId: string;
  zone: LeafDropZone;
}

const EDGE_THRESHOLD = 0.25;
// Top edge is deliberately tighter than left/right/bottom — the tab
// strip sits right above it and the user's muscle memory is to aim
// near the top when targeting a "split up", so 1/8 is easier to hit
// intentionally and harder to hit accidentally.
const TOP_EDGE_THRESHOLD = 0.125;

/**
 * Hit test for a leaf under a drag. Exported for the terminal panel's
 * group renderer, which runs the identical drop-zone model over its own
 * leaves (`contentSelector` names its content region; the tab-bar
 * exclusion matches on the shared `.rules-tabs-bar` class).
 *
 *   - Tab-bar strip → always null. The sortable (reorder / cross-leaf
 *     insert) owns that region completely.
 *   - Content area edges:
 *       left  / right / bottom 25% → "left" / "right" / "bottom"
 *       top 12.5%                 → "top"
 *     Whichever edge the cursor is closest to (within its threshold)
 *     wins; otherwise → "center".
 *   - Elsewhere inside the leaf (breadcrumb, gaps) → "center".
 */
export function computeZoneForLeaf(
  leafEl: HTMLElement,
  clientX: number,
  clientY: number,
  contentSelector = '.rules-editor-content',
): LeafDropZone | null {
  const leafRect = leafEl.getBoundingClientRect();
  if (clientX < leafRect.left || clientX > leafRect.right || clientY < leafRect.top || clientY > leafRect.bottom) {
    return null;
  }

  const tabBar = leafEl.querySelector<HTMLElement>('.rules-tabs-bar');
  if (tabBar) {
    const r = tabBar.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) return null;
  }

  const content = leafEl.querySelector<HTMLElement>(contentSelector);
  if (content) {
    const c = content.getBoundingClientRect();
    if (clientX >= c.left && clientX <= c.right && clientY >= c.top && clientY <= c.bottom) {
      const relX = (clientX - c.left) / c.width;
      const relY = (clientY - c.top) / c.height;
      const candidates: Array<{ zone: LeafDropZone; distance: number; threshold: number }> = [
        { zone: 'left', distance: relX, threshold: EDGE_THRESHOLD },
        { zone: 'right', distance: 1 - relX, threshold: EDGE_THRESHOLD },
        { zone: 'top', distance: relY, threshold: TOP_EDGE_THRESHOLD },
        { zone: 'bottom', distance: 1 - relY, threshold: EDGE_THRESHOLD },
      ];
      const hit = candidates.filter((c2) => c2.distance < c2.threshold).sort((a, b) => a.distance - b.distance)[0];
      if (hit) return hit.zone;
    }
  }

  return 'center';
}

function previewStyleFor(zone: LeafDropZone): React.CSSProperties {
  switch (zone) {
    case 'center':
      return { inset: 0 };
    case 'left':
      return { left: 0, top: 0, width: '50%', height: '100%' };
    case 'right':
      return { right: 0, top: 0, width: '50%', height: '100%' };
    case 'top':
      return { left: 0, top: 0, width: '100%', height: '50%' };
    case 'bottom':
      return { left: 0, bottom: 0, width: '100%', height: '50%' };
  }
}

// ── Per-tab panel with scroll-memory ─────────────────────────────
//
// Each tab gets its own scroll container. Inactive panels are
// `display: none` so they take no layout or paint cost — important
// because some child components (antd Tabs, Allotment, Monaco)
// run layout effects with ResizeObservers that would otherwise fire
// for every hidden leaf, cascading into a setState-in-layout-effect
// loop when multiple tabs are open at once.
//
// The tradeoff is that the browser resets scrollTop when a scroll
// container transitions display: none → block, so we mirror the last
// observed scrollTop into a per-panel ref and restore it on every
// activation in a layout effect (before paint).

interface TabPanelProps {
  isActive: boolean;
  children: React.ReactNode;
}

const TabPanel: React.FC<TabPanelProps> = ({ isActive, children }) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);

  // Lazy keep-alive: the body first mounts when the tab first becomes
  // active, and stays mounted from then on (scroll memory, editor
  // drafts). A restored session can carry dozens of tabs, and none of
  // them has in-memory state yet (dirtiness is cleared on restore) —
  // eagerly mounting every body just front-loads their full render cost
  // onto workbench load.
  const [everActive, setEverActive] = useState(isActive);
  if (isActive && !everActive) setEverActive(true);

  useLayoutEffect(() => {
    if (!isActive) return;
    const el = panelRef.current;
    if (el) el.scrollTop = scrollTopRef.current;
  }, [isActive]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  }, []);

  return (
    <TabActiveProvider value={isActive}>
      <div
        ref={panelRef}
        className="rules-editor-tab-panel"
        style={isActive ? undefined : { display: 'none' }}
        onScroll={handleScroll}
        aria-hidden={isActive ? undefined : true}
        inert={!isActive}
      >
        {everActive ? children : null}
      </div>
    </TabActiveProvider>
  );
};

// ── Preview overlay ──────────────────────────────────────────────

interface LeafDropPreviewProps {
  active: boolean;
  zone: LeafDropZone;
}

/** Half-panel (edge) / whole-panel (center) drop highlight — shared
 *  with the terminal panel's group renderer. */
export const LeafDropPreview: React.FC<LeafDropPreviewProps> = ({ active, zone }) => {
  const { token } = theme.useToken();
  if (!active) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 40,
        background: `${token.colorPrimary}22`,
        border: `2px solid ${token.colorPrimary}`,
        // Border inside the 50%/100% box — content-box math would push
        // the far edge 4px past the pane and clip the border there.
        boxSizing: 'border-box',
        borderRadius: 4,
        transition: 'all 0.08s ease',
        ...previewStyleFor(zone),
      }}
    />
  );
};

// ── Props ────────────────────────────────────────────────────────

export interface RenderLeafContext {
  tab: WorkbenchTab;
  leafId: string;
  isFocusedLeaf: boolean;
}

export interface RenderLeafHeaderContext {
  leaf: EditorLeaf;
  isFocusedLeaf: boolean;
  activeTab: WorkbenchTab | undefined;
}

export interface EditorGroupRendererProps {
  groups: UseEditorGroupsApi;
  rules: Rule[];
  templates: Template[];
  requests: Request[];
  pausedUids: ReadonlySet<string>;
  /** Rules/Requests/Workflows whose `{{...}}` references don't resolve
   *  against the current scope — forwarded to TabBar for icon coloring. */
  unresolvableRuleUids?: ReadonlySet<string>;
  unresolvableRequestUids?: ReadonlySet<string>;
  liveWorkflows?: LiveWorkflow[];
  unresolvableWorkflowUids?: ReadonlySet<string>;
  renderTabBody: (ctx: RenderLeafContext) => React.ReactNode;
  renderLeafHeader: (ctx: RenderLeafHeaderContext) => React.ReactNode;
  renderEmpty: () => React.ReactNode;
  /** Returns the breadcrumb segments (without workspace) for a tab —
   *  forwarded to TabBar so hover tooltips can show the tab's path. */
  getTabPath?: (tab: WorkbenchTab) => string[];
  /** Live-derived display label per tab — forwarded to TabBar so
   *  renames in any surface land in the tab strip without an
   *  imperative sync hook. See `tab-display.ts`. */
  getDisplayLabel?: (tab: WorkbenchTab) => string;
  onCreateRule: (type: string) => void;
  /** "Create API Request" row on each leaf's + create menu. */
  onCreateRequest: () => void;
  createMenuOpen?: boolean;
  onCreateMenuOpenChange?: (open: boolean) => void;
  /** Forwarded to the focused leaf's TabBar so App.tsx can reach the tab-search toggle. */
  registerTabSearchToggle?: (toggle: () => void) => void;
  onTabDoubleClick?: (tabId: string) => void;
  /** Duplicate a rule/request tab into a fresh scratch — surfaced on
   *  the tab context menu, forwarded to each leaf's TabBar. */
  onDuplicate?: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOther: (tabId: string) => void;
  onCloseAll: () => void;
  onCloseUnmodified: () => void;
  onCloseToLeft: (tabId: string) => void;
  onCloseToRight: (tabId: string) => void;
  recentlyClosed: ClosedTab[];
}

// ── Component ────────────────────────────────────────────────────

export const EditorGroupRenderer: React.FC<EditorGroupRendererProps> = ({
  groups,
  rules,
  templates,
  requests,
  pausedUids,
  unresolvableRuleUids,
  unresolvableRequestUids,
  liveWorkflows,
  unresolvableWorkflowUids,
  renderTabBody,
  renderLeafHeader,
  renderEmpty,
  getTabPath,
  getDisplayLabel,
  onCreateRule,
  onCreateRequest,
  createMenuOpen,
  onCreateMenuOpenChange,
  registerTabSearchToggle,
  onTabDoubleClick,
  onDuplicate,
  onCloseTab,
  onCloseOther,
  onCloseAll,
  onCloseUnmodified,
  onCloseToLeft,
  onCloseToRight,
  recentlyClosed,
}) => {
  const { token } = theme.useToken();
  const canUnsplitAll = allLeaves(groups.root).length >= 3;

  // Per-leaf DOM refs for cursor hit-testing. Populated via the ref
  // callback attached to each leaf's root element.
  const leafRefs = useRef(new Map<string, HTMLElement>());
  const registerLeafRef = useCallback((leafId: string) => {
    return (el: HTMLElement | null) => {
      if (el) leafRefs.current.set(leafId, el);
      else leafRefs.current.delete(leafId);
    };
  }, []);

  // Drag state — only populated while an editor-tab drag is active. We
  // keep a ref mirror for inside-of-listener reads without stale closures.
  const [dragActive, setDragActive] = useState<{ fromLeafId: string; tabId: string } | null>(null);
  const dragRef = useRef<{ fromLeafId: string; tabId: string } | null>(null);
  const [hover, setHover] = useState<LeafHover | null>(null);
  const hoverRef = useRef<LeafHover | null>(null);
  hoverRef.current = hover;
  const [insertion, setInsertion] = useState<{ leafId: string; index: number } | null>(null);
  const rootRef = useRef(groups.root);
  rootRef.current = groups.root;

  // Cursor tracking — one pointermove listener while dragging.
  useEffect(() => {
    if (!dragActive) {
      setHover(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      let match: LeafHover | null = null;
      for (const [leafId, el] of leafRefs.current) {
        const zone = computeZoneForLeaf(el, e.clientX, e.clientY);
        if (zone) {
          match = { leafId, zone };
          break;
        }
      }
      setHover((prev) => {
        if (prev && match && prev.leafId === match.leafId && prev.zone === match.zone) return prev;
        return match;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [dragActive]);

  // ── DnD monitor — owns editor-tab drop dispatch ────────────────
  useDndMonitor({
    onDragStart: (event) => {
      const data = event.active.data.current as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
      if (data?.kind !== 'editor-tab') return;
      if (typeof data.leafId !== 'string' || typeof data.tabId !== 'string') return;
      const next = { fromLeafId: data.leafId, tabId: data.tabId };
      dragRef.current = next;
      setDragActive(next);
      setInsertion(null);
    },
    onDragOver: (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const overData = event.over?.data.current as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
      if (overData?.kind !== 'editor-tab') {
        setInsertion((prev) => (prev === null ? prev : null));
        return;
      }
      if (typeof overData.leafId !== 'string' || typeof overData.tabId !== 'string') return;
      if (overData.leafId === drag.fromLeafId) {
        // Same-leaf reorder is handled natively by SortableContext —
        // no cross-leaf insertion marker needed.
        setInsertion((prev) => (prev === null ? prev : null));
        return;
      }
      const toLeaf = findLeaf(rootRef.current, overData.leafId);
      const idx = toLeaf?.tabs.findIndex((t) => t.id === overData.tabId) ?? -1;
      if (idx < 0) return;
      setInsertion((prev) => {
        if (prev && prev.leafId === overData.leafId && prev.index === idx) return prev;
        return { leafId: overData.leafId as string, index: idx };
      });
    },
    onDragCancel: () => {
      dragRef.current = null;
      setDragActive(null);
      setHover(null);
      setInsertion(null);
    },
    onDragEnd: (event) => {
      const drag = dragRef.current;
      dragRef.current = null;
      const hoverAtDrop = hoverRef.current;
      setDragActive(null);
      setHover(null);
      setInsertion(null);
      if (!drag) return;

      // Priority 1: dropped on another editor tab (sortable droppable).
      const over = event.over;
      const overData = over?.data.current as { kind?: unknown; leafId?: unknown; tabId?: unknown } | undefined;
      if (
        overData?.kind === 'editor-tab' &&
        typeof overData.leafId === 'string' &&
        typeof overData.tabId === 'string'
      ) {
        const toLeafId = overData.leafId;
        const toTabId = overData.tabId;
        if (drag.fromLeafId === toLeafId) {
          if (drag.tabId !== toTabId) groups.reorderTab(drag.tabId, toTabId);
          return;
        }
        const toLeaf = findLeaf(groups.root, toLeafId);
        const idx = toLeaf?.tabs.findIndex((t) => t.id === toTabId) ?? -1;
        groups.moveTabToLeaf(drag.fromLeafId, toLeafId, drag.tabId, idx === -1 ? undefined : idx);
        return;
      }

      // Priority 2: cursor is inside some leaf — center or edge split.
      if (!hoverAtDrop) return;
      if (hoverAtDrop.zone === 'center') {
        if (hoverAtDrop.leafId === drag.fromLeafId) return;
        groups.moveTabToLeaf(drag.fromLeafId, hoverAtDrop.leafId, drag.tabId);
        return;
      }
      groups.splitLeafWithDrop(hoverAtDrop.leafId, hoverAtDrop.zone, drag.fromLeafId, drag.tabId);
    },
  });

  const handleLeafPointerDown = useCallback(
    (leafId: string) => {
      groups.focusLeaf(leafId);
    },
    [groups],
  );

  // Precompute which leaves still have a parent split (for Unsplit enablement).
  const parentedLeafIds = useMemo(() => collectLeavesWithParent(groups.root), [groups.root]);

  // Published drag-intent state. Three signals cover every visual
  // aspect of an editor-tab drag:
  //   - draggingTabId: who is being dragged (source placeholder owner).
  //   - overDropZone: cursor is over a leaf-drop zone → hide source
  //     placeholder, show drop-preview overlay.
  //   - insertion: cursor is over a tab in a DIFFERENT leaf → hide
  //     source placeholder AND render a cross-leaf insertion marker in
  //     the destination TabBar at that index.
  const draggingTab = useMemo<WorkbenchTab | null>(() => {
    if (!dragActive) return null;
    return groups.allTabs.find((t) => t.id === dragActive.tabId) ?? null;
  }, [dragActive, groups.allTabs]);

  const dragIntent = useMemo<DragIntent>(
    () => ({
      draggingTabId: dragActive?.tabId ?? null,
      draggingTab,
      overDropZone: dragActive !== null && hover !== null,
      insertion,
    }),
    [dragActive, draggingTab, hover, insertion],
  );

  // ONE global blue: the editor's active pill renders the primary tint
  // only while the editor REGION itself owns focus. Working in any
  // dock — sidebars included, since their rows echo this strip's
  // active tab — greys the pill down to the neutral fill, so blue
  // always marks exactly one locus of focus across the workbench.
  // Functional leaf focus stays broader on purpose (below): create
  // menu, tab search, and shortcut targets keep following the focused
  // leaf while a sidebar owns focus, exactly as before.
  const focusedRegion = useFocusedRegion();
  const editorOwnsFocus = focusedRegion !== 'bottom';
  const editorOwnsTint = focusedRegion === 'editor';

  const renderLeaf = (leaf: EditorLeaf): React.ReactNode => {
    // Leaf focus (which group owns editor keyboard actions) is
    // independent of the visual tint: shortcut registrations below key
    // on the leaf alone so ⌘⇧A / ⌥N still work while a tool window has
    // focus; only the blue-vs-grey highlight follows the region.
    const isFocusedLeafId = groups.focusedLeafId === leaf.id;
    const isFocused = isFocusedLeafId && editorOwnsFocus;
    const isTintedLeaf = isFocusedLeafId && editorOwnsTint;
    const activeTab = leaf.tabs.find((t) => t.id === leaf.activeTabId);
    const canUnsplit = parentedLeafIds.has(leaf.id);
    const hoverHere = hover?.leafId === leaf.id;

    return (
      <div
        ref={registerLeafRef(leaf.id)}
        className={`rules-editor-leaf${isFocused ? ' focused' : ''}`}
        data-leaf-id={leaf.id}
        style={{
          background: token.colorBgContainer,
          borderRadius: 6,
          position: 'relative',
        }}
        onPointerDownCapture={() => handleLeafPointerDown(leaf.id)}
      >
        <TabBar
          leafId={leaf.id}
          isFocusedLeaf={isTintedLeaf}
          tabs={leaf.tabs}
          activeTabId={leaf.activeTabId}
          rules={rules}
          templates={templates}
          requests={requests}
          pausedUids={pausedUids}
          unresolvableRuleUids={unresolvableRuleUids}
          unresolvableRequestUids={unresolvableRequestUids}
          liveWorkflows={liveWorkflows}
          unresolvableWorkflowUids={unresolvableWorkflowUids}
          getTabPath={getTabPath}
          getDisplayLabel={getDisplayLabel}
          onSwitch={groups.switchTab}
          onClose={onCloseTab}
          onTabDoubleClick={onTabDoubleClick}
          onDuplicate={onDuplicate}
          onCreateRule={onCreateRule}
          onCreateRequest={onCreateRequest}
          onCloseOther={onCloseOther}
          onCloseAll={onCloseAll}
          onCloseUnmodified={onCloseUnmodified}
          onCloseToLeft={onCloseToLeft}
          onCloseToRight={onCloseToRight}
          recentlyClosed={recentlyClosed}
          onReopenTab={groups.reopenTab}
          onSplitAndMoveRight={(tabId) => groups.splitAndMoveRight(leaf.id, tabId)}
          onSplitAndMoveLeft={(tabId) => groups.splitAndMoveLeft(leaf.id, tabId)}
          onSplitAndMoveDown={(tabId) => groups.splitAndMoveDown(leaf.id, tabId)}
          onSplitAndMoveUp={(tabId) => groups.splitAndMoveUp(leaf.id, tabId)}
          onMoveToOppositeGroup={(tabId) => groups.moveToOppositeGroup(leaf.id, tabId)}
          oppositeDirection={(() => {
            const link = findParentSplitLink(groups.root, leaf.id);
            if (!link) return null;
            if (link.parent.orientation === 'horizontal') return link.side === 'a' ? 'right' : 'left';
            return link.side === 'a' ? 'down' : 'up';
          })()}
          parentOrientation={findParentSplitLink(groups.root, leaf.id)?.parent.orientation ?? null}
          onChangeSplitterOrientation={() => groups.changeSplitterOrientation(leaf.id)}
          onUnsplit={() => groups.unsplit(leaf.id)}
          onUnsplitAll={groups.unsplitAll}
          canUnsplit={canUnsplit}
          canUnsplitAll={canUnsplitAll}
          createMenuOpen={isFocused ? createMenuOpen : false}
          onCreateMenuOpenChange={isFocused ? onCreateMenuOpenChange : undefined}
          registerTabSearchToggle={isFocused ? registerTabSearchToggle : undefined}
        />
        {/* Everything below the tab bar — breadcrumb + content — lives
            inside a single positioned wrapper so the drop-preview
            overlay (absolutely positioned into this wrapper) can span
            the breadcrumb while intentionally leaving the tab strip
            untouched. */}
        <div
          className="rules-editor-leaf-body"
          style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          {renderLeafHeader({ leaf, isFocusedLeaf: isFocused, activeTab })}
          <div className="rules-editor-content">
            {leaf.tabs.length === 0 && renderEmpty()}
            {leaf.tabs.map((tab) => (
              <TabPanel key={tab.id} isActive={tab.id === leaf.activeTabId}>
                {renderTabBody({ tab, leafId: leaf.id, isFocusedLeaf: isFocused })}
              </TabPanel>
            ))}
          </div>
          <LeafDropPreview active={hoverHere} zone={hover?.zone ?? 'center'} />
        </div>
      </div>
    );
  };

  const renderNode = (node: EditorNode): React.ReactNode => {
    if (node.kind === 'leaf') return renderLeaf(node);
    const vertical = node.orientation === 'vertical';
    // Allotment captures orientation at mount and does not react to later
    // changes of its `vertical` prop — the DOM class flips but the internal
    // split-view keeps the old orientation, producing corrupted layouts.
    // Keying on orientation forces a clean remount on flip.
    return (
      <Allotment key={`${node.id}-${node.orientation}`} vertical={vertical} proportionalLayout separator>
        <Allotment.Pane minSize={180}>{renderNode(node.a)}</Allotment.Pane>
        <Allotment.Pane minSize={180}>{renderNode(node.b)}</Allotment.Pane>
      </Allotment>
    );
  };

  return (
    <DragIntentContext.Provider value={dragIntent}>
      <div className="rules-editor-tree">{renderNode(groups.root)}</div>
    </DragIntentContext.Provider>
  );
};

// ── Helpers ──────────────────────────────────────────────────────

function collectLeavesWithParent(root: EditorNode): Set<string> {
  const out = new Set<string>();
  const walk = (node: EditorNode, parented: boolean) => {
    if (node.kind === 'leaf') {
      if (parented) out.add(node.id);
      return;
    }
    walk(node.a, true);
    walk(node.b, true);
  };
  walk(root, false);
  return out;
}

export default EditorGroupRenderer;
