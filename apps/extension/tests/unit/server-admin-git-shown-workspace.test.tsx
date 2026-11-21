// @vitest-environment jsdom
/**
 * Administration › Git lands on the workspace the window SHOWS — when
 * the server holds it, else on the server's first — and follows it
 * until the admin picks another, which then stands. The card serves one
 * workspace at a time: what was typed for one never sits under the
 * next.
 */

import type { WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type { ReactElement } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall, mirror } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mirror: {
    liveActiveWorkspaceId: (): string | null => 'ws-first',
    subscribeMirror: (): (() => void) => () => undefined,
  },
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

vi.mock('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@openheaders/ui/context/mirrors/extension-workspace-sync-mirror')>();
  return { ...actual, getActiveExtensionWorkspaceSyncMirror: () => mirror };
});

// The diff and merge dialogs load the code editor, which jsdom cannot.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/shared/merge-editor', () => ({ MergeConflictModal: () => null }));

import '@openheaders/ui/workbench/settings/categories';
import { __resetBackgroundTasksForTests } from '@openheaders/ui/shared/background-tasks';
import ServerAdminGitSection from '@openheaders/ui/workbench/components/server-admin/ServerAdminGitSection';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';

const STATUS: WorkspaceTreeGitStatusWire = {
  bound: true,
  git: { available: true, version: '2.54.0' },
  repo: true,
  branch: 'main',
  headSha: 'a'.repeat(40),
  branches: ['main'],
  tags: [],
  dirtyFiles: 0,
  userIndexBusy: false,
  suggestedMessage: '',
  cadence: 'off',
  bypassHooks: false,
  upstream: 'origin/main',
  ahead: 0,
  behind: 0,
  autoPushOnCommit: false,
  forcePush: null,
  shallow: false,
};

const HELD = [
  { id: 'ws-first', name: 'First' },
  { id: 'ws-second', name: 'Second' },
  { id: 'ws-third', name: 'Third' },
];

/** The workspaces the server's engine has a folder for. */
let bound: string[];

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

beforeEach(() => {
  __resetBackgroundTasksForTests();
  bound = HELD.map((workspace) => workspace.id);
  mockCall.mockReset();
  mockCall.mockImplementation(
    async (channel: string, request?: { op?: string; payload?: { workspaceId?: string } }) => {
      if (channel === 'oh.daemon.users.list') return { users: [] };
      if (channel === 'oh.daemon.workspaces.list') return { workspaces: HELD };
      if (channel !== 'oh.daemon.workspaceTree.dispatch') throw new Error(`no answer for ${channel}`);
      if (request?.op === 'oh.workspaceTree.list') {
        return { bindings: bound.map((id) => ({ workspaceId: id, rootDir: `/repos/${id}`, issues: [] })) };
      }
      if (request?.op === 'oh.workspaceTree.gitStatus') {
        return bound.includes(request.payload?.workspaceId ?? '') ? STATUS : { bound: false };
      }
      throw new Error(`no answer for ${request?.op}`);
    },
  );
});

afterEach(cleanup);

/** The section in a window that shows `shown`; `show` shows another workspace. */
function mount(shown: string): { show: (next: string) => void } {
  const tree = (workspaceId: string): ReactElement => (
    <AntApp>
      <EditingScopeWorkspaceProvider workspaceId={workspaceId}>
        <ServerAdminGitSection />
      </EditingScopeWorkspaceProvider>
    </AntApp>
  );
  const view = render(tree(shown));
  return { show: (next) => view.rerender(tree(next)) };
}

/** The card stands on a workspace once it shows that workspace's folder. */
const cardOn = (workspaceId: string): Promise<HTMLElement> => screen.findByText(`/repos/${workspaceId}`);

function pick(name: string): void {
  const picker = screen.getByTestId('server-admin-git-workspace');
  const combobox = picker.matches('[role="combobox"]') ? picker : picker.querySelector('[role="combobox"]');
  if (combobox === null) throw new Error('the picker holds no combobox');
  fireEvent.mouseDown(combobox);
  fireEvent.click(combobox);
  const option = [...document.querySelectorAll<HTMLElement>('.ant-select-item-option')].find(
    (el) => el.getAttribute('title') === name,
  );
  if (option === undefined) throw new Error(`the picker offers no ${name}`);
  fireEvent.click(option);
}

describe('Administration › Git — the workspace the card lands on', () => {
  it('lands on the shown workspace, not the first', async () => {
    mount('ws-second');
    await cardOn('ws-second');
    expect(screen.queryByText('/repos/ws-first')).toBeNull();
  });

  it('lands on the first when the server does not hold the shown workspace', async () => {
    mount('ws-of-another-server');
    await cardOn('ws-first');
  });

  it('follows the shown workspace until the admin picks; the pick then stands', async () => {
    const { show } = mount('ws-second');
    await cardOn('ws-second');
    show('ws-third');
    await cardOn('ws-third');

    pick('First');
    await cardOn('ws-first');
    show('ws-second');
    await cardOn('ws-first');
    expect(screen.queryByText('/repos/ws-second')).toBeNull();
  });

  it('a path typed for one workspace does not sit under the next', async () => {
    bound = [];
    const { show } = mount('ws-second');
    const typed = (): HTMLInputElement => screen.getByTestId('git-pane-path-input') as HTMLInputElement;
    fireEvent.change(await screen.findByTestId('git-pane-path-input'), { target: { value: '/srv/john-doe' } });
    expect(typed().value).toBe('/srv/john-doe');
    show('ws-third');
    expect(typed().value).toBe('');
  });
});
