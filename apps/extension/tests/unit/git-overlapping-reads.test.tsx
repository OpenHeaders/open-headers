// @vitest-environment jsdom
/**
 * The compare pane and the Push window over a mocked bridge whose
 * answers are held: each reads on open and again on every status
 * frame, so two reads are out at once and answer in any order. The
 * newest read's answer is the surface's — an older one landing last
 * changes nothing, and the Push window's list reads as loading until
 * the newest answers.
 */

import type { WorkspaceTreeCompareRefsWire, WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (payload: { workspaceId: string }) => void;

const { mockCall, listeners, snapshot } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  listeners: new Map<string, Set<(payload: { workspaceId: string }) => void>>(),
  // ONE object: the Push window keys its read on the status it is handed.
  snapshot: {
    bound: true,
    rootDir: '/private/tmp/john-doe/repo/ws',
    status: {
      bound: true,
      repo: true,
      branch: 'main',
      headSha: 'a'.repeat(40),
      upstream: 'origin/main',
    },
    refs: [],
    current: 'main',
  },
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

// The times follow the clock-format setting, whose registry this pin does not load.
vi.mock('@openheaders/ui/workbench/components/panels/git/use-log-hour-cycle', () => ({
  useLogHourCycle: () => 'h23',
}));

// The diff dialog loads the code editor; no test here opens one.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));

vi.mock('@openheaders/ui/workbench/stores/git-status-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/ui/workbench/stores/git-status-store')>()),
  useWorkspaceGitSnapshot: () => snapshot,
}));

import GitComparePane from '@openheaders/ui/workbench/components/panels/git/compare/GitComparePane';
import type { GitCompareTabState } from '@openheaders/ui/workbench/components/panels/git/git-panel-view-store';
import PushCommitsModal from '@openheaders/ui/workbench/components/panels/git/push/PushCommitsModal';

function entry(sha: string): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents: [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-06T10:00:00.000Z',
    subject: `commit ${sha}`,
    coAuthors: [],
    files: [{ path: `docs/${sha}.md`, status: 'M' }],
  };
}

const compared = (shas: string[]): WorkspaceTreeCompareRefsWire => ({
  ok: true,
  current: 'main',
  ref: 'origin/main',
  onlyInCurrent: shas.map(entry),
  onlyInRef: [],
});

/** The compare reads in the order they were sent, each answered by hand. */
let held: Array<(answer: WorkspaceTreeCompareRefsWire) => void> = [];

const emitStatus = (workspaceId: string): void => {
  for (const listener of listeners.get('workspaceTreeGitStatus') ?? []) listener({ workspaceId });
};

const answer = async (index: number, shas: string[]): Promise<void> => {
  await act(async () => {
    held[index](compared(shas));
    await Promise.resolve();
  });
};

const TAB: GitCompareTabState = {
  kind: 'compare',
  id: 1,
  ref: 'origin/main',
  selectedInCurrent: null,
  selectedInRef: null,
};

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

beforeEach(() => {
  held = [];
  listeners.clear();
  mockCall.mockReset();
  mockCall.mockImplementation((type: string) => {
    if (type === 'oh.workspaceTree.compareRefs') {
      return new Promise<WorkspaceTreeCompareRefsWire>((resolve) => {
        held.push(resolve);
      });
    }
    if (type === 'oh.workspaceTree.listRefs') return Promise.resolve({ ok: true, refs: [], current: 'main' });
    return Promise.resolve({ ok: true });
  });
});

afterEach(cleanup);

describe('GitComparePane', () => {
  const rows = (): string[] => screen.queryAllByTestId('git-tool-row').map((el) => el.getAttribute('data-sha') ?? '');

  it('keeps its newest read’s lists when an older read answers last', async () => {
    render(<GitComparePane workspaceId="ws-1" tab={TAB} patchTab={() => undefined} />);
    await waitFor(() => expect(held).toHaveLength(1));
    emitStatus('ws-1');
    await waitFor(() => expect(held).toHaveLength(2));

    await answer(1, ['new1', 'new2']);
    await waitFor(() => expect(rows()).toEqual(['new1', 'new2']));

    await answer(0, ['old1']);
    expect(rows()).toEqual(['new1', 'new2']);
  });
});

describe('PushCommitsModal', () => {
  const rows = (): string[] => screen.queryAllByTestId('git-push-row').map((el) => el.getAttribute('data-sha') ?? '');
  const push = (): HTMLElement => screen.getByTestId('git-push-confirm');

  it('keeps its newest read’s commits, and holds Push until that read answers', async () => {
    render(<PushCommitsModal workspaceId="ws-1" open onClose={() => undefined} onConfirm={async () => undefined} />);
    await waitFor(() => expect(held).toHaveLength(1));
    emitStatus('ws-1');
    await waitFor(() => expect(held).toHaveLength(2));

    // The older read answers first: the newest is still out, so the list is still being read.
    await answer(0, ['old1']);
    expect(rows()).toEqual([]);
    expect(push().hasAttribute('disabled')).toBe(true);

    await answer(1, ['new1', 'new2']);
    await waitFor(() => expect(rows()).toEqual(['new1', 'new2']));
    expect(push().hasAttribute('disabled')).toBe(false);
  });
});
