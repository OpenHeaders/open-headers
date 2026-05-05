/**
 * Runtime coverage for `useWorkbenchWorkspaceSlice`'s mode gate
 * (BC-MWPT-2 + BC-MWPT-8). The lint test pins the structural shape
 * (mode read inside the callback BEFORE any side-effect call); these
 * tests assert the runtime contract — fire `workspaceChanged` in each
 * mode and observe the slice writes.
 *
 * The setting is read via `getSetting` (non-reactive snapshot), which
 * matches the slice owner's "read inside callback" discipline. Mode
 * flips between event-fires take effect on the very next event.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditingScopeViewStateApi } from '@/shared/editing-scope-view-state';
import type { WorkbenchViewState } from '@/workbench/hooks/useToolLayout';

type WorkspaceChangedHandler = (payload: { activeWorkspaceId: string }) => void;

const { mockSubscribe, mockGetSetting, mockFallThrough } = vi.hoisted(() => ({
  mockSubscribe: vi.fn(),
  mockGetSetting: vi.fn(),
  mockFallThrough: vi.fn(),
}));

vi.mock('@utils/bridge', () => ({
  call: vi.fn(),
  subscribe: mockSubscribe,
  broadcast: vi.fn(),
  receive: vi.fn(),
  presence: vi.fn(),
  tabCall: vi.fn(),
}));

vi.mock('@/workbench/settings/store', () => ({
  get: mockGetSetting,
}));

vi.mock('@/workbench/hooks/useToolLayout', () => ({
  readWorkspaceFallThrough: mockFallThrough,
}));

import { useWorkbenchWorkspaceSlice } from '@/workbench/hooks/useWorkbenchWorkspaceSlice';

let workspaceChangedHandler: WorkspaceChangedHandler | null = null;
let onPersist: ReturnType<typeof vi.fn>;
let perTab: EditingScopeViewStateApi<WorkbenchViewState>;

beforeEach(() => {
  workspaceChangedHandler = null;
  onPersist = vi.fn();
  mockSubscribe.mockReset();
  mockGetSetting.mockReset();
  mockFallThrough.mockReset();
  mockSubscribe.mockImplementation((type: string, handler: WorkspaceChangedHandler) => {
    if (type === 'workspaceChanged') workspaceChangedHandler = handler;
    return () => undefined;
  });
  mockFallThrough.mockResolvedValue({ workspaceId: 'ws-next' });
  // Minimal stand-in — slice owner only consumes `onPersist`.
  perTab = { onPersist, initial: {}, ready: true } as unknown as EditingScopeViewStateApi<WorkbenchViewState>;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useWorkbenchWorkspaceSlice — mode gate', () => {
  it('global mode rebinds the slice on workspaceChanged (BC-MWPT-2 baseline)', async () => {
    mockGetSetting.mockReturnValue('global');
    renderHook(() => useWorkbenchWorkspaceSlice(perTab));
    expect(workspaceChangedHandler).toBeTruthy();

    await act(async () => {
      workspaceChangedHandler?.({ activeWorkspaceId: 'ws-next' });
      // Drain the microtask scheduled inside the handler.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFallThrough).toHaveBeenCalledWith('ws-next');
    expect(onPersist).toHaveBeenCalledTimes(1);
  });

  it('per-tab mode skips fall-through + onPersist on workspaceChanged (BC-MWPT-8)', async () => {
    mockGetSetting.mockReturnValue('per-window-or-tab');
    renderHook(() => useWorkbenchWorkspaceSlice(perTab));

    await act(async () => {
      workspaceChangedHandler?.({ activeWorkspaceId: 'ws-next' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFallThrough).not.toHaveBeenCalled();
    expect(onPersist).not.toHaveBeenCalled();
  });

  it('mid-session mode flip takes effect on the next event (BC-MWPT-2 closure-capture trap)', async () => {
    // Mount with global mode, fire once → side effects.
    mockGetSetting.mockReturnValue('global');
    renderHook(() => useWorkbenchWorkspaceSlice(perTab));

    await act(async () => {
      workspaceChangedHandler?.({ activeWorkspaceId: 'ws-a' });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onPersist).toHaveBeenCalledTimes(1);

    // Flip to per-tab (the user toggles the setting). The slice owner
    // MUST read the new mode on the next event; closure-captured mode
    // would still rebind here and break per-tab divergence.
    mockGetSetting.mockReturnValue('per-window-or-tab');
    await act(async () => {
      workspaceChangedHandler?.({ activeWorkspaceId: 'ws-b' });
      await Promise.resolve();
      await Promise.resolve();
    });
    // No new onPersist call — the per-tab mode short-circuit fired.
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(mockFallThrough).toHaveBeenCalledTimes(1);
  });
});
