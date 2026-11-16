// @vitest-environment jsdom
/**
 * `useSelectedCommits` over a mocked bridge whose answers are held: a
 * selected row's commit comes off its page with the press; its changed
 * paths, and the commits the pages do not hold, are read under a key of
 * the selection's own, one read out at a time, the missing rows in as
 * few reads as cover them;
 * a commit stays once its page is let go; another list's answer is no
 * one's; past the most read together nothing is read; a refused read is
 * not asked again for the same rows.
 */

import type { WorkspaceTreeLogRowsWire, WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import type { RowRange } from '@openheaders/ui/shared/selection';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/bridge')>()),
  hostBridge: { call: mockCall, subscribe: vi.fn(), broadcast: vi.fn(), presence: vi.fn() },
}));

import {
  LOG_PAGE_ROWS,
  type LogRowPages,
  type LogRowsAsk,
  NO_LOG_ROWS,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import type { SelectedSet } from '@openheaders/ui/workbench/components/panels/git/log-selected-commits';
import { useSelectedCommits } from '@openheaders/ui/workbench/components/panels/git/use-selected-commits';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const OTHER: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, noMerges: true };

function row(at: number, list: string): WorkspaceTreeLogRowWire {
  return {
    entry: {
      sha: at.toString(16).padStart(40, '0'),
      parents: [],
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `${list} commit ${at}`,
      coAuthors: [],
      files: [],
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: [at + 1],
    child: at - 1,
  };
}

type Request = LogRowsAsk & { from: number; count: number; files?: boolean };

/** The list with the named pages held as a list reads them — no commit with its changed paths. */
function holdingBare(pages: number[]): LogRowPages {
  const held = holding(pages);
  return {
    ...held,
    pages: new Map(
      [...held.pages].map(([page, { rows: read, runs }]) => [
        page,
        { runs, rows: read.map(({ entry: { files: _files, ...head }, ...rest }) => ({ ...rest, entry: head })) },
      ]),
    ),
  };
}

/** The host's answer to `request` over a list of 100,000 rows it names `list`. */
function rows(request: { from: number; count: number }, list = 'g1'): WorkspaceTreeLogRowsWire {
  const out: WorkspaceTreeLogRowWire[] = [];
  for (let at = request.from; at < request.from + request.count; at += 1) out.push(row(at, list));
  return { ok: true, list, total: 100_000, widest: 1, rows: out, runs: [] };
}

function holding(pages: number[], ask = ASK, list = 'g1'): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    const from = page * LOG_PAGE_ROWS;
    const answer = rows({ from, count: LOG_PAGE_ROWS }, list);
    if (answer.ok) held = takeLogRows(held, ask, from, answer, { first: from, last: from + 30 });
  }
  return held;
}

interface Held {
  request: Request;
  resolve: (answer: WorkspaceTreeLogRowsWire) => void;
  reject: (fault: Error) => void;
}

let reads: Held[] = [];

interface Props {
  held: LogRowPages;
  ranges: readonly RowRange[];
}

const mount = (held: LogRowPages, ranges: readonly RowRange[]) =>
  renderHook((props: Props) => useSelectedCommits(props.held, props.ranges), { initialProps: { held, ranges } });

const settle = async (step: () => void): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const range = (first: number, last: number): RowRange => ({ first, last });
const subjects = (set: SelectedSet): string[] | string =>
  set.kind === 'commits' ? set.entries.map((entry) => entry.subject) : set.kind;
const stretch = (read: Held) => ({ from: read.request.from, count: read.request.count });

beforeEach(() => {
  reads = [];
  mockCall.mockReset();
  mockCall.mockImplementation(
    (_type: string, request: Request) =>
      new Promise<WorkspaceTreeLogRowsWire>((resolve, reject) => {
        reads.push({ request, resolve, reject });
      }),
  );
});

describe('useSelectedCommits', () => {
  it('is none with no row selected, and asks the host nothing', () => {
    const hook = mount(holding([0]), []);
    expect(hook.result.current).toEqual({ kind: 'none' });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('takes a selected row’s commit off its page — within the render, with no read', async () => {
    const HELD = holding([0]);
    const hook = mount(HELD, []);
    hook.rerender({ held: HELD, ranges: [range(3, 4)] });
    expect(subjects(hook.result.current)).toEqual(['g1 commit 3', 'g1 commit 4']);
    await settle(() => undefined);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('reads the rows the pages do not hold, under a key of the selection’s own', async () => {
    const hook = mount(holding([0]), [range(3, 3), range(5_000, 5_002)]);
    expect(hook.result.current).toEqual({ kind: 'reading', count: 4 });
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.logRows', {
      ...ASK,
      key: 'log:1:selection',
      from: 5_000,
      count: 3,
      files: true,
    });

    await settle(() => reads[0].resolve(rows(reads[0].request)));
    expect(subjects(hook.result.current)).toEqual([
      'g1 commit 3',
      'g1 commit 5000',
      'g1 commit 5001',
      'g1 commit 5002',
    ]);
    expect(reads).toHaveLength(1);
  });

  it('has a selected row’s commit off its page with the press, and reads its changed paths', async () => {
    const HELD = holdingBare([0]);
    const hook = mount(HELD, []);
    hook.rerender({ held: HELD, ranges: [range(3, 4)] });
    // The commits are the set's within the render: what acts on the set waits for nothing.
    expect(subjects(hook.result.current)).toEqual(['g1 commit 3', 'g1 commit 4']);
    expect(
      hook.result.current.kind === 'commits' && hook.result.current.entries.every((entry) => !('files' in entry)),
    ).toBe(true);
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(reads[0].request).toMatchObject({ key: 'log:1:selection', from: 3, count: 2, files: true });

    await settle(() => reads[0].resolve(rows(reads[0].request)));
    expect(hook.result.current.kind === 'commits' && hook.result.current.entries.map((entry) => entry.files)).toEqual([
      [],
      [],
    ]);
    expect(reads).toHaveLength(1);
  });

  it('reads missing rows too far apart for one read one after the other, never two at once', async () => {
    const hook = mount(holding([0]), [range(1_000, 1_000), range(1_100, 1_100), range(9_000, 9_000)]);
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(stretch(reads[0])).toEqual({ from: 1_000, count: 101 });
    await settle(() => undefined);
    expect(reads).toHaveLength(1);

    await settle(() => reads[0].resolve(rows(reads[0].request)));
    expect(hook.result.current).toEqual({ kind: 'reading', count: 3 });
    expect(reads).toHaveLength(2);
    expect(stretch(reads[1])).toEqual({ from: 9_000, count: 1 });
    await settle(() => reads[1].resolve(rows(reads[1].request)));
    expect(subjects(hook.result.current)).toEqual(['g1 commit 1000', 'g1 commit 1100', 'g1 commit 9000']);
  });

  it('keeps a commit once its page is let go — the view scrolled far away', async () => {
    const hook = mount(holding([0]), [range(3, 3)]);
    await settle(() => undefined);
    hook.rerender({ held: holding([40]), ranges: [range(3, 3)] });
    expect(subjects(hook.result.current)).toEqual(['g1 commit 3']);
    await settle(() => undefined);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('answers a selection that changed while a read was out when it lands', async () => {
    const HELD = holding([0]);
    const hook = mount(HELD, [range(5_000, 5_000)]);
    await waitFor(() => expect(reads).toHaveLength(1));
    hook.rerender({ held: HELD, ranges: [range(7_000, 7_000)] });
    await settle(() => undefined);
    // One read out: the new row waits.
    expect(reads).toHaveLength(1);

    await settle(() => reads[0].resolve(rows(reads[0].request)));
    expect(reads).toHaveLength(2);
    expect(stretch(reads[1])).toEqual({ from: 7_000, count: 1 });
    await settle(() => reads[1].resolve(rows(reads[1].request)));
    expect(subjects(hook.result.current)).toEqual(['g1 commit 7000']);
  });

  it('takes the rows selected when the answer lands out of it — one it was not read for included', async () => {
    const HELD = holding([0]);
    const hook = mount(HELD, [range(5_000, 5_000), range(5_002, 5_002)]);
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(stretch(reads[0])).toEqual({ from: 5_000, count: 3 });
    hook.rerender({ held: HELD, ranges: [range(5_001, 5_001)] });
    await settle(() => reads[0].resolve(rows(reads[0].request)));
    expect(subjects(hook.result.current)).toEqual(['g1 commit 5001']);
    expect(reads).toHaveLength(1);
  });

  it('takes nothing of an answer for another list, and reads the rows selected in the one held', async () => {
    const hook = mount(holding([0]), [range(5_000, 5_000)]);
    await waitFor(() => expect(reads).toHaveLength(1));
    // The history was read anew: the selection went with the list, and the tab's row is selected again.
    const anew = holding([0], ASK, 'g2');
    hook.rerender({ held: anew, ranges: [] });
    hook.rerender({ held: anew, ranges: [range(5_003, 5_003)] });
    await settle(() => undefined);
    expect(reads).toHaveLength(1);

    await settle(() => reads[0].resolve(rows(reads[0].request, 'g1')));
    expect(hook.result.current).toEqual({ kind: 'reading', count: 1 });
    expect(reads).toHaveLength(2);
    expect(reads[1].request).toMatchObject({ key: 'log:1:selection', from: 5_003, count: 1 });
    await settle(() => reads[1].resolve(rows(reads[1].request, 'g2')));
    expect(subjects(hook.result.current)).toEqual(['g2 commit 5003']);
  });

  it('reads under the held list’s own ask', async () => {
    mount(holding([0], OTHER), [range(5_000, 5_000)]);
    await waitFor(() => expect(reads).toHaveLength(1));
    expect(reads[0].request).toEqual({ ...OTHER, key: 'log:1:selection', from: 5_000, count: 1, files: true });
  });

  it('is a number of rows past the most read together, and reads nothing', async () => {
    const hook = mount(holding([0]), [range(0, 300)]);
    expect(hook.result.current).toEqual({ kind: 'over', count: 301 });
    await settle(() => undefined);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('does not ask again for the same rows once the host refused, and asks for another selection', async () => {
    const HELD = holding([0]);
    const hook = mount(HELD, [range(5_000, 5_000)]);
    await waitFor(() => expect(reads).toHaveLength(1));
    await settle(() => reads[0].resolve({ ok: false, reason: 'log-failed' }));
    expect(hook.result.current).toEqual({ kind: 'reading', count: 1 });
    expect(reads).toHaveLength(1);

    hook.rerender({ held: HELD, ranges: [range(6_000, 6_000)] });
    await waitFor(() => expect(reads).toHaveLength(2));
    await settle(() => reads[1].reject(new Error('host: gone')));
    expect(reads).toHaveLength(2);
  });
});
