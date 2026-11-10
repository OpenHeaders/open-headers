// @vitest-environment jsdom
/**
 * The log's Cherry-Pick and Revert Commit on the surface: the order a
 * set is applied in (a pick oldest first, a revert newest first), one
 * host verb per commit with the FULL sha, the stop at the first commit
 * the host does not record, and what each answer says — the finished
 * toast, the documents both sides changed, what was left out, the
 * files the branch kept, the uncommitted work that was committed
 * first. The conflict describe pins the editor leg: a
 * refusal that carries files opens the shared merge editor, the same
 * verb goes again with the answers and the token, the set waits and
 * resumes, Cancel ends it, and a stale token reopens on the new files.
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

// The Monaco editor stays out of jsdom: the stub keeps the modal's contract — Complete Merge answers
// every file with the commit's text and closes when every outcome is ok; Cancel tells the session.
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
import { commitApplyOrder, shortSha } from '@openheaders/ui/workbench/components/panels/git/commit-apply';
import {
  type CommitApplyActions,
  useCommitApply,
} from '@openheaders/ui/workbench/components/panels/git/use-commit-apply';

const NEWEST = 'a'.repeat(40);
const MIDDLE = 'b'.repeat(40);
const OLDEST = 'c'.repeat(40);

beforeAll(() => {
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

function mount(): CommitApplyActions {
  let actions: CommitApplyActions | null = null;
  const Probe: React.FC = () => {
    actions = useCommitApply('ws-1');
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

const calledShas = (): string[] => mockCall.mock.calls.map(([, payload]) => (payload as { sha: string }).sha);

describe('commitApplyOrder', () => {
  it('a pick replays oldest first; a revert unwinds newest first', () => {
    expect(commitApplyOrder([NEWEST, MIDDLE, OLDEST], 'pick')).toEqual([OLDEST, MIDDLE, NEWEST]);
    expect(commitApplyOrder([NEWEST, MIDDLE, OLDEST], 'revert')).toEqual([NEWEST, MIDDLE, OLDEST]);
    expect(shortSha(NEWEST)).toBe('aaaaaaa');
  });
});

// The locale context answers English here, so the pin reads the words.
describe('useCommitApply', () => {
  it('picks a set oldest first, one verb per commit, and says it finished', async () => {
    mockCall.mockResolvedValue({ ok: true, sha: 'd'.repeat(40) });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST, OLDEST]));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([
      ['oh.workspaceTree.applyCommit', { workspaceId: 'ws-1', sha: OLDEST, mode: 'pick' }],
      ['oh.workspaceTree.applyCommit', { workspaceId: 'ws-1', sha: NEWEST, mode: 'pick' }],
    ]);
  });

  it('reverts a set newest first', async () => {
    mockCall.mockResolvedValue({ ok: true, sha: 'd'.repeat(40) });
    const actions = mount();
    act(() => actions.revert([NEWEST, OLDEST]));
    await waitFor(() => expect(screen.getByText('Revert finished')).toBeTruthy());
    expect(calledShas()).toEqual([NEWEST, OLDEST]);
  });

  it('stops at the first commit both sides changed, names the documents, and still reports what landed before it', async () => {
    mockCall
      .mockResolvedValueOnce({ ok: true, sha: 'd'.repeat(40) })
      .mockResolvedValueOnce({ ok: false, reason: 'conflicts', conflicts: ['rules/a/rule.yaml'] });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST, MIDDLE, OLDEST]));
    await waitFor(() =>
      expect(
        screen.getByText('The branch and commit bbbbbbb both changed rules/a/rule.yaml. Nothing was applied.'),
      ).toBeTruthy(),
    );
    expect(calledShas()).toEqual([OLDEST, MIDDLE]);
    expect(screen.getByText('Cherry-pick finished')).toBeTruthy();
  });

  it('a conflict whose files are too large to send says so and opens no editor', async () => {
    mockCall.mockResolvedValueOnce({
      ok: false,
      reason: 'conflicts',
      conflicts: ['rules/a/rule.yaml'],
      tooLarge: true,
    });
    const actions = mount();
    act(() => actions.cherryPick([OLDEST]));
    await waitFor(() =>
      expect(
        screen.getByText(
          'The branch and commit ccccccc both changed rules/a/rule.yaml, and the files are too large to resolve here. Nothing was applied.',
        ),
      ).toBeTruthy(),
    );
    expect(mockCall).toHaveBeenCalledTimes(1);
  });

  it('a refused single commit raises no finished toast', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'unsupported-commit', detail: 'merge' });
    const actions = mount();
    act(() => actions.revert([NEWEST]));
    await waitFor(() =>
      expect(
        screen.getByText('Commit aaaaaaa has no single change to apply: it is a merge or the first commit.'),
      ).toBeTruthy(),
    );
    expect(screen.queryByText('Revert finished')).toBeNull();
  });

  it('a change the branch already holds reads by its mode', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'empty' });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() =>
      expect(screen.getByText('Nothing to cherry-pick from aaaaaaa: the branch already has this change.')).toBeTruthy(),
    );
  });

  it('says what was left out and which files the branch kept, beside the finished toast', async () => {
    mockCall.mockResolvedValue({
      ok: true,
      sha: 'd'.repeat(40),
      skipped: [{ uid: 'rul0000a', path: 'rules/a/rule.yaml', reason: 'missing' }],
      keptLocal: ['README.md'],
    });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(
      screen.getByText('Part of the change was left out because the branch does not match it: rules/a/rule.yaml.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Both sides changed README.md. Your version was kept and the incoming change was not taken.'),
    ).toBeTruthy();
  });

  it('names the files whose uncommitted work was committed first; a pick that committed none says nothing of it', async () => {
    mockCall.mockResolvedValue({
      ok: true,
      sha: 'd'.repeat(40),
      committedLocal: ['requests/status-probe/request.yaml'],
    });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(
      screen.getByText(
        'Your uncommitted changes to requests/status-probe/request.yaml were committed first, in a commit of their own.',
      ),
    ).toBeTruthy();

    cleanup();
    mockCall.mockResolvedValue({ ok: true, sha: 'd'.repeat(40) });
    const again = mount();
    act(() => again.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(screen.queryByText(/were committed first/)).toBeNull();
  });

  it('any other refusal names the commit and the host reason', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'op-in-progress' });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByText('Could not cherry-pick aaaaaaa: op-in-progress')).toBeTruthy());
  });
});

describe('useCommitApply — a conflict answered in the merge editor', () => {
  const RULE = 'rules/a/rule.yaml';
  const FILE = { path: RULE, base: 'name: Probe\n', theirs: 'name: Picked\n', mine: 'name: Local\n' };
  const conflicts = (token: string, file = FILE) => ({
    ok: false,
    reason: 'conflicts',
    conflicts: [RULE],
    resolve: { token, files: [file] },
  });
  const answered = (token: string, sha: string, content = FILE.theirs) => [
    'oh.workspaceTree.applyCommit',
    { workspaceId: 'ws-1', sha, mode: 'pick', resolution: { token, files: [{ path: RULE, content }] } },
  ];

  it('opens the editor on the files, sends the answers with the token, and the set resumes', async () => {
    mockCall
      .mockResolvedValueOnce(conflicts('tok-1'))
      .mockResolvedValueOnce({ ok: true, sha: 'd'.repeat(40) })
      .mockResolvedValueOnce({ ok: true, sha: 'e'.repeat(40) });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST, OLDEST]));

    await waitFor(() =>
      expect(screen.getByTestId('merge-title').textContent).toBe('Cherry-Pick ccccccc: Resolve Conflicts'),
    );
    expect(screen.getByTestId('merge-files').textContent).toBe(RULE);
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/both changed/)).toBeNull();

    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(mockCall.mock.calls).toEqual([
      ['oh.workspaceTree.applyCommit', { workspaceId: 'ws-1', sha: OLDEST, mode: 'pick' }],
      answered('tok-1', OLDEST),
      ['oh.workspaceTree.applyCommit', { workspaceId: 'ws-1', sha: NEWEST, mode: 'pick' }],
    ]);
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('a revert reads by its own title', async () => {
    mockCall.mockResolvedValueOnce({ ...conflicts('tok-1') });
    const actions = mount();
    act(() => actions.revert([NEWEST]));
    await waitFor(() =>
      expect(screen.getByTestId('merge-title').textContent).toBe('Revert aaaaaaa: Resolve Conflicts'),
    );
  });

  it('Cancel ends the set with nothing sent and nothing said about the commit', async () => {
    mockCall.mockResolvedValueOnce({ ok: true, sha: 'd'.repeat(40) }).mockResolvedValueOnce(conflicts('tok-1'));
    const actions = mount();
    act(() => actions.cherryPick([NEWEST, MIDDLE, OLDEST]));
    await waitFor(() => expect(screen.getByTestId('merge-modal')).toBeTruthy());

    fireEvent.click(screen.getByTestId('merge-cancel'));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(calledShas()).toEqual([OLDEST, MIDDLE]);
    expect(screen.queryByTestId('merge-modal')).toBeNull();
    expect(screen.queryByText(/Could not cherry-pick/)).toBeNull();
    expect(screen.queryByText(/both changed/)).toBeNull();
  });

  it('an answer the host cannot read keeps the editor open on that file', async () => {
    mockCall
      .mockResolvedValueOnce(conflicts('tok-1'))
      .mockResolvedValueOnce({ ok: false, reason: 'resolution-invalid', detail: 'bad indentation', file: RULE })
      .mockResolvedValueOnce({ ok: true, sha: 'd'.repeat(40) });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByTestId('merge-modal')).toBeTruthy());

    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByTestId('merge-errors').textContent).toBe(`${RULE}: bad indentation`));
    expect(screen.queryByText('Cherry-pick finished')).toBeNull();

    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('a token the branch moved away from reopens on the files as they stand, and says so', async () => {
    const moved = { ...FILE, mine: 'name: Moved on\n' };
    mockCall
      .mockResolvedValueOnce(conflicts('tok-1'))
      .mockResolvedValueOnce(conflicts('tok-2', moved))
      .mockResolvedValueOnce({ ok: true, sha: 'd'.repeat(40) });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByTestId('merge-modal')).toBeTruthy());

    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() =>
      expect(screen.getByText('The branch changed while you were resolving. Review the conflicts again.')).toBeTruthy(),
    );
    expect(screen.getByTestId('merge-modal')).toBeTruthy();
    expect(screen.queryByText('Cherry-pick finished')).toBeNull();

    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(mockCall.mock.calls[2]).toEqual(answered('tok-2', NEWEST));
  });

  it('an answer that leaves nothing to record closes the editor and reads as empty', async () => {
    mockCall.mockResolvedValueOnce(conflicts('tok-1')).mockResolvedValueOnce({ ok: false, reason: 'empty' });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByTestId('merge-modal')).toBeTruthy());

    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() =>
      expect(screen.getByText('Nothing to cherry-pick from aaaaaaa: the branch already has this change.')).toBeTruthy(),
    );
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });

  it('two conflicted commits in a set are answered one after the other', async () => {
    mockCall
      .mockResolvedValueOnce(conflicts('tok-1'))
      .mockResolvedValueOnce({ ok: true, sha: 'd'.repeat(40) })
      .mockResolvedValueOnce(conflicts('tok-2'))
      .mockResolvedValueOnce({ ok: true, sha: 'e'.repeat(40) });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST, OLDEST]));

    await waitFor(() => expect(screen.getByTestId('merge-title').textContent).toContain('ccccccc'));
    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByTestId('merge-title').textContent).toContain('aaaaaaa'));
    fireEvent.click(screen.getByTestId('merge-apply'));
    await waitFor(() => expect(screen.getByText('Cherry-pick finished')).toBeTruthy());
    expect(mockCall.mock.calls[3]).toEqual(answered('tok-2', NEWEST));
    expect(screen.queryByTestId('merge-modal')).toBeNull();
  });
});
