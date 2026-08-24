/**
 * ServerAdminConsole grants rendering — the forward-tolerant decode law
 * (the access-foundation plan §6): a grant role outside the console's
 * authoring vocabulary (a newer server's value) renders VERBATIM beside
 * the translated known roles — the row is never refused or blanked.
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
// drive their own channels; the grants seam under test needs none of
// them mounted.
vi.mock('@openheaders/ui/workbench/settings/components/backend-tokens-section', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/settings/components/git-workspace-pane', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/server-admin/ServerAuditReports', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/server-admin/ServerReleaseNotesCard', () => ({ default: () => null }));

/** One directory user whose grants mix a known role with a newer server's unknown one. */
const DIRECTORY = {
  users: [
    {
      userId: 'u1',
      displayName: 'John Doe',
      email: 'john.doe@openheaders.io',
      gitEmail: null,
      createdAt: 1756000000000,
      deactivatedAt: null,
      hasPassword: false,
      mayCreateWorkspaces: false,
      isDaemonAdmin: false,
      grants: [
        { workspaceId: 'w-alpha', role: 'publisher' },
        { workspaceId: 'w-beta', role: 'viewer' },
      ],
    },
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
        return Promise.resolve({
          workspaces: [
            { id: 'w-alpha', name: 'Alpha' },
            { id: 'w-beta', name: 'Beta' },
          ],
        });
      default:
        return Promise.resolve({});
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ServerAdminConsole grant role labels', () => {
  it('renders an unknown role verbatim and a known role through its label', async () => {
    render(<ServerAdminConsole />);
    // The unknown role from a newer server rides through untranslated —
    // never a blank tag, never a dropped row.
    expect(await screen.findByText('Alpha · publisher')).toBeTruthy();
    // The known role keeps its translated label.
    expect(await screen.findByText('Beta · Viewer')).toBeTruthy();
  });
});
