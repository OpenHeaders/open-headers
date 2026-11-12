// @vitest-environment jsdom
/**
 * What a pass asks before it writes, outside the log: a Pull or a
 * branch Merge. The first describe pins the shared answers themselves —
 * a verb that answers `local-changes` raises the question naming the
 * files under the offered message and goes again with the word; one
 * that answers `conflicts` with files names them first under the
 * pass's own title, and goes again with the token and either one side
 * for all of them (Accept Incoming / Keep Mine — no editor) or
 * the answers made in the merge editor (Review Conflicts…), the word
 * riding that call too; Cancel at any of the three sends nothing more
 * and answers null; any other answer passes through with no dialog. The
 * second pins the branch verbs on it: Pull and Merge into Current each
 * name their own verb, send what was answered, and say afterwards what
 * was committed first, what was left out, or that the files are too
 * large to resolve.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import type React from 'react';
import { useState } from 'react';
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

// The Monaco editor stays out of jsdom: the stub keeps the modal's contract — Complete Merge answers
// every file with the incoming text and closes when every outcome is ok; Cancel tells the session.
vi.mock('@openheaders/ui/shared/merge-editor', () => {
  const MergeConflictModal = ({ session, onClose }: MergeConflictModalProps): React.ReactElement => {
    const [errors, setErrors] = useState<string[]>([]);
    return (
      <div data-testid="merge-modal">
        <span data-testid="merge-title">{session.title}</span>
        <span data-testid="merge-files">{session.files.map((file) => file.id).join(',')}</span>
        <span data-testid="merge-errors">{errors.join(',')}</span>
        <button
          type="button"
          data-testid="merge-apply"
          onClick={async () => {
            const results = new Map(session.files.map((file) => [file.id, file.theirs] as const));
            const outcomes = await session.onApply(session.files, results);
            setErrors(outcomes.flatMap((outcome) => (outcome.ok ? [] : [`${outcome.fileId}: ${outcome.error}`])));
            if (outcomes.every((outcome) => outcome.ok)) onClose();
          }}
        >
          apply
        </button>
        <button
          type="button"
          data-testid="merge-cancel"
          onClick={() => {
            session.onCancel();
            onClose();
          }}
        >
          cancel
        </button>
      </div>
    );
  };
  return { MergeConflictModal };
});

import type { MergeConflictModalProps } from '@openheaders/ui/shared/merge-editor';
import {
  type GitBranchActions,
  useGitBranchActions,
} from '@openheaders/ui/workbench/components/panels/git/branch-actions/use-git-branch-actions';
import {
  type PassAnswerSet,
  type PassAnswers,
  type PassRefusal,
  usePassAnswers,
} from '@openheaders/ui/workbench/components/panels/git/use-pass-answers';

const REQUEST = 'requests/status-probe/request.yaml';
const NOTES = 'notes/orders.md';
const TITLE = 'Commit your changes to these files first?';
const refusal = {
  ok: false,
  reason: 'local-changes',
  localChanges: [REQUEST, NOTES],
  suggestedMessage: 'Update 1 request',
};
const conflicts = {
  ok: false,
  reason: 'conflicts',
  conflicts: [REQUEST],
  resolve: {
    token: 'token-1',
    files: [{ path: REQUEST, base: 'value: one\n', theirs: 'value: theirs\n', mine: 'value: mine\n' }],
  },
};
const answered = { token: 'token-1', files: [{ path: REQUEST, content: 'value: theirs\n' }] };

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

// The files step comes first and Review Conflicts… opens the editor. A click that lands before the step is up does
// nothing, so it is repeated until the editor (under `title`, when given) is there.
const toEditor = (title = ''): Promise<void> =>
  waitFor(() => {
    if (screen.queryByTestId('merge-title')?.textContent?.includes(title)) return;
    fireEvent.click(screen.getByText('Review Conflicts…'));
    throw new Error('the editor is not open yet');
  });

// The locale context answers English here, so the pin reads the words.
/** The files step's list as a path: with no workspace behind the pin, a file is named by its directory, then its name. */
const listedFile = (): string =>
  [...screen.getByTestId('git-tool-conflict-files-list').querySelectorAll('.rules-sidebar-item-label')]
    .map((label) => label.textContent)
    .join('/');

describe('usePassAnswers', () => {
  function mount(): PassAnswers {
    let answers: PassAnswers | null = null;
    const Probe: React.FC = () => {
      answers = usePassAnswers();
      return <>{answers.dialogs}</>;
    };
    render(
      <AntApp>
        <Probe />
      </AntApp>,
    );
    if (answers === null) throw new Error('the hook did not mount');
    return answers;
  }

  const verbOf = () => vi.fn<(given: PassAnswerSet) => Promise<PassRefusal>>();

  it('a verb that goes through is run once and nothing is asked', async () => {
    const verb = verbOf().mockResolvedValue({ ok: true });
    const answers = mount();
    let answer: PassRefusal | null = null;
    await act(async () => {
      answer = await answers.run({ kind: 'pull' }, verb);
    });
    expect(answer).toEqual({ ok: true });
    expect(verb.mock.calls).toEqual([[{}]]);
    expect(screen.queryByText(TITLE)).toBeNull();
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('a refusal for any other reason passes through as it came', async () => {
    const failed = { ok: false, reason: 'fetch-failed' };
    const verb = verbOf().mockResolvedValue(failed);
    const answers = mount();
    let answer: PassRefusal | null = null;
    await act(async () => {
      answer = await answers.run({ kind: 'pull' }, verb);
    });
    expect(answer).toBe(failed);
    expect(verb).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('local-changes raises the question; the word sends the verb again with the message', async () => {
    const verb = verbOf().mockResolvedValueOnce(refusal).mockResolvedValueOnce({ ok: true });
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'pull' }, verb);
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
    expect(verb.mock.calls).toEqual([[{}], [{ commitLocal: { message: 'Probe header, as I had it' } }]]);
  });

  it('Cancel on the question answers null and the verb is not sent again', async () => {
    const verb = verbOf().mockResolvedValue(refusal);
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'merge', ref: 'feature/orders-v2' }, verb);
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
    const verb = verbOf().mockResolvedValue(refusal);
    const answers = mount();
    act(() => {
      void answers.run({ kind: 'pull' }, verb);
    });
    await waitFor(() => expect(screen.getByText('Commit and Pull')).toBeTruthy());
    fireEvent.change(screen.getByTestId('git-tool-local-changes-first-message'), { target: { value: '   ' } });
    expect(screen.getByText('Commit and Pull').closest('button')?.disabled).toBe(true);
  });

  it('conflicts name the files first; Review Conflicts… opens the editor and the answers go back with the token', async () => {
    const done = { ok: true };
    const verb = verbOf().mockResolvedValueOnce(conflicts).mockResolvedValueOnce(done);
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'pull' }, verb);
    });

    await waitFor(() => expect(listedFile()).toBe(REQUEST));
    expect(screen.getByText('Pull: Resolve Conflicts')).toBeTruthy();
    expect(screen.getByText(/^Both sides changed these files\. Nothing has been written yet\./)).toBeTruthy();
    expect(screen.queryByTestId('merge-modal')).toBeNull();
    expect(verb).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Review Conflicts…'));
    await waitFor(() => expect(screen.getByTestId('merge-title').textContent).toBe('Pull: Resolve Conflicts'));
    expect(screen.getByTestId('merge-files').textContent).toBe(REQUEST);
    expect(verb).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('merge-apply'));
    await act(async () => {
      expect(await answer).toBe(done);
    });
    expect(verb.mock.calls).toEqual([[{}], [{ resolution: answered }]]);
    await waitFor(() => expect(screen.queryByTestId('merge-modal')).toBeNull());
  });

  it('Accept Incoming sends that one side with the token; the editor never opens', async () => {
    const done = { ok: true };
    const verb = verbOf().mockResolvedValueOnce(conflicts).mockResolvedValueOnce(done);
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'pull' }, verb);
    });
    await waitFor(() => expect(listedFile()).toBe(REQUEST));

    fireEvent.click(screen.getByTestId('git-tool-conflict-files-theirs'));
    await act(async () => {
      expect(await answer).toBe(done);
    });
    expect(verb.mock.calls).toEqual([[{}], [{ resolution: { token: 'token-1', side: 'theirs' } }]]);
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('one side given while the branch moved lists the files again, says so, and goes with the new token', async () => {
    const moved = { ...conflicts, resolve: { ...conflicts.resolve, token: 'token-2' } };
    const verb = verbOf()
      .mockResolvedValueOnce(conflicts)
      .mockResolvedValueOnce(moved)
      .mockResolvedValueOnce({ ok: true });
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'pull' }, verb);
    });
    await waitFor(() => expect(listedFile()).toBe(REQUEST));
    expect(screen.getByTestId('git-tool-conflict-files-theirs').textContent).toBe('Accept Incoming');
    expect(screen.getByTestId('git-tool-conflict-files-mine').textContent).toBe('Keep Mine');

    fireEvent.click(screen.getByTestId('git-tool-conflict-files-mine'));
    await waitFor(() =>
      expect(screen.getByText('The branch changed while you were resolving. Review the conflicts again.')).toBeTruthy(),
    );
    expect(listedFile()).toBe(REQUEST);
    expect(screen.queryByTestId('merge-modal')).toBeNull();

    fireEvent.click(screen.getByTestId('git-tool-conflict-files-mine'));
    await act(async () => {
      expect(await answer).toEqual({ ok: true });
    });
    expect(verb.mock.calls).toEqual([
      [{}],
      [{ resolution: { token: 'token-1', side: 'mine' } }],
      [{ resolution: { token: 'token-2', side: 'mine' } }],
    ]);
  });

  it('Cancel on the files step answers null, opens no editor and sends nothing more', async () => {
    const verb = verbOf().mockResolvedValue(conflicts);
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'merge', ref: 'local-test' }, verb);
    });
    await waitFor(() => expect(screen.getByText('Merge local-test: Resolve Conflicts')).toBeTruthy());

    fireEvent.click(screen.getByText('Cancel'));
    await act(async () => {
      expect(await answer).toBeNull();
    });
    expect(verb).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('the word given before the editor rides the call that carries the answers', async () => {
    const verb = verbOf()
      .mockResolvedValueOnce(refusal)
      .mockResolvedValueOnce(conflicts)
      .mockResolvedValueOnce({ ok: true });
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'merge', ref: 'local-test' }, verb);
    });

    await waitFor(() => expect(screen.getByText('Commit and Merge')).toBeTruthy());
    fireEvent.click(screen.getByText('Commit and Merge'));
    await toEditor('Merge local-test: Resolve Conflicts');
    fireEvent.click(screen.getByTestId('merge-apply'));
    await act(async () => {
      expect(await answer).toEqual({ ok: true });
    });
    const word = { commitLocal: { message: 'Update 1 request' } };
    expect(verb.mock.calls).toEqual([[{}], [word], [{ ...word, resolution: answered }]]);
  });

  it('Cancel in the editor answers null and sends nothing more', async () => {
    const verb = verbOf().mockResolvedValue(conflicts);
    const answers = mount();
    let answer: Promise<PassRefusal | null> | null = null;
    act(() => {
      answer = answers.run({ kind: 'pull' }, verb);
    });
    await toEditor();
    fireEvent.click(screen.getByTestId('merge-cancel'));
    await act(async () => {
      expect(await answer).toBeNull();
    });
    expect(verb).toHaveBeenCalledTimes(1);
  });

  it('an answer the host cannot read keeps the editor open on that file', async () => {
    const verb = verbOf()
      .mockResolvedValueOnce(conflicts)
      .mockResolvedValueOnce({ ok: false, reason: 'resolution-invalid', detail: 'bad yaml', file: REQUEST });
    const answers = mount();
    act(() => {
      void answers.run({ kind: 'pull' }, verb);
    });
    await toEditor();
    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByTestId('merge-errors').textContent).toBe(`${REQUEST}: bad yaml`));
    expect(screen.getByTestId('merge-modal')).toBeTruthy();
  });
});

describe('useGitBranchActions — Pull and Merge ask before they write', () => {
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

  it('reads as working while a verb is at the host, and not while it waits on the person', async () => {
    let land: (answer: PassRefusal) => void = () => undefined;
    mockCall.mockReturnValueOnce(
      new Promise<PassRefusal>((resolve) => {
        land = resolve;
      }),
    );
    let pull: () => void = () => undefined;
    const Probe: React.FC = () => {
      const actions = useGitBranchActions({ workspaceId: 'ws-1', currentRef: 'main', refs: [], container: null });
      pull = actions.pull;
      return (
        <>
          <span data-testid="working">{String(actions.busy.working)}</span>
          {actions.dialogs}
        </>
      );
    };
    render(
      <AntApp>
        <Probe />
      </AntApp>,
    );
    const working = (): string | null => screen.getByTestId('working').textContent;
    expect(working()).toBe('false');

    act(() => pull());
    await waitFor(() => expect(working()).toBe('true'));

    await act(async () => land(conflicts));
    await waitFor(() => expect(screen.getByTestId('git-tool-conflict-files')).toBeTruthy());
    expect(working()).toBe('false');
  });

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

  it('a Pull both sides changed opens the editor and finishes on the answers, naming what was left out', async () => {
    mockCall.mockResolvedValueOnce(conflicts).mockResolvedValueOnce({
      ok: true,
      upToDate: false,
      sha: 'd'.repeat(40),
      applied: 1,
      skipped: [{ uid: 'req00002', path: NOTES, reason: 'missing' }],
    });
    const actions = mount();
    act(() => actions.pull());

    await toEditor('Pull: Resolve Conflicts');
    expect(screen.queryByText('Pull finished')).toBeNull();
    fireEvent.click(screen.getByTestId('merge-apply'));

    await waitFor(() => expect(screen.getByText('Pull finished')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([
      ['oh.workspaceTree.pull', { workspaceId: 'ws-1' }],
      ['oh.workspaceTree.pull', { workspaceId: 'ws-1', resolution: answered }],
    ]);
    expect(
      screen.getByText(`Part of the change was left out because the branch does not match it: ${NOTES}.`),
    ).toBeTruthy();
  });

  it('a Pull answered with Keep Mine sends the branch’s side on its own verb and finishes', async () => {
    mockCall
      .mockResolvedValueOnce(conflicts)
      .mockResolvedValueOnce({ ok: true, upToDate: false, sha: 'd'.repeat(40), applied: 0 });
    const actions = mount();
    act(() => actions.pull());
    await waitFor(() => expect(listedFile()).toBe(REQUEST));

    fireEvent.click(screen.getByTestId('git-tool-conflict-files-mine'));
    await waitFor(() => expect(screen.getByText('Pull finished')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([
      ['oh.workspaceTree.pull', { workspaceId: 'ws-1' }],
      ['oh.workspaceTree.pull', { workspaceId: 'ws-1', resolution: { token: 'token-1', side: 'mine' } }],
    ]);
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('Cancel in a Pull’s editor sends nothing more and raises no toast', async () => {
    mockCall.mockResolvedValueOnce(conflicts);
    const actions = mount();
    act(() => actions.pull());
    await toEditor();

    fireEvent.click(screen.getByTestId('merge-cancel'));
    await act(async () => {});
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Pull finished')).toBeNull();
    expect(screen.queryByText(/Pull failed/)).toBeNull();
  });

  it('files too large to resolve say so', async () => {
    mockCall.mockResolvedValueOnce({ ok: false, reason: 'conflicts', conflicts: [REQUEST], tooLarge: true });
    const actions = mount();
    act(() => actions.pull());
    await waitFor(() =>
      expect(
        screen.getByText(
          `Pull failed: Both sides changed ${REQUEST}, and the files are too large to resolve here. Nothing was changed.`,
        ),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId('merge-modal')).toBeNull();
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

  it('a Merge both branches changed is answered in the editor under its own title', async () => {
    mockCall
      .mockResolvedValueOnce(conflicts)
      .mockResolvedValueOnce({ ok: true, upToDate: false, sha: 'e'.repeat(40), applied: 1 });
    const actions = mount();
    act(() => actions.mergeIntoCurrent('local-test'));

    await toEditor('Merge local-test: Resolve Conflicts');
    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByText('Merged local-test into main (eeeeeeee)')).toBeTruthy());
    expect(mockCall.mock.calls[1]).toEqual([
      'oh.workspaceTree.mergeBranch',
      { workspaceId: 'ws-1', ref: 'local-test', resolution: answered },
    ]);
  });
});
