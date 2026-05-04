import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDockLayout } from '@/shared/dock-layout/use-dock-layout';
import { createFocusStore } from '@/shared/dock-layout/focus-store';
import { ALL_DOCK_SLOTS } from '@/shared/dock-layout/constants';
import type { DockSlot, ToolWindowDef } from '@/shared/dock-layout/types';

type Id = 'core' | 'a' | 'b' | 'c' | 'd';

const DEFS: readonly ToolWindowDef<Id>[] = [
  { id: 'core', label: 'Core', icon: null, core: true, defaultSlot: 'left-top' },
  { id: 'a', label: 'A', icon: null, core: false, defaultSlot: 'left-bottom' },
  { id: 'b', label: 'B', icon: null, core: false, defaultSlot: 'right-top' },
  { id: 'c', label: 'C', icon: null, core: false, defaultSlot: 'right-bottom' },
  { id: 'd', label: 'D', icon: null, core: false, defaultSlot: 'bottom-left' },
];

const MAP = DEFS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<Id, ToolWindowDef<Id>>,
);

function setup(initialActive?: Partial<Record<DockSlot, Id>>) {
  const focusStore = createFocusStore();
  const initial = initialActive
    ? {
        docks: ALL_DOCK_SLOTS.reduce(
          (acc, s) => {
            acc[s] = { windows: [], active: null };
            return acc;
          },
          {} as Record<DockSlot, { windows: Id[]; active: Id | null }>,
        ),
        hidden: [] as Id[],
      }
    : undefined;
  if (initial && initialActive) {
    for (const def of DEFS) {
      initial.docks[def.defaultSlot].windows.push(def.id);
    }
    for (const [slot, id] of Object.entries(initialActive) as [DockSlot, Id][]) {
      initial.docks[slot].active = id;
    }
  }
  const hook = renderHook(() =>
    useDockLayout<Id>({ windowDefs: DEFS, windowMap: MAP, initial, focusStore }),
  );
  return { hook, focusStore };
}

describe('useDockLayout', () => {
  describe('invariants', () => {
    it('hideWindow + restoreWindow keeps hidden and docks disjoint', () => {
      const { hook } = setup({ 'left-bottom': 'a' });
      act(() => hook.result.current.hideWindow('a'));
      expect(hook.result.current.state.hidden).toContain('a');
      expect(hook.result.current.state.docks['left-bottom'].windows).not.toContain('a');

      act(() => hook.result.current.restoreWindow('a'));
      expect(hook.result.current.state.hidden).not.toContain('a');
      expect(hook.result.current.state.docks['left-bottom'].windows).toContain('a');
    });

    it('moveWindow keeps a window in only one slot', () => {
      const { hook } = setup({ 'left-bottom': 'a' });
      act(() => hook.result.current.moveWindow('a', 'right-bottom'));

      const docks = hook.result.current.state.docks;
      const occurrences = ALL_DOCK_SLOTS.reduce(
        (n, s) => n + (docks[s].windows.includes('a') ? 1 : 0),
        0,
      );
      expect(occurrences).toBe(1);
      expect(docks['right-bottom'].windows).toContain('a');
    });

    it('core windows cannot be hidden', () => {
      const { hook } = setup({ 'left-top': 'core' });
      const before = hook.result.current.state;
      act(() => hook.result.current.hideWindow('core'));
      expect(hook.result.current.state).toBe(before); // no-op, same reference
      expect(hook.result.current.state.hidden).not.toContain('core');
      expect(hook.result.current.state.docks['left-top'].windows).toContain('core');
    });

    it('removing the active window clears the dock active', () => {
      const { hook } = setup({ 'right-top': 'b' });
      act(() => hook.result.current.hideWindow('b'));
      expect(hook.result.current.state.docks['right-top'].active).toBeNull();
    });

    it('layoutEquals short-circuits — no-op patch returns same state reference', () => {
      const { hook } = setup({ 'left-bottom': 'a' });
      const before = hook.result.current.state;
      act(() => hook.result.current.activateWindow('a')); // already active
      expect(hook.result.current.state).toBe(before);
    });
  });

  describe('toggleWindow', () => {
    it('opens a docked window and focuses its dock', () => {
      const { hook, focusStore } = setup();
      act(() => hook.result.current.toggleWindow('a'));
      expect(hook.result.current.state.docks['left-bottom'].active).toBe('a');
      expect(focusStore.getFocusedDock()).toBe('left-bottom');
    });

    it('toggles closed when called on the active window (does not change focus)', () => {
      const { hook } = setup({ 'left-bottom': 'a' });
      act(() => hook.result.current.toggleWindow('a'));
      expect(hook.result.current.state.docks['left-bottom'].active).toBeNull();
    });
  });

  describe('toggleRegion', () => {
    it('collapses an open region and remembers active windows for restore', () => {
      const { hook } = setup({ 'left-top': 'core', 'left-bottom': 'a' });
      act(() => hook.result.current.toggleRegion('left'));
      expect(hook.result.current.state.docks['left-top'].active).toBeNull();
      expect(hook.result.current.state.docks['left-bottom'].active).toBeNull();

      act(() => hook.result.current.toggleRegion('left'));
      // last-active memory restores the same windows
      expect(hook.result.current.state.docks['left-top'].active).toBe('core');
      expect(hook.result.current.state.docks['left-bottom'].active).toBe('a');
    });

    it('opens a fully-closed region by activating the first window in each slot', () => {
      // a is in left-bottom by default but no active set
      const { hook } = setup();
      // Region is closed (nothing active).
      expect(hook.result.current.state.docks['left-top'].active).toBeNull();
      act(() => hook.result.current.toggleRegion('left'));
      expect(hook.result.current.state.docks['left-top'].active).toBe('core');
      expect(hook.result.current.state.docks['left-bottom'].active).toBe('a');
    });
  });

  describe('toggleZenMode', () => {
    it('captures all active windows, collapses them, and restores on second call', () => {
      const { hook } = setup({ 'left-top': 'core', 'right-top': 'b', 'bottom-left': 'd' });
      act(() => hook.result.current.toggleZenMode());

      expect(hook.result.current.state.zenSnapshot).not.toBeNull();
      for (const s of ALL_DOCK_SLOTS) {
        expect(hook.result.current.state.docks[s].active).toBeNull();
      }

      act(() => hook.result.current.toggleZenMode());
      expect(hook.result.current.state.zenSnapshot).toBeNull();
      expect(hook.result.current.state.docks['left-top'].active).toBe('core');
      expect(hook.result.current.state.docks['right-top'].active).toBe('b');
      expect(hook.result.current.state.docks['bottom-left'].active).toBe('d');
    });

    it('no-ops when nothing is active (anyCaptured = false)', () => {
      const { hook } = setup();
      const before = hook.result.current.state;
      act(() => hook.result.current.toggleZenMode());
      expect(hook.result.current.state).toBe(before);
    });

    it('clears focused dock on entering zen', () => {
      const { hook, focusStore } = setup({ 'left-bottom': 'a' });
      act(() => hook.result.current.activateWindow('a'));
      expect(focusStore.getFocusedDock()).toBe('left-bottom');
      act(() => hook.result.current.toggleZenMode());
      expect(focusStore.getFocusedDock()).toBeNull();
    });
  });

  describe('moveWindow', () => {
    it('preserves active selection when the moved window was selected', () => {
      const { hook } = setup({ 'left-bottom': 'a' });
      act(() => hook.result.current.moveWindow('a', 'bottom-right'));
      expect(hook.result.current.state.docks['bottom-right'].active).toBe('a');
      expect(hook.result.current.state.docks['left-bottom'].active).toBeNull();
    });

    it('inserts at requested index, clamped to bounds', () => {
      const { hook } = setup();
      // left-bottom default has just 'a'; move b into index 0
      act(() => hook.result.current.moveWindow('b', 'left-bottom', 0));
      expect(hook.result.current.state.docks['left-bottom'].windows).toEqual(['b', 'a']);

      // out-of-bounds index → clamped to end
      act(() => hook.result.current.moveWindow('c', 'left-bottom', 999));
      expect(hook.result.current.state.docks['left-bottom'].windows).toEqual(['b', 'a', 'c']);
    });

    it('removes from hidden when moving a previously-hidden window', () => {
      const { hook } = setup({ 'left-bottom': 'a' });
      act(() => hook.result.current.hideWindow('a'));
      expect(hook.result.current.state.hidden).toContain('a');
      act(() => hook.result.current.moveWindow('a', 'right-bottom'));
      expect(hook.result.current.state.hidden).not.toContain('a');
      expect(hook.result.current.state.docks['right-bottom'].windows).toContain('a');
    });
  });

  describe('queries', () => {
    it('dockOf returns the window slot or null', () => {
      const { hook } = setup();
      expect(hook.result.current.dockOf('a')).toBe('left-bottom');
      act(() => hook.result.current.hideWindow('a'));
      expect(hook.result.current.dockOf('a')).toBeNull();
    });

    it('isRegionOpen reflects active state in the region', () => {
      const { hook } = setup({ 'right-top': 'b' });
      expect(hook.result.current.isRegionOpen('right')).toBe(true);
      expect(hook.result.current.isRegionOpen('bottom')).toBe(false);
    });

    it('isDockOpen reflects per-slot active', () => {
      const { hook } = setup({ 'right-top': 'b' });
      expect(hook.result.current.isDockOpen('right-top')).toBe(true);
      expect(hook.result.current.isDockOpen('right-bottom')).toBe(false);
    });
  });

  it('calls onPersist after each state change', () => {
    const calls: Array<{ activeLeftBottom: Id | null }> = [];
    const hook = renderHook(() =>
      useDockLayout<Id>({
        windowDefs: DEFS,
        windowMap: MAP,
        onPersist: (s) => calls.push({ activeLeftBottom: s.docks['left-bottom'].active }),
      }),
    );
    expect(calls.length).toBe(1); // initial commit
    act(() => hook.result.current.toggleWindow('a'));
    expect(calls.at(-1)?.activeLeftBottom).toBe('a');
  });
});
