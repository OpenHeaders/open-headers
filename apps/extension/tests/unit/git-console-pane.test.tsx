// @vitest-environment jsdom
/**
 * The Console pane over a mocked bridge: it reads the feed on mount
 * and again whenever the host says the feed gained rows — for this
 * workspace only — and Clear All hides everything the host ran up to
 * the press, a row the pane had not drawn yet included: it reads the
 * feed first and marks its newest row.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (payload: { workspaceId: string; seq?: number }) => void;

const { mockCall, listeners } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  listeners: new Map<string, Set<(payload: { workspaceId: string; seq?: number }) => void>>(),
}));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: {
      call: mockCall,
      subscribe: (type: string, listener: Listener) => {
        const set = listeners.get(type) ?? new Set<Listener>();
        set.add(listener);
        listeners.set(type, set);
        return () => set.delete(listener);
      },
      broadcast: vi.fn(),
      presence: vi.fn(),
    },
  };
});

// The face follows the Terminal settings, whose registry this pin does not load.
vi.mock('@openheaders/ui/workbench/components/panels/git/use-console-font', () => ({
  useConsoleFont: () => ({ family: 'monospace', size: 12 }),
}));

import GitConsolePane from '@openheaders/ui/workbench/components/panels/git/GitConsolePane';
import { setGitConsoleClearMark } from '@openheaders/ui/workbench/components/panels/git/git-console-view-state';

const ROOT = '/private/tmp/john-doe/repo/ws';

function row(seq: number, command: string[]): WorkspaceTreeGitConsoleRowWire {
  return {
    seq,
    at: '2026-11-14T22:19:53.700Z',
    options: ['--git-dir', `${ROOT}/.git`, '--work-tree', ROOT],
    command,
    cwd: ROOT,
    code: 0,
    durationMs: 9,
    output: '',
  };
}

let feed: WorkspaceTreeGitConsoleRowWire[] = [];

const emit = (type: string, payload: { workspaceId: string; seq?: number }): void => {
  for (const listener of listeners.get(type) ?? []) listener(payload);
};
const seqs = (): string[] =>
  screen.queryAllByTestId('git-tool-console-row').map((el) => el.getAttribute('data-seq') ?? '');

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
});

beforeEach(() => {
  feed = [row(1, ['commit', '-m', 'one']), row(2, ['fetch', '--quiet'])];
  mockCall.mockReset();
  mockCall.mockImplementation(async (type: string) =>
    type === 'oh.workspaceTree.gitConsole' ? { ok: true, rows: [...feed] } : { ok: true },
  );
  listeners.clear();
  setGitConsoleClearMark('ws-1', null);
});

afterEach(cleanup);

describe('GitConsolePane', () => {
  it('reads the feed again when the host says it gained rows — this workspace’s only', async () => {
    render(<GitConsolePane workspaceId="ws-1" />);
    await waitFor(() => expect(seqs()).toEqual(['1', '2']));

    feed = [...feed, row(3, ['fetch', '--quiet'])];
    emit('workspaceTreeGitConsole', { workspaceId: 'ws-2', seq: 3 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(seqs()).toEqual(['1', '2']);

    emit('workspaceTreeGitConsole', { workspaceId: 'ws-1', seq: 3 });
    await waitFor(() => expect(seqs()).toEqual(['1', '2', '3']));
  });

  it('Clear All hides everything the host ran up to the press — rows the pane had not drawn yet too', async () => {
    render(<GitConsolePane workspaceId="ws-1" />);
    await waitFor(() => expect(seqs()).toEqual(['1', '2']));

    // Three background fetches ran since the pane last read; nothing told it.
    feed = [...feed, row(3, ['fetch', '--quiet']), row(4, ['fetch', '--quiet']), row(5, ['fetch', '--quiet'])];
    fireEvent.click(screen.getByTestId('git-tool-console-clear'));
    await waitFor(() => expect(seqs()).toEqual([]));

    // The person's own fetch after it is the one row the feed shows.
    feed = [...feed, row(6, ['fetch', '--all', '--prune', '--quiet'])];
    emit('workspaceTreeGitConsole', { workspaceId: 'ws-1', seq: 6 });
    await waitFor(() => expect(seqs()).toEqual(['6']));
  });

  it('a clear the host does not answer keeps the mark on what the pane held', async () => {
    render(<GitConsolePane workspaceId="ws-1" />);
    await waitFor(() => expect(seqs()).toEqual(['1', '2']));
    mockCall.mockImplementationOnce(async () => {
      throw new Error('offline');
    });
    fireEvent.click(screen.getByTestId('git-tool-console-clear'));
    await waitFor(() => expect(seqs()).toEqual([]));
    feed = [...feed, row(3, ['fetch', '--quiet'])];
    emit('workspaceTreeGitConsole', { workspaceId: 'ws-1', seq: 3 });
    await waitFor(() => expect(seqs()).toEqual(['3']));
  });
});
