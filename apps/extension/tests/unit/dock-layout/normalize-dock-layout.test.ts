import { describe, expect, it } from 'vitest';
import { normalizeDockLayout } from '@/shared/dock-layout/use-dock-layout';
import type { DockSlot, ToolLayoutState, ToolWindowDef } from '@/shared/dock-layout/types';

type Id = 'a' | 'b' | 'c' | 'd';

const DEFS: readonly ToolWindowDef<Id>[] = [
  { id: 'a', label: 'A', icon: null, core: true, defaultSlot: 'left-top' },
  { id: 'b', label: 'B', icon: null, core: false, defaultSlot: 'left-bottom' },
  { id: 'c', label: 'C', icon: null, core: false, defaultSlot: 'right-top' },
  { id: 'd', label: 'D', icon: null, core: false, defaultSlot: 'bottom-left' },
];

const MAP = DEFS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<Id, ToolWindowDef<Id>>,
);

const EMPTY_DOCKS = (): ToolLayoutState<Id>['docks'] => ({
  'left-top': { windows: [], active: null },
  'left-bottom': { windows: [], active: null },
  'right-top': { windows: [], active: null },
  'right-bottom': { windows: [], active: null },
  'bottom-left': { windows: [], active: null },
  'bottom-right': { windows: [], active: null },
});

describe('normalizeDockLayout', () => {
  it('returns a fresh layout with every window in its defaultSlot when raw is null', () => {
    const out = normalizeDockLayout(null, DEFS, MAP);
    expect(out.docks['left-top'].windows).toEqual(['a']);
    expect(out.docks['left-bottom'].windows).toEqual(['b']);
    expect(out.docks['right-top'].windows).toEqual(['c']);
    expect(out.docks['bottom-left'].windows).toEqual(['d']);
    expect(out.hidden).toEqual([]);
    expect(out.zenSnapshot).toBeNull();
  });

  it('round-trips a fully-specified layout (no churn)', () => {
    const docks = EMPTY_DOCKS();
    docks['right-bottom'] = { windows: ['a', 'b'], active: 'b' };
    docks['bottom-right'] = { windows: ['c'], active: 'c' };
    docks['bottom-left'] = { windows: ['d'], active: null };

    const out = normalizeDockLayout({ docks, hidden: [] }, DEFS, MAP);

    expect(out.docks['right-bottom'].windows).toEqual(['a', 'b']);
    expect(out.docks['right-bottom'].active).toBe('b');
    expect(out.docks['bottom-right'].active).toBe('c');
    expect(out.docks['bottom-left'].active).toBeNull();
    expect(out.hidden).toEqual([]);
  });

  it('drops unknown ids from docks (registry no longer contains them)', () => {
    const docks = EMPTY_DOCKS();
    docks['left-top'] = { windows: ['a', 'ghost' as Id], active: 'ghost' as Id };
    const out = normalizeDockLayout({ docks, hidden: [] }, DEFS, MAP);

    expect(out.docks['left-top'].windows).toEqual(['a']);
    expect(out.docks['left-top'].active).toBeNull();
  });

  it('drops unknown ids from hidden', () => {
    const out = normalizeDockLayout({ docks: EMPTY_DOCKS(), hidden: ['b', 'ghost' as Id] }, DEFS, MAP);
    expect(out.hidden).toEqual(['b']);
  });

  it('deduplicates a window present in two slots — first occurrence wins', () => {
    const docks = EMPTY_DOCKS();
    docks['left-top'] = { windows: ['a', 'b'], active: 'b' };
    docks['left-bottom'] = { windows: ['b', 'c'], active: 'b' };
    docks['right-top'] = { windows: ['c', 'd'], active: 'c' };
    const out = normalizeDockLayout({ docks, hidden: [] }, DEFS, MAP);

    // b kept in left-top, dropped from left-bottom
    expect(out.docks['left-top'].windows).toEqual(['a', 'b']);
    expect(out.docks['left-bottom'].windows).toEqual(['c']);
    expect(out.docks['left-bottom'].active).toBeNull(); // active was 'b', now removed → null
    // c kept in left-bottom (first occurrence), dropped from right-top
    expect(out.docks['right-top'].windows).toEqual(['d']);
    expect(out.docks['right-top'].active).toBeNull();
  });

  it('restores defaultSlot placement for registry entries missing from persisted state', () => {
    // Persisted state only mentions a + b. c and d should appear in their defaults.
    const docks = EMPTY_DOCKS();
    docks['left-top'] = { windows: ['a'], active: 'a' };
    docks['left-bottom'] = { windows: ['b'], active: 'b' };
    const out = normalizeDockLayout({ docks, hidden: [] }, DEFS, MAP);

    expect(out.docks['right-top'].windows).toEqual(['c']);
    expect(out.docks['bottom-left'].windows).toEqual(['d']);
  });

  it('clears active when it does not point to a window in its dock', () => {
    const docks = EMPTY_DOCKS();
    docks['left-top'] = { windows: ['a'], active: 'b' };
    const out = normalizeDockLayout({ docks, hidden: [] }, DEFS, MAP);
    expect(out.docks['left-top'].active).toBeNull();
  });

  it('keeps hidden and docks disjoint — a hidden id is not also placed in defaultSlot', () => {
    const out = normalizeDockLayout({ docks: EMPTY_DOCKS(), hidden: ['b'] }, DEFS, MAP);
    expect(out.hidden).toEqual(['b']);
    for (const slot of Object.keys(out.docks) as DockSlot[]) {
      expect(out.docks[slot].windows).not.toContain('b');
    }
  });

  it('zenSnapshot is always null after normalize (ephemeral, not persisted)', () => {
    const docks = EMPTY_DOCKS();
    const out = normalizeDockLayout(
      { docks, hidden: [], zenSnapshot: { 'left-top': 'a' } as never },
      DEFS,
      MAP,
    );
    expect(out.zenSnapshot).toBeNull();
  });
});
