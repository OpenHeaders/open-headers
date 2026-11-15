// @vitest-environment jsdom
/**
 * The log view over the whole history, mounted over a mocked host that
 * keeps the list: the tab asks for it by what it lists and reads the
 * rows it shows; an unborn branch alone asks nothing; a ref that went
 * leaves the scope; a refusal says so. A selection reads through the
 * list — a press shows its commit with no read, a set its cards, more
 * than are read together their number — and the tab's commit is found
 * again when the history was read anew, the panes never blinking empty.
 * The row menu walks by row and covers the set; a press on a run folds
 * it into what the tab asks; the band follows the host's flag and the
 * scope; the signature column asks about the rows in view alone.
 */

import type {
  WorkspaceTreeLocateLogRowWire,
  WorkspaceTreeLogEntryWire,
  WorkspaceTreeLogRowsWire,
  WorkspaceTreeLogRunWire,
  WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (payload: { workspaceId: string }) => void;

const { mockCall, listeners, drawn } = vi.hoisted(() => ({
  mockCall: vi.fn(),
  listeners: new Map<string, Set<(payload: { workspaceId: string }) => void>>(),
  /** How many times the view was drawn. */
  drawn: { count: 0 },
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

// The times follow the clock-format setting, whose registry this pin does not load. The view reads it once a draw.
vi.mock('@openheaders/ui/workbench/components/panels/git/use-log-hour-cycle', () => ({
  useLogHourCycle: () => {
    drawn.count += 1;
    return 'h23';
  },
}));

// The diff dialog, the file history and the merge editor load the code editor; no test here opens one.
vi.mock('@openheaders/ui/workbench/components/panels/git/DiffModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/workbench/components/panels/git/FileHistoryModal', () => ({ default: () => null }));
vi.mock('@openheaders/ui/shared/merge-editor', () => ({ MergeConflictModal: () => null }));

import GitLogView from '@openheaders/ui/workbench/components/panels/git/GitLogView';
import { patchGitLogViewPrefs } from '@openheaders/ui/workbench/components/panels/git/git-log-view-prefs';
import type { GitLogTabState } from '@openheaders/ui/workbench/components/panels/git/git-panel-view-store';
import { resetCommitSignatures } from '@openheaders/ui/workbench/components/panels/git/use-commit-signatures';

const TOTAL = 1_000;
const ROW_PX = 26;

const sha = (commit: number): string => commit.toString(16).padStart(40, '0');

/** Commit `n` of a line: `TOTAL` the newest. Every fifth is off the checked-out branch's history. */
function commit(n: number): WorkspaceTreeLogEntryWire {
  return {
    sha: sha(n),
    parents: n > 1 ? [sha(n - 1)] : [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-15T10:00:00.000Z',
    subject: `commit ${n}`,
    coAuthors: [],
    files: [{ path: `docs/${n}.md`, status: 'M' }],
    onHead: n % 5 !== 0,
  };
}

/** Rows 2…6 are one linear run: 2 its top, 6 its bottom, 3–5 the commits it hides. */
const runOf = (first: string, folded: boolean): WorkspaceTreeLogRunWire => ({
  run: 7,
  first,
  top: 2,
  bottom: 6,
  hidden: 3,
  folded,
});

interface RowsRequest {
  from: number;
  count: number;
  refs?: string[];
  allRefs?: boolean;
  folds?: string[];
  foldAll?: boolean;
  noMerges?: boolean;
  refresh?: boolean;
  key?: string;
}

/** The list the host keeps, newest first, and the id it names its reading by. */
let listed: WorkspaceTreeLogEntryWire[] = [];
let listId = 'g1';
let refs: WorkspaceTreeRefWire[] = [];
/** A read of the list the host refuses, once. */
let refuseNext: WorkspaceTreeLogRowsWire | null = null;
let rowReads: RowsRequest[] = [];
let locates: string[] = [];
let signatureAsks: string[][] = [];
/** The refs read is answered by hand when set. */
let holdRefs: ((answer: unknown) => void)[] | null = null;
/** A commit's place is answered by hand when set: each entry lets one answer go. */
let holdLocates: (() => void)[] | null = null;

function listRows(request: RowsRequest): WorkspaceTreeLogRowsWire {
  if (request.refs?.includes('gone') === true) return { ok: false, reason: 'unknown-ref', unknownRefs: ['gone'] };
  // No Merges lists every other commit: a list the tab's commit may be left out of.
  const list = request.noMerges === true ? listed.filter((_, at) => at % 2 === 0) : listed;
  const end = Math.min(list.length, request.from + request.count);
  const folded = request.foldAll === true || (request.folds?.length ?? 0) > 0;
  const run = runOf(list[3]?.sha ?? sha(0), folded);
  return {
    ok: true,
    list: listId,
    total: list.length,
    widest: 1,
    rows: list.slice(request.from, end).map((entry, offset) => {
      const at = request.from + offset;
      return {
        entry,
        cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
        parents: at + 1 < list.length ? [at + 1] : [],
        child: at - 1,
        ...(at >= 2 && at <= 5 ? { run: run.run } : {}),
      };
    }),
    runs: request.from <= 5 ? [run] : [],
  };
}

function locateRow(request: RowsRequest & { target: string }): WorkspaceTreeLocateLogRowWire {
  const list = request.noMerges === true ? listed.filter((_, at) => at % 2 === 0) : listed;
  const named = refs.find((ref) => ref.name === request.target)?.sha ?? request.target;
  const row = list.findIndex((entry) => entry.sha === named);
  if (row !== -1) return { ok: true, list: listId, row };
  return { ok: false, reason: listed.some((entry) => entry.sha === named) ? 'not-listed' : 'not-found' };
}

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

/** The tab as the view last patched it. */
let tabNow: GitLogTabState = TAB;
let patch: (patch: Partial<GitLogTabState>) => void = () => undefined;

const Harness: React.FC<{ initial: GitLogTabState; branch?: string | null }> = ({ initial, branch = 'main' }) => {
  const [tab, setTab] = useState(initial);
  tabNow = tab;
  patch = (next) => setTab((prev) => ({ ...prev, ...next }));
  return (
    <GitLogView
      workspaceId="ws-1"
      tab={tab}
      branch={branch}
      detachedSha={null}
      historyRewritten={false}
      patchTab={(next) => setTab((prev) => ({ ...prev, ...next }))}
      onOpenCompare={() => undefined}
    />
  );
};

const rowEl = (at: number): HTMLElement => {
  const found = screen.getAllByTestId('git-tool-row').find((el) => el.getAttribute('data-row') === String(at));
  if (!found) throw new Error(`no row ${at}`);
  return found;
};
const mountedRows = (): number[] => screen.queryAllByTestId('git-tool-row').map((el) => Number(el.dataset.row));
const selectedRows = (): number[] =>
  screen
    .getAllByTestId('git-tool-row')
    .filter((el) => el.getAttribute('data-selected') === 'true')
    .map((el) => Number(el.dataset.row));
const cellOf = (at: number): Element => {
  const cell = rowEl(at).querySelector('[data-testid="git-tool-graph-cell"]');
  if (!cell) throw new Error(`no cell in row ${at}`);
  return cell;
};
/** The faces the details pane is given from now on, by test id — one that stood for a single draw is among them. */
function watchDetailFaces(): () => string[] {
  const seen: string[] = [];
  const take = (records: MutationRecord[]): void => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        for (const el of [node, ...node.querySelectorAll<HTMLElement>('[data-testid]')]) {
          const id = el.getAttribute('data-testid');
          if (id !== null) seen.push(id);
        }
      }
    }
  };
  const observer = new MutationObserver(take);
  observer.observe(screen.getByTestId('git-tool-detail'), { childList: true, subtree: true });
  return () => {
    take(observer.takeRecords());
    return seen;
  };
}
const listReads = (): RowsRequest[] => rowReads.filter((read) => read.key === 'log:1');
/** The newest read of the list's first page — what a new ask reads first. */
const firstPageRead = (): RowsRequest | undefined =>
  listReads()
    .filter((read) => read.from === 0)
    .at(-1);
const selectionReads = (): RowsRequest[] => rowReads.filter((read) => read.key === 'log:1:selection');

const settle = async (step: () => void = () => undefined): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const emit = async (type: 'workspaceTreeGitStatus' | 'workspaceTreeLogHistory'): Promise<void> => {
  await settle(() => {
    for (const listener of listeners.get(type) ?? []) listener({ workspaceId: 'ws-1' });
  });
};

const apply = async (next: Partial<GitLogTabState>): Promise<void> => {
  await settle(() => patch(next));
};

/** The view mounted with its list's first page drawn. */
async function mount(initial: Partial<GitLogTabState> = {}, branch: string | null = 'main'): Promise<void> {
  render(<Harness initial={{ ...TAB, ...initial }} branch={branch} />);
  await waitFor(() => expect(mountedRows().length).toBeGreaterThan(0));
  await settle();
}

/** The scroller as an engine lays it out; 0 leaves it unlaid (jsdom's own). */
let viewportPx = 0;

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
  const isList = (el: HTMLElement): boolean => el.getAttribute('data-testid') === 'git-tool-list';
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? viewportPx : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? Math.max(viewportPx, Number(this.getAttribute('data-total')) * ROW_PX) : 0;
    },
  });
});

beforeEach(() => {
  viewportPx = 0;
  listed = Array.from({ length: TOTAL }, (_, at) => commit(TOTAL - at));
  listId = 'g1';
  refs = [{ name: 'main', kind: 'local', sha: sha(TOTAL) }];
  refuseNext = null;
  rowReads = [];
  locates = [];
  signatureAsks = [];
  holdRefs = null;
  holdLocates = null;
  tabNow = TAB;
  listeners.clear();
  resetCommitSignatures();
  patchGitLogViewPrefs('ws-1', { showSignatureColumn: false, highlightCurrentBranch: true });
  mockCall.mockReset();
  mockCall.mockImplementation((type: string, request: RowsRequest & { target: string; shas: string[] }) => {
    if (type === 'oh.workspaceTree.listRefs') {
      if (holdRefs !== null) return new Promise((resolve) => holdRefs?.push(resolve));
      return Promise.resolve({ ok: true, refs, current: 'main' });
    }
    if (type === 'oh.workspaceTree.logRows') {
      rowReads.push(request);
      const refused = refuseNext;
      refuseNext = null;
      return Promise.resolve(refused ?? listRows(request));
    }
    if (type === 'oh.workspaceTree.locateLogRow') {
      locates.push(request.target);
      if (holdLocates === null) return Promise.resolve(locateRow(request));
      return new Promise((resolve) => holdLocates?.push(() => resolve(locateRow(request))));
    }
    if (type === 'oh.workspaceTree.commitSignatures') {
      signatureAsks.push(request.shas);
      return Promise.resolve({ ok: true, signatures: [] });
    }
    // A text is asked of the whole history too; here the host never finishes, and the first page's sift stands.
    if (type === 'oh.workspaceTree.searchLog') return Promise.resolve({ ok: false, reason: 'search-timeout' });
    return Promise.resolve({ ok: true });
  });
});

afterEach(cleanup);

describe('GitLogView — the list it asks for', () => {
  it('asks the host for every ref’s history as the tab, and draws the rows it reads by number', async () => {
    await mount();
    expect(listReads()[0]).toEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true, from: 0, count: 200 });
    expect(screen.getByTestId('git-tool-list').getAttribute('data-total')).toBe(String(TOTAL));
    expect(rowEl(0).getAttribute('data-sha')).toBe(sha(TOTAL));
    expect(rowEl(199).getAttribute('data-sha')).toBe(sha(TOTAL - 199));
    expect(mockCall.mock.calls.some(([type]) => type === 'oh.workspaceTree.log')).toBe(false);
  });

  it('reads the list again on a frame of the repo and when the history was read anew, with no word of a press', async () => {
    await mount();
    const before = listReads().length;
    await emit('workspaceTreeGitStatus');
    expect(listReads()).toHaveLength(before + 1);
    await emit('workspaceTreeLogHistory');
    expect(listReads()).toHaveLength(before + 2);
    expect(listReads().every((read) => read.refresh === undefined)).toBe(true);
  });

  it('asks nothing for the unborn branch alone — an empty filtered list, with the reset', async () => {
    refs = [{ name: 'feature/orders-v2', kind: 'local', sha: sha(900) }];
    render(<Harness initial={{ ...TAB, selectedRefs: ['main'] }} />);
    await waitFor(() => expect(screen.getByTestId('git-tool-empty')).toBeTruthy());
    expect(screen.getByTestId('git-tool-reset-filters')).toBeTruthy();
    expect(rowReads).toHaveLength(0);
  });

  it('walks the other refs of a scope that names the unborn branch beside them', async () => {
    refs = [{ name: 'feature/orders-v2', kind: 'local', sha: sha(900) }];
    await mount({ selectedRefs: ['main', 'feature/orders-v2'] });
    expect(listReads()[0]).toMatchObject({ refs: ['feature/orders-v2'] });
    expect(tabNow.selectedRefs).toEqual(['main', 'feature/orders-v2']);
  });

  it('waits for the refs before it asks for a scope that names the checked-out branch — it may be the unborn one', async () => {
    holdRefs = [];
    render(<Harness initial={{ ...TAB, selectedRefs: ['main'] }} />);
    await settle();
    expect(rowReads).toHaveLength(0);
    // Not known to be empty yet: the list is being read.
    expect(screen.getByTestId('git-tool-list-pending')).toBeTruthy();
    await settle(() => holdRefs?.[0]({ ok: true, refs, current: 'main' }));
    await waitFor(() => expect(listReads()[0]).toMatchObject({ refs: ['main'] }));
  });

  it('asks at once for a scope that cannot name an unborn branch — and once: the refs landing ask nothing again', async () => {
    holdRefs = [];
    render(<Harness initial={{ ...TAB, selectedRefs: ['feature/orders-v2'] }} />);
    await waitFor(() => expect(listReads()).toHaveLength(1));
    await settle(() => holdRefs?.[0]({ ok: true, refs, current: 'main' }));
    await settle();
    expect(listReads().filter((read) => read.from === 0)).toHaveLength(1);
  });

  it('reads the rows the view scrolls to', async () => {
    viewportPx = 10 * ROW_PX;
    await mount();
    const list = screen.getByTestId('git-tool-list');
    list.scrollTop = 600 * ROW_PX;
    await settle(() => fireEvent.scroll(list));
    await waitFor(() => expect(rowEl(600).getAttribute('data-sha')).toBe(sha(TOTAL - 600)));
    // The mounted rows sit on two pages: one read of both.
    expect(listReads()).toContainEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true, from: 400, count: 400 });
    expect(mountedRows()).not.toContain(0);
  });

  it('keeps the list’s first page while a text is applied, wherever the view stood — a history read anew reads it again', async () => {
    viewportPx = 10 * ROW_PX;
    await mount();
    const list = screen.getByTestId('git-tool-list');
    list.scrollTop = 600 * ROW_PX;
    await settle(() => fireEvent.scroll(list));
    await waitFor(() => expect(rowEl(600).getAttribute('data-sha')).toBe(sha(TOTAL - 600)));

    // Commits 990–999 match, all on the first page.
    await apply({ filter: 'commit 99' });
    await waitFor(() => expect(screen.getAllByTestId('git-tool-row')).toHaveLength(10));
    listId = 'g2';
    await emit('workspaceTreeLogHistory');
    await settle();
    expect(screen.getAllByTestId('git-tool-row')).toHaveLength(10);
    expect(firstPageRead()).toMatchObject({ from: 0 });
    expect(listReads().at(-1)?.from).toBe(0);
  });

  it('drops a ref the history no longer holds from the scope, and asks for what is left', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: sha(TOTAL) },
      { name: 'feature/orders-v2', kind: 'local', sha: sha(900) },
    ];
    await mount({ selectedRefs: ['feature/orders-v2', 'gone'] });
    expect(tabNow.selectedRefs).toEqual(['feature/orders-v2']);
    expect(firstPageRead()).toMatchObject({ refs: ['feature/orders-v2'] });
    expect(screen.queryByTestId('git-tool-error')).toBeNull();
  });

  it('clears the scope when the host names no ref of it as gone', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: sha(TOTAL) },
      { name: 'feature/orders-v2', kind: 'local', sha: sha(900) },
    ];
    refuseNext = { ok: false, reason: 'unknown-ref' };
    await mount({ selectedRefs: ['feature/orders-v2'] });
    expect(tabNow.selectedRefs).toEqual([]);
    expect(firstPageRead()).toMatchObject({ allRefs: true });

    cleanup();
    refuseNext = { ok: false, reason: 'unknown-ref', unknownRefs: ['another'] };
    await mount({ selectedRefs: ['feature/orders-v2'] });
    expect(tabNow.selectedRefs).toEqual([]);
  });

  it('says a refusal, and draws none of the rows it held for another ask', async () => {
    await mount();
    refuseNext = { ok: false, reason: 'log-timeout' };
    await apply({ noMerges: true });
    expect(screen.getByTestId('git-tool-error').textContent).toContain('log-timeout');
    expect(mountedRows()).toEqual([]);
  });

  it('keeps the rows of the ask before drawn until the new ask is answered', async () => {
    await mount();
    let answer: (rows: WorkspaceTreeLogRowsWire) => void = () => undefined;
    mockCall.mockImplementationOnce(
      (_type: string, request: RowsRequest) =>
        new Promise<WorkspaceTreeLogRowsWire>((resolve) => {
          rowReads.push(request);
          answer = resolve;
        }),
    );
    await apply({ noMerges: true });
    expect(rowEl(1).getAttribute('data-sha')).toBe(sha(TOTAL - 1));
    await settle(() => answer(listRows({ from: 0, count: 200, noMerges: true })));
    expect(rowEl(1).getAttribute('data-sha')).toBe(sha(TOTAL - 2));
    expect(screen.getByTestId('git-tool-list').getAttribute('data-total')).toBe(String(TOTAL / 2));
  });
});

describe('GitLogView — the selection read through the list', () => {
  it('shows a pressed row’s commit, remembers it in the tab, and reads nothing for it', async () => {
    await mount();
    expect(screen.getByTestId('git-tool-detail-placeholder')).toBeTruthy();
    const reads = rowReads.length;
    await settle(() => fireEvent.click(rowEl(7)));
    expect(tabNow.selectedSha).toBe(sha(TOTAL - 7));
    expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull();
    expect(screen.getByTestId('git-tool-detail-info')).toBeTruthy();
    expect(rowReads).toHaveLength(reads);
    expect(locates).toEqual([]);
  });

  it('shows a set’s commits as a card each, newest first', async () => {
    await mount();
    await settle(() => fireEvent.click(rowEl(3)));
    await settle(() => fireEvent.click(rowEl(6), { shiftKey: true }));
    expect(screen.getAllByTestId('git-tool-detail-card')).toHaveLength(4);
    expect(tabNow.selectedSha).toBe(sha(TOTAL - 6));
    expect(selectionReads()).toHaveLength(0);
  });

  it('says how many are selected past the most read together — no files, no cards, nothing read', async () => {
    viewportPx = 320 * ROW_PX;
    await mount();
    await settle(() => fireEvent.click(rowEl(0)));
    await settle(() => fireEvent.click(rowEl(210), { shiftKey: true }));
    expect(screen.getByTestId('git-tool-detail-over').textContent).toBe('211 commits selected');
    expect(screen.queryByTestId('git-tool-detail-card')).toBeNull();
    expect(screen.queryByTestId('git-tool-detail-info')).toBeNull();
    expect(selectionReads()).toHaveLength(0);

    // Back within what is read together: the set shows again.
    await settle(() => fireEvent.click(rowEl(1)));
    expect(screen.queryByTestId('git-tool-detail-over')).toBeNull();
    expect(screen.getByTestId('git-tool-detail-info')).toBeTruthy();
  });

  it('finds the tab’s commit again when the history was read anew, the details never going empty', async () => {
    await mount();
    await settle(() => fireEvent.click(rowEl(7)));
    const selected = tabNow.selectedSha;

    // A commit landed on top: every row moved down one, under another id.
    listed = [commit(TOTAL + 1), ...listed];
    listId = 'g2';
    holdLocates = [];
    const faces = watchDetailFaces();
    await emit('workspaceTreeLogHistory');
    await waitFor(() => expect(holdLocates).toHaveLength(1));
    await settle();
    // The new list is drawn and holds no selected row yet: the commit is being found, and its details stand.
    expect(rowEl(0).getAttribute('data-sha')).toBe(sha(TOTAL + 1));
    expect(screen.getAllByTestId('git-tool-row').some((el) => el.getAttribute('data-selected') === 'true')).toBe(false);
    expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull();
    expect(screen.getByTestId('git-tool-detail-info')).toBeTruthy();

    await settle(() => holdLocates?.[0]());
    await waitFor(() => expect(selectedRows()).toEqual([8]));
    expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull();
    // The row is found one draw before the list selects it: that draw shows the pane empty no more than any other.
    expect(faces()).not.toContain('git-tool-detail-placeholder');
    expect(locates).toEqual([selected]);
    expect(tabNow.selectedSha).toBe(selected);
  });

  it('selects no row and shows no details where another listing leaves the tab’s commit out', async () => {
    await mount();
    await settle(() => fireEvent.click(rowEl(7)));
    await apply({ noMerges: true });
    await waitFor(() => expect(locates).toEqual([sha(TOTAL - 7)]));
    await settle();
    expect(selectedRows()).toEqual([]);
    expect(screen.getByTestId('git-tool-detail-placeholder')).toBeTruthy();
    expect(tabNow.selectedSha).toBe(sha(TOTAL - 7));

    // The filter off again: the commit is listed, and found.
    await apply({ noMerges: false });
    await waitFor(() => expect(selectedRows()).toEqual([7]));
    expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull();
  });

  it('selects the row of a commit the tab remembers when it mounts, and reads it where its page is not held', async () => {
    await mount({ selectedSha: sha(TOTAL - 640) });
    await waitFor(() => expect(locates).toEqual([sha(TOTAL - 640)]));
    await waitFor(() => expect(selectionReads()).toHaveLength(1));
    expect(selectionReads()[0]).toMatchObject({ from: 640, count: 1 });
    await waitFor(() => expect(screen.getByTestId('git-tool-detail-info')).toBeTruthy());
  });
});

describe('GitLogView — where the list is looked at', () => {
  const VIEW = 10 * ROW_PX;
  /** The scroll position that centres a row in the viewport. */
  const centred = (at: number): number => at * ROW_PX - (VIEW - ROW_PX) / 2;
  const scrollTop = (): number => screen.getByTestId('git-tool-list').scrollTop;

  it('comes to the commit the tab remembers when it mounts', async () => {
    viewportPx = VIEW;
    await mount({ selectedSha: sha(TOTAL - 640) });
    await waitFor(() => expect(scrollTop()).toBe(centred(640)));
    await waitFor(() => expect(selectedRows()).toEqual([640]));
  });

  it('looks at another listing from its top where it leaves the tab’s commit out, and on the commit where it lists it', async () => {
    viewportPx = VIEW;
    // Row 641: No Merges, which lists every other commit, leaves it out.
    await mount({ selectedSha: sha(TOTAL - 641) });
    await waitFor(() => expect(scrollTop()).toBe(centred(641)));

    await apply({ noMerges: true });
    await waitFor(() => expect(locates).toHaveLength(2));
    await settle();
    expect(scrollTop()).toBe(0);

    await apply({ noMerges: false });
    await waitFor(() => expect(scrollTop()).toBe(centred(641)));
  });

  it('stays where it is under a fold, a frame of the repo and a history read anew', async () => {
    viewportPx = VIEW;
    await mount({ selectedSha: sha(TOTAL - 150) });
    await waitFor(() => expect(scrollTop()).toBe(centred(150)));
    const list = screen.getByTestId('git-tool-list');
    list.scrollTop = 2 * ROW_PX;
    await settle(() => fireEvent.scroll(list));

    await settle(() => fireEvent.click(cellOf(4)));
    expect(tabNow.folds.runs).toHaveLength(1);
    await settle();
    expect(scrollTop()).toBe(2 * ROW_PX);

    await emit('workspaceTreeGitStatus');
    listId = 'g2';
    await emit('workspaceTreeLogHistory');
    await waitFor(() => expect(locates.length).toBeGreaterThan(2));
    await settle();
    expect(scrollTop()).toBe(2 * ROW_PX);
  });
});

describe('GitLogView — the row menu', () => {
  const menuRow = async (testid: string): Promise<HTMLElement> => {
    const label = await screen.findByTestId(testid);
    const item = label.closest('li');
    if (item === null) throw new Error(`no menu row ${testid}`);
    return item;
  };

  it('walks to the row’s parent and child by row', async () => {
    await mount();
    await act(async () => {
      fireEvent.contextMenu(rowEl(5));
    });
    const toParent = await menuRow('git-tool-commit-menu-go-to-parent');
    await settle(() => fireEvent.click(toParent));
    expect(selectedRows()).toEqual([6]);
    expect(tabNow.selectedSha).toBe(sha(TOTAL - 6));
    expect(locates).toEqual([]);
  });

  it('holds the walk at the list’s first row, and the pick on its first commit', async () => {
    await mount();
    await act(async () => {
      fireEvent.contextMenu(rowEl(0));
    });
    expect((await menuRow('git-tool-commit-menu-go-to-child')).getAttribute('aria-disabled')).toBe('true');
    expect((await menuRow('git-tool-commit-menu-go-to-parent')).getAttribute('aria-disabled')).not.toBe('true');
    expect((await menuRow('git-tool-commit-menu-cherry-pick')).getAttribute('aria-disabled')).not.toBe('true');
  });

  it('covers the set on a selected row — every commit of it, newest first', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await mount();
    await settle(() => fireEvent.click(rowEl(3)));
    await settle(() => fireEvent.click(rowEl(5), { shiftKey: true }));
    await act(async () => {
      fireEvent.contextMenu(rowEl(4));
    });
    expect(selectedRows()).toEqual([3, 4, 5]);
    const copy = await menuRow('git-tool-commit-menu-copy-revision');
    await settle(() => fireEvent.click(copy));
    expect(writeText).toHaveBeenCalledWith([sha(TOTAL - 3), sha(TOTAL - 4), sha(TOTAL - 5)].join('\n'));
  });
});

describe('GitLogView — the folds', () => {
  it('names the run a press folds in what the tab asks, the rows staying drawn', async () => {
    await mount();
    await settle(() => fireEvent.click(cellOf(4)));
    expect(tabNow.folds).toEqual({ all: false, runs: [sha(TOTAL - 3)] });
    expect(firstPageRead()).toMatchObject({ folds: [sha(TOTAL - 3)] });
    expect(mountedRows().length).toBeGreaterThan(0);

    // The run is folded now: a press opens it again.
    await settle(() => fireEvent.click(cellOf(4)));
    expect(tabNow.folds).toEqual({ all: false, runs: [] });
    expect(firstPageRead()?.folds).toBeUndefined();
  });

  it('keeps the folds when the scope or a filter changes', async () => {
    await mount();
    await settle(() => fireEvent.click(cellOf(4)));
    await apply({ selectedRefs: ['HEAD'] });
    expect(tabNow.folds.runs).toEqual([sha(TOTAL - 3)]);
    expect(firstPageRead()).toMatchObject({ folds: [sha(TOTAL - 3)] });
    expect(firstPageRead()?.allRefs).toBeUndefined();
  });

  it('folds no run on a list that sifts — a press on its cell asks nothing', async () => {
    await mount({ noMerges: true });
    const before = listReads().length;
    await settle(() => fireEvent.click(cellOf(4)));
    expect(tabNow.folds).toEqual({ all: false, runs: [] });
    expect(listReads()).toHaveLength(before);
  });
});

describe('GitLogView — the band and the signatures', () => {
  const banded = (): number[] => mountedRows().filter((at) => rowEl(at).getAttribute('data-current-branch') === 'true');

  it('bands the rows the host says the checked-out commit reaches', async () => {
    await mount();
    // Commit n sits on row TOTAL - n; every fifth commit is off the branch.
    expect(banded().slice(0, 6)).toEqual([1, 2, 3, 4, 6, 7]);
  });

  it('bands nothing on the HEAD scope, on the checked-out branch’s, or with the preference off', async () => {
    await mount({ selectedRefs: ['HEAD'] });
    expect(banded()).toEqual([]);
    await apply({ selectedRefs: ['main'] });
    await settle();
    expect(banded()).toEqual([]);
    await apply({ selectedRefs: [] });
    await waitFor(() => expect(banded().length).toBeGreaterThan(0));
    await settle(() => patchGitLogViewPrefs('ws-1', { highlightCurrentBranch: false }));
    expect(banded()).toEqual([]);
  });

  it('is not drawn again by a scroll over rows it holds — the rows in view are its business only while the column shows', async () => {
    viewportPx = 10 * ROW_PX;
    await mount();
    const list = screen.getByTestId('git-tool-list');
    const scrollTo = async (at: number): Promise<void> => {
      list.scrollTop = at * ROW_PX;
      await settle(() => fireEvent.scroll(list));
    };
    // The scroll stays well inside the first page: it reads nothing.
    await settle();
    const reads = rowReads.length;
    const before = drawn.count;
    await scrollTo(30);
    await scrollTo(60);
    expect(mountedRows()).toContain(60);
    expect(rowReads).toHaveLength(reads);
    expect(drawn.count).toBe(before);

    await settle(() => patchGitLogViewPrefs('ws-1', { showSignatureColumn: true }));
    const shown = drawn.count;
    await scrollTo(30);
    expect(drawn.count).toBeGreaterThan(shown);
  });

  it('asks about the signatures of the rows in view alone, and of none while the column is off', async () => {
    viewportPx = 10 * ROW_PX;
    await mount();
    expect(signatureAsks).toEqual([]);
    await settle(() => patchGitLogViewPrefs('ws-1', { showSignatureColumn: true }));
    await waitFor(() => expect(signatureAsks).toHaveLength(1));
    const inView = mountedRows();
    expect(inView.length).toBeLessThan(60);
    expect(signatureAsks[0]).toEqual(inView.map((at) => sha(TOTAL - at)));
  });
});
