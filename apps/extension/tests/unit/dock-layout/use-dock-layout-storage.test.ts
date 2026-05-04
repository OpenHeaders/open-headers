/**
 * Tests for useDockLayoutStorage — debounced write-through to
 * extensionStorage with Web Lock serialization. We mock the storage
 * adapter to assert call counts and use fake timers for the debounce.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolLayoutState } from '@/shared/dock-layout/types';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockSet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@/shared/storage', async () => {
  const real = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...real,
    extensionStorage: {
      get: mockGet,
      set: mockSet,
      getMany: vi.fn(async () => ({})),
      remove: vi.fn(async () => undefined),
    },
  };
});

import { useDockLayoutStorage } from '@/shared/dock-layout/use-dock-layout-storage';

type Id = 'a' | 'b';

const ACTIVE_LAYOUT: ToolLayoutState<Id> = {
  docks: {
    'left-top': { windows: ['a'], active: 'a' },
    'left-bottom': { windows: ['b'], active: null },
    'right-top': { windows: [], active: null },
    'right-bottom': { windows: [], active: null },
    'bottom-left': { windows: [], active: null },
    'bottom-right': { windows: [], active: null },
  },
  hidden: [],
  zenSnapshot: null,
};

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockGet.mockResolvedValue(undefined);
  mockSet.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDockLayoutStorage', () => {
  it('returns ready=true after the storage read settles; initial=null on fresh profile', async () => {
    const hook = renderHook(() => useDockLayoutStorage<Id>('testKey'));

    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toBeNull();
    expect(mockGet).toHaveBeenCalled();
  });

  it('exposes persisted state via initial when storage returns a layout with docks', async () => {
    mockGet.mockResolvedValueOnce({ docks: ACTIVE_LAYOUT.docks, hidden: [] });
    const hook = renderHook(() => useDockLayoutStorage<Id>('testKey'));

    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toEqual({ docks: ACTIVE_LAYOUT.docks, hidden: [] });
  });

  it('ignores persisted payload that has no docks (corrupted/legacy)', async () => {
    mockGet.mockResolvedValueOnce({ hidden: ['a'] });
    const hook = renderHook(() => useDockLayoutStorage<Id>('testKey'));

    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toBeNull();
  });

  it('debounces onPersist — many calls within 500ms result in one write', async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useDockLayoutStorage<Id>('testKey'));

    act(() => {
      for (let i = 0; i < 10; i++) hook.result.current.onPersist(ACTIVE_LAYOUT);
    });
    expect(mockSet).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    // Drain the microtask queue created by the lock fallback / promise chain.
    await vi.waitFor(() => expect(mockSet).toHaveBeenCalledTimes(1));
  });

  it('strips zenSnapshot before writing', async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useDockLayoutStorage<Id>('testKey'));

    const withZen: ToolLayoutState<Id> = {
      ...ACTIVE_LAYOUT,
      zenSnapshot: {
        'left-top': 'a',
        'left-bottom': null,
        'right-top': null,
        'right-bottom': null,
        'bottom-left': null,
        'bottom-right': null,
      },
    };
    act(() => hook.result.current.onPersist(withZen));
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    await vi.waitFor(() => expect(mockSet).toHaveBeenCalledOnce());

    const payload = mockSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('zenSnapshot');
    expect(payload).toEqual({ docks: ACTIVE_LAYOUT.docks, hidden: [] });
  });

  it('cancels a pending write when a new onPersist arrives before the timer fires', async () => {
    vi.useFakeTimers();
    const hook = renderHook(() => useDockLayoutStorage<Id>('testKey'));

    act(() => hook.result.current.onPersist(ACTIVE_LAYOUT));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mockSet).not.toHaveBeenCalled();

    // Updated state arrives — timer resets.
    const updated = { ...ACTIVE_LAYOUT, hidden: ['b' as Id] };
    act(() => hook.result.current.onPersist(updated));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mockSet).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    await vi.waitFor(() => expect(mockSet).toHaveBeenCalledOnce());
    const payload = mockSet.mock.calls[0][1] as { hidden: Id[] };
    expect(payload.hidden).toEqual(['b']);
  });
});
