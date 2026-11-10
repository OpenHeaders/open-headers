// @vitest-environment jsdom
/**
 * The log's Cherry-Pick and Revert Commit on the surface: the order a
 * set is applied in (a pick oldest first, a revert newest first), one
 * host verb per commit with the FULL sha, the stop at the first commit
 * the host does not record, and what each answer says — the finished
 * toast, the documents both sides changed, what was left out, the
 * files the branch kept.
 */

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
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
    return null;
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

  it('any other refusal names the commit and the host reason', async () => {
    mockCall.mockResolvedValue({ ok: false, reason: 'op-in-progress' });
    const actions = mount();
    act(() => actions.cherryPick([NEWEST]));
    await waitFor(() => expect(screen.getByText('Could not cherry-pick aaaaaaa: op-in-progress')).toBeTruthy());
  });
});
