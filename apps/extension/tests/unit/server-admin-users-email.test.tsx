/**
 * The server-admin Users tab's invite identity and credential (the client
 * sign-in plan D5): a User is admitted with an email or not at all —
 * the add form's required rule; the initial-password field appears
 * only where the server says a password is how a person signs in; an
 * email-less row offers "Set email" first and holds its password action
 * back with the reason; a row with an email keeps the plain password
 * action and no repair.
 */

import ServerAdminTab from '@openheaders/ui/workbench/components/server-admin/ServerAdminTab';
import { __resetServerAdminStatusForTests } from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Ant's responsive observer (List) probes matchMedia, which jsdom lacks.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const { mockCall, mockSubscribe } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mockSubscribe: vi.fn(),
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: mockSubscribe, broadcast: vi.fn(), presence: vi.fn() },
  };
});

vi.mock('@openheaders/ui/workbench/settings/components/backend-tokens-section', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/settings/components/git/git-workspace-card', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/server-admin/ServerAuditReports', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/server-admin/ServerBuildSection', () => ({ default: () => null }));

function directoryUser(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    displayName: 'John Doe',
    email: null,
    gitEmail: null,
    createdAt: 1756000000000,
    deactivatedAt: null,
    lastSeenAt: null,
    hasPassword: false,
    mayCreateWorkspaces: false,
    isDaemonAdmin: false,
    grants: [{ workspaceId: 'w-alpha', role: 'editor' }],
    ...overrides,
  };
}

const DIRECTORY = {
  users: [
    directoryUser({ userId: 'u-nomail', displayName: 'Jane Doe' }),
    directoryUser({ userId: 'u-mail', displayName: 'John Doe', email: 'john@openheaders.io' }),
  ],
};

let authMeta: { passwordLogin: boolean; ssoProvider: string | null } | null;

beforeEach(() => {
  __resetServerAdminStatusForTests();
  mockCall.mockReset();
  mockSubscribe.mockReset();
  mockSubscribe.mockReturnValue(() => {});
  authMeta = { passwordLogin: true, ssoProvider: null };
  mockCall.mockImplementation((channel: string) => {
    switch (channel) {
      case 'oh.daemon.admin.status':
        return Promise.resolve({ admin: true });
      case 'oh.daemon.users.list':
        return Promise.resolve(DIRECTORY);
      case 'oh.daemon.workspaces.list':
        return Promise.resolve({ workspaces: [{ id: 'w-alpha', name: 'Alpha' }] });
      case 'oh.daemon.auth.meta':
        // An older server has no such channel: the call rejects.
        return authMeta ? Promise.resolve(authMeta) : Promise.reject(new Error('unknown channel'));
      case 'oh.daemon.users.setEmail':
        return Promise.resolve({ ok: true });
      default:
        return Promise.resolve({});
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('server-admin Users tab — the invite identity and credential', () => {
  it('refuses to admit a User without an email, and says why', async () => {
    render(<ServerAdminTab section="users" />);
    const name = await screen.findByTestId('server-admin-add-name');
    expect((screen.getByTestId('server-admin-add-email') as HTMLInputElement).placeholder).toBe('Email');
    fireEvent.change(name, { target: { value: 'Alice' } });
    fireEvent.click(screen.getByTestId('server-admin-add-user'));
    expect(await screen.findByText('Email is required. Users sign in with it.')).toBeTruthy();
    expect(mockCall.mock.calls.some(([channel]) => channel === 'oh.daemon.users.create')).toBe(false);
  });

  it('offers the initial password only where a password is how the person signs in', async () => {
    render(<ServerAdminTab section="users" />);
    const field = await screen.findByTestId('server-admin-add-password');
    expect((field as HTMLInputElement).placeholder).toBe('Initial password (optional)');
    cleanup();
    authMeta = { passwordLogin: false, ssoProvider: 'Example SSO' };
    render(<ServerAdminTab section="users" />);
    await screen.findByTestId('server-admin-add-name');
    expect(screen.queryByTestId('server-admin-add-password')).toBeNull();
    cleanup();
    authMeta = null;
    render(<ServerAdminTab section="users" />);
    await screen.findByTestId('server-admin-add-name');
    expect(screen.queryByTestId('server-admin-add-password')).toBeNull();
  });

  it('an email-less row offers Set email and holds the password action; a row with an email does not', async () => {
    // The repair's toast rides antd's App context, which the tab
    // expects its shell to provide.
    render(
      <AntApp>
        <ServerAdminTab section="users" />
      </AntApp>,
    );
    const repair = await screen.findByTestId('server-admin-email-u-nomail');
    expect((screen.getByTestId('server-admin-password-u-nomail') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId('server-admin-email-u-mail')).toBeNull();
    expect((screen.getByTestId('server-admin-password-u-mail') as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(repair);
    const input = await screen.findByTestId('server-admin-email-input');
    fireEvent.change(input, { target: { value: 'jane@openheaders.io' } });
    fireEvent.click(screen.getByTestId('server-admin-email-save'));
    await waitFor(() =>
      expect(mockCall).toHaveBeenCalledWith('oh.daemon.users.setEmail', {
        userId: 'u-nomail',
        email: 'jane@openheaders.io',
      }),
    );
    // The modal closes on success and the directory re-reads.
    await waitFor(() => expect(screen.queryByTestId('server-admin-email-input')).toBeNull());
    expect(mockCall.mock.calls.filter(([channel]) => channel === 'oh.daemon.users.list').length).toBeGreaterThan(1);
  });
});
