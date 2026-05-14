/**
 * useEditingScopeViewState — unit tests covering the bug-class predictions in
 * `docs/PER_WINDOW_OR_TAB_VIEW_STATE_DESIGN.md` § 16:
 *   - BC-V2 — schema-mismatched payloads silently fall through.
 *   - BC-V4 — sessionStorage survives reload (re-mount uses persisted snapshot).
 *   - BC-V5 — all-tabs-closed → next tab inherits last-published donor record.
 *   - BC-V7 — sessionStorage quota exceptions don't crash the loader.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet, mockRemove } = vi.hoisted(() => ({
  mockGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockSet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
  mockRemove: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@openheaders/core/storage', async () => {
  const real = await vi.importActual<typeof import('@openheaders/core/storage')>('@openheaders/core/storage');
  return {
    ...real,
    hostStorage: {
      get: mockGet,
      set: mockSet,
      remove: mockRemove,
      subscribe: vi.fn(() => () => undefined),
    },
  };
});

import { useEditingScopeViewState } from '@/shared/editing-scope-view-state/use-editing-scope-view-state';

interface ViewState {
  dockLayout: { foo: string };
}

const FACTORY: ViewState = { dockLayout: { foo: 'factory' } };

beforeEach(() => {
  mockGet.mockReset();
  mockSet.mockReset();
  mockRemove.mockReset();
  mockGet.mockResolvedValue(undefined);
  mockSet.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useEditingScopeViewState', () => {
  it('uses factoryDefault when both sessionStorage and donor record are empty', async () => {
    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toEqual(FACTORY);
  });

  it('BC-V5: cold-start falls through to donor record when sessionStorage is empty', async () => {
    const donorSnapshot = { dockLayout: { foo: 'donor' } };
    mockGet.mockResolvedValueOnce({
      donorTabUid: 'old-tab',
      schemaVersion: 1,
      publishedAt: 0,
      snapshot: donorSnapshot,
    });

    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toEqual(donorSnapshot);
  });

  it('BC-V4: sessionStorage envelope is reused on re-mount', async () => {
    const sessionSnap = { dockLayout: { foo: 'fromSession' } };
    sessionStorage.setItem(
      'oh.viewState.workbench',
      JSON.stringify({ tabUid: 'tab-A', schemaVersion: 1, snapshot: sessionSnap }),
    );

    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    expect(hook.result.current.ready).toBe(true); // synchronous from sessionStorage
    expect(hook.result.current.initial).toEqual(sessionSnap);
    // The donor record is NOT consulted when sessionStorage already has data.
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('BC-V2: schema-mismatched sessionStorage envelope is rejected', async () => {
    sessionStorage.setItem(
      'oh.viewState.workbench',
      JSON.stringify({ tabUid: 't', schemaVersion: 99, snapshot: { dockLayout: { foo: 'old' } } }),
    );
    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toEqual(FACTORY);
  });

  it('BC-V2: schema-mismatched donor record is rejected', async () => {
    mockGet.mockResolvedValueOnce({
      donorTabUid: 'old',
      schemaVersion: 99,
      publishedAt: 0,
      snapshot: { dockLayout: { foo: 'old' } },
    });
    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial).toEqual(FACTORY);
  });

  it('onPersist updates sessionStorage synchronously via the setter form', async () => {
    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));

    act(() => {
      hook.result.current.onPersist((prev) => ({ ...prev, dockLayout: { foo: 'edited' } }));
    });

    const raw = sessionStorage.getItem('oh.viewState.workbench');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { snapshot: ViewState };
    expect(parsed.snapshot.dockLayout.foo).toBe('edited');
  });

  it('normalize is applied to inherited donor snapshot', async () => {
    mockGet.mockResolvedValueOnce({
      donorTabUid: 'old-tab',
      schemaVersion: 1,
      publishedAt: 0,
      snapshot: { dockLayout: { foo: 'donor' } },
    });
    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
        normalize: (raw) => ({ dockLayout: { foo: `normalized:${raw.dockLayout.foo}` } }),
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial.dockLayout.foo).toBe('normalized:donor');
  });

  it('BC-V7: sessionStorage write failure does not throw', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      const hook = renderHook(() =>
        useEditingScopeViewState<ViewState>({
          surface: 'workbench',
          schemaVersion: 1,
          factoryDefault: FACTORY,
        }),
      );
      await waitFor(() => expect(hook.result.current.ready).toBe(true));
      // onPersist must not throw even when sessionStorage rejects.
      expect(() => {
        act(() => {
          hook.result.current.onPersist((prev) => ({ ...prev, dockLayout: { foo: 'x' } }));
        });
      }).not.toThrow();
    } finally {
      setItemSpy.mockRestore();
    }
  });

  it('BC-V21: resolveSnapshot rebuilds workspace slice on cross-workspace inheritance', async () => {
    interface WS {
      dockLayout: { foo: string };
      workspace: { workspaceId: string; data: { editorTabs: { tabs: string[]; activeTabId: string | null } } } | null;
    }
    const factory: WS = { dockLayout: { foo: 'factory' }, workspace: null };
    // Donor was captured in workspace 'other'.
    mockGet.mockResolvedValueOnce({
      donorTabUid: 'donor-tab',
      schemaVersion: 1,
      publishedAt: 0,
      snapshot: {
        dockLayout: { foo: 'inherited' },
        workspace: { workspaceId: 'other', data: { editorTabs: { tabs: ['leak-from-other'], activeTabId: 'leak' } } },
      } satisfies WS,
    });
    const fallThrough = vi.fn(async (id: string) => ({ editorTabs: { tabs: [`from-${id}`], activeTabId: `from-${id}` } }));
    const resolveSnapshot = async (raw: WS): Promise<WS> => {
      const activeId = 'active';
      if (raw.workspace?.workspaceId === activeId) return raw;
      const data = await fallThrough(activeId);
      return { ...raw, workspace: { workspaceId: activeId, data } };
    };
    const hook = renderHook(() =>
      useEditingScopeViewState<WS>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: factory,
        resolveSnapshot,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    // Donor's dockLayout (universal field) is inherited.
    expect(hook.result.current.initial.dockLayout).toEqual({ foo: 'inherited' });
    // Foreign workspace slice was REPLACED — not inherited.
    expect(hook.result.current.initial.workspace).toEqual({
      workspaceId: 'active',
      data: { editorTabs: { tabs: ['from-active'], activeTabId: 'from-active' } },
    });
    expect(fallThrough).toHaveBeenCalledWith('active');
  });

  it('BC-V21: resolveSnapshot keeps slice when donor workspaceId matches active', async () => {
    interface WS {
      dockLayout: { foo: string };
      workspace: { workspaceId: string; data: { editorTabs: { tabs: string[]; activeTabId: string | null } } } | null;
    }
    const factory: WS = { dockLayout: { foo: 'factory' }, workspace: null };
    mockGet.mockResolvedValueOnce({
      donorTabUid: 'donor-tab',
      schemaVersion: 1,
      publishedAt: 0,
      snapshot: {
        dockLayout: { foo: 'd' },
        workspace: { workspaceId: 'active', data: { editorTabs: { tabs: ['preserved'], activeTabId: 'preserved' } } },
      } satisfies WS,
    });
    const fallThrough = vi.fn(async () => ({ editorTabs: { tabs: ['SHOULD-NOT-BE-USED'], activeTabId: null } }));
    const resolveSnapshot = async (raw: WS): Promise<WS> => {
      const activeId = 'active';
      if (raw.workspace?.workspaceId === activeId) return raw;
      const data = await fallThrough();
      return { ...raw, workspace: { workspaceId: activeId, data } };
    };
    const hook = renderHook(() =>
      useEditingScopeViewState<WS>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: factory,
        resolveSnapshot,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    expect(hook.result.current.initial.workspace?.data.editorTabs.tabs).toEqual(['preserved']);
    expect(fallThrough).not.toHaveBeenCalled();
  });

  it('resetToDefaults clears donor record and reloads the page', async () => {
    sessionStorage.setItem(
      'oh.viewState.workbench',
      JSON.stringify({ tabUid: 't', schemaVersion: 1, snapshot: FACTORY }),
    );
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: reloadSpy },
    });

    const hook = renderHook(() =>
      useEditingScopeViewState<ViewState>({
        surface: 'workbench',
        schemaVersion: 1,
        factoryDefault: FACTORY,
      }),
    );
    await waitFor(() => expect(hook.result.current.ready).toBe(true));

    act(() => {
      hook.result.current.resetToDefaults();
    });

    expect(sessionStorage.getItem('oh.viewState.workbench')).toBeNull();
    expect(mockRemove).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });
});
