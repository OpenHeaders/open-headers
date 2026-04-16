import { useTheme } from '@context/ThemeContext';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Allotment, LayoutPriority } from 'allotment';
import 'allotment/dist/style.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DockTabStrip } from './components/DockTabStrip';
import { DropZoneOverlay, type DropZoneRect } from './components/DropZoneOverlay';
import { FilterDocs } from './components/FilterDocs';
import { FilterInput } from './components/FilterInput';
import { InspectorDetailContent } from './components/InspectorDetailContent';
import { InspectorEditorGroupRenderer } from './components/InspectorEditorGroupRenderer';
import { ResourceFilter } from './components/ResourceFilter';
import { RuleExecutions, RuleExecutionsHint } from './components/RuleExecutions';
import { SearchPanel } from './components/SearchPanel';
import { TrafficList } from './components/TrafficList';
import type { FilterConfig } from './data/filter-engine';
import { DEFAULT_FILTER_CONFIG, hasFilterError, parseFilter } from './data/filter-engine';
import type { PanelRegion } from './data/focus-store';
import { setFocusedRegion, useFocusedRegion } from './data/focus-store';
import type { DetailSection } from './data/inspector-tab';
import { buildInspectorTab } from './data/inspector-tab';
import {
  ALL_PANEL_DOCK_SLOTS,
  PANEL_DOCK_LABELS,
  PANEL_TOOL_WINDOW_MAP,
  type PanelDockSlot,
  type PanelToolRegion,
  type PanelToolWindowId,
  panelDockRegion,
} from './data/tool-windows';
import { useInspector } from './data/use-inspector';
import { useInspectorEditorGroups } from './data/use-inspector-editor-groups';
import { usePanelToolLayout } from './data/use-panel-tool-layout';

type ThemeMode = 'light' | 'dark' | 'auto';
type SidebarLayout = 'proportional' | 'compact' | 'stacked';

const SIDEBAR_LAYOUT_OPTIONS: { key: SidebarLayout; label: string }[] = [
  { key: 'proportional', label: 'Proportional (even halves)' },
  { key: 'compact', label: 'Compact (bottom pinned)' },
  { key: 'stacked', label: 'Stacked (all at top)' },
];

function SidebarLayoutIcon({ variant }: { variant: SidebarLayout }) {
  const stroke = 'var(--dt-text-muted)';
  const fill = 'var(--dt-text)';
  const CELL_H = 2.4;
  const LEFT = 0.5;
  const RIGHT = 5.5;
  const TOP = 0.5;
  const occupied: Record<SidebarLayout, number[]> = {
    proportional: [1, 3, 5],
    compact: [1, 2, 5],
    stacked: [1, 2, 3],
  };
  const cells = occupied[variant];
  const sorted = [...cells].sort((a, b) => a - b);
  const blocks: { start: number; end: number }[] = [];
  for (const row of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && row === last.end + 1) last.end = row;
    else blocks.push({ start: row, end: row });
  }
  return (
    <svg viewBox="0 0 16 13" width={16} height={13} role="img" aria-hidden="true" style={{ display: 'block' }}>
      <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />
      <line x1={RIGHT} y1={TOP} x2={RIGHT} y2={12.5} stroke={stroke} strokeWidth={1} />
      {blocks.map((b) => (
        <rect
          key={`${b.start}-${b.end}`}
          x={LEFT}
          y={TOP + (b.start - 1) * CELL_H}
          width={RIGHT - LEFT}
          height={(b.end - b.start + 1) * CELL_H}
          fill={fill}
          fillOpacity={0.15}
        />
      ))}
      {blocks.map((b) => {
        const dividers: React.ReactNode[] = [];
        const top = TOP + (b.start - 1) * CELL_H;
        const bottom = TOP + b.end * CELL_H;
        if (top > TOP + 0.01)
          dividers.push(
            <line key={`t${b.start}`} x1={LEFT} y1={top} x2={RIGHT} y2={top} stroke={stroke} strokeWidth={0.75} />,
          );
        if (bottom < 12.5 - 0.01)
          dividers.push(
            <line key={`b${b.end}`} x1={LEFT} y1={bottom} x2={RIGHT} y2={bottom} stroke={stroke} strokeWidth={0.75} />,
          );
        return dividers;
      })}
    </svg>
  );
}

// ── Region toggle SVG (same as workspace StatusBar) ──────────────

function RegionToggle({
  title,
  active,
  position,
  onClick,
}: {
  title: string;
  active: boolean;
  position: 'left' | 'bottom' | 'right';
  onClick: () => void;
}) {
  const strokeColor = 'var(--dt-text-muted)';
  const fillColor = active ? 'var(--dt-text-muted)' : 'none';

  return (
    <button type="button" className="dt-region-toggle" onClick={onClick} title={title} aria-label={title}>
      <svg viewBox="0 0 16 13" width={16} height={13} role="img" aria-hidden="true">
        <rect x="0.5" y="0.5" width="15" height="12" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={1} />
        {position === 'left' && (
          <>
            <rect
              x="0.5"
              y="0.5"
              width="4.5"
              height="12"
              rx="1.5"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1}
              opacity={active ? 0.35 : 0.15}
            />
            <line x1="5" y1="0.5" x2="5" y2="12.5" stroke={strokeColor} strokeWidth={1} />
          </>
        )}
        {position === 'bottom' && (
          <>
            <rect
              x="0.5"
              y="8.5"
              width="15"
              height="4"
              rx="1.5"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1}
              opacity={active ? 0.35 : 0.15}
            />
            <line x1="0.5" y1="8.5" x2="15.5" y2="8.5" stroke={strokeColor} strokeWidth={1} />
          </>
        )}
        {position === 'right' && (
          <>
            <rect
              x="11"
              y="0.5"
              width="4.5"
              height="12"
              rx="1.5"
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={1}
              opacity={active ? 0.35 : 0.15}
            />
            <line x1="11" y1="0.5" x2="11" y2="12.5" stroke={strokeColor} strokeWidth={1} />
          </>
        )}
      </svg>
    </button>
  );
}

// ── Layout menu icon SVGs ────────────────────────────────────────

type LayoutIconKind = 'bottom-full' | 'bottom-nested' | 'show-labels' | 'hide-labels';

function LayoutIcon({ kind }: { kind: LayoutIconKind }) {
  const stroke = 'var(--dt-text-muted)';
  const fill = 'var(--dt-text)';
  const frame = <rect x={0.5} y={0.5} width={15} height={12} rx={1.5} fill="none" stroke={stroke} strokeWidth={1} />;

  let content: React.ReactNode;
  if (kind === 'bottom-full') {
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={8.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
        <rect
          x={0.5}
          y={8.5}
          width={15}
          height={4}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={0.5} y1={8.5} x2={15.5} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'bottom-nested') {
    content = (
      <>
        <line x1={5} y1={0.5} x2={5} y2={12.5} stroke={stroke} strokeWidth={1} />
        <line x1={11} y1={0.5} x2={11} y2={12.5} stroke={stroke} strokeWidth={1} />
        <rect x={5} y={8.5} width={6} height={4} fill={fill} stroke={stroke} strokeWidth={1} fillOpacity={0.15} />
        <line x1={5} y1={8.5} x2={11} y2={8.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else if (kind === 'show-labels') {
    content = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={5.5}
          height={12}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={6} y1={0.5} x2={6} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  } else {
    content = (
      <>
        <rect
          x={0.5}
          y={0.5}
          width={3}
          height={12}
          rx={1.5}
          fill={fill}
          stroke={stroke}
          strokeWidth={1}
          fillOpacity={0.15}
        />
        <line x1={3.5} y1={0.5} x2={3.5} y2={12.5} stroke={stroke} strokeWidth={1} />
      </>
    );
  }

  return (
    <svg viewBox="0 0 16 13" width={16} height={13} role="img" aria-hidden="true" style={{ display: 'block' }}>
      {frame}
      {content}
    </svg>
  );
}

const THEME_DISPLAY: Record<ThemeMode, { symbol: string; text: string; color: string }> = {
  light: { symbol: '\u2600', text: 'Light', color: '#faad14' },
  dark: { symbol: '\u263E', text: 'Dark', color: '#722ed1' },
  auto: { symbol: '\u25D0', text: 'Auto', color: '#1890ff' },
};

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

function IconRecord({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="5" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconClear() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="4.5" y1="11.5" x2="11.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path d="M1 3h14M4 8h8M6 13h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function sectionToTab(section: string): DetailSection {
  if (section === 'Request Headers' || section === 'Response Headers' || section === 'General') return 'headers';
  if (section === 'Query Params' || section === 'Request Body') return 'payload';
  if (section === 'Response') return 'response';
  return 'headers';
}

const TOOL_WINDOW_ICONS: Record<PanelToolWindowId, React.ReactNode> = {
  network: (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path d="M1 4h14M1 8h10M1 12h6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  rules: (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path
        d="M3 2v12M7 4l5 4-5 4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="7" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="10" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  docs: (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="10" fontFamily="serif" fontStyle="italic">
        i
      </text>
    </svg>
  ),
  console: (
    <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
      <path
        d="M2 4l4 4-4 4M8 12h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function menuPositionAbove(ref: React.RefObject<HTMLElement | null>): React.CSSProperties {
  if (!ref.current) return { position: 'fixed', bottom: 24, right: 8 };
  const rect = ref.current.getBoundingClientRect();
  return {
    position: 'fixed',
    bottom: window.innerHeight - rect.top + 4,
    right: window.innerWidth - rect.right,
    zIndex: 100,
  };
}

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

  const clear = useCallback(() => {
    clearStore();
    groups.closeAllTabs();
  }, [clearStore, groups]);
  const { themeMode, setThemeMode } = useTheme();

  // ── Panel-level state ──────────────────────────────────────
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [urlFilter, setUrlFilter] = useState<string>('');
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  const [showFilter, setShowFilter] = useState(true);
  const [activityLabels, setActivityLabels] = useState(true);
  const [barCtxMenu, setBarCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [bottomFullWidth, setBottomFullWidth] = useState(false);
  const [sidebarLayout, setSidebarLayout] = useState<SidebarLayout>('proportional');
  const [sidebarLayoutOpen, setSidebarLayoutOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [dockDragging, setDockDragging] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState<string | undefined>(undefined);
  const [searchSection, setSearchSection] = useState<string | undefined>(undefined);
  const [searchLineNumber, setSearchLineNumber] = useState<number | undefined>(undefined);
  const [, setSearchNonce] = useState(0);

  const shellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  const focusedRegion = useFocusedRegion();
  const [horizontalSizes, setHorizontalSizes] = useState<number[] | null>(null);
  const [verticalSizes, setVerticalSizes] = useState<number[] | null>(null);

  // DnD sensors for editor tab drag
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Derived from tool layout ───────────────────────────────
  const leftOpen = tl.isRegionOpen('left');
  const rightOpen = tl.isRegionOpen('right');
  const bottomOpen = tl.isRegionOpen('bottom');

  // ── Focus tracking ─────────────────────────────────────────
  const handleFocusCapture = useCallback((e: React.MouseEvent | React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const regionEl = target.closest<HTMLElement>('[data-region]');
    if (!regionEl) return;
    const key = regionEl.getAttribute('data-region') as PanelRegion;
    if (key === 'left' || key === 'main' || key === 'right' || key === 'bottom') {
      setFocusedRegion(key);
    }
  }, []);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;
    const handler = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      if (!next || (root && !root.contains(next))) {
        setFocusedRegion(null);
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
      const region = panelDockRegion(slot);
      if (focusedRegion === region) return 'focused';
      return 'active';
    },
    [tl, focusedRegion],
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

  // ── Editor group tab body renderer ─────────────────────────
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

  // ── DnD (both editor tabs and dock tabs) ────────────────────
  const [dragTabId, setDragTabId] = useState<string | null>(null);
  const dragTab = dragTabId ? (groups.allTabs.find((t) => t.id === dragTabId) ?? null) : null;
  const [dragDockWindowId, setDragDockWindowId] = useState<PanelToolWindowId | null>(null);

  const handleDndStart = useCallback((event: { active: { data: { current?: Record<string, unknown> } } }) => {
    const data = event.active.data.current;
    if (!data) return;
    if (data.kind === 'editor-tab' && typeof data.tabId === 'string') {
      setDragTabId(data.tabId);
    } else if (data.kind === 'tool-window' && typeof data.toolWindowId === 'string') {
      setDragDockWindowId(data.toolWindowId as PanelToolWindowId);
      setDockDragging(true);
    }
  }, []);

  const handleDndEnd = useCallback(
    (event: {
      active: { data: { current?: Record<string, unknown> } };
      over: { data: { current?: Record<string, unknown> } } | null;
    }) => {
      const data = event.active.data.current;
      if (data?.kind === 'tool-window' && typeof data.toolWindowId === 'string') {
        const overData = event.over?.data.current;
        let targetSlot: PanelDockSlot | null = null;
        if (overData?.slot && typeof overData.slot === 'string') {
          // Dropped on a dock strip (useDroppable)
          targetSlot = overData.slot as PanelDockSlot;
        } else if (overData?.fromSlot && typeof overData.fromSlot === 'string') {
          // Dropped on another dock tab (useSortable)
          targetSlot = overData.fromSlot as PanelDockSlot;
        }
        if (targetSlot) {
          tl.moveWindow(data.toolWindowId as PanelToolWindowId, targetSlot);
        }
      }
      setDragTabId(null);
      setDragDockWindowId(null);
      setDockDragging(false);
    },
    [tl],
  );

  const handleDndCancel = useCallback(() => {
    setDragTabId(null);
    setDragDockWindowId(null);
    setDockDragging(false);
  }, []);

  // ── Drop zone overlay rects (same algorithm as workspace) ───
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
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

  // ── Tool window content renderer ───────────────────────────
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

  // ── Render a dock's content (no strip — strip lives in activity bar) ──
  const renderDockContent = useCallback(
    (slot: PanelDockSlot): React.ReactNode => {
      const dock = tl.state.docks[slot];
      if (!dock.active) return null;
      const region = panelDockRegion(slot);
      return (
        <div className="dt-dock-slot" data-region={region} data-dock-slot={slot} tabIndex={-1}>
          <div className="dt-dock-content">{renderToolWindow(dock.active)}</div>
        </div>
      );
    },
    [tl, renderToolWindow],
  );

  // ── Render a region (left / right / bottom) ────────────────
  const renderRegion = useCallback(
    (region: PanelToolRegion): React.ReactNode => {
      const slots = ALL_PANEL_DOCK_SLOTS.filter((s) => panelDockRegion(s) === region);
      const [slotA, slotB] = slots;
      const activeA = tl.state.docks[slotA].active !== null;
      const activeB = tl.state.docks[slotB].active !== null;

      if (!activeA && !activeB) return null;

      const vertical = region !== 'bottom';
      return (
        <Allotment vertical={vertical} proportionalLayout={false}>
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

  // ── Rules hint visible? ────────────────────────────────────
  const rulesVisible = iconState('rules') !== undefined;

  return (
    <div
      className="dt-panel-root"
      ref={shellRef}
      onClickCapture={handleFocusCapture}
      onFocusCapture={handleFocusCapture}
    >
      {/* App header — toolbar + filter, spans full width */}
      <div className="dt-header">
        <div className="dt-toolbar">
          <button
            type="button"
            className="dt-toolbar-icon dt-toolbar-icon--record"
            data-active={recording}
            onClick={() => setRecording(!recording)}
            title={recording ? 'Stop recording' : 'Record network log'}
          >
            <IconRecord active={recording} />
          </button>
          <button type="button" className="dt-toolbar-icon" onClick={clear} title="Clear network log">
            <IconClear />
          </button>
          <div className="dt-toolbar-separator" />
          <button
            type="button"
            className="dt-toolbar-icon"
            data-active={showFilter}
            onClick={() => setShowFilter(!showFilter)}
            title="Filter"
          >
            <IconFilter />
          </button>
          <button
            type="button"
            className="dt-toolbar-icon"
            data-active={iconState('search') !== undefined}
            onClick={() => tl.toggleWindow('search')}
            title="Search"
          >
            <IconSearch />
          </button>
          <div className="dt-toolbar-separator" />
          <label className="dt-checkbox">
            <input type="checkbox" checked={preserveLog} onChange={(e) => setPreserveLog(e.target.checked)} />
            Preserve log
          </label>
          {rulesVisible && (
            <>
              <div className="dt-toolbar-separator" />
              <RuleExecutionsHint />
            </>
          )}
        </div>
        {showFilter && (
          <div className="dt-filter-bar">
            <FilterInput
              value={urlFilter}
              onChange={setUrlFilter}
              config={filterConfig}
              onConfigChange={setFilterConfig}
              hasError={filterError}
              placeholder="Filter"
            />
            <button
              type="button"
              className="dt-toolbar-icon"
              data-state={iconState('docs')}
              onClick={() => tl.toggleWindow('docs')}
              title="Filter syntax help"
            >
              <svg viewBox="0 0 16 16" role="img" aria-hidden="true">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <text
                  x="8"
                  y="12"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="10"
                  fontFamily="serif"
                  fontStyle="italic"
                >
                  i
                </text>
              </svg>
            </button>
            <div className="dt-filter-separator" />
            <ResourceFilter value={filter} onChange={setFilter} />
          </div>
        )}
      </div>

      <div className="dt-panel" ref={panelRef}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDndStart}
          onDragEnd={handleDndEnd}
          onDragCancel={handleDndCancel}
        >
          {/* Left activity bar — vertical dock tab strips, same pattern as workspace */}
          <nav
            className={`dt-activity-bar ${activityLabels ? '' : 'dt-activity-bar--compact'} dt-activity-bar--layout-${sidebarLayout}`}
            onContextMenu={(e) => {
              e.preventDefault();
              setBarCtxMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <div className="dt-activity-group dt-activity-group--top">
              <div className="dt-activity-subslot dt-activity-subslot--first">
                <DockTabStrip
                  slot="left-top"
                  dock={tl.state.docks['left-top']}
                  tl={tl}
                  dragging={dockDragging}
                  focused={focusedRegion === 'left'}
                  showLabels={activityLabels}
                  icons={TOOL_WINDOW_ICONS}
                />
              </div>
              <div className="dt-activity-subslot dt-activity-subslot--second">
                <DockTabStrip
                  slot="left-bottom"
                  dock={tl.state.docks['left-bottom']}
                  tl={tl}
                  dragging={dockDragging}
                  focused={focusedRegion === 'left'}
                  showLabels={activityLabels}
                  icons={TOOL_WINDOW_ICONS}
                />
              </div>
            </div>
            <div className="dt-activity-group dt-activity-group--bottom">
              <DockTabStrip
                slot="bottom-left"
                dock={tl.state.docks['bottom-left']}
                tl={tl}
                dragging={dockDragging}
                focused={focusedRegion === 'bottom'}
                showLabels={activityLabels}
                icons={TOOL_WINDOW_ICONS}
              />
            </div>
          </nav>

          {/* Main layout — outer split controls full-width bottom */}
          <Allotment
            vertical={bottomFullWidth && bottomOpen}
            proportionalLayout={false}
            key={bottomFullWidth ? 'full' : 'nested'}
          >
            <Allotment.Pane priority={LayoutPriority.High} minSize={120}>
              <Allotment proportionalLayout={false} onChange={setHorizontalSizes}>
                {/* Left region */}
                <Allotment.Pane preferredSize={320} minSize={180} visible={leftOpen} snap>
                  {renderRegion('left')}
                </Allotment.Pane>

                {/* Center — toolbar + filter + editor groups */}
                <Allotment.Pane priority={LayoutPriority.High}>
                  <div className="dt-main" data-region="main" tabIndex={-1}>
                    {/* Editor groups + optional nested bottom */}
                    <div className="dt-content">
                      {bottomFullWidth ? (
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
                      ) : (
                        <Allotment vertical proportionalLayout={false} onChange={setVerticalSizes}>
                          <Allotment.Pane priority={LayoutPriority.High} minSize={120}>
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
                          </Allotment.Pane>
                          <Allotment.Pane preferredSize={160} minSize={80} visible={bottomOpen} snap>
                            <div data-region="bottom" tabIndex={-1} style={{ height: '100%' }}>
                              {renderRegion('bottom')}
                            </div>
                          </Allotment.Pane>
                        </Allotment>
                      )}
                    </div>
                  </div>
                </Allotment.Pane>

                {/* Right region */}
                <Allotment.Pane preferredSize={400} minSize={180} maxSize={500} visible={rightOpen} snap>
                  {renderRegion('right')}
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>

            {/* Full-width bottom region (only in full-width mode) */}
            {bottomFullWidth && (
              <Allotment.Pane preferredSize={160} minSize={80} visible={bottomOpen} snap>
                <div data-region="bottom" tabIndex={-1} style={{ height: '100%' }}>
                  {renderRegion('bottom')}
                </div>
              </Allotment.Pane>
            )}
          </Allotment>

          {/* Right activity bar — vertical dock tab strips for right + bottom-right docks */}
          <nav
            className={`dt-activity-bar dt-activity-bar--right ${activityLabels ? '' : 'dt-activity-bar--compact'} dt-activity-bar--layout-${sidebarLayout}`}
            onContextMenu={(e) => {
              e.preventDefault();
              setBarCtxMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <div className="dt-activity-group dt-activity-group--top">
              <div className="dt-activity-subslot dt-activity-subslot--first">
                <DockTabStrip
                  slot="right-top"
                  dock={tl.state.docks['right-top']}
                  tl={tl}
                  dragging={dockDragging}
                  focused={focusedRegion === 'right'}
                  showLabels={activityLabels}
                  icons={TOOL_WINDOW_ICONS}
                />
              </div>
              <div className="dt-activity-subslot dt-activity-subslot--second">
                <DockTabStrip
                  slot="right-bottom"
                  dock={tl.state.docks['right-bottom']}
                  tl={tl}
                  dragging={dockDragging}
                  focused={focusedRegion === 'right'}
                  showLabels={activityLabels}
                  icons={TOOL_WINDOW_ICONS}
                />
              </div>
            </div>
            <div className="dt-activity-group dt-activity-group--bottom">
              <DockTabStrip
                slot="bottom-right"
                dock={tl.state.docks['bottom-right']}
                tl={tl}
                dragging={dockDragging}
                focused={focusedRegion === 'bottom'}
                showLabels={activityLabels}
                icons={TOOL_WINDOW_ICONS}
              />
            </div>
          </nav>

          {/* Activity bar right-click context menu */}
          {barCtxMenu && (
            <>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
              <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setBarCtxMenu(null)} />
              <div
                className="dt-ctx-menu"
                style={{ position: 'fixed', left: barCtxMenu.x, top: barCtxMenu.y, zIndex: 100 }}
              >
                <button
                  type="button"
                  className="dt-ctx-item"
                  onClick={() => {
                    setActivityLabels((v) => !v);
                    setBarCtxMenu(null);
                  }}
                >
                  {activityLabels ? 'Hide Tool Window Names' : 'Show Tool Window Names'}
                </button>
              </div>
            </>
          )}

          {/* Drop zone overlay — 6 labeled zones shown during dock tab drags */}
          <DropZoneOverlay visible={dockDragging} rects={dropZoneRects} highlightedSlot={highlightedSlot} />

          {/* DragOverlay — renders at top level for both editor tabs and dock tabs */}
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
              <div className="dt-drag-preview">
                {TOOL_WINDOW_ICONS[dragDockWindowId]}
                <span>{PANEL_TOOL_WINDOW_MAP[dragDockWindowId].label}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Status bar — full width, outside activity bars and Allotment */}
      <div className="dt-status-bar">
        <div className="dt-status-bar-left">
          <span>
            {entries.length} request{entries.length === 1 ? '' : 's'}
          </span>
          <span>{totalSize} transferred</span>
          {finishTime && <span>Finish: {finishTime}</span>}
          {groups.allTabs.length > 0 && (
            <span>
              {groups.allTabs.length} tab{groups.allTabs.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div className="dt-status-bar-right">
          {/* Theme switcher */}
          <div>
            <button
              ref={themeButtonRef}
              type="button"
              className="dt-status-bar-item"
              style={{ color: THEME_DISPLAY[themeMode as ThemeMode]?.color, cursor: 'pointer' }}
              onClick={() => setThemeMenuOpen((v) => !v)}
              title={`Theme: ${THEME_DISPLAY[themeMode as ThemeMode]?.text}`}
            >
              <span style={{ fontSize: 12 }}>{THEME_DISPLAY[themeMode as ThemeMode]?.symbol}</span>
              <span style={{ fontSize: 10 }}>{THEME_DISPLAY[themeMode as ThemeMode]?.text}</span>
            </button>
            {themeMenuOpen && (
              <>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setThemeMenuOpen(false)} />
                <div className="dt-theme-menu" style={menuPositionAbove(themeButtonRef)}>
                  {(['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className="dt-ctx-item"
                      onClick={() => {
                        setThemeMode(mode);
                        setThemeMenuOpen(false);
                      }}
                    >
                      <span style={{ color: THEME_DISPLAY[mode].color, marginRight: 6 }}>
                        {THEME_DISPLAY[mode].symbol}
                      </span>
                      {THEME_DISPLAY[mode].text}
                      {themeMode === mode && <span style={{ marginLeft: 'auto' }}>{'\u2713'}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="dt-status-bar-divider" />
          {/* Region toggles */}
          <div className="dt-region-toggles">
            <RegionToggle
              title="Left sidebar"
              active={leftOpen}
              position="left"
              onClick={() => tl.toggleRegion('left')}
            />
            <RegionToggle
              title="Bottom panel"
              active={bottomOpen}
              position="bottom"
              onClick={() => tl.toggleRegion('bottom')}
            />
            <RegionToggle
              title="Right panel"
              active={rightOpen}
              position="right"
              onClick={() => tl.toggleRegion('right')}
            />
          </div>
          <div className="dt-status-bar-divider" />
          {/* Layout options menu */}
          <div>
            <button
              ref={layoutButtonRef}
              type="button"
              className="dt-region-toggle"
              onClick={() => setLayoutMenuOpen((v) => !v)}
              title="Layout options"
              aria-label="Layout options"
            >
              <svg
                viewBox="0 0 16 16"
                width={14}
                height={14}
                role="img"
                aria-hidden="true"
                style={{ display: 'block' }}
              >
                <rect x="1" y="1" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1" />
                <line x1="6" y1="5" x2="6" y2="15" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            {layoutMenuOpen && (
              <>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop */}
                {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setLayoutMenuOpen(false)} />
                <div className="dt-layout-menu" style={menuPositionAbove(layoutButtonRef)}>
                  <button
                    type="button"
                    className="dt-ctx-item"
                    onClick={() => {
                      setBottomFullWidth((v) => !v);
                      setLayoutMenuOpen(false);
                    }}
                  >
                    <span className="dt-layout-menu-icon">
                      <LayoutIcon kind={bottomFullWidth ? 'bottom-full' : 'bottom-nested'} />
                    </span>
                    <span>{bottomFullWidth ? '\u2713' : '\u2003'}</span>
                    Bottom panel full width
                  </button>
                  <button
                    type="button"
                    className="dt-ctx-item"
                    onClick={() => {
                      setActivityLabels((v) => !v);
                      setLayoutMenuOpen(false);
                    }}
                  >
                    <span className="dt-layout-menu-icon">
                      <LayoutIcon kind={activityLabels ? 'show-labels' : 'hide-labels'} />
                    </span>
                    <span>{activityLabels ? '\u2713' : '\u2003'}</span>
                    Show Tool Window Names
                  </button>
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
                  <div
                    className="dt-ctx-item dt-ctx-sub"
                    onMouseEnter={() => setSidebarLayoutOpen(true)}
                    onMouseLeave={() => setSidebarLayoutOpen(false)}
                  >
                    <span className="dt-layout-menu-icon">
                      <SidebarLayoutIcon variant={sidebarLayout} />
                    </span>
                    Sidebar Layout {'\u25B8'}
                    {sidebarLayoutOpen && (
                      <div className="dt-ctx-menu dt-ctx-submenu" style={{ left: '-100%', right: 'auto' }}>
                        {SIDEBAR_LAYOUT_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            className="dt-ctx-item"
                            onClick={() => {
                              setSidebarLayout(opt.key);
                              setSidebarLayoutOpen(false);
                              setLayoutMenuOpen(false);
                            }}
                          >
                            <span className="dt-layout-menu-icon">
                              <SidebarLayoutIcon variant={opt.key} />
                            </span>
                            <span>{sidebarLayout === opt.key ? '\u2713' : '\u2003'}</span>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="dt-ctx-sep" />
                  <button
                    type="button"
                    className={`dt-ctx-item${tl.state.hidden.length === 0 ? ' disabled' : ''}`}
                    disabled={tl.state.hidden.length === 0}
                    onClick={() => {
                      for (const id of tl.state.hidden) tl.restoreWindow(id);
                      setLayoutMenuOpen(false);
                    }}
                  >
                    Restore Hidden Sidebar Tools
                    {tl.state.hidden.length > 0 && (
                      <span style={{ marginLeft: 'auto', color: 'var(--dt-text-muted)' }}>
                        ({tl.state.hidden.length})
                      </span>
                    )}
                  </button>
                  {tl.state.hidden.map((id) => {
                    const def = PANEL_TOOL_WINDOW_MAP[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        className="dt-ctx-item"
                        onClick={() => {
                          tl.restoreWindow(id);
                          setLayoutMenuOpen(false);
                        }}
                      >
                        <span style={{ marginLeft: 12 }}>{def.label}</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--dt-text-muted)', fontSize: 10 }}>
                          {'\u2192'} {PANEL_DOCK_LABELS[def.defaultSlot]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
