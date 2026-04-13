/**
 * useToolLayout — authoritative state machine for the IDE-style
 * tool-window shell on workspace.html.
 *
 * Replaces the older `useWorkspaceLayout` hook which encoded the shell as
 * three fixed regions (leftPanel / rightPanel / bottomOpen). The new model
 * has six dock slots, each holding an ordered list of tool windows and
 * tracking which one is currently active. Tool windows can be dragged
 * between docks, hidden via a context menu, and restored to their default
 * slot. Core tool windows (currently `items`) cannot be hidden.
 *
 * Persistence mirrors useResponsiveLayout's pattern — `onPersist` is
 * called after every mutation so the host can coalesce writes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_DOCK_SLOTS, dockRegion, TOOL_WINDOW_MAP, TOOL_WINDOWS } from '../tool-windows';
import type {
  DockSlot,
  DockState,
  FocusRegion,
  SidebarLayoutVariant,
  ToolLayoutState,
  ToolRegion,
  ToolWindowId,
} from '../types';

// ── Defaults ──────────────────────────────────────────────────────────

function makeDefaultDocks(): Record<DockSlot, DockState> {
  const docks: Record<DockSlot, DockState> = {
    'left-top': { windows: [], active: null },
    'left-bottom': { windows: [], active: null },
    'right-top': { windows: [], active: null },
    'right-bottom': { windows: [], active: null },
    'bottom-left': { windows: [], active: null },
    'bottom-right': { windows: [], active: null },
  };
  for (const def of TOOL_WINDOWS) {
    docks[def.defaultSlot].windows.push(def.id);
  }
  // Activate the first tool window of the Items dock by default; other
  // docks stay collapsed until the user opens them explicitly.
  docks['left-top'].active = docks['left-top'].windows[0] ?? null;
  return docks;
}

export const DEFAULT_TOOL_LAYOUT: ToolLayoutState = {
  docks: makeDefaultDocks(),
  hidden: [],
  bottomFullWidth: false,
  showLabels: true,
  sidebarLayout: 'proportional',
  focusedRegion: null,
  focusedDock: null,
};

// ── Helpers ───────────────────────────────────────────────────────────

/** Deep-clone just enough of ToolLayoutState to mutate without touching prev. */
function cloneDocks(docks: Record<DockSlot, DockState>): Record<DockSlot, DockState> {
  const next: Record<DockSlot, DockState> = {} as Record<DockSlot, DockState>;
  for (const slot of ALL_DOCK_SLOTS) {
    const prev = docks[slot];
    next[slot] = { windows: [...prev.windows], active: prev.active };
  }
  return next;
}

function findDock(docks: Record<DockSlot, DockState>, id: ToolWindowId): DockSlot | null {
  for (const slot of ALL_DOCK_SLOTS) {
    if (docks[slot].windows.includes(id)) return slot;
  }
  return null;
}

function removeFromDock(dock: DockState, id: ToolWindowId): void {
  dock.windows = dock.windows.filter((w) => w !== id);
  if (dock.active === id) dock.active = null;
}

function insertIntoDock(dock: DockState, id: ToolWindowId, at?: number): void {
  if (!dock.windows.includes(id)) {
    if (at === undefined || at < 0 || at >= dock.windows.length) {
      dock.windows.push(id);
    } else {
      dock.windows.splice(at, 0, id);
    }
  }
  dock.active = id;
}

// ── Validation / migration ────────────────────────────────────────────

/**
 * Validate a persisted ToolLayoutState and repair obvious inconsistencies
 * so stale or corrupt records can't leave a tool window orphaned. Every
 * known tool window must appear in exactly one place (some dock, or the
 * hidden list); duplicates are dropped, and unknown ids are stripped.
 */
export function normalizeToolLayout(raw: Partial<ToolLayoutState> | null | undefined): ToolLayoutState {
  const docks = cloneDocks(DEFAULT_TOOL_LAYOUT.docks);
  const hidden: ToolWindowId[] = [];
  const seen = new Set<ToolWindowId>();

  // Clear default placements — we'll reapply from raw, then fill gaps.
  for (const slot of ALL_DOCK_SLOTS) {
    docks[slot].windows = [];
    docks[slot].active = null;
  }

  const rawDocks = raw?.docks;
  if (rawDocks) {
    for (const slot of ALL_DOCK_SLOTS) {
      const src = rawDocks[slot];
      if (!src) continue;
      const clean: ToolWindowId[] = [];
      for (const id of src.windows ?? []) {
        if (!TOOL_WINDOW_MAP[id]) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        clean.push(id);
      }
      docks[slot].windows = clean;
      if (src.active && clean.includes(src.active)) {
        docks[slot].active = src.active;
      }
    }
  }

  const rawHidden = raw?.hidden ?? [];
  for (const id of rawHidden) {
    if (!TOOL_WINDOW_MAP[id]) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    hidden.push(id);
  }

  // Re-seat any tool window that the persisted record forgot about — put
  // it back in its default slot so new tool windows added to the registry
  // automatically appear for existing users.
  for (const def of TOOL_WINDOWS) {
    if (seen.has(def.id)) continue;
    docks[def.defaultSlot].windows.push(def.id);
    seen.add(def.id);
  }

  return {
    docks,
    hidden,
    bottomFullWidth: raw?.bottomFullWidth ?? DEFAULT_TOOL_LAYOUT.bottomFullWidth,
    showLabels: raw?.showLabels ?? DEFAULT_TOOL_LAYOUT.showLabels,
    sidebarLayout:
      raw?.sidebarLayout === 'compact' || raw?.sidebarLayout === 'proportional' || raw?.sidebarLayout === 'stacked'
        ? raw.sidebarLayout
        : DEFAULT_TOOL_LAYOUT.sidebarLayout,
    focusedRegion: null,
    focusedDock: null,
  };
}

// ── Hook API ──────────────────────────────────────────────────────────

/** In-place mutator over a ToolLayoutState draft. */
type Mutator = (draft: ToolLayoutState) => void;

export interface UseToolLayoutOptions {
  initial?: Partial<ToolLayoutState>;
  onPersist?: (state: ToolLayoutState) => void;
}

export interface ToolLayoutApi {
  state: ToolLayoutState;

  // Dock queries
  dockOf: (id: ToolWindowId) => DockSlot | null;
  isRegionOpen: (region: ToolRegion) => boolean;
  isDockOpen: (slot: DockSlot) => boolean;

  // Tool-window actions
  activateWindow: (id: ToolWindowId) => void;
  toggleWindow: (id: ToolWindowId) => void;
  hideWindow: (id: ToolWindowId) => void;
  restoreWindow: (id: ToolWindowId, target?: DockSlot) => void;
  moveWindow: (id: ToolWindowId, target: DockSlot, insertAt?: number) => void;

  // Dock-level actions
  closeDock: (slot: DockSlot) => void;

  // Region-level toggles (used by keyboard shortcuts)
  toggleRegion: (region: ToolRegion) => void;

  // Layout-mode toggles
  setBottomFullWidth: (value: boolean) => void;
  setShowLabels: (value: boolean) => void;
  toggleShowLabels: () => void;
  setSidebarLayout: (value: SidebarLayoutVariant) => void;
  toggleSidebarLayout: () => void;
  setFocusedRegion: (region: FocusRegion) => void;
  setFocusedDock: (slot: DockSlot | null) => void;
}

// ── Hook implementation ───────────────────────────────────────────────

export function useToolLayout({ initial, onPersist }: UseToolLayoutOptions = {}): ToolLayoutApi {
  const [state, setState] = useState<ToolLayoutState>(() => normalizeToolLayout(initial));

  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  useEffect(() => {
    persistRef.current?.(state);
  }, [state]);

  /**
   * Remembered per-dock active tool window so toggleRegion('left') can
   * restore exactly the tool windows the user had open before collapsing.
   * Ref — never triggers a re-render.
   */
  const lastActiveRef = useRef<Record<DockSlot, ToolWindowId | null>>({
    'left-top': null,
    'left-bottom': null,
    'right-top': null,
    'right-bottom': null,
    'bottom-left': null,
    'bottom-right': null,
  });

  /** Shallow-clones state and hands the clone to `mutate`, which edits
   *  it in place. Returning nothing commits the mutated clone. */
  const patch = useCallback((mutate: Mutator) => {
    setState((prev) => {
      const next: ToolLayoutState = {
        ...prev,
        docks: cloneDocks(prev.docks),
        hidden: [...prev.hidden],
      };
      mutate(next);
      return next;
    });
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────

  const dockOf = useCallback((id: ToolWindowId) => findDock(state.docks, id), [state.docks]);

  const isDockOpen = useCallback((slot: DockSlot) => state.docks[slot].active !== null, [state.docks]);

  const isRegionOpen = useCallback(
    (region: ToolRegion) => {
      for (const slot of ALL_DOCK_SLOTS) {
        if (dockRegion(slot) !== region) continue;
        if (state.docks[slot].active !== null) return true;
      }
      return false;
    },
    [state.docks],
  );

  // ── Tool-window actions ─────────────────────────────────────────────

  const activateWindow = useCallback(
    (id: ToolWindowId) => {
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        next.docks[slot].active = id;
        next.focusedDock = slot;
        lastActiveRef.current[slot] = id;
      });
    },
    [patch],
  );

  const toggleWindow = useCallback(
    (id: ToolWindowId) => {
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        const dock = next.docks[slot];
        if (dock.active === id) {
          dock.active = null;
        } else {
          dock.active = id;
          lastActiveRef.current[slot] = id;
          next.focusedDock = slot;
        }
      });
    },
    [patch],
  );

  const hideWindow = useCallback(
    (id: ToolWindowId) => {
      const def = TOOL_WINDOW_MAP[id];
      if (!def || def.core) return;
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        removeFromDock(next.docks[slot], id);
        if (!next.hidden.includes(id)) next.hidden.push(id);
      });
    },
    [patch],
  );

  const restoreWindow = useCallback(
    (id: ToolWindowId, target?: DockSlot) => {
      const def = TOOL_WINDOW_MAP[id];
      if (!def) return;
      const targetSlot = target ?? def.defaultSlot;
      patch((next) => {
        next.hidden = next.hidden.filter((w) => w !== id);
        const currentSlot = findDock(next.docks, id);
        if (currentSlot) removeFromDock(next.docks[currentSlot], id);
        insertIntoDock(next.docks[targetSlot], id);
        lastActiveRef.current[targetSlot] = id;
      });
    },
    [patch],
  );

  // Selection and focus are properties of the tool window; a move carries
  // both across the destination. Moving an unselected tab never grants it
  // focus; moving a selected-but-unfocused tab keeps focus on whichever
  // dock already had it.
  const moveWindow = useCallback(
    (id: ToolWindowId, target: DockSlot, insertAt?: number) => {
      patch((next) => {
        const sourceSlot = findDock(next.docks, id);
        const wasSelected = sourceSlot !== null && next.docks[sourceSlot].active === id;
        const wasFocused = wasSelected && next.focusedDock === sourceSlot;

        if (sourceSlot === target && insertAt === undefined) return;

        if (sourceSlot) removeFromDock(next.docks[sourceSlot], id);
        next.hidden = next.hidden.filter((w) => w !== id);

        const dock = next.docks[target];
        if (insertAt !== undefined) {
          const clamped = Math.max(0, Math.min(insertAt, dock.windows.length));
          dock.windows.splice(clamped, 0, id);
        } else if (!dock.windows.includes(id)) {
          dock.windows.push(id);
        }

        if (wasSelected) {
          dock.active = id;
          lastActiveRef.current[target] = id;
        }
        if (wasFocused) {
          next.focusedDock = target;
        }
      });
    },
    [patch],
  );

  const closeDock = useCallback(
    (slot: DockSlot) => {
      patch((next) => {
        next.docks[slot].active = null;
      });
    },
    [patch],
  );

  // ── Region toggle ───────────────────────────────────────────────────

  const toggleRegion = useCallback(
    (region: ToolRegion) => {
      patch((next) => {
        const slotsInRegion = ALL_DOCK_SLOTS.filter((s) => dockRegion(s) === region);
        const anyOpen = slotsInRegion.some((s) => next.docks[s].active !== null);
        if (anyOpen) {
          for (const s of slotsInRegion) {
            if (next.docks[s].active !== null) {
              lastActiveRef.current[s] = next.docks[s].active;
              next.docks[s].active = null;
            }
          }
        } else {
          for (const s of slotsInRegion) {
            const remembered = lastActiveRef.current[s];
            const first = next.docks[s].windows[0] ?? null;
            const candidate = remembered && next.docks[s].windows.includes(remembered) ? remembered : first;
            if (candidate) next.docks[s].active = candidate;
          }
        }
      });
    },
    [patch],
  );

  // ── Layout-mode toggles ─────────────────────────────────────────────

  const setBottomFullWidth = useCallback(
    (value: boolean) =>
      patch((next) => {
        next.bottomFullWidth = value;
      }),
    [patch],
  );
  const setShowLabels = useCallback(
    (value: boolean) =>
      patch((next) => {
        next.showLabels = value;
      }),
    [patch],
  );
  const toggleShowLabels = useCallback(
    () =>
      patch((next) => {
        next.showLabels = !next.showLabels;
      }),
    [patch],
  );
  const setSidebarLayout = useCallback(
    (value: SidebarLayoutVariant) =>
      patch((next) => {
        next.sidebarLayout = value;
      }),
    [patch],
  );
  const toggleSidebarLayout = useCallback(
    () =>
      patch((next) => {
        const order: SidebarLayoutVariant[] = ['proportional', 'compact', 'stacked'];
        const i = order.indexOf(next.sidebarLayout);
        next.sidebarLayout = order[(i + 1) % order.length];
      }),
    [patch],
  );
  const setFocusedRegion = useCallback(
    (region: FocusRegion) =>
      patch((next) => {
        next.focusedRegion = region;
        // Leaving dock regions drops the per-dock focus so the activity
        // bars stop showing a blue accent.
        if (region === null || region === 'editor') {
          next.focusedDock = null;
        }
      }),
    [patch],
  );

  const setFocusedDock = useCallback(
    (slot: DockSlot | null) =>
      patch((next) => {
        next.focusedDock = slot;
      }),
    [patch],
  );

  return useMemo<ToolLayoutApi>(
    () => ({
      state,
      dockOf,
      isRegionOpen,
      isDockOpen,
      activateWindow,
      toggleWindow,
      hideWindow,
      restoreWindow,
      moveWindow,
      closeDock,
      toggleRegion,
      setBottomFullWidth,
      setShowLabels,
      toggleShowLabels,
      setSidebarLayout,
      toggleSidebarLayout,
      setFocusedRegion,
      setFocusedDock,
    }),
    [
      state,
      dockOf,
      isRegionOpen,
      isDockOpen,
      activateWindow,
      toggleWindow,
      hideWindow,
      restoreWindow,
      moveWindow,
      closeDock,
      toggleRegion,
      setBottomFullWidth,
      setShowLabels,
      toggleShowLabels,
      setSidebarLayout,
      toggleSidebarLayout,
      setFocusedRegion,
      setFocusedDock,
    ],
  );
}
