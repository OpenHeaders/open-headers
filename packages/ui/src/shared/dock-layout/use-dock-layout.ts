/**
 * useDockLayout — generic state machine for the dockable tool-window shell.
 *
 * Parameterized over the tool-window ID type so both workspace and
 * devtools panel can use the same hook with their own registries.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ALL_DOCK_SLOTS, dockRegion } from './constants';
import type { FocusStore } from './focus-store';
import type { DockSlot, DockState, FocusRegion, ToolLayoutState, ToolRegion, ToolWindowDef } from './types';

// ── Helpers ───────────────────────────────────────────────────────────

function cloneDocks<T extends string>(docks: Record<DockSlot, DockState<T>>): Record<DockSlot, DockState<T>> {
  const next = {} as Record<DockSlot, DockState<T>>;
  for (const slot of ALL_DOCK_SLOTS) {
    const prev = docks[slot];
    next[slot] = { windows: [...prev.windows], active: prev.active };
  }
  return next;
}

function findDock<T extends string>(docks: Record<DockSlot, DockState<T>>, id: T): DockSlot | null {
  for (const slot of ALL_DOCK_SLOTS) {
    if (docks[slot].windows.includes(id)) return slot;
  }
  return null;
}

function layoutEquals<T extends string>(a: ToolLayoutState<T>, b: ToolLayoutState<T>): boolean {
  if (a === b) return true;
  for (const slot of ALL_DOCK_SLOTS) {
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

function removeFromDock<T extends string>(dock: DockState<T>, id: T): void {
  dock.windows = dock.windows.filter((w) => w !== id);
  if (dock.active === id) dock.active = null;
}

function insertIntoDock<T extends string>(dock: DockState<T>, id: T, at?: number): void {
  if (!dock.windows.includes(id)) {
    if (at === undefined || at < 0 || at >= dock.windows.length) {
      dock.windows.push(id);
    } else {
      dock.windows.splice(at, 0, id);
    }
  }
  dock.active = id;
}

// ── Default state builder ─────────────────────────────────────────────

export function makeDefaultDocks<T extends string>(
  windows: readonly ToolWindowDef<T>[],
): Record<DockSlot, DockState<T>> {
  const docks = {} as Record<DockSlot, DockState<T>>;
  for (const slot of ALL_DOCK_SLOTS) {
    docks[slot] = { windows: [], active: null };
  }
  for (const def of windows) {
    docks[def.defaultSlot].windows.push(def.id);
  }
  return docks;
}

// ── Validation / migration ────────────────────────────────────────────

export function normalizeDockLayout<T extends string>(
  raw: Partial<ToolLayoutState<T>> | null | undefined,
  windowDefs: readonly ToolWindowDef<T>[],
  windowMap: Record<T, ToolWindowDef<T>>,
): ToolLayoutState<T> {
  const defaultDocks = makeDefaultDocks(windowDefs);
  const docks = cloneDocks(defaultDocks);
  const hidden: T[] = [];
  const seen = new Set<T>();

  for (const slot of ALL_DOCK_SLOTS) {
    docks[slot].windows = [];
    docks[slot].active = null;
  }

  const rawDocks = raw?.docks;
  if (rawDocks) {
    for (const slot of ALL_DOCK_SLOTS) {
      const src = rawDocks[slot];
      if (!src) continue;
      const clean: T[] = [];
      for (const id of src.windows ?? []) {
        if (!windowMap[id]) continue;
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
    if (!windowMap[id]) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    hidden.push(id);
  }

  // Windows the persisted state doesn't know yet (added in an update)
  // land in their defaultSlot at their REGISTRY position among the
  // slot's windows — not appended — so an existing profile shows them
  // where a fresh profile would (e.g. notifications above docs).
  for (const def of windowDefs) {
    if (seen.has(def.id)) continue;
    const slotOrder = windowDefs.filter((d) => d.defaultSlot === def.defaultSlot).map((d) => d.id);
    const myOrder = slotOrder.indexOf(def.id);
    const slotWindows = docks[def.defaultSlot].windows;
    let insertAt = slotWindows.length;
    for (let i = 0; i < slotWindows.length; i++) {
      const existingOrder = slotOrder.indexOf(slotWindows[i]);
      if (existingOrder !== -1 && existingOrder > myOrder) {
        insertAt = i;
        break;
      }
    }
    slotWindows.splice(insertAt, 0, def.id);
    seen.add(def.id);
  }

  return { docks, hidden, zenSnapshot: null };
}

// ── Hook API ──────────────────────────────────────────────────────────

type Mutator<T extends string> = (draft: ToolLayoutState<T>) => void;

export interface UseDockLayoutOptions<T extends string> {
  windowDefs: readonly ToolWindowDef<T>[];
  windowMap: Record<T, ToolWindowDef<T>>;
  initial?: Partial<ToolLayoutState<T>>;
  onPersist?: (state: ToolLayoutState<T>) => void;
  focusStore?: FocusStore;
}

export interface DockLayoutApi<T extends string> {
  state: ToolLayoutState<T>;
  dockOf: (id: T) => DockSlot | null;
  isRegionOpen: (region: ToolRegion) => boolean;
  isDockOpen: (slot: DockSlot) => boolean;
  activateWindow: (id: T) => void;
  toggleWindow: (id: T) => void;
  hideWindow: (id: T) => void;
  restoreWindow: (id: T, target?: DockSlot) => void;
  moveWindow: (id: T, target: DockSlot, insertAt?: number) => void;
  closeDock: (slot: DockSlot) => void;
  toggleRegion: (region: ToolRegion) => void;
  toggleZenMode: () => void;
  setFocusedRegion: (region: FocusRegion) => void;
  setFocusedDock: (slot: DockSlot | null) => void;
}

export function useDockLayout<T extends string>({
  windowDefs,
  windowMap,
  initial,
  onPersist,
  focusStore,
}: UseDockLayoutOptions<T>): DockLayoutApi<T> {
  const [state, setState] = useState<ToolLayoutState<T>>(() => normalizeDockLayout(initial, windowDefs, windowMap));

  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  useEffect(() => {
    persistRef.current?.(state);
  }, [state]);

  const lastActiveRef = useRef<Record<DockSlot, T | null>>({
    'left-top': null,
    'left-bottom': null,
    'right-top': null,
    'right-bottom': null,
    'bottom-left': null,
    'bottom-right': null,
  } as Record<DockSlot, T | null>);

  // Captured at toggleRegion-close: the set of slots that were active
  // right before the close. Reopening the region only restores these
  // slots — slots that just *had windows but were never activated*
  // stay closed. Without this, hitting the region collapse/expand
  // button opens every dock with a windows list, which is louder
  // than what the user had before.
  const lastRegionOpenSlotsRef = useRef<Record<ToolRegion, Set<DockSlot>>>({
    left: new Set(),
    right: new Set(),
    bottom: new Set(),
  });

  const patch = useCallback((mutate: Mutator<T>) => {
    setState((prev) => {
      const next: ToolLayoutState<T> = {
        ...prev,
        docks: cloneDocks(prev.docks),
        hidden: [...prev.hidden],
      };
      mutate(next);
      return layoutEquals(prev, next) ? prev : next;
    });
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────

  const dockOf = useCallback((id: T) => findDock(state.docks, id), [state.docks]);

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
    (id: T) => {
      let focusTarget: DockSlot | null = null;
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        next.docks[slot].active = id;
        lastActiveRef.current[slot] = id;
        focusTarget = slot;
      });
      if (focusTarget && focusStore) focusStore.setFocusedDock(focusTarget);
    },
    [patch, focusStore],
  );

  const toggleWindow = useCallback(
    (id: T) => {
      let focusTarget: DockSlot | null = null;
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        const dock = next.docks[slot];
        if (dock.active === id) {
          dock.active = null;
        } else {
          dock.active = id;
          lastActiveRef.current[slot] = id;
          focusTarget = slot;
        }
      });
      if (focusTarget && focusStore) focusStore.setFocusedDock(focusTarget);
    },
    [patch, focusStore],
  );

  const hideWindow = useCallback(
    (id: T) => {
      const def = windowMap[id];
      if (!def || def.core) return;
      patch((next) => {
        const slot = findDock(next.docks, id);
        if (!slot) return;
        removeFromDock(next.docks[slot], id);
        if (!next.hidden.includes(id)) next.hidden.push(id);
      });
    },
    [patch, windowMap],
  );

  const restoreWindow = useCallback(
    (id: T, target?: DockSlot) => {
      const def = windowMap[id];
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
    [patch, windowMap],
  );

  const moveWindow = useCallback(
    (id: T, target: DockSlot, insertAt?: number) => {
      let focusTarget: DockSlot | null = null;
      patch((next) => {
        const sourceSlot = findDock(next.docks, id);
        const wasSelected = sourceSlot !== null && next.docks[sourceSlot].active === id;
        const wasFocused = wasSelected && focusStore?.getFocusedDock() === sourceSlot;

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
          focusTarget = target;
        }
      });
      if (focusTarget && focusStore) focusStore.setFocusedDock(focusTarget);
    },
    [patch, focusStore],
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
          const openSnapshot = new Set<DockSlot>();
          for (const s of slotsInRegion) {
            if (next.docks[s].active !== null) {
              lastActiveRef.current[s] = next.docks[s].active;
              openSnapshot.add(s);
              next.docks[s].active = null;
            }
          }
          lastRegionOpenSlotsRef.current[region] = openSnapshot;
        } else {
          const snapshot = lastRegionOpenSlotsRef.current[region];
          // First-ever open of this region (no snapshot): fall back to
          // opening every slot that has a window, BUT skip any slot
          // whose candidate window is flagged `openByDefault: false`.
          // After at least one close, snapshot drives restoration so we
          // only reopen the slots the user had open.
          const restoreAll = snapshot.size === 0;
          for (const s of slotsInRegion) {
            if (!restoreAll && !snapshot.has(s)) continue;
            const remembered = lastActiveRef.current[s];
            const first = next.docks[s].windows[0] ?? null;
            const candidate = remembered && next.docks[s].windows.includes(remembered) ? remembered : first;
            if (!candidate) continue;
            if (restoreAll && windowMap[candidate]?.openByDefault === false) continue;
            next.docks[s].active = candidate;
          }
        }
      });
    },
    [patch],
  );

  const toggleZenMode = useCallback(() => {
    let clearFocus = false;
    patch((next) => {
      if (next.zenSnapshot) {
        for (const s of ALL_DOCK_SLOTS) {
          const id = next.zenSnapshot[s];
          if (!id) continue;
          if (next.docks[s].active !== null) continue;
          if (!next.docks[s].windows.includes(id)) continue;
          next.docks[s].active = id;
        }
        next.zenSnapshot = null;
        return;
      }

      const snap = {} as Record<DockSlot, T | null>;
      let anyCaptured = false;
      for (const s of ALL_DOCK_SLOTS) {
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
      clearFocus = true;
    });
    if (clearFocus && focusStore) focusStore.setFocusedDock(null);
  }, [patch, focusStore]);

  const setFocusedRegion = useCallback(
    (region: FocusRegion) => {
      focusStore?.setFocusedRegion(region);
    },
    [focusStore],
  );

  const setFocusedDock = useCallback(
    (slot: DockSlot | null) => {
      focusStore?.setFocusedDock(slot);
    },
    [focusStore],
  );

  return useMemo<DockLayoutApi<T>>(
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
      toggleZenMode,
      setFocusedRegion,
      setFocusedDock,
    ],
  );
}
