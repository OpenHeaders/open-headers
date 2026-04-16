/**
 * useResponsiveLayout — viewport-aware panel sizing for workspace.html.
 *
 * Responsibilities:
 *   1. Compute initial panel sizes from viewport (first-open) or restore persisted ratios
 *   2. Persist panel sizes as ratios (not pixels) to chrome.storage.local on drag
 *   3. matchMedia breakpoint for auto-collapsing sidebar on narrow viewports
 *   4. Panel coordination: auto-narrow sidebar when inspector opens on medium screens
 *   5. Guard against degenerate viewport values (browser restore, 0-width)
 */

import { storage } from '@utils/browser-api';
import { scheduleFrame } from '@utils/frame-scheduler';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToolLayoutState } from '../types';

// ── Storage key ────────────────────────────────────────────────────

const STORAGE_KEY = 'workspacePanelLayout';

// ── Breakpoints (CSS pixels, accounts for browser zoom) ───────────

/** Below this: auto-collapse sidebar on first open */
const BP_SIDEBAR_COLLAPSE = 1400;

// ── Pixel clamps ───────────────────────────────────────────────────

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 400;
const INSPECTOR_MIN = 280;
const INSPECTOR_MAX_RATIO = 0.35;
const BOTTOM_MIN = 100;
const BOTTOM_MAX_RATIO = 0.45;
const EDITOR_MIN = 400;

// ── Types ──────────────────────────────────────────────────────────

interface PersistedLayout {
  /** Sidebar width as ratio of viewport width (0–1) */
  sidebarRatio: number;
  /** Inspector width as ratio of viewport width (0–1) */
  inspectorRatio: number;
  /** Bottom panel height as ratio of viewport height (0–1) */
  bottomRatio: number;
  /**
   * Dockable tool-window layout. Owns dock assignments and the
   * hidden list. Normalized on load so stale records never leave a
   * tool window orphaned. Layout behaviors (bottom full-width, label
   * visibility, sidebar layout) now live in the settings store.
   */
  toolLayout?: Partial<ToolLayoutState>;
}

export interface ResponsiveLayoutSizes {
  sidebar: { preferred: number; min: number; max: number };
  inspector: { preferred: number; min: number; max: number };
  bottom: { preferred: number; min: number; max: number };
  editorMin: number;
}

export interface ResponsiveLayout {
  sizes: ResponsiveLayoutSizes;
  /** true when viewport is narrow enough that sidebar should default to collapsed */
  shouldCollapseSidebar: boolean;
  /** Call when allotment onChange fires — persists ratios to storage */
  onPanelResize: (panelSizes: number[]) => void;
  /** Call when the vertical (editor / bottom) allotment changes */
  onVerticalResize: (panelSizes: number[]) => void;
  /** When inspector opens on a medium screen, returns a narrowed sidebar preferred size (or null if no change needed) */
  getCoordinatedSidebarSize: (inspectorVisible: boolean) => number | null;
  /** Whether persisted layout has been loaded (avoid flash of default sizes) */
  ready: boolean;
  /** Previously-persisted tool-window layout, or null on fresh profiles. */
  persistedToolLayout: Partial<ToolLayoutState> | null;
  /** Persist the tool-window layout — debounced through the same write. */
  persistToolLayout: (state: ToolLayoutState) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

function getViewportWidth(): number {
  const w = window.innerWidth;
  return w > 0 ? w : 1920;
}

function getViewportHeight(): number {
  const h = window.innerHeight;
  return h > 0 ? h : 1080;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeSizes(vw: number, vh: number, persisted: PersistedLayout | null): ResponsiveLayoutSizes {
  const inspectorMax = Math.round(Math.min(900, vw * INSPECTOR_MAX_RATIO));
  const bottomMax = Math.round(Math.min(500, vh * BOTTOM_MAX_RATIO));

  if (persisted) {
    return {
      sidebar: {
        preferred: clamp(Math.round(persisted.sidebarRatio * vw), SIDEBAR_MIN, SIDEBAR_MAX),
        min: SIDEBAR_MIN,
        max: SIDEBAR_MAX,
      },
      inspector: {
        preferred: clamp(Math.round(persisted.inspectorRatio * vw), INSPECTOR_MIN, inspectorMax),
        min: INSPECTOR_MIN,
        max: inspectorMax,
      },
      bottom: {
        preferred: clamp(Math.round(persisted.bottomRatio * vh), BOTTOM_MIN, bottomMax),
        min: BOTTOM_MIN,
        max: bottomMax,
      },
      editorMin: EDITOR_MIN,
    };
  }

  // First-open defaults: proportional to viewport
  // Sidebar 17%: gives tree labels ~245px on a 1440px MacBook Air (vs 216px at 15%)
  // Inspector 20%: docs panel doesn't need more; keeps editor wider
  return {
    sidebar: {
      preferred: clamp(Math.round(vw * 0.17), SIDEBAR_MIN, SIDEBAR_MAX),
      min: SIDEBAR_MIN,
      max: SIDEBAR_MAX,
    },
    inspector: {
      preferred: clamp(Math.round(vw * 0.2), INSPECTOR_MIN, inspectorMax),
      min: INSPECTOR_MIN,
      max: inspectorMax,
    },
    bottom: {
      preferred: clamp(Math.round(vh * 0.25), BOTTOM_MIN, bottomMax),
      min: BOTTOM_MIN,
      max: bottomMax,
    },
    editorMin: EDITOR_MIN,
  };
}

// ── Hook ───────────────────────────────────────────────────────────

export function useResponsiveLayout(): ResponsiveLayout {
  const [persisted, setPersisted] = useState<PersistedLayout | null>(null);
  const [persistedToolLayout, setPersistedToolLayout] = useState<Partial<ToolLayoutState> | null>(null);
  const [ready, setReady] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(() => getViewportWidth() < BP_SIDEBAR_COLLAPSE);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPersistedRef = useRef<PersistedLayout | null>(null);

  // ── Load persisted layout on mount ─────────────────────────────

  useEffect(() => {
    // Defer one frame so the browser's window-restore measurements land
    // before we read persisted ratios back into layout state.
    scheduleFrame(() => {
      storage.local.get([STORAGE_KEY], (result: Record<string, unknown>) => {
        const saved = result[STORAGE_KEY] as PersistedLayout | undefined;
        if (saved?.sidebarRatio != null && saved?.inspectorRatio != null && saved?.bottomRatio != null) {
          setPersisted(saved);
          latestPersistedRef.current = saved;
          setPersistedToolLayout(saved.toolLayout ?? null);
        }
        setReady(true);
      });
    });
  }, []);

  // ── matchMedia breakpoint listener ─────────────────────────────

  useEffect(() => {
    const collapseQuery = matchMedia(`(max-width: ${BP_SIDEBAR_COLLAPSE}px)`);
    const handleCollapse = (e: MediaQueryListEvent) => setShouldCollapse(e.matches);
    collapseQuery.addEventListener('change', handleCollapse);
    return () => collapseQuery.removeEventListener('change', handleCollapse);
  }, []);

  // ── Compute sizes ──────────────────────────────────────────────

  const sizes = useMemo(() => {
    const vw = getViewportWidth();
    const vh = getViewportHeight();
    return computeSizes(vw, vh, persisted);
  }, [persisted]);

  // ── Persist helpers (debounced 500ms) ──────────────────────────

  const flushPersist = useCallback((ratios: PersistedLayout) => {
    storage.local.set({ [STORAGE_KEY]: ratios });
  }, []);

  const schedulePersist = useCallback(
    (record: PersistedLayout) => {
      latestPersistedRef.current = record;
      // Mirror the ratio record into React state so `sizes` useMemo
      // recomputes. Without this, Allotment subtrees force-remounted via
      // key (classic ↔ wide-bottom toggle) read stale preferredSize
      // values from the initial persisted load and snap back to the
      // original height, losing the user's drag.
      setPersisted((prev) => {
        if (
          prev &&
          prev.sidebarRatio === record.sidebarRatio &&
          prev.inspectorRatio === record.inspectorRatio &&
          prev.bottomRatio === record.bottomRatio
        ) {
          return prev;
        }
        return record;
      });
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => flushPersist(record), 500);
    },
    [flushPersist],
  );

  // ── Tool-window layout persistence ─────────────────────────────

  const persistToolLayout = useCallback(
    (next: ToolLayoutState) => {
      const prev = latestPersistedRef.current ?? {
        sidebarRatio: 0.17,
        inspectorRatio: 0.2,
        bottomRatio: 0.25,
      };
      schedulePersist({
        ...prev,
        toolLayout: {
          docks: next.docks,
          hidden: next.hidden,
        },
      });
    },
    [schedulePersist],
  );

  // ── onPanelResize: horizontal allotment (sidebar | editor+bottom | inspector) ──

  const onPanelResize = useCallback(
    (panelSizes: number[]) => {
      const vw = getViewportWidth();
      if (vw <= 0) return;
      const prev = latestPersistedRef.current ?? { sidebarRatio: 0.17, inspectorRatio: 0.2, bottomRatio: 0.25 };
      const sidebarRatio = panelSizes[0] != null && panelSizes[0] > 0 ? panelSizes[0] / vw : prev.sidebarRatio;
      const inspectorRatio = panelSizes[2] != null && panelSizes[2] > 0 ? panelSizes[2] / vw : prev.inspectorRatio;
      schedulePersist({ ...prev, sidebarRatio, inspectorRatio });
    },
    [schedulePersist],
  );

  // ── onVerticalResize: vertical allotment (editor | bottom) ────

  const onVerticalResize = useCallback(
    (panelSizes: number[]) => {
      const vh = getViewportHeight();
      if (vh <= 0) return;
      const prev = latestPersistedRef.current ?? { sidebarRatio: 0.17, inspectorRatio: 0.2, bottomRatio: 0.25 };
      const bottomRatio = panelSizes[1] != null && panelSizes[1] > 0 ? panelSizes[1] / vh : prev.bottomRatio;
      schedulePersist({ ...prev, bottomRatio });
    },
    [schedulePersist],
  );

  // ── Panel coordination ─────────────────────────────────────────

  const getCoordinatedSidebarSize = useCallback(
    (inspectorVisible: boolean): number | null => {
      if (!inspectorVisible) return null;
      const vw = getViewportWidth();
      const editorSpace = vw - 64 - sizes.sidebar.preferred - sizes.inspector.preferred;
      if (editorSpace < EDITOR_MIN) {
        return SIDEBAR_MIN;
      }
      return null;
    },
    [sizes],
  );

  return {
    sizes,
    shouldCollapseSidebar: shouldCollapse,
    onPanelResize,
    onVerticalResize,
    getCoordinatedSidebarSize,
    ready,
    persistedToolLayout,
    persistToolLayout,
  };
}
