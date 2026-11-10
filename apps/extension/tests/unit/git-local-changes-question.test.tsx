// @vitest-environment jsdom
/**
 * The uncommitted-work question outside the log: a Pull or a branch
 * Merge about to write a file that holds uncommitted work. The first
 * describe pins the shared question itself — a verb that answers
 * `local-changes` raises the dialog naming the files under the offered
 * message, the word sends the same verb again with the message, Cancel
 * sends nothing and answers null, and any other answer passes through
 * without a dialog. The second pins the branch verbs on it: Pull and
 * Merge into Current each name their own verb, send `commitLocal`, and
 * say afterwards which files were committed first.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => undefined), broadcast: vi.fn(), presence: vi.fn() },
  };
});

// The code editor stays out of jsdom: the Push window's diff is the hook's only way to it.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));

import {
  type GitBranchActions,
  useGitBranchActions,
} from '@openheaders/ui/workbench/components/panels/git/branch-actions/use-git-branch-actions';
import {
  type LocalChangesQuestion,
  type LocalChangesRefusal,
  useLocalChangesQuestion,
} from '@openheaders/ui/workbench/components/panels/git/use-local-changes-question';

const REQUEST = 'requests/status-probe/request.yaml';
const NOTES = 'notes/orders.md';
const TITLE = 'Commit your changes to these files first?';
const refusal = {
  ok: false,
  reason: 'local-changes',
  localChanges: [REQUEST, NOTES],
  suggestedMessage: 'Update 1 request',
};

beforeAll(() => {
  // jsdom has none; the question's message field sizes itself through one.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

afterEach(cleanup);

beforeEach(() => {
  mockCall.mockReset();
});

describe('useLocalChangesQuestion', () => {
  function mount(): LocalChangesQuestion {
    let question: LocalChangesQuestion | null = null;
    const Probe: React.FC = () => {
      question = useLocalChangesQuestion(null);
      return <>{question.dialog}</>;
    };
    render(
      <AntApp>
        <Probe />
      </AntApp>,
    );
    if (question === null) throw new Error('the hook did not mount');
    return question;
  }

  it('a verb that goes through is run once and no question is raised', async () => {
    const verb = vi.fn(async (): Promise<LocalChangesRefusal> => ({ ok: true }));
    const question = mount();
    let answer: LocalChangesRefusal | null = null;
    await act(async () => {
      answer = await question.withWord({ kind: 'pull' }, verb);
    });
    expect(answer).toEqual({ ok: true });
    expect(verb.mock.calls).toEqual([[]]);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('a refusal for any other reason passes through as it came', async () => {
    const failed = { ok: false, reason: 'fetch-failed' };
    const verb = vi.fn(async (): Promise<LocalChangesRefusal> => failed);
    const question = mount();
    let answer: LocalChangesRefusal | null = null;
    await act(async () => {
      answer = await question.withWord({ kind: 'pull' }, verb);
    });
    expect(answer).toBe(failed);
    expect(verb).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('local-changes raises the question; the word sends the verb again with the message', async () => {
    const verb = vi
      .fn<(word?: { message: string }) => Promise<LocalChangesRefusal>>()
      .mockResolvedValueOnce(refusal)
      .mockResolvedValueOnce({ ok: true });
    const question = mount();
    let answer: Promise<LocalChangesRefusal | null> | null = null;
    act(() => {
      answer = question.withWord({ kind: 'pull' }, verb);
    });

    await waitFor(() => expect(screen.getByText(TITLE)).toBeTruthy());
    expect(screen.getByText(/^The pull changes files that hold uncommitted changes of yours\./)).toBeTruthy();
    expect(screen.getByTestId('git-tool-local-changes-first-files').textContent).toBe(`${REQUEST}${NOTES}`);
    const message = screen.getByTestId('git-tool-local-changes-first-message') as HTMLTextAreaElement;
    expect(message.value).toBe('Update 1 request');
    expect(verb).toHaveBeenCalledTimes(1);

    fireEvent.change(message, { target: { value: 'Probe header, as I had it' } });
    fireEvent.click(screen.getByText('Commit and Pull'));
    await act(async () => {
      expect(await answer).toEqual({ ok: true });
    });
    expect(verb.mock.calls).toEqual([[], [{ message: 'Probe header, as I had it' }]]);
  });

  it('Cancel answers null and the verb is not sent again', async () => {
    const verb = vi.fn(async (): Promise<LocalChangesRefusal> => refusal);
    const question = mount();
    let answer: Promise<LocalChangesRefusal | null> | null = null;
    act(() => {
      answer = question.withWord({ kind: 'merge', ref: 'feature/orders-v2' }, verb);
    });

    await waitFor(() => expect(screen.getByText('Commit and Merge')).toBeTruthy());
    expect(screen.getByText(/^Merging feature\/orders-v2 changes files/)).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    await act(async () => {
      expect(await answer).toBeNull();
    });
    expect(verb).toHaveBeenCalledTimes(1);
  });

  it('an emptied message holds the word', async () => {
    const verb = vi.fn(async (): Promise<LocalChangesRefusal> => refusal);
    const question = mount();
    act(() => {
      void question.withWord({ kind: 'pull' }, verb);
    });
    await waitFor(() => expect(screen.getByText('Commit and Pull')).toBeTruthy());
    fireEvent.change(screen.getByTestId('git-tool-local-changes-first-message'), { target: { value: '   ' } });
    expect(screen.getByText('Commit and Pull').closest('button')?.disabled).toBe(true);
  });
});

describe('useGitBranchActions — Pull and Merge ask before committing uncommitted work', () => {
  function mount(): GitBranchActions {
    let actions: GitBranchActions | null = null;
    const Probe: React.FC = () => {
      actions = useGitBranchActions({ workspaceId: 'ws-1', currentRef: 'main', refs: [], container: null });
      return <>{actions.dialogs}</>;
    };
    render(
      <AntApp>
        <Probe />
      </AntApp>,
    );
    if (actions === null) throw new Error('the hook did not mount');
    return actions;
  }

  it('Pull raises the question, sends the word, and says which files were committed first', async () => {
    mockCall
      .mockResolvedValueOnce(refusal)
      .mockResolvedValueOnce({ ok: true, upToDate: false, sha: 'd'.repeat(40), applied: 2, committedLocal: [REQUEST] });
    const actions = mount();
    act(() => actions.pull());

    await waitFor(() => expect(screen.getByText('Commit and Pull')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([['oh.workspaceTree.pull', { workspaceId: 'ws-1' }]]);
    fireEvent.click(screen.getByText('Commit and Pull'));

    await waitFor(() => expect(screen.getByText('Pull finished')).toBeTruthy());
    expect(mockCall.mock.calls[1]).toEqual([
      'oh.workspaceTree.pull',
      { workspaceId: 'ws-1', commitLocal: { message: 'Update 1 request' } },
    ]);
    expect(
      screen.getByText(`Your uncommitted changes to ${REQUEST} were committed first, in a commit of their own.`),
    ).toBeTruthy();
  });

  it('Cancel on a Pull sends nothing more and raises no toast', async () => {
    mockCall.mockResolvedValueOnce(refusal);
    const actions = mount();
    act(() => actions.pull());
    await waitFor(() => expect(screen.getByText('Commit and Pull')).toBeTruthy());

    fireEvent.click(screen.getByText('Cancel'));
    await act(async () => {});
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Pull finished')).toBeNull();
    expect(screen.queryByText(/Pull failed/)).toBeNull();
  });

  it('Merge into Current names the ref and sends the word on its own verb', async () => {
    mockCall
      .mockResolvedValueOnce(refusal)
      .mockResolvedValueOnce({ ok: true, upToDate: false, sha: 'e'.repeat(40), applied: 1, committedLocal: [NOTES] });
    const actions = mount();
    act(() => actions.mergeIntoCurrent('local-test'));

    await waitFor(() => expect(screen.getByText('Commit and Merge')).toBeTruthy());
    expect(screen.getByText(/^Merging local-test changes files/)).toBeTruthy();
    fireEvent.click(screen.getByText('Commit and Merge'));

    await waitFor(() => expect(screen.getByText('Merged local-test into main (eeeeeeee)')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([
      ['oh.workspaceTree.mergeBranch', { workspaceId: 'ws-1', ref: 'local-test' }],
      [
        'oh.workspaceTree.mergeBranch',
        { workspaceId: 'ws-1', ref: 'local-test', commitLocal: { message: 'Update 1 request' } },
      ],
    ]);
  });
});
