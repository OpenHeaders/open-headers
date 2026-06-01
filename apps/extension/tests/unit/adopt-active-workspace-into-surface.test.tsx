/**
 * useAdoptActiveWorkspaceIntoSurface — surface-follow on a back-end switch.
 *
 * After a switch, the data plane promotes the new host's workspace to
 * ACTIVE (an authoritative `workspaceChanged` broadcast → mirror tick).
 * This hook waits for that active to land in the live list, then re-pins
 * THIS surface's per-tab slice to it. Pins:
 *   - re-pins when the active changes to a new in-list workspace;
 *   - no-ops when the surface is already bound to the new active.
 */

import type { EditingScopeViewStateApi } from '@openheaders/ui/shared/editing-scope-view-state';
import type { WorkbenchViewState } from '@openheaders/ui/workbench/hooks/useToolLayout';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MirrorListener = () => void;

const mirror = {
  active: null as string | null,
  workspaces: [] as { id: string }[],
  listeners: new Set<MirrorListener>(),
  liveActiveWorkspaceId(): string | null {
    return this.active;
  },
  liveWorkspaces(): { id: string }[] {
    return this.workspaces;
  },
  subscribeMirror(fn: MirrorListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
  emit(active: string | null): void {
    this.active = active;
    for (const fn of this.listeners) fn();
  },
};

vi.mock('@openheaders/ui/context', () => ({
  getActiveExtensionWorkspaceSyncMirror: () => mirror,
}));

vi.mock('@openheaders/ui/workbench/hooks/useToolLayout', () => ({
  readWorkspaceFallThrough: vi.fn(async () => ({ tabs: [], activeTabId: null })),
}));

import { useAdoptActiveWorkspaceIntoSurface } from '@openheaders/ui/workbench/hooks/useAdoptActiveWorkspaceIntoSurface';

function makePerTab(boundWorkspaceId: string | null): {
  api: EditingScopeViewStateApi<WorkbenchViewState>;
  onPersist: ReturnType<typeof vi.fn>;
} {
  const onPersist = vi.fn();
  const api = {
    initial: {
      dockLayout: null,
      workspace: boundWorkspaceId ? { workspaceId: boundWorkspaceId, data: {} } : null,
    },
    onPersist,
    ready: true,
    isDonor: false,
    claimDonor: () => {},
    resetToDefaults: () => {},
  } as unknown as EditingScopeViewStateApi<WorkbenchViewState>;
  return { api, onPersist };
}

beforeEach(() => {
  mirror.active = 'ws-old';
  mirror.workspaces = [{ id: 'ws-old' }, { id: 'ws-new' }];
  mirror.listeners.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAdoptActiveWorkspaceIntoSurface', () => {
  it('re-pins the surface when the active workspace changes to a new in-list workspace', async () => {
    const { api, onPersist } = makePerTab('ws-old');
    const { result } = renderHook(() => useAdoptActiveWorkspaceIntoSurface(api));

    await act(async () => {
      const pending = result.current();
      // The new host's workspace syncs down and becomes active.
      mirror.emit('ws-new');
      await pending;
    });

    expect(onPersist).toHaveBeenCalledTimes(1);
    const updater = onPersist.mock.calls[0]![0] as (prev: WorkbenchViewState) => WorkbenchViewState;
    const next = updater(api.initial);
    expect(next.workspace?.workspaceId).toBe('ws-new');
  });

  it('does not re-pin when the surface is already bound to the new active', async () => {
    mirror.active = 'ws-old';
    const { api, onPersist } = makePerTab('ws-new');
    const { result } = renderHook(() => useAdoptActiveWorkspaceIntoSurface(api));

    await act(async () => {
      const pending = result.current();
      mirror.emit('ws-new');
      await pending;
    });

    expect(onPersist).not.toHaveBeenCalled();
  });
});
