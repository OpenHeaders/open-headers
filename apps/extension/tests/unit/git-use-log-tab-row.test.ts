// @vitest-environment jsdom
/**
 * `useLogTabRow` over a mocked bridge whose answers are held: a gesture
 * on the list knows its row and asks nothing; the tab's commit is asked
 * of the host whenever its row in the held list is not known, one ask
 * at a time; a row walked to gets its commit when its page lands; a
 * navigation goes first and says what became of it; a new listing is
 * looked at from its top, then on the tab's commit; a fold and a list
 * read anew move nothing.
 */

import type { WorkspaceTreeLocateLogRowWire, WorkspaceTreeLogRowWire } from '@openheaders/core/bridge';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
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
import { type LogGoToOutcome, useLogTabRow } from '@openheaders/ui/workbench/components/panels/git/use-log-tab-row';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const FOLDED: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, foldAll: true };
const OTHER: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true, noMerges: true };

const sha = (row: number): string => row.toString(16).padStart(40, '0');

function row(at: number): WorkspaceTreeLogRowWire {
  return {
    entry: {
      sha: sha(at),
      parents: [sha(at + 1)],
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `commit ${at}`,
      coAuthors: [],
      files: [],
    },
    cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
    parents: [at + 1],
    child: at - 1,
  };
}

/** A list of 10,000 rows with the named pages held, under the two names given. */
function holding(pages: number[], ask = ASK, list = 'g1'): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    const from = page * LOG_PAGE_ROWS;
    const rows = Array.from({ length: LOG_PAGE_ROWS }, (_, at) => row(from + at));
    held = takeLogRows(
      held,
      ask,
      from,
      { ok: true, list, total: 10_000, widest: 1, rows, runs: [] },
      {
        first: from,
        last: from + 30,
      },
    );
  }
  return held;
}

interface Asked {
  request: LogRowsAsk & { target: string };
  resolve: (answer: WorkspaceTreeLocateLogRowWire) => void;
  reject: (fault: Error) => void;
}

/** The asks in the order they were sent, each answered by hand. */
let asked: Asked[] = [];

interface Props {
  held: LogRowPages;
  listing: string | null;
  landed: boolean;
}

/** The tab's part: it remembers the commit the hook gives it. */
function mount(initial: Props, commit: string | null = null) {
  return renderHook(
    (props: Props) => {
      const [tabSha, setTabSha] = useState(commit);
      return { tabSha, setTabSha, row: useLogTabRow(props.held, props.listing, props.landed, tabSha, setTabSha) };
    },
    { initialProps: initial },
  );
}

const settle = async (step: () => void): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const found = (at: number, list = 'g1'): WorkspaceTreeLocateLogRowWire => ({ ok: true, list, row: at });
const AT_REST: Props = { held: holding([0]), listing: 'all', landed: true };

beforeEach(() => {
  asked = [];
  mockCall.mockReset();
  mockCall.mockImplementation(
    (_type: string, request: LogRowsAsk & { target: string }) =>
      new Promise<WorkspaceTreeLocateLogRowWire>((resolve, reject) => {
        asked.push({ request, resolve, reject });
      }),
  );
});

describe('useLogTabRow — a gesture on the list', () => {
  it('gives the tab the pressed row’s commit and asks the host nothing', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    expect(hook.result.current.tabSha).toBe(sha(7));
    expect(hook.result.current.row.row).toBe(7);
    expect(hook.result.current.row.finding).toBe(false);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('leaves the tab with no commit when nothing stays selected', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    await settle(() => hook.result.current.row.select(null));
    expect(hook.result.current.tabSha).toBeNull();
    expect(hook.result.current.row).toMatchObject({ row: null, finding: false });
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('holds a row walked to as the tab’s before its commit is read, and takes the commit when its page lands', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    await settle(() => hook.result.current.row.select(4_321));
    expect(hook.result.current.row.row).toBe(4_321);
    expect(hook.result.current.tabSha).toBe(sha(7));
    expect(mockCall).not.toHaveBeenCalled();

    await settle(() => hook.rerender({ ...AT_REST, held: holding([0, 21]) }));
    expect(hook.result.current.tabSha).toBe(sha(4_321));
    expect(hook.result.current.row.row).toBe(4_321);
    expect(mockCall).not.toHaveBeenCalled();

    // The row has its commit now: a commit the tab is given from elsewhere is asked about, and stays the tab's.
    await settle(() => hook.result.current.setTabSha(sha(9)));
    expect(asked).toHaveLength(1);
    expect(asked[0].request.target).toBe(sha(9));
    expect(hook.result.current.tabSha).toBe(sha(9));
  });

  it('walks to a row: it is the tab’s and comes into view, each walk its own', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.walkTo(9));
    expect(hook.result.current.tabSha).toBe(sha(9));
    const first = hook.result.current.row.scrollTo;
    expect(first?.row).toBe(9);
    await settle(() => hook.result.current.row.walkTo(9));
    expect(hook.result.current.row.scrollTo?.row).toBe(9);
    expect(hook.result.current.row.scrollTo?.nonce).not.toBe(first?.nonce);
  });
});

describe('useLogTabRow — the tab’s commit in the held list', () => {
  it('asks where a remembered commit sits, selects its row and brings it into view', async () => {
    const hook = mount(AT_REST, sha(4_321));
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(mockCall).toHaveBeenCalledWith('oh.workspaceTree.locateLogRow', { ...ASK, target: sha(4_321) });
    expect(hook.result.current.row).toMatchObject({ row: null, finding: true, scrollTo: null });

    await settle(() => asked[0].resolve(found(4_321)));
    expect(hook.result.current.row).toMatchObject({ row: 4_321, finding: false });
    expect(hook.result.current.row.scrollTo?.row).toBe(4_321);
    expect(hook.result.current.tabSha).toBe(sha(4_321));
    expect(asked).toHaveLength(1);
  });

  it('asks nothing while no list is held, and asks once one is', async () => {
    const hook = mount({ held: NO_LOG_ROWS, listing: 'all', landed: false }, sha(7));
    await settle(() => undefined);
    expect(mockCall).not.toHaveBeenCalled();
    await settle(() => hook.rerender(AT_REST));
    expect(asked).toHaveLength(1);
  });

  it('keeps a commit the list leaves out as the tab’s, on no row', async () => {
    const hook = mount(AT_REST, sha(7));
    await waitFor(() => expect(asked).toHaveLength(1));
    await settle(() => asked[0].resolve({ ok: false, reason: 'not-listed' }));
    expect(hook.result.current.row).toMatchObject({ row: null, finding: false, scrollTo: null });
    expect(hook.result.current.tabSha).toBe(sha(7));
    expect(asked).toHaveLength(1);
  });

  it('keeps the commit on no row when the host cannot say, and does not ask again', async () => {
    const hook = mount(AT_REST, sha(7));
    await waitFor(() => expect(asked).toHaveLength(1));
    await settle(() => asked[0].reject(new Error("host: RPC 'oh.workspaceTree.locateLogRow' is not implemented")));
    expect(hook.result.current.row).toMatchObject({ row: null, finding: false });
    expect(hook.result.current.tabSha).toBe(sha(7));
    expect(asked).toHaveLength(1);
  });

  it('takes a superseded ask for no answer — the commit is still being found', async () => {
    const hook = mount(AT_REST, sha(7));
    await waitFor(() => expect(asked).toHaveLength(1));
    await settle(() => asked[0].resolve({ ok: false, reason: 'superseded' }));
    expect(hook.result.current.row).toMatchObject({ row: null, finding: true });
  });

  it('asks again when the history was read anew, and moves the view nowhere', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    const before = hook.result.current.row.scrollTo;

    await settle(() => hook.rerender({ ...AT_REST, held: holding([0], ASK, 'g2') }));
    expect(asked).toHaveLength(1);
    expect(asked[0].request).toEqual({ ...ASK, target: sha(7) });
    expect(hook.result.current.row).toMatchObject({ row: null, finding: true });

    await settle(() => asked[0].resolve(found(9, 'g2')));
    expect(hook.result.current.row).toMatchObject({ row: 9, finding: false });
    expect(hook.result.current.row.scrollTo).toBe(before);
  });

  it('asks again under a fold — another ask of the same listing — and moves the view nowhere', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    const before = hook.result.current.row.scrollTo;

    // The fold is asked: the rows of the ask before stay drawn, and so does the tab's row.
    await settle(() => hook.rerender({ ...AT_REST, landed: false }));
    expect(hook.result.current.row.row).toBe(7);
    expect(asked).toHaveLength(0);

    await settle(() => hook.rerender({ ...AT_REST, held: holding([0], FOLDED) }));
    expect(asked[0].request).toEqual({ ...FOLDED, target: sha(7) });
    await settle(() => asked[0].resolve(found(3)));
    expect(hook.result.current.row.row).toBe(3);
    expect(hook.result.current.row.scrollTo).toBe(before);
  });

  it('takes no answer for another list than the held one, and asks again when the held list changes', async () => {
    const hook = mount(AT_REST, sha(7));
    await waitFor(() => expect(asked).toHaveLength(1));
    // The host already answers from a reading the view does not hold yet.
    await settle(() => asked[0].resolve(found(9, 'g2')));
    expect(hook.result.current.row).toMatchObject({ row: null, finding: true });

    await settle(() => hook.rerender({ ...AT_REST, held: holding([0], ASK, 'g2') }));
    expect(asked).toHaveLength(2);
    await settle(() => asked[1].resolve(found(9, 'g2')));
    expect(hook.result.current.row.row).toBe(9);
  });

  it('takes only the newest ask’s answer', async () => {
    const hook = mount(AT_REST, sha(7));
    await waitFor(() => expect(asked).toHaveLength(1));
    await settle(() => hook.result.current.setTabSha(sha(9)));
    expect(asked).toHaveLength(2);
    expect(asked[1].request.target).toBe(sha(9));
    await settle(() => asked[1].resolve(found(9)));
    await settle(() => asked[0].resolve(found(7)));
    expect(hook.result.current.row.row).toBe(9);
  });
});

describe('useLogTabRow — another listing', () => {
  it('is looked at from its top at once, then on the tab’s commit once its rows are held', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(150));
    expect(hook.result.current.row.scrollTo).toBeNull();

    // The filter is asked: the old rows stay drawn, from their top.
    await settle(() => hook.rerender({ ...AT_REST, listing: 'no merges', landed: false }));
    expect(hook.result.current.row.scrollTo?.row).toBe(0);
    expect(asked).toHaveLength(0);

    await settle(() => hook.rerender({ held: holding([0], OTHER), listing: 'no merges', landed: true }));
    expect(asked).toHaveLength(1);
    expect(hook.result.current.row.scrollTo?.row).toBe(0);
    await settle(() => asked[0].resolve(found(120)));
    expect(hook.result.current.row.row).toBe(120);
    expect(hook.result.current.row.scrollTo?.row).toBe(120);
  });

  it('stays at its top where it leaves the tab’s commit out, or the tab has none', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(150));
    await settle(() => hook.rerender({ held: holding([0], OTHER), listing: 'no merges', landed: true }));
    const top = hook.result.current.row.scrollTo;
    expect(top?.row).toBe(0);
    await settle(() => asked[0].resolve({ ok: false, reason: 'not-listed' }));
    expect(hook.result.current.row.scrollTo).toBe(top);

    const none = mount(AT_REST);
    await settle(() => none.rerender({ held: holding([0], OTHER), listing: 'no merges', landed: true }));
    expect(none.result.current.row.scrollTo?.row).toBe(0);
    expect(asked).toHaveLength(1);
  });

  it('comes to the tab’s commit once only: a later answer of the same listing moves nothing', async () => {
    const hook = mount(AT_REST, sha(150));
    await waitFor(() => expect(asked).toHaveLength(1));
    await settle(() => asked[0].resolve(found(150)));
    const shown = hook.result.current.row.scrollTo;
    expect(shown?.row).toBe(150);

    await settle(() => hook.rerender({ ...AT_REST, held: holding([0], ASK, 'g2') }));
    await settle(() => asked[1].resolve(found(151, 'g2')));
    expect(hook.result.current.row.row).toBe(151);
    expect(hook.result.current.row.scrollTo).toBe(shown);
  });
});

describe('useLogTabRow — a navigation', () => {
  const go = (hook: ReturnType<typeof mount>, target: string, take = false): { outcome: LogGoToOutcome | null } => {
    const said: { outcome: LogGoToOutcome | null } = { outcome: null };
    void hook.result.current.row.goTo(target, take).then((outcome) => {
      said.outcome = outcome;
    });
    return said;
  };

  it('asks the host where a name sits, takes the row’s commit and brings it into view', async () => {
    const hook = mount(AT_REST);
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, 'origin/main');
    });
    expect(asked[0].request).toEqual({ ...ASK, target: 'origin/main' });
    await settle(() => asked[0].resolve(found(12)));
    expect(said.outcome).toBe('found');
    expect(hook.result.current.tabSha).toBe(sha(12));
    expect(hook.result.current.row.row).toBe(12);
    expect(hook.result.current.row.scrollTo?.row).toBe(12);
    expect(asked).toHaveLength(1);
  });

  it('is over once it arrived: a list read anew asks about the tab’s commit, not where it went', async () => {
    const hook = mount(AT_REST);
    await settle(() => {
      go(hook, 'origin/main');
    });
    await settle(() => asked[0].resolve(found(12)));
    await settle(() => hook.rerender({ ...AT_REST, held: holding([0], ASK, 'g2') }));
    expect(asked).toHaveLength(2);
    expect(asked[1].request.target).toBe(sha(12));
  });

  it('goes to a row whose page is not held: the row is the tab’s, its commit comes with its page', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, 'v1.0.0');
    });
    await settle(() => asked[0].resolve(found(4_321)));
    expect(said.outcome).toBe('found');
    expect(hook.result.current.row.row).toBe(4_321);
    expect(hook.result.current.row.scrollTo?.row).toBe(4_321);
    expect(hook.result.current.tabSha).toBe(sha(7));
    await settle(() => hook.rerender({ ...AT_REST, held: holding([0, 21]) }));
    expect(hook.result.current.tabSha).toBe(sha(4_321));
    expect(asked).toHaveLength(1);
  });

  it('goes to a commit by its full hash with its page not held — the tab has the commit at once', async () => {
    const hook = mount(AT_REST);
    await settle(() => {
      go(hook, sha(4_321), true);
    });
    await settle(() => asked[0].resolve(found(4_321)));
    expect(hook.result.current.tabSha).toBe(sha(4_321));
    expect(hook.result.current.row.row).toBe(4_321);
  });

  it('says a miss — no such commit, or one this list leaves out — and leaves the tab as it was', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, 'nope');
    });
    await settle(() => asked[0].resolve({ ok: false, reason: 'not-found' }));
    expect(said.outcome).toBe('not-found');
    await settle(() => {
      said = go(hook, sha(9_999));
    });
    await settle(() => asked[1].resolve({ ok: false, reason: 'not-listed' }));
    expect(said.outcome).toBe('not-listed');
    expect(hook.result.current.tabSha).toBe(sha(7));
    expect(hook.result.current.row.row).toBe(7);
    expect(asked).toHaveLength(2);
  });

  it('gives the tab a commit gone to by its hash even where the list leaves it out', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, sha(9_999), true);
    });
    await settle(() => asked[0].resolve({ ok: false, reason: 'not-listed' }));
    expect(said.outcome).toBe('not-listed');
    expect(hook.result.current.tabSha).toBe(sha(9_999));
    expect(hook.result.current.row).toMatchObject({ row: null, finding: false });
    // Known to be left out: it is not asked about again.
    expect(asked).toHaveLength(1);
  });

  it('takes a name it could not find for no commit, whatever it was told to take', async () => {
    const hook = mount(AT_REST);
    await settle(() => hook.result.current.row.select(7));
    await settle(() => {
      go(hook, 'nope', true);
    });
    await settle(() => asked[0].resolve({ ok: false, reason: 'not-found' }));
    expect(hook.result.current.tabSha).toBe(sha(7));
  });

  it('finds nothing while no list is held', async () => {
    const hook = mount({ held: NO_LOG_ROWS, listing: null, landed: false });
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, 'main');
    });
    expect(said.outcome).toBe('not-found');
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('goes before the tab’s own commit is asked about — one ask at a time', async () => {
    const hook = mount(AT_REST, sha(7));
    await waitFor(() => expect(asked).toHaveLength(1));
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, 'main');
    });
    expect(asked).toHaveLength(2);
    expect(asked[1].request.target).toBe('main');
    await settle(() => asked[1].resolve(found(12)));
    expect(said.outcome).toBe('found');
    // The answer the navigation replaced is no one's.
    await settle(() => asked[0].resolve(found(7)));
    expect(hook.result.current.tabSha).toBe(sha(12));
    expect(hook.result.current.row.row).toBe(12);
    expect(asked).toHaveLength(2);
  });

  it('is asked again under the list that comes when its answer was another list’s', async () => {
    const hook = mount(AT_REST);
    let said = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      said = go(hook, 'main');
    });
    await settle(() => asked[0].resolve(found(12, 'g2')));
    expect(said.outcome).toBeNull();
    await settle(() => hook.rerender({ ...AT_REST, held: holding([0], ASK, 'g2') }));
    expect(asked).toHaveLength(2);
    await settle(() => asked[1].resolve(found(12, 'g2')));
    expect(said.outcome).toBe('found');
    expect(hook.result.current.row.row).toBe(12);
  });

  it('a newer navigation replaces the one before, which found nothing', async () => {
    const hook = mount(AT_REST);
    let first = { outcome: null as LogGoToOutcome | null };
    let second = { outcome: null as LogGoToOutcome | null };
    await settle(() => {
      first = go(hook, 'main');
    });
    await settle(() => {
      second = go(hook, 'v1.0.0');
    });
    expect(first.outcome).toBe('not-found');
    await settle(() => asked[1].resolve(found(30)));
    expect(second.outcome).toBe('found');
    expect(hook.result.current.row.row).toBe(30);
  });
});
