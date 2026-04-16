import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Allotment, LayoutPriority } from 'allotment';
import { theme } from 'antd';
import 'allotment/dist/style.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSetting } from '@/rules/settings/hooks';
import type { DockSlot, DropZoneRect, FocusRegion } from '@/shared/dock-layout';
import { DockTabStrip, DropZoneOverlay } from '@/shared/dock-layout';
import { FilterDocs } from './components/FilterDocs';
import { InspectorDetailContent } from './components/InspectorDetailContent';
import { InspectorEditorGroupRenderer } from './components/InspectorEditorGroupRenderer';
import PanelStatusBar from './components/PanelStatusBar';
import { PanelToolbar } from './components/PanelToolbar';
import { RuleExecutions } from './components/RuleExecutions';
import { SearchPanel } from './components/SearchPanel';
import { TrafficList } from './components/TrafficList';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import { setFocusedDock, setFocusedRegion, useFocusedDock, useFocusedRegion } from './data/focus-store';
import type { DetailSection } from './data/inspector-tab';
import { buildInspectorTab } from './data/inspector-tab';
import {
  ALL_PANEL_DOCK_SLOTS,
  PANEL_TOOL_WINDOW_MAP,
  type PanelDockSlot,
  type PanelToolRegion,
  type PanelToolWindowId,
  panelDockRegion,
} from './data/tool-windows';
import { useInspector } from './data/use-inspector';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { usePanelToolLayout } from './data/use-panel-tool-layout';

// ── Helpers ──────────────────────────────────────────────────────────

function sectionToTab(section: string): DetailSection {
  if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
  if (section === 'Query Params' || section === 'Request Body') return 'payload';
  if (section === 'Response') return 'response';
  return 'headers';
}

function formatTotalSize(entries: readonly { responseSize?: number }[]): string {
  let total = 0;
  for (const e of entries) {
    if (e.responseSize != null && e.responseSize > 0) total += e.responseSize;
  }
  if (total < 1024) return `${total} B`;
  if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} kB`;
  return `${(total / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFinishTime(entries: readonly { duration?: number }[]): string {
  let max = 0;
  for (const e of entries) {
    if (e.duration != null && e.duration > max) max = e.duration;
  }
  if (max === 0) return '';
  if (max < 1000) return `${Math.round(max)} ms`;
  return `${(max / 1000).toFixed(2)} s`;
}

// ── App ──────────────────────────────────────────────────────────────

export default function App() {
  const {
    entries,
    danglingFires,
    clear: clearStore,
    preserveLog,
    setPreserveLog,
    recording,
    setRecording,
  } = useInspector();
  const groups = useInspectorEditorGroups();
  const tl = usePanelToolLayout();
  const { token } = theme.useToken();

  const clear = useCallback(() => {
    clearStore();
    groups.closeAllTabs();
  }, [clearStore, groups]);

  // ── Layout settings (persisted via settings store) ────────────
  const [activityLabels, setActivityLabels] = useSetting('workspaceLayout.showToolWindowLabels');
  const [bottomFullWidth] = useSetting('workspaceLayout.bottomPanelFullWidth');
  const [sidebarLayout] = useSetting('workspaceLayout.sidebarLayout');
  const toggleLabels = useCallback(() => setActivityLabels(!activityLabels), [activityLabels, setActivityLabels]);

  // ── Panel-level state ──────────────────────────────────────
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [showFilter, setShowFilter] = useState(true);
  const [dockDragging, setDockDragging] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  const [, setSearchNonce] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusedRegion();
  const focusedDock = useFocusedDock();
  const [horizontalSizes, setHorizontalSizes] = useState<number[] | null>(null);
  const [verticalSizes, setVerticalSizes] = useState<number[] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Derived ────────────────────────────────────────────────
  const leftOpen = tl.isRegionOpen('left');
  const rightOpen = tl.isRegionOpen('right');
  const bottomOpen = tl.isRegionOpen('bottom');

  // ── Focus tracking ─────────────────────────────────────────
  const handleFocusCapture = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const regionEl = target.closest<HTMLElement>('[data-region]');
    if (!regionEl) return;
    const key = regionEl.getAttribute('data-region') as FocusRegion;
    if (key === 'left' || key === 'editor' || key === 'right' || key === 'bottom') {
      setFocusedRegion(key);
      const dockEl = target.closest<HTMLElement>('[data-dock-slot]');
      if (dockEl) {
        setFocusedDock(dockEl.getAttribute('data-dock-slot') as PanelDockSlot);
      } else if (key === 'editor') {
        setFocusedDock(null);
      }
    }
  }, []);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    const handler = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (!next || (root && !root.contains(next))) {
        setFocusedRegion(null);
        setFocusedDock(null);
      }
    };
    root.addEventListener('focusout', handler);
    return () => root.removeEventListener('focusout', handler);
  }, []);

  const iconState = useCallback(
    (windowId: PanelToolWindowId): 'focused' | 'active' | undefined => {
      const slot = tl.dockOf(windowId);
      if (!slot) return undefined;
      if (tl.state.docks[slot].active !== windowId) return undefined;
      if (focusedDock === slot) return 'focused';
      return 'active';
    },
    [tl, focusedDock],
  );

  // ── Filter ─────────────────────────────────────────────────
  const filterTokens = useMemo(() => parseFilter(urlFilter, filterConfig), [urlFilter, filterConfig]);
  const filterError = useMemo(() => hasFilterError(filterTokens), [filterTokens]);

  // ── Open request as tab ────────────────────────────────────
  const handleSelect = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (!entry) return;
      const tab = buildInspectorTab(entry, 'network');
      tab.statusCode = entry.statusCode;
      groups.addTab(tab);
      setSearchHighlight(undefined);
      setSearchSection(undefined);
      setSearchLineNumber(undefined);
    },
    [entries, groups],
  );

  const handleCrossNav = useCallback(
    (id: string) => {
      tl.activateWindow('network');
      handleSelect(id);
    },
    [tl, handleSelect],
  );

  const handleSearchResult = useCallback(
    (entryId: string, highlight: string, section: string, lineNumber: number) => {
      const entry = entries.find((e) => e.id === entryId);
      if (!entry) return;
      const tab = buildInspectorTab(entry, 'network');
      tab.activeSection = sectionToTab(section);
      tab.statusCode = entry.statusCode;
      groups.addTab(tab);
      groups.updateTab(tab.id, { activeSection: sectionToTab(section) });
      setSearchHighlight(highlight);
      setSearchSection(section);
      setSearchLineNumber(lineNumber);
      setSearchNonce((n) => n + 1);
    },
    [entries, groups],
  );

  // ── Editor group tab body ──────────────────────────────────
  const renderTabBody = useCallback(
    ({ tab }: { tab: ReturnType<typeof buildInspectorTab>; leafId: string; isFocusedLeaf: boolean }) => {
      const request = entries.find((e) => e.id === tab.requestId);
      if (!request) {
        return <div className="dt-editor-empty">Request no longer available (cleared or navigated away)</div>;
      }
      const isActiveTab = tab.id === groups.activeTabId;
      return (
        <InspectorDetailContent
          request={request}
          activeSection={tab.activeSection}
          onSectionChange={(s) => groups.updateTab(tab.id, { activeSection: s })}
          searchHighlight={isActiveTab ? searchHighlight : undefined}
          searchSection={isActiveTab ? searchSection : undefined}
          searchLineNumber={isActiveTab ? searchLineNumber : undefined}
        />
      );
    },
    [entries, groups, searchHighlight, searchSection, searchLineNumber],
  );

  const renderEmpty = useCallback(
    () => <div className="dt-editor-empty">Select a request from the sidebar to inspect</div>,
    [],
  );

  const activeTab = groups.focusedLeaf.tabs.find((t) => t.id === groups.activeTabId);
  const selectedId = activeTab?.requestId ?? null;
  const totalSize = useMemo(() => formatTotalSize(entries), [entries]);
  const finishTime = useMemo(() => formatFinishTime(entries), [entries]);

  // ── DnD state ──────────────────────────────────────────────
  type DockWindowsMap = Record<PanelDockSlot, PanelToolWindowId[]>;
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const dragTab = dragTabId ? (groups.allTabs.find((t) => t.id === dragTabId) ?? null) : null;
  const [dragDockWindowId, setDragDockWindowId] = useState<PanelToolWindowId | null>(null);
  const [preview, setPreview] = useState<DockWindowsMap | null>(null);

  const getWindows = useCallback(
    (slot: PanelDockSlot): PanelToolWindowId[] => preview?.[slot] ?? tl.state.docks[slot].windows,
    [preview, tl.state.docks],
  );

  const resolveTarget = useCallback(
    (nodeId: string, source: DockWindowsMap): { slot: PanelDockSlot; index: number } | null => {
      if (nodeId.startsWith('dock:'))
        return { slot: nodeId.slice(5) as PanelDockSlot, index: source[nodeId.slice(5) as PanelDockSlot].length };
      if (nodeId.startsWith('drop:'))
        return { slot: nodeId.slice(5) as PanelDockSlot, index: source[nodeId.slice(5) as PanelDockSlot].length };
      if (nodeId.startsWith('tw:')) {
        const twId = nodeId.slice(3) as PanelToolWindowId;
        for (const slot of ALL_PANEL_DOCK_SLOTS) {
          const idx = source[slot].indexOf(twId);
          if (idx >= 0) return { slot, index: idx };
        }
      }
      return null;
    },
    [],
  );

  const handleDndStart = useCallback(
    (event: { active: { id: string | number; data: { current?: Record<string, unknown> } } }) => {
      const data = event.active.data.current;
      if (!data) return;
      if (data.kind === 'editor-tab' && typeof data.tabId === 'string') {
        setDragTabId(data.tabId);
        return;
      }
      if (data.kind === 'tool-window' && typeof data.toolWindowId === 'string') {
        setDragDockWindowId(data.toolWindowId as PanelToolWindowId);
        setDockDragging(true);
        const snapshot = {} as DockWindowsMap;
        for (const slot of ALL_PANEL_DOCK_SLOTS) snapshot[slot] = [...tl.state.docks[slot].windows];
        setPreview(snapshot);
      }
    },
    [tl.state.docks],
  );

  const handleDragOver = useCallback(
    (event: {
      active: { id: string | number; data: { current?: Record<string, unknown> } };
      over: { id: string | number } | null;
    }) => {
      const data = event.active.data.current;
      if (!data || data.kind === 'editor-tab') return;
      if (!event.over) return;
      setPreview((prev) => {
        if (!prev) return prev;
        const activeLoc = resolveTarget(String(event.active.id), prev);
        const overLoc = resolveTarget(String(event.over!.id), prev);
        if (!activeLoc || !overLoc) return prev;
        const activeTw = String(event.active.id).slice(3) as PanelToolWindowId;

        if (activeLoc.slot === overLoc.slot) {
          if (activeLoc.index === overLoc.index) return prev;
          const next = { ...prev };
          const list = [...prev[activeLoc.slot]];
          list.splice(activeLoc.index, 1);
          list.splice(overLoc.index, 0, activeTw);
          next[activeLoc.slot] = list;
          return next;
        }

        const next = { ...prev };
        next[activeLoc.slot] = prev[activeLoc.slot].filter((id) => id !== activeTw);
        const destList = [...prev[overLoc.slot]];
        const insertIndex =
          String(event.over!.id).startsWith('dock:') || String(event.over!.id).startsWith('drop:')
            ? destList.length
            : overLoc.index;
        destList.splice(Math.max(0, Math.min(insertIndex, destList.length)), 0, activeTw);
        next[overLoc.slot] = destList;
        return next;
      });
    },
    [resolveTarget],
  );

  const handleDndEnd = useCallback(
    (event: {
      active: { data: { current?: Record<string, unknown> } };
      over: { data: { current?: Record<string, unknown> } } | null;
    }) => {
      const data = event.active.data.current;
      if (data?.kind === 'editor-tab') {
        setDragTabId(null);
        return;
      }
      const activeTw = data?.kind === 'tool-window' ? (data.toolWindowId as PanelToolWindowId) : null;
      const finalPreview = preview;
      setDragDockWindowId(null);
      setDockDragging(false);
      setPreview(null);
      if (!activeTw || !finalPreview) return;

      for (const slot of ALL_PANEL_DOCK_SLOTS) {
        const idx = finalPreview[slot].indexOf(activeTw);
        if (idx < 0) continue;
        tl.moveWindow(activeTw, slot, idx);
        return;
      }
    },
    [preview, tl],
  );

  const handleDndCancel = useCallback(() => {
    setDragTabId(null);
    setDragDockWindowId(null);
    setDockDragging(false);
    setPreview(null);
  }, []);

  // ── Drop zone rects ────────────────────────────────────────
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => {
      const r = es[0]?.contentRect;
      if (r) setPanelSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const highlightedSlot = useMemo<PanelDockSlot | null>(() => {
    if (!dragDockWindowId) return null;
    return tl.dockOf(dragDockWindowId);
  }, [dragDockWindowId, tl]);

  const PREFERRED_SIDEBAR = 320;
  const PREFERRED_INSPECTOR = 400;
  const PREFERRED_BOTTOM = 160;

  const dropZoneRects = useMemo<Record<PanelDockSlot, DropZoneRect> | null>(() => {
    if (!dockDragging) return null;
    const fullW = panelSize.width;
    const fullH = panelSize.height;
    if (fullW === 0 || fullH === 0) return null;

    const barW = activityLabels ? 56 : 32;
    const displaySidebarW = leftOpen ? (horizontalSizes?.[0] ?? PREFERRED_SIDEBAR) : PREFERRED_SIDEBAR;
    const hLen = horizontalSizes?.length ?? 0;
    const displayInspectorW = rightOpen ? (horizontalSizes?.[hLen - 1] ?? PREFERRED_INSPECTOR) : PREFERRED_INSPECTOR;
    const vLen = verticalSizes?.length ?? 0;
    const displayBottomH = bottomOpen ? (verticalSizes?.[vLen - 1] ?? PREFERRED_BOTTOM) : PREFERRED_BOTTOM;

    const leftRectX = barW;
    const leftRectEnd = leftRectX + displaySidebarW;
    const rightRectX = fullW - barW - displayInspectorW;
    const bottomLeftX = leftRectEnd;
    const bottomWidth = Math.max(0, rightRectX - leftRectEnd);

    let leftRect: DropZoneRect;
    let rightRect: DropZoneRect;
    let bottomRect: DropZoneRect;

    if (bottomFullWidth) {
      const topH = Math.max(0, fullH - displayBottomH);
      leftRect = { left: leftRectX, top: 0, width: displaySidebarW, height: topH };
      rightRect = { left: rightRectX, top: 0, width: displayInspectorW, height: topH };
      bottomRect = { left: barW, top: topH, width: Math.max(0, fullW - barW * 2), height: displayBottomH };
    } else {
      leftRect = { left: leftRectX, top: 0, width: displaySidebarW, height: fullH };
      rightRect = { left: rightRectX, top: 0, width: displayInspectorW, height: fullH };
      bottomRect = {
        left: bottomLeftX,
        top: Math.max(0, fullH - displayBottomH),
        width: bottomWidth,
        height: displayBottomH,
      };
    }

    const halfV = (r: DropZoneRect): [DropZoneRect, DropZoneRect] => [
      { left: r.left, top: r.top, width: r.width, height: r.height / 2 },
      { left: r.left, top: r.top + r.height / 2, width: r.width, height: r.height / 2 },
    ];
    const halfH = (r: DropZoneRect): [DropZoneRect, DropZoneRect] => [
      { left: r.left, top: r.top, width: r.width / 2, height: r.height },
      { left: r.left + r.width / 2, top: r.top, width: r.width / 2, height: r.height },
    ];

    const [lt, lb] = halfV(leftRect);
    const [rt, rb] = halfV(rightRect);
    const [bl, br] = halfH(bottomRect);
    return {
      'left-top': lt,
      'left-bottom': lb,
      'right-top': rt,
      'right-bottom': rb,
      'bottom-left': bl,
      'bottom-right': br,
    };
  }, [
    dockDragging,
    panelSize,
    horizontalSizes,
    verticalSizes,
    activityLabels,
    bottomFullWidth,
    leftOpen,
    rightOpen,
    bottomOpen,
  ]);

  // ── Tool window content ────────────────────────────────────
  const renderToolWindow = useCallback(
    (windowId: PanelToolWindowId): React.ReactNode => {
      switch (windowId) {
        case 'network':
          return (
            <TrafficList
              entries={entries}
              selectedId={selectedId}
              onSelect={handleSelect}
              filter={filter}
              filterTokens={filterTokens}
              filterConfig={filterConfig}
              recording={recording}
              onStartRecording={() => setRecording(true)}
              onReloadPage={() => {
                (
                  chrome as unknown as { devtools?: { inspectedWindow?: { reload: () => void } } }
                ).devtools?.inspectedWindow?.reload();
              }}
            />
          );
        case 'rules':
          return <RuleExecutions entries={entries} danglingFires={danglingFires} onRequestClick={handleCrossNav} />;
        case 'search':
          return (
            <SearchPanel
              entries={entries}
              onClose={() => tl.toggleWindow('search')}
              onResultClick={handleSearchResult}
              docsActive={iconState('docs') !== undefined}
              onToggleDocs={() => tl.toggleWindow('docs')}
            />
          );
        case 'docs':
          return <FilterDocs onClose={() => tl.toggleWindow('docs')} />;
        case 'console':
          return <div className="dt-editor-empty">Console — content coming soon</div>;
      }
    },
    [
      entries,
      selectedId,
      handleSelect,
      filter,
      filterTokens,
      filterConfig,
      recording,
      setRecording,
      danglingFires,
      handleCrossNav,
      handleSearchResult,
      tl,
      iconState,
    ],
  );

  // ── Render a dock's content ────────────────────────────────
  const renderDockContent = useCallback(
    (slot: PanelDockSlot): React.ReactNode => {
      const dock = tl.state.docks[slot];
      if (!dock.active) return null;
      const region = panelDockRegion(slot);
      return (
        <div className="rules-dock-body" data-region={region} data-dock-slot={slot} tabIndex={-1}>
          <div className="rules-dock-content">{renderToolWindow(dock.active)}</div>
        </div>
      );
    },
    [tl, renderToolWindow],
  );

  // ── Render a region ────────────────────────────────────────
  const renderRegion = useCallback(
    (region: PanelToolRegion): React.ReactNode => {
      const slots = ALL_PANEL_DOCK_SLOTS.filter((s) => panelDockRegion(s) === region);
      const [slotA, slotB] = slots;
      const activeA = tl.state.docks[slotA].active !== null;
      const activeB = tl.state.docks[slotB].active !== null;
      if (!activeA && !activeB) return null;

      return (
        <Allotment vertical={region !== 'bottom'} proportionalLayout={false}>
          <Allotment.Pane minSize={50} visible={activeA} snap>
            {activeA && renderDockContent(slotA)}
          </Allotment.Pane>
          <Allotment.Pane minSize={50} visible={activeB} snap>
            {activeB && renderDockContent(slotB)}
          </Allotment.Pane>
        </Allotment>
      );
    },
    [tl.state.docks, renderDockContent],
  );

  // ── Activity bar strip helper ──────────────────────────────
  const renderStrip = useCallback(
    (slot: DockSlot) => (
      <DockTabStrip<PanelToolWindowId>
        slot={slot}
        windows={getWindows(slot)}
        activeId={tl.state.docks[slot].active}
        orientation="vertical"
        showLabels={activityLabels}
        dragging={dockDragging}
        windowMap={PANEL_TOOL_WINDOW_MAP}
        isFocused={focusedDock === slot}
        onActivate={tl.toggleWindow}
        onHide={tl.hideWindow}
        onMove={tl.moveWindow}
        onCloseDock={() => tl.closeDock(slot)}
        onToggleLabels={toggleLabels}
      />
    ),
    [getWindows, tl, activityLabels, dockDragging, focusedDock, toggleLabels],
  );

  // ── Editor content ─────────────────────────────────────────
  const editorContent = (
    <InspectorEditorGroupRenderer
      groups={groups}
      renderTabBody={renderTabBody}
      renderEmpty={renderEmpty}
      onCloseTab={groups.closeTab}
      onCloseOther={groups.closeOtherTabs}
      onCloseAll={groups.closeAllTabs}
      onCloseToLeft={groups.closeTabsToLeft}
      onCloseToRight={groups.closeTabsToRight}
      recentlyClosed={groups.recentlyClosed}
    />
  );

  const rulesVisible = iconState('rules') !== undefined;

  // ── Layout ─────────────────────────────────────────────────

  const activityBar = (side: 'left' | 'right') => {
    const [upperFirst, upperSecond] =
      side === 'left' ? (['left-top', 'left-bottom'] as const) : (['right-top', 'right-bottom'] as const);
    const lower: DockSlot = side === 'left' ? 'bottom-left' : 'bottom-right';

    return (
      <nav
        className={`rules-activity-bar rules-activity-bar--${side} ${activityLabels ? '' : 'rules-activity-bar--compact'} rules-activity-bar--layout-${sidebarLayout}`}
        style={{
          background: token.colorBgLayout,
          [side === 'left' ? 'borderRight' : 'borderLeft']: `1px solid ${token.colorBorderSecondary}`,
        }}
        data-side={side}
      >
        <div className="rules-activity-group rules-activity-group--top">
          <div className="rules-activity-subslot rules-activity-subslot--first">{renderStrip(upperFirst)}</div>
          <div className="rules-activity-subslot rules-activity-subslot--second">{renderStrip(upperSecond)}</div>
        </div>
        <div className="rules-activity-group rules-activity-group--bottom">{renderStrip(lower)}</div>
      </nav>
    );
  };

  const classicLayout = (
    <div key="classic" style={{ height: '100%', width: '100%' }}>
      <Allotment proportionalLayout defaultSizes={[50, 50]} onChange={setHorizontalSizes}>
        <Allotment.Pane minSize={180} visible={leftOpen} snap>
          {renderRegion('left')}
        </Allotment.Pane>
        <Allotment.Pane priority={LayoutPriority.High}>
          <div className="dt-main" data-region="editor" tabIndex={-1}>
            <div className="dt-content">
              <Allotment vertical proportionalLayout={false} onChange={setVerticalSizes}>
                <Allotment.Pane priority={LayoutPriority.High} minSize={120}>
                  {editorContent}
                </Allotment.Pane>
                <Allotment.Pane preferredSize={160} minSize={80} visible={bottomOpen} snap>
                  <div data-region="bottom" tabIndex={-1} style={{ height: '100%' }}>
                    {renderRegion('bottom')}
                  </div>
                </Allotment.Pane>
              </Allotment>
            </div>
          </div>
        </Allotment.Pane>
        <Allotment.Pane minSize={180} maxSize={500} visible={rightOpen} snap>
          {renderRegion('right')}
        </Allotment.Pane>
      </Allotment>
    </div>
  );

  const wideBottomLayout = (
    <Allotment key="full" vertical proportionalLayout={false} onChange={setVerticalSizes}>
      <Allotment.Pane priority={LayoutPriority.High}>
        <Allotment proportionalLayout defaultSizes={[50, 50]} onChange={setHorizontalSizes}>
          <Allotment.Pane minSize={180} visible={leftOpen} snap>
            {renderRegion('left')}
          </Allotment.Pane>
          <Allotment.Pane priority={LayoutPriority.High}>
            <div className="dt-main" data-region="editor" tabIndex={-1}>
              <div className="dt-content">{editorContent}</div>
            </div>
          </Allotment.Pane>
          <Allotment.Pane minSize={180} maxSize={500} visible={rightOpen} snap>
            {renderRegion('right')}
          </Allotment.Pane>
        </Allotment>
      </Allotment.Pane>
      <Allotment.Pane preferredSize={160} minSize={80} visible={bottomOpen} snap>
        <div data-region="bottom" tabIndex={-1} style={{ height: '100%' }}>
          {renderRegion('bottom')}
        </div>
      </Allotment.Pane>
    </Allotment>
  );

  return (
    <div
      className="dt-panel-root"
      ref={shellRef}
      onClickCapture={handleFocusCapture}
      onFocusCapture={handleFocusCapture}
    >
      <PanelToolbar
        recording={recording}
        onToggleRecording={() => setRecording(!recording)}
        onClear={clear}
        showFilter={showFilter}
        onToggleFilter={() => setShowFilter(!showFilter)}
        searchActive={iconState('search') !== undefined}
        onToggleSearch={() => tl.toggleWindow('search')}
        preserveLog={preserveLog}
        onPreserveLogChange={setPreserveLog}
        rulesVisible={rulesVisible}
        urlFilter={urlFilter}
        onUrlFilterChange={setUrlFilter}
        filterConfig={filterConfig}
        onFilterConfigChange={setFilterConfig}
        filterError={filterError}
        docsState={iconState('docs')}
        onToggleDocs={() => tl.toggleWindow('docs')}
        filter={filter}
        onFilterChange={setFilter}
      />

      <div className="dt-panel" ref={panelRef}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDndStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDndEnd}
          onDragCancel={handleDndCancel}
        >
          {activityBar('left')}
          {bottomFullWidth ? wideBottomLayout : classicLayout}
          {activityBar('right')}

          <DropZoneOverlay visible={dockDragging} rects={dropZoneRects} highlightedSlot={highlightedSlot} />

          <DragOverlay dropAnimation={null}>
            {dragTab && (
              <div className="dt-editor-tab active" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)', opacity: 0.9 }}>
                <span
                  className="dt-method-badge"
                  style={{
                    color: dragTab.method === 'GET' ? '#61affe' : dragTab.method === 'POST' ? '#49cc90' : '#fca130',
                  }}
                >
                  {dragTab.method}
                </span>
                <span className="dt-editor-tab-label">{dragTab.label.replace(/^[A-Z]+ /, '')}</span>
              </div>
            )}
            {dragDockWindowId && (
              <div className="rules-drag-preview">
                <span className="rules-drag-preview-icon">{PANEL_TOOL_WINDOW_MAP[dragDockWindowId].icon}</span>
                <span className="rules-drag-preview-label">{PANEL_TOOL_WINDOW_MAP[dragDockWindowId].label}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      <PanelStatusBar
        tl={tl}
        requestCount={entries.length}
        totalSize={totalSize}
        finishTime={finishTime}
        tabCount={groups.allTabs.length}
      />
    </div>
  );
}
