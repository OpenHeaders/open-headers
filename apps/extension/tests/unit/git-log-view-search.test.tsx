// @vitest-environment jsdom
/**
 * The log view's text search over a mocked bridge whose search answers
 * are held: the window is sifted at once; the host is asked only past a
 * full window, once per ask — a status frame that moves no ref asks
 * nothing; an answer that reaches past the window takes the list, in
 * the host's order, and everything beside the list reads the commits
 * that are listed; an answer inside the window, a search that timed out
 * and a host that cannot search leave the window's sift standing.
 */

import type {
  WorkspaceTreeLogEntryWire,
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

const WINDOW = 200;

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

/** A commit as the log's window lists it: HEAD reaches every one. */
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
  selectedSha: null,
  refsCollapsed: true,
  railSelection: null,
};

interface HeldSearch {
  request: Record<string, unknown>;
  resolve: (answer: WorkspaceTreeSearchLogWire) => void;
  reject: (fault: Error) => void;
}

let logWindow: WorkspaceTreeLogEntryWire[] = [];
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
const probes = (count: number): string[] =>
  line(count)
    .filter((commit) => commit.subject.startsWith('probe'))
    .map((commit) => commit.sha);

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
  logWindow = line(WINDOW);
  refs = [{ name: 'main', kind: 'local', sha: `w${WINDOW}` }];
  held = [];
  logReads = 0;
  listeners.clear();
  mockCall.mockReset();
  mockCall.mockImplementation((type: string, request: Record<string, unknown>) => {
    if (type === 'oh.workspaceTree.listRefs') return Promise.resolve({ ok: true, refs, current: 'main' });
    if (type === 'oh.workspaceTree.log') {
      logReads += 1;
      return Promise.resolve({ ok: true, entries: logWindow });
    }
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
  it('sifts a window under its limit by itself — the host is not asked', async () => {
    logWindow = line(30);
    refs = [{ name: 'main', kind: 'local', sha: 'w30' }];
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(rows()).toEqual(probes(30)));
    expect(held).toHaveLength(0);
  });

  it('sifts a full window at once and asks the host once, as the tab', async () => {
    render(<Harness initial={TAB} />);
    await waitFor(() => expect(rows()).toHaveLength(WINDOW));
    expect(held).toHaveLength(0);

    await apply({ filter: 'probe' });
    expect(rows()).toEqual(probes(WINDOW));
    await waitFor(() => expect(held).toHaveLength(1));
    expect(held[0].request).toEqual({ workspaceId: 'ws-1', key: 'log:1', text: 'probe', limit: WINDOW, allRefs: true });
  });

  it('asks nothing more on a status frame that moves no ref, and asks again when one moves', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page([found('w200'), found('old1')])));
    await waitFor(() => expect(rows()).toEqual(['w200', 'old1']));

    const before = logReads;
    await emitStatus();
    await waitFor(() => expect(logReads).toBe(before + 1));
    expect(held).toHaveLength(1);

    // A commit landed: the branch's tip moved. The page stands until the new answer.
    refs = [{ name: 'main', kind: 'local', sha: 'w201' }];
    await emitStatus();
    await waitFor(() => expect(held).toHaveLength(2));
    expect(rows()).toEqual(['w200', 'old1']);
    await settle(() => held[1].resolve(page([found('w200'), found('old1'), found('old2')])));
    await waitFor(() => expect(rows()).toEqual(['w200', 'old1', 'old2']));
  });

  it('lists the host’s page, in its order and with no band, once it reaches past the window', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: `w${WINDOW}` },
      { name: 'feature/orders-v2', kind: 'local', sha: 'w150' },
    ];
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    // The band shows on the window's sift (every ref walked, HEAD's commit in the window).
    expect(screen.getAllByTestId('git-tool-row')[0].getAttribute('data-current-branch')).toBe('true');

    // HEAD's own commit is on the page: a walk over the listed rows would band it.
    await settle(() => held[0].resolve(page([found('w200'), found('old2'), found('w100'), found('old1')])));
    await waitFor(() => expect(rows()).toEqual(['w200', 'old2', 'w100', 'old1']));
    expect(screen.getAllByTestId('git-tool-row').every((row) => row.getAttribute('data-current-branch') === null)).toBe(
      true,
    );
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('says so under the page when matches exist past it', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page([found('w200'), found('old1')], true)));
    await waitFor(() => expect(rows()).toEqual(['w200', 'old1']));
    expect(screen.getByTestId('git-tool-list-note').textContent).toBe(
      'Showing the newest 2 matches. Older commits match too — refine the search.',
    );
  });

  it('keeps the window’s sift for an answer wholly inside the window', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    const inside = logWindow.filter((commit) => commit.subject.startsWith('probe')).reverse();
    await settle(() => held[0].resolve(page(inside)));
    expect(rows()).toEqual(probes(WINDOW));
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('reads a selected commit of the page for the details, and lets it go when the text is cleared', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve(page([found('w200'), found('old1')])));
    await waitFor(() => expect(rows()).toEqual(['w200', 'old1']));

    fireEvent.click(screen.getAllByTestId('git-tool-row')[1]);
    await waitFor(() => expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull());

    await apply({ filter: '' });
    await waitFor(() => expect(rows()).toHaveLength(WINDOW));
    expect(screen.getByTestId('git-tool-detail-placeholder')).toBeTruthy();
  });

  it('keeps the window’s sift and says the search did not finish when the host’s deadline came', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].resolve({ ok: false, reason: 'search-timeout' }));
    expect(rows()).toEqual(probes(WINDOW));
    expect(screen.getByTestId('git-tool-list-note').textContent).toBe(
      'The search ran out of time before it reached the whole history. These matches are from the newest 200 commits.',
    );
  });

  it('says the search did not finish in place of “no matches” when the window holds none', async () => {
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
    expect(rows()).toEqual(probes(WINDOW));
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('keeps the window’s sift, silently, over a host that predates the verb', async () => {
    render(<Harness initial={{ ...TAB, filter: 'probe' }} />);
    await waitFor(() => expect(held).toHaveLength(1));
    await settle(() => held[0].reject(new Error("host: RPC 'oh.workspaceTree.searchLog' is not implemented")));
    expect(rows()).toEqual(probes(WINDOW));
    expect(screen.queryByTestId('git-tool-error')).toBeNull();
    expect(screen.queryByTestId('git-tool-list-note')).toBeNull();
  });

  it('sends the riders and the scope with the search', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: `w${WINDOW}` },
      { name: 'feature/orders-v2', kind: 'local', sha: 'w150' },
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
