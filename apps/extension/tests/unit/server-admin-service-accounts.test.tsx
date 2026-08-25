/**
 * ServerAdminConsole service-account rows (the access-foundation plan
 * §8 F3) — a `kind: 'service'` row renders the Service tag with the
 * machine wording and hides the human-only affordances (password,
 * server roles); a kind-less row from an older server and an unknown
 * kind from a newer one both render as human rows (the forward-tolerant
 * decode law — never a refusal).
 */

import ServerAdminConsole from '@openheaders/ui/workbench/components/server-admin/ServerAdminConsole';
import { cleanup, render, screen } from '@testing-library/react';
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

// The console's sibling sections (tokens, git, audit, release notes)
// drive their own channels; the rows under test need none of them.
vi.mock('@openheaders/ui/workbench/settings/components/backend-tokens-section', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/settings/components/git-workspace-pane', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/server-admin/ServerAuditReports', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/server-admin/ServerReleaseNotesCard', () => ({ default: () => null }));

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
    directoryUser({ userId: 'svc-1', displayName: 'CI deployer', kind: 'service' }),
    // Older server: no kind field at all — a human row.
    directoryUser({ userId: 'u-legacy', displayName: 'Jane Doe' }),
    // Newer server: an unknown kind degrades to a human row, never a refusal.
    directoryUser({ userId: 'u-future', displayName: 'John Doe', kind: 'automation' }),
  ],
};

beforeEach(() => {
  mockCall.mockReset();
  mockSubscribe.mockReset();
  mockSubscribe.mockReturnValue(() => {});
  mockCall.mockImplementation((channel: string) => {
    switch (channel) {
      case 'oh.daemon.admin.status':
        return Promise.resolve({ admin: true });
      case 'oh.daemon.users.list':
        return Promise.resolve(DIRECTORY);
      case 'oh.daemon.workspaces.list':
        return Promise.resolve({ workspaces: [{ id: 'w-alpha', name: 'Alpha' }] });
      default:
        return Promise.resolve({});
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ServerAdminConsole service-account rows', () => {
  it('renders the Service tag and machine last-seen wording, hides password and server roles', async () => {
    render(<ServerAdminConsole />);
    expect(await screen.findByText('Service')).toBeTruthy();
    // The lastSeen line uses the machine wording for a never-connected bot.
    expect(screen.getByText(/never used/)).toBeTruthy();
    // Human-only affordances stay off the service row; grants stay on it.
    expect(screen.queryByTestId('server-admin-password-svc-1')).toBeNull();
    expect(screen.queryByTestId('server-admin-role-admin-svc-1')).toBeNull();
    expect(screen.queryByTestId('server-admin-role-create-svc-1')).toBeNull();
    expect(screen.getAllByText('Alpha · Editor').length).toBe(3);
  });

  it('renders kind-less and unknown-kind rows as human rows (forward-tolerant)', async () => {
    render(<ServerAdminConsole />);
    expect(await screen.findByTestId('server-admin-password-u-legacy')).toBeTruthy();
    expect(screen.getByTestId('server-admin-role-admin-u-legacy')).toBeTruthy();
    expect(screen.getByTestId('server-admin-password-u-future')).toBeTruthy();
    expect(screen.getByTestId('server-admin-role-admin-u-future')).toBeTruthy();
  });
});
