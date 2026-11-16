// @vitest-environment jsdom
/**
 * `useLogRows` over a mocked bridge whose answers are held: one read is
 * out at a time, and the rows the view moved to meanwhile are asked
 * when it lands; a new ask, a frame of the repo, a history read anew
 * and the press of Refresh each end the read that is out; the rows of
 * the ask before stay until the new ask is answered; a list the host
 * names anew drops the rows held; a refusal is the ask's own and a
 * scroll does not ask it again; a list that is entered is first read
 * around the row it is entered at, and not before that row is found; a
 * list refused where it was to be entered is refused with no read.
 */

import type { WorkspaceTreeLogRowsWire, WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall, mockSubscribe } = vi.hoisted(() => ({ mockCall: vi.fn(), mockSubscribe: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/bridge')>()),
  hostBridge: { call: mockCall, subscribe: mockSubscribe, broadcast: vi.fn(), presence: vi.fn() },
}));

import type { LogEntranceState } from '@openheaders/ui/workbench/components/panels/git/log-entrance';
import { type LogRowsAsk, logRowAt } from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import { useLogRows } from '@openheaders/ui/workbench/components/panels/git/use-log-rows';

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

type Request = LogRowsAsk & { from: number; count: number };

/** The host's answer to `request` over a list of `total` rows it names `list`. */
function rows(request: Request, total: number, list = 'g1'): WorkspaceTreeLogRowsWire {
  const out: WorkspaceTreeLogRowWire[] = [];
  for (let at = request.from; at < Math.min(total, request.from + request.count); at += 1) out.push(row(at, list));
  return { ok: true, list, total, widest: 1, rows: out, runs: [] };
}

interface Held {
  request: Request;
  resolve: (answer: WorkspaceTreeLogRowsWire) => void;
  reject: (fault: Error) => void;
}

/** The reads in the order they were sent, each answered by hand. */
let held: Held[] = [];
/** What the hook listens to, by broadcast. */
let listeners = new Map<string, (payload: { workspaceId: string }) => void>();

const settle = async (step: () => void): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
  });
};

interface Asking {
  asking: LogRowsAsk | null;
  /** Where the ask's list is entered; null where nothing is entered — the read is where the view stands. */
  entering: LogEntranceState;
}

const mount = (ask: LogRowsAsk | null, entering: LogEntranceState = null) =>
  renderHook(({ asking, entering: entrance }: Asking) => useLogRows(asking, entrance), {
    initialProps: { asking: ask, entering },
  });

/** The stretch a read asked for. */
const stretch = (read: Held) => ({ from: read.request.from, count: read.request.count });

beforeEach(() => {
  held = [];
  listeners = new Map();
  mockCall.mockReset();
  mockCall.mockImplementation(
    (_type: string, request: Request) =>
      new Promise<WorkspaceTreeLogRowsWire>((resolve, reject) => {
        held.push({ request, resolve, reject });
      }),
  );
  mockSubscribe.mockReset();
  mockSubscribe.mockImplementation((type: string, listener: (payload: { workspaceId: string }) => void) => {
    listeners.set(type, listener);
    return () => listeners.delete(type);
  });
});

describe('useLogRows', () => {
  it('asks the host nothing while there is nothing to list', () => {
    const hook = mount(null);
    expect(mockCall).not.toHaveBeenCalled();
    expect(hook.result.current).toMatchObject({ pending: false, asked: false, refusal: null });
    expect(hook.result.current.held.total).toBe(0);
  });

  it('reads the list’s first page, pending until the host answers', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.logRows', { ...ASK, from: 0, count: 200 });
    expect(hook.result.current.pending).toBe(true);

    await settle(() => held[0].resolve(rows(held[0].request, 1_000)));
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.held).toMatchObject({ ask: ASK, list: 'g1', total: 1_000 });
    expect(logRowAt(hook.result.current.held, 7)?.entry.subject).toBe('g1 commit 7');
    // Nothing is mounted: nothing more is read.
    expect(held).toHaveLength(1);
  });

  it('reads the page a mounted row is missing from, and then a page ahead', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 10_000)));

    await settle(() => hook.result.current.want({ first: 390, last: 520 }));
    expect(held).toHaveLength(2);
    expect(stretch(held[1])).toEqual({ from: 200, count: 400 });

    await settle(() => held[1].resolve(rows(held[1].request, 10_000)));
    expect(logRowAt(hook.result.current.held, 520)?.entry.subject).toBe('g1 commit 520');
    expect(held).toHaveLength(3);
    expect(stretch(held[2])).toEqual({ from: 600, count: 200 });
  });

  it('asks nothing for rows it holds', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 150)));
    await settle(() => hook.result.current.want({ first: 0, last: 40 }));
    await settle(() => hook.result.current.want({ first: 60, last: 149 }));
    expect(held).toHaveLength(1);
  });

  it('holds the rows the view moved to until the read that is out lands', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 100_000)));

    await settle(() => hook.result.current.want({ first: 1_010, last: 1_090 }));
    expect(stretch(held[1])).toEqual({ from: 1_000, count: 200 });
    await settle(() => hook.result.current.want({ first: 40_010, last: 40_090 }));
    await settle(() => hook.result.current.want({ first: 70_010, last: 70_090 }));
    expect(held).toHaveLength(2);

    await settle(() => held[1].resolve(rows(held[1].request, 100_000)));
    expect(held).toHaveLength(3);
    expect(stretch(held[2])).toEqual({ from: 70_000, count: 200 });
    expect(logRowAt(hook.result.current.held, 1_050)?.entry.subject).toBe('g1 commit 1050');
  });

  it('reads a new ask at once, the rows of the ask before standing until it is answered', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 1_000)));
    await settle(() => hook.result.current.want({ first: 410, last: 490 }));
    expect(held).toHaveLength(2);

    hook.rerender({ asking: OTHER, entering: null });
    await waitFor(() => expect(held).toHaveLength(3));
    expect(held[2].request).toEqual({ ...OTHER, from: 400, count: 200 });
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.held.ask).toBe(ASK);

    // The read it ended answers last: it is no one's.
    await settle(() => held[2].resolve(rows(held[2].request, 900, 'g1')));
    await settle(() => held[1].resolve(rows(held[1].request, 1_000)));
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.held).toMatchObject({ ask: OTHER, total: 900 });
    expect(logRowAt(hook.result.current.held, 7)).toBeNull();
    expect(logRowAt(hook.result.current.held, 410)?.entry.subject).toBe('g1 commit 410');
  });

  it('lets go of everything when there is nothing to list any more', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 1_000)));
    await settle(() => hook.result.current.want({ first: 210, last: 290 }));
    expect(held).toHaveLength(2);

    await settle(() => hook.rerender({ asking: null, entering: null }));
    expect(hook.result.current.held.total).toBe(0);
    expect(logRowAt(hook.result.current.held, 7)).toBeNull();

    // The read that was out answers no one.
    await settle(() => held[1].resolve(rows(held[1].request, 1_000)));
    expect(hook.result.current.held.total).toBe(0);
    expect(hook.result.current.pending).toBe(false);
    expect(held).toHaveLength(2);
  });

  for (const broadcast of ['workspaceTreeGitStatus', 'workspaceTreeLogHistory']) {
    it(`reads where the view stands again on ${broadcast}, and drops the rows of a list named anew`, async () => {
      const hook = mount(ASK);
      await waitFor(() => expect(held).toHaveLength(1));
      await settle(() => held[0].resolve(rows(held[0].request, 1_000)));
      await settle(() => hook.result.current.want({ first: 210, last: 290 }));
      await settle(() => held[1].resolve(rows(held[1].request, 1_000)));
      const before = held.length;

      await settle(() => listeners.get(broadcast)?.({ workspaceId: 'ws-2' }));
      expect(held).toHaveLength(before);

      await settle(() => listeners.get(broadcast)?.({ workspaceId: 'ws-1' }));
      expect(held).toHaveLength(before + 1);
      expect(held[before].request).toEqual({ ...ASK, from: 200, count: 200 });
      expect(hook.result.current.pending).toBe(false);
      expect(hook.result.current.asked).toBe(false);

      await settle(() => held[before].resolve(rows(held[before].request, 1_001, 'g2')));
      expect(hook.result.current.held).toMatchObject({ list: 'g2', total: 1_001 });
      expect(logRowAt(hook.result.current.held, 7)).toBeNull();
      expect(logRowAt(hook.result.current.held, 210)?.entry.subject).toBe('g2 commit 210');
    });
  }

  it('keeps the rows it holds when the same list answers a frame', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 1_000)));
    await settle(() => hook.result.current.want({ first: 210, last: 290 }));
    await settle(() => held[1].resolve(rows(held[1].request, 1_000)));
    const first = logRowAt(hook.result.current.held, 7);

    await settle(() => listeners.get('workspaceTreeGitStatus')?.({ workspaceId: 'ws-1' }));
    const again = held[held.length - 1];
    await settle(() => again.resolve(rows(again.request, 1_000)));
    expect(logRowAt(hook.result.current.held, 7)).toBe(first);
  });

  it('a frame ends the read that is out: its answer is no one’s', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => listeners.get('workspaceTreeGitStatus')?.({ workspaceId: 'ws-1' }));
    expect(held).toHaveLength(2);

    await settle(() => held[1].resolve(rows(held[1].request, 500, 'g2')));
    await settle(() => held[0].resolve(rows(held[0].request, 400, 'g1')));
    expect(hook.result.current.held).toMatchObject({ list: 'g2', total: 500 });
  });

  it('sends the press of Refresh as the person’s word, asked while it is out', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 1_000)));

    await settle(() => hook.result.current.refresh());
    expect(held).toHaveLength(2);
    expect(held[1].request).toEqual({ ...ASK, from: 0, count: 200, refresh: true });
    expect(hook.result.current.asked).toBe(true);

    await settle(() => held[1].resolve(rows(held[1].request, 1_000)));
    expect(hook.result.current.asked).toBe(false);
    // The reads that follow are the view's own.
    await settle(() => hook.result.current.want({ first: 210, last: 290 }));
    expect(held[2].request).toEqual({ ...ASK, from: 200, count: 200 });
  });

  it('says what the host refused the ask with, and does not ask it again on a scroll', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve({ ok: false, reason: 'unknown-ref', unknownRefs: ['gone'] }));
    expect(hook.result.current.refusal).toEqual({ ok: false, reason: 'unknown-ref', unknownRefs: ['gone'] });
    expect(hook.result.current.pending).toBe(false);

    await settle(() => hook.result.current.want({ first: 210, last: 290 }));
    expect(held).toHaveLength(1);

    // A frame asks it again; an answer clears what was refused.
    await settle(() => listeners.get('workspaceTreeGitStatus')?.({ workspaceId: 'ws-1' }));
    expect(held).toHaveLength(2);
    await settle(() => held[1].resolve(rows(held[1].request, 1_000)));
    expect(hook.result.current.refusal).toBeNull();
  });

  it('keeps a refusal the ask’s own: another ask is read and starts with none', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve({ ok: false, reason: 'log-timeout' }));
    hook.rerender({ asking: OTHER, entering: null });
    await waitFor(() => expect(held).toHaveLength(2));
    expect(hook.result.current.refusal).toBeNull();
    expect(hook.result.current.pending).toBe(true);
  });

  it('says nothing of a read the host ended for a newer one', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve({ ok: false, reason: 'superseded' }));
    expect(hook.result.current.refusal).toBeNull();
    expect(hook.result.current.pending).toBe(true);
  });

  it('reads a host that is gone as a refusal', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].reject(new Error('bridge closed')));
    expect(hook.result.current.refusal).toEqual({ ok: false, reason: 'log-failed', detail: 'bridge closed' });
  });

  it('listens to no frame once it is gone', async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    hook.unmount();
    expect(listeners.size).toBe(0);
  });
});

describe('useLogRows — a list that is entered', () => {
  const SHA = 'c'.repeat(40);

  /** The first list held, the view standing on rows 410–490 of it. */
  const standing = async () => {
    const hook = mount(ASK);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(rows(held[0].request, 100_000)));
    await settle(() => hook.result.current.want({ first: 410, last: 490 }));
    await settle(() => held[1].resolve(rows(held[1].request, 100_000)));
    return hook;
  };

  it('reads nothing while the row it is entered at is being found — the rows before stay', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: 'finding' }));
    expect(held).toHaveLength(before);
    expect(hook.result.current.pending).toBe(true);
    expect(hook.result.current.held.ask).toBe(ASK);

    // The view goes on reporting the rows of the list before: nothing is read for them under the new ask.
    await settle(() => hook.result.current.want({ first: 430, last: 510 }));
    await settle(() => listeners.get('workspaceTreeGitStatus')?.({ workspaceId: 'ws-1' }));
    expect(held).toHaveLength(before);
  });

  it('reads first around the row found, as many rows as the view has mounted — never where the list before was looked at', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: 'finding' }));
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: 3_100, list: 'g1', sha: SHA } }));
    // 81 rows are mounted: rows 3,060–3,140 will be, all on one page.
    expect(held).toHaveLength(before + 1);
    expect(held[before].request).toEqual({ ...OTHER, from: 3_000, count: 200 });

    await settle(() => held[before].resolve(rows(held[before].request, 90_000)));
    expect(hook.result.current.pending).toBe(false);
    expect(logRowAt(hook.result.current.held, 3_100)?.entry.subject).toBe('g1 commit 3100');
    // The view stands there from the list's first draw: what is read next is ahead of THOSE rows.
    expect(held).toHaveLength(before + 2);
    expect(stretch(held[before + 1])).toEqual({ from: 2_800, count: 200 });
  });

  it('reads two pages at once where the rows around the row found sit on two', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: 3_010, list: 'g1', sha: SHA } }));
    expect(stretch(held[before])).toEqual({ from: 2_800, count: 400 });
  });

  it('reads the list’s first page where it is entered at its top', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: null } }));
    expect(held).toHaveLength(before + 1);
    expect(held[before].request).toEqual({ ...OTHER, from: 0, count: 200 });
  });

  it('reads the first rows of a list entered before any view has mounted', async () => {
    mount(ASK, { ask: ASK, row: 5_020, list: 'g1', sha: SHA });
    await waitFor(() => expect(held).toHaveLength(1));
    // 50 rows each way of the row.
    expect(held[0].request).toEqual({ ...ASK, from: 4_800, count: 400 });
  });

  it('reads where the view stands where the entrance is another ask’s — a fold of the listing drawn', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: ASK, row: 3_100, list: 'g1', sha: SHA } }));
    expect(held[before].request).toEqual({ ...OTHER, from: 400, count: 200 });
  });

  it('reads the same rows again on a frame while the entrance’s read is out, and still enters there', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: 3_100, list: 'g1', sha: SHA } }));
    await settle(() => listeners.get('workspaceTreeLogHistory')?.({ workspaceId: 'ws-1' }));
    expect(held).toHaveLength(before + 2);
    expect(held[before + 1].request).toEqual({ ...OTHER, from: 3_000, count: 200 });

    await settle(() => held[before + 1].resolve(rows(held[before + 1].request, 90_000, 'g2')));
    await settle(() => held[before].resolve(rows(held[before].request, 90_000)));
    expect(hook.result.current.held).toMatchObject({ ask: OTHER, list: 'g2' });
    expect(stretch(held[before + 2])).toEqual({ from: 2_800, count: 200 });
  });

  it('carries a press of Refresh made while the row is being found on the entrance’s read', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: 'finding' }));
    await settle(() => hook.result.current.refresh());
    expect(held).toHaveLength(before);

    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: null } }));
    expect(held[before].request).toEqual({ ...OTHER, from: 0, count: 200, refresh: true });
    expect(hook.result.current.asked).toBe(true);
    await settle(() => held[before].resolve(rows(held[before].request, 900)));
    expect(hook.result.current.asked).toBe(false);
    // The press is spent: the reads that follow are the view's own.
    await settle(() => hook.result.current.want({ first: 210, last: 290 }));
    expect(held[before + 1].request).toEqual({ ...OTHER, from: 200, count: 200 });
  });

  const TIMEOUT = { ok: false, reason: 'search-timeout' } as const;

  it('takes a list refused where it was to be entered as refused — no row of it is read, by the entrance or by a scroll', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: 'finding' }));
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: null, refusal: TIMEOUT } }));
    expect(held).toHaveLength(before);
    expect(hook.result.current.refusal).toBe(TIMEOUT);
    expect(hook.result.current.pending).toBe(false);
    expect(hook.result.current.asked).toBe(false);

    await settle(() => hook.result.current.want({ first: 430, last: 510 }));
    expect(held).toHaveLength(before);
  });

  it('reads a list refused at its entrance again on a press of Refresh — from its top, and holds what answers', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: null, refusal: TIMEOUT } }));
    expect(held).toHaveLength(before);

    await settle(() => hook.result.current.refresh());
    expect(held).toHaveLength(before + 1);
    expect(held[before].request).toEqual({ ...OTHER, from: 0, count: 200, refresh: true });
    expect(hook.result.current.asked).toBe(true);

    await settle(() => held[before].resolve(rows(held[before].request, 900)));
    expect(hook.result.current.refusal).toBeNull();
    expect(hook.result.current.held).toMatchObject({ ask: OTHER, total: 900 });
    // Held, the list is read like any other: the entrance's refusal says nothing more.
    await settle(() => hook.result.current.want({ first: 210, last: 290 }));
    expect(held[before + 1].request).toEqual({ ...OTHER, from: 200, count: 200 });
    expect(hook.result.current.refusal).toBeNull();
  });

  it('asks a list refused at its entrance again where a press of Refresh was made while it was being found', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: 'finding' }));
    await settle(() => hook.result.current.refresh());
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: OTHER, row: null, refusal: TIMEOUT } }));
    expect(held).toHaveLength(before + 1);
    expect(held[before].request).toEqual({ ...OTHER, from: 0, count: 200, refresh: true });
    expect(hook.result.current.refusal).toBeNull();

    // Refused again, it is the read's own refusal — and no scroll asks after it.
    await settle(() => held[before].resolve({ ok: false, reason: 'log-timeout' }));
    expect(hook.result.current.refusal).toEqual({ ok: false, reason: 'log-timeout' });
    await settle(() => hook.result.current.want({ first: 430, last: 510 }));
    expect(held).toHaveLength(before + 1);
  });

  it('takes no refusal from an entrance of another ask — a fold of the listing is read where the view stands', async () => {
    const hook = await standing();
    const before = held.length;
    await settle(() => hook.rerender({ asking: OTHER, entering: { ask: ASK, row: null, refusal: TIMEOUT } }));
    expect(held[before].request).toEqual({ ...OTHER, from: 400, count: 200 });
    expect(hook.result.current.refusal).toBeNull();
  });
});
