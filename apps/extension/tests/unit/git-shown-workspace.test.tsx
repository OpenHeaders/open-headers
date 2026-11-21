// @vitest-environment jsdom
/**
 * Every git surface follows the workspace the workbench SHOWS, never
 * the host's Active one — a repo is bound to the workspace shown. Each
 * surface is mounted under a shown workspace that differs from the
 * Active one, with only one of the two bound: the Git and Commit
 * windows offer the bind for the shown workspace and bind THAT one, the
 * tool window is named for the shown workspace's binding, and the three
 * Git settings pages read the shown workspace's folder and repository.
 */

import type { WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ACTIVE = 'ws-active';
const SHOWN = 'ws-shown';

const { mockCall, mirror } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  mirror: {
    liveActiveWorkspaceId: (): string | null => 'ws-active',
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

// The shell itself stays out: the pin reads the name it is handed for the Git tool window.
vi.mock('@openheaders/ui/shared/dock-layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/ui/shared/dock-layout')>();
  return {
    ...actual,
    ShellLayout: ({ windowMap }: { windowMap: { git: { labelKey: string } } }): ReactElement => (
      <div data-testid="shell" data-git-label={windowMap.git.labelKey} />
    ),
  };
});

import '@openheaders/ui/workbench/settings/categories';
import '@openheaders/ui/workbench/settings/schema/workspace-layout';
import { __resetBackgroundTasksForTests } from '@openheaders/ui/shared/background-tasks';
import CommitToolPanel from '@openheaders/ui/workbench/components/panels/git/commit/CommitToolPanel';
import GitLogPanel from '@openheaders/ui/workbench/components/panels/git/GitLogPanel';
import ShellLayout, { type ShellLayoutProps } from '@openheaders/ui/workbench/components/shell/ShellLayout';
import { EditingScopeWorkspaceProvider } from '@openheaders/ui/workbench/hooks/EditingScopeWorkspaceContext';
import { getCategory } from '@openheaders/ui/workbench/settings/registry';
import { resetWorkspaceGitStoreForTests } from '@openheaders/ui/workbench/stores/git-status-store';

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

/** The one workspace of the two that has a folder. */
let bound: string;

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  registerCapability('workspaceGit', () => true);
});

afterAll(() => {
  unregisterCapability('workspaceGit');
});

beforeEach(() => {
  resetWorkspaceGitStoreForTests();
  __resetBackgroundTasksForTests();
  mockCall.mockReset();
  mockCall.mockImplementation(async (verb: string, payload?: { workspaceId?: string }) => {
    switch (verb) {
      case 'oh.workspaceTree.list':
        return { bindings: [{ workspaceId: bound, rootDir: `/repos/${bound}`, issues: [] }] };
      case 'oh.workspaceTree.gitStatus':
        return payload?.workspaceId === bound ? STATUS : { bound: false };
      case 'oh.workspaceTree.listRefs':
        return { ok: true, refs: [], current: 'main' };
      case 'oh.workspaceTree.bind':
        return { ok: true, initialized: false };
      default:
        throw new Error(`no answer for ${verb}`);
    }
  });
});

afterEach(cleanup);

/** A surface in a workbench that shows `SHOWN` while the host's Active workspace is `ACTIVE`. */
function show(surface: ReactNode): void {
  render(
    <AntApp>
      <EditingScopeWorkspaceProvider workspaceId={SHOWN}>{surface}</EditingScopeWorkspaceProvider>
    </AntApp>,
  );
}

const INFO = { title: 'Git', summary: 'Version control' };

describe('the tool windows — the shown workspace has no folder, the Active one has', () => {
  beforeEach(() => {
    bound = ACTIVE;
  });

  it.each([
    [
      'Git',
      'git-tool-bind',
      <GitLogPanel
        key="git"
        info={INFO}
        dockSlot="bottom-left"
        onHide={() => undefined}
        onMoveTo={() => undefined}
        onRemoveFromSidebar={() => undefined}
      />,
    ],
    ['Commit', 'commit-tool-bind', <CommitToolPanel key="commit" info={INFO} onHide={() => undefined} />],
  ])('the %s window offers the bind and binds the shown workspace', async (_name, prefix, surface) => {
    show(surface);
    fireEvent.change(screen.getByTestId(`${prefix}-path-input`), { target: { value: '/repos/john-doe' } });
    fireEvent.click(screen.getByTestId(`${prefix}-bind-button`));
    await waitFor(() =>
      expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.bind', {
        workspaceId: SHOWN,
        rootDir: '/repos/john-doe',
      }),
    );
    expect(mockCall.mock.calls.filter(([, payload]) => payload?.workspaceId === ACTIVE)).toEqual([]);
  });
});

describe('the shown workspace has a folder, the Active one has none', () => {
  beforeEach(() => {
    bound = SHOWN;
  });

  it('the tool window is named Git', async () => {
    const props = { tl: {}, responsive: { sizes: {} } } as unknown as ShellLayoutProps;
    show(<ShellLayout {...props} />);
    const label = (): string | null => screen.getByTestId('shell').getAttribute('data-git-label');
    await waitFor(() => expect(label()).toBe('workbench.toolWindows.git'));
  });

  it.each([
    ['gitFolder', 'git-pane-unbind-button'],
    ['gitAutomation', 'git-pane-cadence-select'],
    ['gitLog', 'git-log-pane-tag-names'],
  ])('Settings › %s reads the shown workspace', async (categoryId, testid) => {
    const category = getCategory(categoryId);
    const Page = category?.renderPane;
    if (category === undefined || Page === undefined) throw new Error(`no page for ${categoryId}`);
    show(<Page category={category} defs={[]} />);
    expect(await screen.findByTestId(testid)).toBeTruthy();
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.gitStatus', { workspaceId: SHOWN });
    expect(mockCall.mock.calls.filter(([, payload]) => payload?.workspaceId === ACTIVE)).toEqual([]);
  });
});
