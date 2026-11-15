// @vitest-environment jsdom
/**
 * The log view's text search over a mocked bridge whose search answers
 * are held: the list's first page is sifted at once; the host is asked
 * only where the list is longer than that page, once per ask — a status
 * frame that moves no ref asks nothing; an answer that reaches past the
 * page takes the list, in the host's order, and everything beside the
 * list reads the commits that are listed; an answer inside the page, a
 * search that timed out and a host that cannot search leave the page's
 * sift standing.
 */

import type {
  WorkspaceTreeLocateLogRowWire,
  WorkspaceTreeLogEntryWire,
  WorkspaceTreeLogRowsWire,
  WorkspaceTreeRefWire,
  WorkspaceTreeSearchLogWire,
} from '@openheaders/core/bridge';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (payload: { workspaceId: string }) => void;

const { mockCall, listeners } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  listeners: new Map<string, Set<(payload: { workspaceId: string }) => void>>(),
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

// The diff dialog, the file history and the merge editor load the code editor; no test here opens one.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/panels/git/FileHistoryModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/shared/merge-editor', () => ({ MergeConflictModal: () => null }));

import GitLogView from '@openheaders/ui/workbench/components/panels/git/GitLogView';
import type { GitLogTabState } from '@openheaders/ui/workbench/components/panels/git/git-panel-view-store';

/** The list's first page — what a text sifts at once. */
const WINDOW = 200;
/** A list longer than its first page: the host is asked about the rest. */
const LONG = 500;

/** A commit as a searched page lists it — its row carries no `onHead`. */
function found(sha: string, subject = `probe from the past ${sha}`, parents: string[] = []): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents,
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-06T10:00:00.000Z',
    subject,
    coAuthors: [],
    files: [{ path: `docs/${sha}.md`, status: 'M' }],
  };
}

/** A commit as the log lists it: HEAD reaches every one. */
function entry(sha: string, subject = `commit ${sha}`, parents: string[] = []): WorkspaceTreeLogEntryWire {
  return { ...found(sha, subject, parents), onHead: true };
}

/** A line of `count` commits, newest first; every tenth one's subject says "probe". */
function line(count: number): WorkspaceTreeLogEntryWire[] {
  return Array.from({ length: count }, (_, index) => {
    const at = count - index;
    return entry(`w${at}`, at % 10 === 0 ? `probe the gateway ${at}` : `commit ${at}`, at > 1 ? [`w${at - 1}`] : []);
  });
}

const page = (entries: WorkspaceTreeLogEntryWire[], more = false): WorkspaceTreeSearchLogWire => ({
  ok: true,
  entries,
  more,
});

const TAB: GitLogTabState = {
  kind: 'log',
  id: 1,
  selectedRefs: [],
  filter: '',
  filterRegex: false,
  filterCase: false,
  author: null,
  date: null,
  paths: [],
  sort: 'date',
  firstParent: false,
  noMerges: false,
  folds: { all: false, runs: [] },
  selectedSha: null,
  refsCollapsed: true,
  railSelection: null,
};

interface HeldSearch {
  request: Record<string, unknown>;
  resolve: (answer: WorkspaceTreeSearchLogWire) => void;
  reject: (fault: Error) => void;
}

/** The list the host keeps, newest first. */
let listed: WorkspaceTreeLogEntryWire[] = [];
let refs: WorkspaceTreeRefWire[] = [];
let held: HeldSearch[] = [];
let logReads = 0;

let patch: (patch: Partial<GitLogTabState>) => void = () => undefined;

const Harness: React.FC<{ initial: GitLogTabState }> = ({ initial }) => {
  const [tab, setTab] = useState(initial);
  patch = (next) => setTab((prev) => ({ ...prev, ...next }));
  return (
    <GitLogView
      workspaceId="ws-1"
      tab={tab}
      branch="main"
      detachedSha={null}
      historyRewritten={false}
      patchTab={(next) => setTab((prev) => ({ ...prev, ...next }))}
      onOpenCompare={() => undefined}
    />
  );
};

const rows = (): string[] => screen.queryAllByTestId('git-tool-row').map((el) => el.getAttribute('data-sha') ?? '');
/** The probes on the first page of a line of `count` commits. */
const probes = (count: number): string[] =>
  line(count)
    .slice(0, WINDOW)
    .filter((commit) => commit.subject.startsWith('probe'))
    .map((commit) => commit.sha);

/** The host's answer to a read of the list: each commit on one lane, joined to the row under it. */
function listRows(request: { from: number; count: number }): WorkspaceTreeLogRowsWire {
  const end = Math.min(listed.length, request.from + request.count);
  return {
    ok: true,
    list: 'g1',
    total: listed.length,
    widest: 1,
    rows: listed.slice(request.from, end).map((commit, at) => ({
      entry: commit,
      cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
      parents: commit.parents.length > 0 ? [request.from + at + 1] : [],
      child: request.from + at - 1,
    })),
    runs: [],
  };
}

function locateRow(target: string): WorkspaceTreeLocateLogRowWire {
  const row = listed.findIndex((commit) => commit.sha === target);
  return row === -1 ? { ok: false, reason: 'not-listed' } : { ok: true, list: 'g1', row };
}

const emitStatus = async (): Promise<void> => {
  await act(async () => {
    for (const listener of listeners.get('workspaceTreeGitStatus') ?? []) listener({ workspaceId: 'ws-1' });
    await Promise.resolve();
  });
};

const settle = async (step: () => void): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const apply = async (next: Partial<GitLogTabState>): Promise<void> => {
  await act(async () => {
    patch(next);
    await Promise.resolve();
  });
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
  listed = line(LONG);
  refs = [{ name: 'main', kind: 'local', sha: `w${LONG}` }];
  held = [];
  logReads = 0;
  listeners.clear();
  mockCall.mockReset();
  mockCall.mockImplementation((type: string, request: Record<string, unknown>) => {
    if (type === 'oh.workspaceTree.listRefs') return Promise.resolve({ ok: true, refs, current: 'main' });
    if (type === 'oh.workspaceTree.logRows') {
      logReads += 1;
      return Promise.resolve(listRows(request as { from: number; count: number }));
    }
    if (type === 'oh.workspaceTree.locateLogRow') return Promise.resolve(locateRow(String(request.target)));
    if (type === 'oh.workspaceTree.searchLog') {
      return new Promise<WorkspaceTreeSearchLogWire>((resolve, reject) => {
        held.push({ request, resolve, reject });
      });
    }
    return Promise.resolve({ ok: true });
  });
});

afterEach(cleanup);

describe('GitLogView — a text search over the whole history', () => {
  it('sifts a list no longer than its first page by itself — the host is not asked', async () => {
    listed = line(30);
    refs = [{ name: 'main', kind: 'local', sha: 'w30' }];
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(rows()).toEqual(probes(30)));
    expect(held).toHaveLength(0);

    // A list of exactly one page is held whole too.
    cleanup();
    listed = line(WINDOW);
    refs = [{ name: 'main', kind: 'local', sha: `w${WINDOW}` }];
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(rows()).toEqual(probes(WINDOW)));
    expect(held).toHaveLength(0);
  });

  it('sifts the first page of a longer list at once and asks the host once, as the tab', async () => {
    render(<Harness initial={TAB} />);
    await waitFor(() => expect(rows()).toHaveLength(WINDOW));
    expect(held).toHaveLength(0);

    await apply({ filter: 'probe' });
    expect(rows()).toEqual(probes(LONG));
    await waitFor(() => expect(held).toHaveLength(1));
    expect(held[0].request).toEqual({ workspaceId: 'ws-1', key: 'log:1', text: 'probe', limit: WINDOW, allRefs: true });
  });

  it('asks nothing more on a status frame that moves no ref, and asks again when one moves', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page([found('w500'), found('old1')])));
    await waitFor(() => expect(rows()).toEqual(['w500', 'old1']));

    const before = logReads;
    await emitStatus();
    await waitFor(() => expect(logReads).toBe(before + 1));
    expect(held).toHaveLength(1);

    // A commit landed: the branch's tip moved. The page stands until the new answer.
    refs = [{ name: 'main', kind: 'local', sha: 'w501' }];
    await emitStatus();
    await waitFor(() => expect(held).toHaveLength(2));
    expect(rows()).toEqual(['w500', 'old1']);
    await settle(() => held[1].resolve(page([found('w500'), found('old1'), found('old2')])));
    await waitFor(() => expect(rows()).toEqual(['w500', 'old1', 'old2']));
  });

  it('lists the host’s page, in its order and with no band, once it reaches past the first page', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: `w${LONG}` },
      { name: 'feature/orders-v2', kind: 'local', sha: 'w450' },
    ];
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    // The band shows on the page's sift (every ref walked, the host's flag on each row).
    expect(screen.getAllByTestId('git-tool-row')[0].getAttribute('data-current-branch')).toBe('true');

    // HEAD's own commit is on the page: a walk over the listed rows would band it.
    await settle(() => held[0].resolve(page([found('w500'), found('old2'), found('w400'), found('old1')])));
    await waitFor(() => expect(rows()).toEqual(['w500', 'old2', 'w400', 'old1']));
    expect(screen.getAllByTestId('git-tool-row').every((row) => row.getAttribute('data-current-branch') === null)).toBe(
      true,
    );
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('says so under the page when matches exist past it', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page([found('w500'), found('old1')], true)));
    await waitFor(() => expect(rows()).toEqual(['w500', 'old1']));
    expect(screen.getByTestId('git-tool-list-note').textContent).toBe(
      'Showing the newest 2 matches. Older commits match too — refine the search.',
    );
  });

  it('keeps the first page’s sift for an answer wholly inside the page', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    const inside = listed
      .slice(0, WINDOW)
      .filter((commit) => commit.subject.startsWith('probe'))
      .reverse();
    await settle(() => held[0].resolve(page(inside)));
    expect(rows()).toEqual(probes(LONG));
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('reads a selected commit of the page for the details, and lets it go when the text is cleared', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page([found('w500'), found('old1')])));
    await waitFor(() => expect(rows()).toEqual(['w500', 'old1']));

    fireEvent.click(screen.getAllByTestId('git-tool-row')[1]);
    await waitFor(() => expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull());

    await apply({ filter: '' });
    await waitFor(() => expect(rows()).toHaveLength(WINDOW));
    expect(screen.getByTestId('git-tool-detail-placeholder')).toBeTruthy();
  });

  it('keeps the first page’s sift and says the search did not finish when the host’s deadline came', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve({ ok: false, reason: 'search-timeout' }));
    expect(rows()).toEqual(probes(LONG));
    expect(screen.getByTestId('git-tool-list-note').textContent).toBe(
      'The search ran out of time before it reached the whole history. These matches are from the newest 200 commits.',
    );
  });

  it('says the search did not finish in place of “no matches” when the first page holds none', async () => {
    render(<Harness initial={{ ...TAB, filter: 'zzz' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    // While the host is asked, "no matches" is not known: the list says it is searching.
    expect(screen.getByTestId('git-tool-list-note').textContent).toBe('Searching the whole history…');
    expect(screen.getByTestId('git-tool-empty').textContent).not.toContain('No commits matching filters');
    await settle(() => held[0].resolve({ ok: false, reason: 'search-timeout' }));
    expect(screen.getByTestId('git-tool-list-note').textContent).toBe(
      'The search ran out of time before it reached the whole history. Nothing matched in the newest 200 commits.',
    );
    expect(screen.getByTestId('git-tool-reset-filters')).toBeTruthy();
  });

  it('says “no matches” over an empty sift only once the host has answered that nothing matches', async () => {
    render(<Harness initial={{ ...TAB, filter: 'zzz' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    expect(screen.getByTestId('git-tool-empty').textContent).toContain('Searching the whole history…');
    await settle(() => held[0].resolve(page([])));
    expect(screen.getByTestId('git-tool-empty').textContent).toContain('No commits matching filters');
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('says nothing of the search under a sift that lists rows while the host is asked', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    expect(rows()).toEqual(probes(LONG));
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('keeps the first page’s sift, silently, over a host that predates the search', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].reject(new Error("host: RPC 'oh.workspaceTree.searchLog' is not implemented")));
    expect(rows()).toEqual(probes(LONG));
    expect(screen.queryByTestId('git-tool-error')).toBeNull();
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('sends the riders and the scope with the search', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: `w${LONG}` },
      { name: 'feature/orders-v2', kind: 'local', sha: 'w450' },
    ];
    render(
      <Harness
        initial={{ ...TAB, filter: 'probe', selectedRefs: ['feature/orders-v2'], noMerges: true, firstParent: true }}
      />,
    );
    await waitFor(() => expect(held).toHaveLength(1));
    expect(held[0].request).toEqual({
      workspaceId: 'ws-1',
      key: 'log:1',
      text: 'probe',
      limit: WINDOW,
      refs: ['feature/orders-v2'],
      noMerges: true,
      firstParent: true,
    });
  });
});
