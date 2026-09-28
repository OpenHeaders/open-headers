/**
 * useWorkspaceServer reads the EDITING SCOPE's workspace — a workbench
 * tab pinned to a joined server's workspace names that server even
 * while the host's runtime-Active workspace is the home one; outside
 * the workbench the scope falls back to the Active workspace. The place
 * mark keys off the same reader: the server row wears the Org's icon
 * only where the workspace has a server — a personal workspace's Org is
 * the one this host minted, whose icon is this browser's own.
 */

import type { IdentitySnapshot } from '@openheaders/core/identity';
import type { BackendConnection } from '@openheaders/core/types';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mirror = {
  active: 'ws-home' as string | null,
  workspaces: [
    { id: 'ws-home', orgId: 'org-home' },
    { id: 'ws-acme', orgId: 'org-acme' },
  ],
  listeners: new Set<() => void>(),
  liveActiveWorkspaceId(): string | null {
    return this.active;
  },
  liveWorkspaces(): { id: string; orgId: string }[] {
    return this.workspaces;
  },
  getMirror(): unknown {
    return { workspaces: this.workspaces };
  },
  subscribeMirror(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },
};

const SNAPSHOT = {
  user: { homeOrgId: 'org-home' },
  orgs: new Map([
    ['org-home', { id: 'org-home', name: 'Home', hostKind: 'browser', isPrivate: true }],
    ['org-acme', { id: 'org-acme', name: 'Acme', hostKind: 'daemon', isPrivate: false }],
  ]),
} as unknown as IdentitySnapshot;

const BACKENDS: BackendConnection[] = [
  { id: 'backend-1', url: 'wss://sync.openheaders.io', label: 'Acme prod', enabled: true } as BackendConnection,
];

vi.mock('@openheaders/ui/context', () => ({
  getActiveExtensionWorkspaceSyncMirror: () => mirror,
}));

// The Active-workspace reader imports the mirror module by its own
// path, not the barrel — the same fake must answer there.
vi.mock('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror')>();
  return { ...actual, getActiveExtensionWorkspaceSyncMirror: () => mirror };
});

vi.mock('@openheaders/core/identity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/identity')>();
  return { ...actual, getOrgBackendBindings: () => new Map([['org-acme', 'backend-1']]) };
});

vi.mock('@openheaders/ui/shared/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/backend')>();
  return { ...actual, useBackends: () => BACKENDS };
});

vi.mock('@openheaders/ui/shared/hooks/useIdentitySnapshot', () => ({
  useIdentitySnapshot: () => SNAPSHOT,
}));

vi.mock('@openheaders/ui/shared/hooks/useBackendSyncStatus', () => ({
  useBackendSyncStatus: () => ({ snapshot: { 'backend-1': { state: 'green', message: '' } }, isReady: true }),
}));

import { PlaceMark } from '@openheaders/ui/workbench/execution-place/PlaceMark';
import { useWorkspaceServer } from '@openheaders/ui/workbench/execution-place/useWorkspaceServer';

beforeEach(() => {
  setCurrentHost('extension');
  mirror.active = 'ws-home';
});

afterEach(cleanup);

describe('useWorkspaceServer — the editing scope', () => {
  it('names the joined server for a tab pinned to its workspace while the Active workspace is the home one', () => {
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
      <EditingScopeWorkspaceProvider workspaceId="ws-acme">{children}</EditingScopeWorkspaceProvider>
    );
    const { result } = renderHook(() => useWorkspaceServer(), { wrapper });
    expect(result.current).toEqual({ backendId: 'backend-1', name: 'Acme prod', connected: true });
  });

  it('reads the Active workspace outside the workbench', () => {
    expect(renderHook(() => useWorkspaceServer()).result.current).toBeNull();
    mirror.active = 'ws-acme';
    expect(renderHook(() => useWorkspaceServer()).result.current?.backendId).toBe('backend-1');
  });
});

describe('PlaceMark — the server row', () => {
  it("wears the bare server mark on a workspace with no server, never the home Org's browser icon", () => {
    render(
      <EditingScopeWorkspaceProvider workspaceId="ws-home">
        <PlaceMark place="workspace-server" />
      </EditingScopeWorkspaceProvider>,
    );
    expect(screen.getByTestId('execution-place-mark').getAttribute('data-mark')).toBe('host-kind');
  });

  it("wears the Org's icon where the workspace has a server", () => {
    render(
      <EditingScopeWorkspaceProvider workspaceId="ws-acme">
        <PlaceMark place="workspace-server" />
      </EditingScopeWorkspaceProvider>,
    );
    expect(screen.getByTestId('execution-place-mark').getAttribute('data-mark')).toBe('org');
  });
});
