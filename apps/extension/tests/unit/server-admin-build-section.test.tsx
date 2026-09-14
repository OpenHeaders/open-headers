/**
 * The server-admin Server tab — the build this console administers
 * (version, always) over its release notes. A host that embeds no
 * `changelog/daemon` entry (the desktop, an entry-less build) answers
 * null notes: the tab shows the version and an honest empty
 * release-notes card, never a blank surface.
 */

import ServerAdminTab from '@openheaders/ui/workbench/components/server-admin/ServerAdminTab';
import { __resetServerAdminStatusForTests } from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function answerChangelog(resp: { version: string | null; notes: string | null }): void {
  mockCall.mockImplementation((channel: string) => {
    switch (channel) {
      case 'oh.daemon.admin.status':
        return Promise.resolve({ admin: true });
      case 'oh.daemon.changelog.get':
        return Promise.resolve(resp);
      default:
        return Promise.resolve({});
    }
  });
}

beforeEach(() => {
  __resetServerAdminStatusForTests();
  mockCall.mockReset();
  mockSubscribe.mockReset();
  mockSubscribe.mockReturnValue(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('server-admin Server tab', () => {
  it('shows the version and an empty release-notes card when the host embeds no entry', async () => {
    answerChangelog({ version: '2026.9.2', notes: null });
    render(<ServerAdminTab section="server" />);
    expect((await screen.findByTestId('server-admin-build-version')).textContent).toBe('2026.9.2');
    expect(screen.getByTestId('server-admin-release-notes')).toBeTruthy();
    expect(screen.getByText('This build ships no release notes.')).toBeTruthy();
  });

  it('renders the embedded release notes under the version', async () => {
    answerChangelog({ version: '2026.9.2', notes: '## Shipped\n\nFaster sync on openheaders.io.' });
    render(<ServerAdminTab section="server" />);
    expect((await screen.findByTestId('server-admin-build-version')).textContent).toBe('2026.9.2');
    expect(await screen.findByText('Shipped')).toBeTruthy();
    expect(screen.queryByText('This build ships no release notes.')).toBeNull();
  });

  it('falls back to Unknown when the host answers no version', async () => {
    answerChangelog({ version: null, notes: null });
    render(<ServerAdminTab section="server" />);
    expect((await screen.findByTestId('server-admin-build-version')).textContent).toBe('Unknown');
  });
});
