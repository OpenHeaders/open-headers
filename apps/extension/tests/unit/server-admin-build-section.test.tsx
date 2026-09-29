/**
 * The server-admin Server tab — the build this console administers
 * (version, always) over its release notes. A host that embeds no
 * `changelog/daemon` entry (the desktop, an entry-less build) answers
 * null notes: the tab shows the version and an honest empty
 * release-notes card, never a blank surface.
 */

import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import ServerAdminTab from '@openheaders/ui/workbench/components/server-admin/ServerAdminTab';
import { __resetServerAdminStatusForTests } from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
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

/** The server's switch state the rig answers — flipped by the set channel like the daemon's record. */
let remote = true;
let hostKind: 'daemon' | 'desktop' = 'daemon';
const setCalls: boolean[] = [];

function answerChangelog(resp: { version: string | null; notes: string | null }): void {
  mockCall.mockImplementation((channel: string, payload?: { remote?: boolean }) => {
    switch (channel) {
      case 'oh.daemon.admin.status':
        return Promise.resolve({ admin: true });
      case 'oh.daemon.changelog.get':
        return Promise.resolve(resp);
      case 'oh.daemon.peerExecute.get':
        return Promise.resolve({ remote, hostKind });
      case 'oh.daemon.peerExecute.set':
        setCalls.push(payload?.remote === true);
        remote = payload?.remote === true;
        return Promise.resolve({ ok: true });
      default:
        return Promise.resolve({});
    }
  });
}

beforeEach(() => {
  setCurrentHost('web');
  remote = true;
  hostKind = 'daemon';
  setCalls.length = 0;
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

describe('server-admin Server tab — requests from devices', () => {
  it('reads the server’s effective switch ahead of the build and flips it through the set channel', async () => {
    answerChangelog({ version: '2026.9.3', notes: null });
    render(
      <AntApp>
        <ServerAdminTab section="server" />
      </AntApp>,
    );
    const section = await screen.findByTestId('server-admin-requests');
    expect(section.textContent).toContain('Let connected devices run requests on this server');
    const build = screen.getByTestId('server-admin-build');
    expect(section.compareDocumentPosition(build) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const toggle = screen.getByTestId('server-admin-requests-switch');
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(toggle);
    await waitFor(() => expect(setCalls).toEqual([false]));
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
  });

  it('shows the switch off when the server says so', async () => {
    remote = false;
    answerChangelog({ version: '2026.9.3', notes: null });
    render(<ServerAdminTab section="server" />);
    const toggle = await screen.findByTestId('server-admin-requests-switch');
    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
  });

  it('renders no requests section when the answering host is a desktop app, whose own Settings rows are that door', async () => {
    hostKind = 'desktop';
    answerChangelog({ version: '2026.9.3', notes: null });
    render(<ServerAdminTab section="server" />);
    await screen.findByTestId('server-admin-build');
    expect(screen.queryByTestId('server-admin-requests')).toBeNull();
  });
});
