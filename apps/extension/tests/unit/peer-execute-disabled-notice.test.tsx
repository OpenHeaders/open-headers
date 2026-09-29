/**
 * The peer-execute refusal notice names WHOSE switch refused: the local
 * tier is the desktop app on this machine; the remote tier reads the
 * editing scope's Org — a standalone server keeps its switch in Server
 * Admin › Server (the served tab opens it in place for an admin, every
 * other host offers the server's page), a desktop app on another
 * machine keeps the Backup and Sync wording only that machine can act on.
 */

import type { IdentitySnapshot } from '@openheaders/core/identity';
import { LOCAL_PEER_EXECUTE_DISABLED_MESSAGE, REMOTE_PEER_EXECUTE_DISABLED_MESSAGE } from '@openheaders/core/protocol';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  orgId: null as string | null,
  server: null as { backendId: string; name: string | null; connected: boolean } | null,
  adminStatus: 'denied' as 'unknown' | 'admin' | 'denied',
  serverPage: null as string | null,
  openServerPage: vi.fn(),
  postServerAdminReveal: vi.fn(),
}));

const SNAPSHOT = {
  user: { homeOrgId: 'org-home' },
  orgs: new Map([
    ['org-home', { id: 'org-home', name: 'Home', hostKind: 'browser', isPrivate: true }],
    ['org-acme', { id: 'org-acme', name: 'Acme', hostKind: 'daemon', isPrivate: false }],
    ['org-lan', { id: 'org-lan', name: 'Nora’s Mac', hostKind: 'desktop', isPrivate: false }],
  ]),
} as unknown as IdentitySnapshot;

vi.mock('@openheaders/ui/workbench/execution-place/useWorkspaceServer', () => ({
  useEditingScopeOrgId: () => h.orgId,
  useWorkspaceServer: () => h.server,
}));

vi.mock('@openheaders/ui/shared/hooks/useIdentitySnapshot', () => ({
  useIdentitySnapshot: () => SNAPSHOT,
}));

vi.mock('@openheaders/ui/shared/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/backend')>();
  return { ...actual, useBackends: () => [] };
});

vi.mock('@openheaders/ui/shared/hooks/useBackendSyncStatus', () => ({
  useBackendSyncStatus: () => ({ snapshot: {}, isReady: true }),
}));

vi.mock('@openheaders/ui/workbench/components/server-admin/use-server-admin-status', () => ({
  useServerAdminStatus: () => h.adminStatus,
}));

vi.mock('@openheaders/ui/shared/workspace-org/server-page', () => ({
  serverPageForOrg: () => h.serverPage,
  openServerPage: (url: string) => h.openServerPage(url),
}));

vi.mock('@openheaders/ui/workbench/data/server-admin-reveal', () => ({
  postServerAdminReveal: (section: string) => h.postServerAdminReveal(section),
}));

import PeerExecuteDisabledNotice, {
  peerExecuteRefusalKind,
} from '@openheaders/ui/workbench/components/shared/PeerExecuteDisabledNotice';

beforeEach(() => {
  setCurrentHost('extension');
  h.orgId = 'org-acme';
  h.server = { backendId: 'backend-1', name: 'Access Rig', connected: true };
  h.adminStatus = 'denied';
  h.serverPage = 'http://127.0.0.1:19337';
  h.openServerPage.mockReset();
  h.postServerAdminReveal.mockReset();
});

afterEach(cleanup);

describe('peerExecuteRefusalKind', () => {
  it('reads the two wire constants and nothing else', () => {
    expect(peerExecuteRefusalKind(LOCAL_PEER_EXECUTE_DISABLED_MESSAGE)).toBe('local');
    expect(peerExecuteRefusalKind(REMOTE_PEER_EXECUTE_DISABLED_MESSAGE)).toBe('remote');
    expect(peerExecuteRefusalKind('boom')).toBeNull();
    expect(peerExecuteRefusalKind(undefined)).toBeNull();
  });
});

describe('PeerExecuteDisabledNotice — the remote tier answered by a server', () => {
  it('names the server and Server Admin › Server, and offers the server’s page outside on the extension', () => {
    render(<PeerExecuteDisabledNotice kind="remote" />);
    const notice = screen.getByTestId('peer-execute-disabled-notice');
    expect(notice.getAttribute('data-place')).toBe('server');
    expect(notice.textContent).toContain('Running requests for connected devices is turned off on Access Rig.');
    expect(notice.textContent).toContain('under Server Admin › Server.');
    expect(screen.queryByTestId('peer-execute-open-server-admin')).toBeNull();
    fireEvent.click(screen.getByTestId('peer-execute-open-place'));
    expect(h.openServerPage).toHaveBeenCalledWith('http://127.0.0.1:19337');
    expect(screen.getByTestId('peer-execute-open-place').textContent).toBe('Open Access Rig');
  });

  it('opens the Server domain in place on the served tab for an admin, and offers nothing to a viewer', () => {
    setCurrentHost('web');
    h.adminStatus = 'admin';
    render(<PeerExecuteDisabledNotice kind="remote" />);
    expect(screen.queryByTestId('peer-execute-open-place')).toBeNull();
    fireEvent.click(screen.getByTestId('peer-execute-open-server-admin'));
    expect(h.postServerAdminReveal).toHaveBeenCalledWith('server');
    cleanup();
    h.adminStatus = 'denied';
    render(<PeerExecuteDisabledNotice kind="remote" />);
    expect(screen.queryByTestId('peer-execute-open-server-admin')).toBeNull();
    expect(screen.queryByTestId('peer-execute-open-place')).toBeNull();
  });

  it('falls back to the Org’s name, then the role word, when the server record is nameless or gone', () => {
    h.server = null;
    render(<PeerExecuteDisabledNotice kind="remote" />);
    expect(screen.getByTestId('peer-execute-disabled-notice').textContent).toContain('turned off on Acme.');
    cleanup();
    h.orgId = null;
    h.serverPage = null;
    render(<PeerExecuteDisabledNotice kind="remote" />);
    // No Org to read — the remote tier keeps its host-neutral wording.
    const notice = screen.getByTestId('peer-execute-disabled-notice');
    expect(notice.getAttribute('data-place')).toBe('remote-desktop-app');
    expect(notice.textContent).toContain('Backup and Sync › Your devices on that machine.');
  });
});

describe('PeerExecuteDisabledNotice — the other tiers', () => {
  it('a desktop app on another machine keeps the Backup and Sync wording and no action', () => {
    h.orgId = 'org-lan';
    h.server = { backendId: 'backend-2', name: 'Nora’s Mac', connected: true };
    render(<PeerExecuteDisabledNotice kind="remote" />);
    const notice = screen.getByTestId('peer-execute-disabled-notice');
    expect(notice.getAttribute('data-place')).toBe('remote-desktop-app');
    expect(notice.textContent).toContain('Sending from other devices is turned off on the connected host.');
    expect(screen.queryByTestId('peer-execute-open-place')).toBeNull();
    expect(screen.queryByTestId('peer-execute-open-server-admin')).toBeNull();
  });

  it('the local tier names the desktop app on this machine and, with no connected app, no action', () => {
    render(<PeerExecuteDisabledNotice kind="local" />);
    const notice = screen.getByTestId('peer-execute-disabled-notice');
    expect(notice.getAttribute('data-place')).toBe('desktop-app');
    expect(notice.textContent).toContain('turned off in the desktop app.');
    expect(screen.queryByTestId('peer-execute-enable-cta')).toBeNull();
    expect(screen.queryByTestId('peer-execute-open-place')).toBeNull();
  });
});
