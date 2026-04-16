/**
 * usePanelToolLayout — dockable tool-window state machine for the
 * DevTools Inspector panel. Same pattern as workspace's useToolLayout.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ALL_PANEL_DOCK_SLOTS,
  panelDockRegion,
  PANEL_TOOL_WINDOW_MAP,
  PANEL_TOOL_WINDOWS,
  type PanelDockSlot,
  type PanelToolRegion,
  type PanelToolWindowId,
} from './tool-windows';

export interface PanelDockState {
  windows: PanelToolWindowId[];
  active: PanelToolWindowId | null;
}

export interface PanelToolLayoutState {
  docks: Record<PanelDockSlot, PanelDockState>;
  hidden: PanelToolWindowId[];
  zenSnapshot: Record<PanelDockSlot, PanelToolWindowId | null> | null;
}

function makeDefaultDocks(): Record<PanelDockSlot, PanelDockState> {
  const docks: Record<PanelDockSlot, PanelDockState> = {
    'left-top': { windows: [], active: null },
    'left-bottom': { windows: [], active: null },
    'right-top': { windows: [], active: null },
    'right-bottom': { windows: [], active: null },
    'bottom-left': { windows: [], active: null },
    'bottom-right': { windows: [], active: null },
  };
  for (const def of PANEL_TOOL_WINDOWS) {
    docks[def.defaultSlot].windows.push(def.id);
  }
  docks['left-top'].active = docks['left-top'].windows[0] ?? null;
  return docks;
}

const DEFAULT_STATE: PanelToolLayoutState = {
  docks: makeDefaultDocks(),
  hidden: [],
  zenSnapshot: null,
};

function cloneDocks(docks: Record<PanelDockSlot, PanelDockState>): Record<PanelDockSlot, PanelDockState> {
  const next = {} as Record<PanelDockSlot, PanelDockState>;
  for (const slot of ALL_PANEL_DOCK_SLOTS) {
    const prev = docks[slot];
    next[slot] = { windows: [...prev.windows], active: prev.active };
  }
  return next;
}

function findDock(docks: Record<PanelDockSlot, PanelDockState>, id: PanelToolWindowId): PanelDockSlot | null {
  for (const slot of ALL_PANEL_DOCK_SLOTS) {
    if (docks[slot].windows.includes(id)) return slot;
  }
  return null;
}

function layoutEquals(a: PanelToolLayoutState, b: PanelToolLayoutState): boolean {
  if (a === b) return true;
  for (const slot of ALL_PANEL_DOCK_SLOTS) {
    const da = a.docks[slot];
    const db = b.docks[slot];
    if (da === db) continue;
    if (da.active !== db.active) return false;
    if (da.windows.length !== db.windows.length) return false;
    for (let i = 0; i < da.windows.length; i++) {
      if (da.windows[i] !== db.windows[i]) return false;
    }
  }
  if (a.hidden.length !== b.hidden.length) return false;
  for (let i = 0; i < a.hidden.length; i++) {
    if (a.hidden[i] !== b.hidden[i]) return false;
  }
  return a.zenSnapshot === b.zenSnapshot;
}

function removeFromDock(dock: PanelDockState, id: PanelToolWindowId): void {
  dock.windows = dock.windows.filter((w) => w !== id);
  if (dock.active === id) dock.active = null;
}

function insertIntoDock(dock: PanelDockState, id: PanelToolWindowId, at?: number): void {
  if (!dock.windows.includes(id)) {
    if (at === undefined || at < 0 || at >= dock.windows.length) {
      dock.windows.push(id);
    } else {
      dock.windows.splice(at, 0, id);
    }
  }
  dock.active = id;
}

type Mutator = (draft: PanelToolLayoutState) => void;

export interface PanelToolLayoutApi {
  state: PanelToolLayoutState;
  dockOf: (id: PanelToolWindowId) => PanelDockSlot | null;
  isRegionOpen: (region: PanelToolRegion) => boolean;
  isDockOpen: (slot: PanelDockSlot) => boolean;
  activateWindow: (id: PanelToolWindowId) => void;
  toggleWindow: (id: PanelToolWindowId) => void;
  hideWindow: (id: PanelToolWindowId) => void;
  restoreWindow: (id: PanelToolWindowId, target?: PanelDockSlot) => void;
  moveWindow: (id: PanelToolWindowId, target: PanelDockSlot, insertAt?: number) => void;
  closeDock: (slot: PanelDockSlot) => void;
  toggleRegion: (region: PanelToolRegion) => void;
  toggleZenMode: () => void;
}

export function usePanelToolLayout(): PanelToolLayoutApi {
  const [state, setState] = useState<PanelToolLayoutState>(DEFAULT_STATE);

  const lastActiveRef = useRef<Record<PanelDockSlot, PanelToolWindowId | null>>({
    'left-top': null,
    'left-bottom': null,
    'right-top': null,
    'right-bottom': null,
    'bottom-left': null,
    'bottom-right': null,
  });

  const patch = useCallback((mutate: Mutator) => {
    setState((prev) => {
      const next: PanelToolLayoutState = {
        ...prev,
        docks: cloneDocks(prev.docks),
        hidden: [...prev.hidden],
      };
      mutate(next);
      return layoutEquals(prev, next) ? prev : next;
    });
  }, []);

  const dockOf = useCallback((id: PanelToolWindowId) => findDock(state.docks, id), [state.docks]);

  const isDockOpen = useCallback((slot: PanelDockSlot) => state.docks[slot].active !== null, [state.docks]);

  const isRegionOpen = useCallback(
    (region: PanelToolRegion) => {
      for (const slot of ALL_PANEL_DOCK_SLOTS) {
        if (panelDockRegion(slot) !== region) continue;
        if (state.docks[slot].active !== null) return true;
      }
      return false;
    },
    [state.docks],
  );

  const activateWindow = useCallback(
    (id: PanelToolWindowId) => {
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        next.docks[slot].active = id;
        lastActiveRef.current[slot] = id;
      });
    },
    [patch],
  );

  const toggleWindow = useCallback(
    (id: PanelToolWindowId) => {
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        const dock = next.docks[slot];
        if (dock.active === id) {
          dock.active = null;
        } else {
          dock.active = id;
          lastActiveRef.current[slot] = id;
        }
      });
    },
    [patch],
  );

  const hideWindow = useCallback(
    (id: PanelToolWindowId) => {
      const def = PANEL_TOOL_WINDOW_MAP[id];
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
    (id: PanelToolWindowId, target?: PanelDockSlot) => {
      const def = PANEL_TOOL_WINDOW_MAP[id];
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

  const moveWindow = useCallback(
    (id: PanelToolWindowId, target: PanelDockSlot, insertAt?: number) => {
      patch((next) => {
        const sourceSlot = findDock(next.docks, id);
        const wasSelected = sourceSlot !== null && next.docks[sourceSlot].active === id;

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
      });
    },
    [patch],
  );

  const closeDock = useCallback(
    (slot: PanelDockSlot) => {
      patch((next) => {
        next.docks[slot].active = null;
      });
    },
    [patch],
  );

  const toggleRegion = useCallback(
    (region: PanelToolRegion) => {
      patch((next) => {
        const slotsInRegion = ALL_PANEL_DOCK_SLOTS.filter((s) => panelDockRegion(s) === region);
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

  const toggleZenMode = useCallback(() => {
    patch((next) => {
      if (next.zenSnapshot) {
        for (const s of ALL_PANEL_DOCK_SLOTS) {
          const id = next.zenSnapshot[s];
          if (!id) continue;
          if (next.docks[s].active !== null) continue;
          if (!next.docks[s].windows.includes(id)) continue;
          next.docks[s].active = id;
        }
        next.zenSnapshot = null;
        return;
      }
      const snap = {} as Record<PanelDockSlot, PanelToolWindowId | null>;
      let anyCaptured = false;
      for (const s of ALL_PANEL_DOCK_SLOTS) {
        snap[s] = null;
        const active = next.docks[s].active;
        if (active !== null) {
          snap[s] = active;
          next.docks[s].active = null;
          anyCaptured = true;
        }
      }
      if (!anyCaptured) return;
      next.zenSnapshot = snap;
    });
  }, [patch]);

  return useMemo<PanelToolLayoutApi>(
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
      toggleZenMode,
    }),
    [state, dockOf, isRegionOpen, isDockOpen, activateWindow, toggleWindow, hideWindow, restoreWindow, moveWindow, closeDock, toggleRegion, toggleZenMode],
  );
}
