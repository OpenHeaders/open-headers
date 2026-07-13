/**
 * useResponsiveLayout — viewport-aware panel sizing for workbench.html.
 *
 * Responsibilities:
 *   1. Compute initial panel sizes from viewport (first-open) or restore persisted ratios
 *   2. Persist panel sizes as ratios (not pixels) to chrome.storage.local on drag
 *   3. matchMedia breakpoint for auto-collapsing sidebar on narrow viewports
 *   4. Panel coordination: auto-narrow sidebar when inspector opens on medium screens
 *   5. Guard against degenerate viewport values (browser restore, 0-width)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, type PersistedPanelLayout, wsKeys } from '@openheaders/core/storage';
import { applyLayoutSet } from '@openheaders/ui/shared/sync/layout-state-write-client';

// ── Breakpoints (CSS pixels, accounts for browser zoom) ───────────

/** Below this: auto-collapse sidebar on first open */
const BP_SIDEBAR_COLLAPSE = 1400;

// ── Pixel clamps ───────────────────────────────────────────────────

const SIDEBAR_MIN = 260;
const SIDEBAR_MAX = 600;
const INSPECTOR_MIN = 340;
const INSPECTOR_MAX_RATIO = 0.45;
const BOTTOM_MIN = 220;
const BOTTOM_MAX_RATIO = 0.6;
const EDITOR_MIN = 400;

// First-open viewport ratios. Inspector seeds at 31% (1.3× the legacy
// 24%) because Docs + Scope live there and benefit from reading width.
// Reset behavior is owned by Allotment's native sashreset → side panes'
// `preferredSize` (set to each pane's min in ShellLayout), so reset
// snaps to min-width.
const SIDEBAR_SEED_RATIO = 0.22;
const INSPECTOR_SEED_RATIO = 0.31;
const BOTTOM_SEED_RATIO = 0.32;

// ── Types ──────────────────────────────────────────────────────────

interface PersistedLayout {
  /** Sidebar width as ratio of viewport width (0–1) */
  sidebarRatio: number;
  /** Inspector width as ratio of viewport width (0–1) */
  inspectorRatio: number;
  /** Bottom panel height as ratio of viewport height (0–1) */
  bottomRatio: number;
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
  const inspectorMax = Math.round(Math.min(1100, vw * INSPECTOR_MAX_RATIO));
  const bottomMax = Math.round(Math.min(800, vh * BOTTOM_MAX_RATIO));

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

  // First-open defaults: proportional to viewport. Sidebar gives tree
  // labels ~316px on a 1440px MacBook Air — enough breathing room for
  // rule / request names without truncating, without eating too much
  // editor width. The left-bottom pane (API Requests) shares the same
  // width, so widening the sidebar widens both stacked tool windows.
  // Inspector seeds wider (Docs + Scope live there) and the bottom
  // panel takes about a third of the viewport height.
  return {
    sidebar: {
      preferred: clamp(Math.round(vw * SIDEBAR_SEED_RATIO), SIDEBAR_MIN, SIDEBAR_MAX),
      min: SIDEBAR_MIN,
      max: SIDEBAR_MAX,
    },
    inspector: {
      preferred: clamp(Math.round(vw * INSPECTOR_SEED_RATIO), INSPECTOR_MIN, inspectorMax),
      min: INSPECTOR_MIN,
      max: inspectorMax,
    },
    bottom: {
      preferred: clamp(Math.round(vh * BOTTOM_SEED_RATIO), BOTTOM_MIN, bottomMax),
      min: BOTTOM_MIN,
      max: bottomMax,
    },
    editorMin: EDITOR_MIN,
  };
}

// ── Hook ───────────────────────────────────────────────────────────

/**
 * Per-workspace panel ratios. The `workspaceId` argument is the
 * editing-scope workspace — global default in global mode, the tab's
 * slice binding in per-tab mode (BC-MWPT-10). Routing through the prop
 * turns this hook into a single-source-of-truth consumer of the per-tab
 * seam, which makes diverged tabs use the diverged workspace's saved
 * ratios instead of always loading the global default's.
 */
export function useResponsiveLayout(workspaceId: string | null): ResponsiveLayout {
  const [persisted, setPersisted] = useState<PersistedLayout | null>(null);
  const [ready, setReady] = useState(false);
  const [shouldCollapse, setShouldCollapse] = useState(() => getViewportWidth() < BP_SIDEBAR_COLLAPSE);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPersistedRef = useRef<PersistedLayout | null>(null);
  const activeWorkspaceIdRef = useRef<string | null>(null);

  const loadLayoutFor = useCallback(async (id: string) => {
    const saved = (await hostStorage.get(wsKeys(id).panelLayout)) as PersistedLayout | undefined;
    if (saved?.sidebarRatio != null && saved?.inspectorRatio != null && saved?.bottomRatio != null) {
      setPersisted(saved);
      latestPersistedRef.current = saved;
    } else {
      setPersisted(null);
      latestPersistedRef.current = null;
    }
    setReady(true);
  }, []);

  // ── Load + resync on workspace id change ──────────────────────
  //
  // Caller passes the editing-scope workspace id. When it changes —
  // mount, global switch, per-tab divergence — we cancel any pending
  // persist (would write to the wrong workspace) and reload ratios for
  // the new binding.
  useEffect(() => {
    if (!workspaceId) {
      // Caller hasn't resolved a workspace yet — render with defaults.
      activeWorkspaceIdRef.current = null;
      setReady(true);
      return;
    }
    if (activeWorkspaceIdRef.current === workspaceId) return;
    activeWorkspaceIdRef.current = workspaceId;
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    void loadLayoutFor(workspaceId);
  }, [workspaceId, loadLayoutFor]);

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
    // Routes the layout write through the renderer-direct sync client.
    // Two surfaces dragging different panes simultaneously serialize
    // through the oracle's per-entity lock; whole-blob LWW means the
    // newest HLC wins. Workspace switch: ref is updated by the
    // workspaceChanged listener before `flushPersist` fires the
    // debounced write.
    const workspaceId = activeWorkspaceIdRef.current;
    if (!workspaceId) return;
    void applyLayoutSet({ layout: ratios as PersistedPanelLayout }, { workspaceId, surfaceId: 'workbench' }).catch(
      () => undefined,
    );
  }, []);

  const schedulePersist = useCallback(
    (record: PersistedLayout) => {
      latestPersistedRef.current = record;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        // Mirror the ratio record into React state so `sizes` useMemo
        // recomputes. Without this, Allotment subtrees force-remounted via
        // key (classic ↔ wide-bottom toggle) read stale preferredSize
        // values from the initial persisted load and snap back to the
        // original height, losing the user's drag. The mirror rides the
        // same debounce as the storage write: onChange fires per drag
        // tick, and a per-tick state update re-renders the whole shell —
        // every keep-alive editor tab body included — on every pointer
        // move. A remount that would read `sizes` can't happen mid-drag,
        // so post-drag is early enough.
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
        flushPersist(record);
      }, 500);
    },
    [flushPersist],
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
  };
}
