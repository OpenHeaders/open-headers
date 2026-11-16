// @vitest-environment jsdom
/**
 * The log view's text field over a mocked bridge whose host lists as
 * the real one does — every commit of the history a text matches: the
 * applied text rides the list's ask, with its toggles and without the
 * blanks around it; the list is the rows the host names, each painted
 * where it matched; the rows before stay under the pulse until the
 * text's own answer; a text the field cannot take is marked and asked
 * of nobody; a pattern out of time is the list's refusal; and no verb
 * but the list's own is ever called.
 */

import type {
  WorkspaceTreeLocateLogRowWire,
  WorkspaceTreeLogEntryWire,
  WorkspaceTreeLogRowsWire,
  WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';
import { makeLogTextMatcher } from '@openheaders/core/workspace-tree';
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

/** A history longer than the rows the view reads at once. */
const LONG = 500;
const ROW_PX = 26;

/** Commit `at` of a line, `LONG` the newest; every tenth one's subject says "probe", every fourth is Jane's. */
function entry(at: number): WorkspaceTreeLogEntryWire {
  return {
    sha: `w${at}`,
    parents: at > 1 ? [`w${at - 1}`] : [],
    authorName: at % 4 === 0 ? 'Jane Doe' : 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-06T10:00:00.000Z',
    subject: at % 10 === 0 ? `Probe the gateway ${at}` : `commit ${at}`,
    coAuthors: [],
    files: [{ path: `docs/${at}.md`, status: 'M' }],
    onHead: true,
  };
}

const line = (count: number): WorkspaceTreeLogEntryWire[] =>
  Array.from({ length: count }, (_, index) => entry(count - index));

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

interface Ask {
  from?: number;
  count?: number;
  text?: string;
  regex?: boolean;
  matchCase?: boolean;
  target?: string;
  [field: string]: unknown;
}

/** The history the host holds, newest first. */
let history: WorkspaceTreeLogEntryWire[] = [];
let refs: WorkspaceTreeRefWire[] = [];
/** Every call the view made, in order. */
let calls: Array<{ type: string; request: Ask }> = [];
/** A read of a list whose ask carries a text is answered by hand when set. */
let holdText: Array<() => void> | null = null;
/** What the host answers a read under a text with, in place of its list. */
let refuseText: WorkspaceTreeLogRowsWire | null = null;

let patch: (patch: Partial<GitLogTabState>) => void = () => undefined;
let tabNow: GitLogTabState = TAB;

const Harness: React.FC<{ initial: GitLogTabState }> = ({ initial }) => {
  const [tab, setTab] = useState(initial);
  tabNow = tab;
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

/** The list an ask names: every commit of the history its text matches, as the host's own matcher says. */
function listOf(ask: Ask): WorkspaceTreeLogEntryWire[] {
  if (ask.text === undefined) return history;
  const matcher = makeLogTextMatcher(ask.text, ask.regex === true, ask.matchCase === true);
  return matcher.kind === 'match' ? history.filter(matcher.test) : [];
}

function listRows(ask: Ask): WorkspaceTreeLogRowsWire {
  const list = listOf(ask);
  const from = ask.from ?? 0;
  const end = Math.min(list.length, from + (ask.count ?? 0));
  return {
    ok: true,
    list: 'g1',
    total: list.length,
    widest: 1,
    rows: list.slice(from, end).map((commit, offset) => ({
      entry: commit,
      cell: { lane: 0, color: 0, laneCount: 1, edges: [] },
      parents: from + offset + 1 < list.length ? [from + offset + 1] : [],
      child: from + offset - 1,
    })),
    runs: [],
  };
}

function locateRow(ask: Ask): WorkspaceTreeLocateLogRowWire {
  const row = listOf(ask).findIndex((commit) => commit.sha === ask.target);
  return row === -1 ? { ok: false, reason: 'not-listed' } : { ok: true, list: 'g1', row };
}

const rows = (): string[] => screen.queryAllByTestId('git-tool-row').map((el) => el.getAttribute('data-sha') ?? '');
const total = (): string | null => screen.queryByTestId('git-tool-list')?.getAttribute('data-total') ?? null;
const selected = (): string[] =>
  screen
    .queryAllByTestId('git-tool-row')
    .filter((el) => el.getAttribute('data-selected') === 'true')
    .map((el) => el.getAttribute('data-sha') ?? '');
/** The reads of the tab's list, as asked — the stretch left out. */
const listAsks = (): Ask[] =>
  calls
    .filter((call) => call.type === 'oh.workspaceTree.logRows' && call.request.key === 'log:1')
    .map(({ request: { from: _from, count: _count, ...ask } }) => ask);
const probes = (): string[] =>
  history.filter((commit) => commit.subject.startsWith('Probe')).map((commit) => commit.sha);

const settle = async (step: () => void = () => undefined): Promise<void> => {
  await act(async () => {
    step();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const apply = async (next: Partial<GitLogTabState>): Promise<void> => {
  await settle(() => patch(next));
};

const emitStatus = async (): Promise<void> => {
  await settle(() => {
    for (const listener of listeners.get('workspaceTreeGitStatus') ?? []) listener({ workspaceId: 'ws-1' });
  });
};

/** The view mounted with the whole history's first rows drawn. */
async function mount(initial: Partial<GitLogTabState> = {}): Promise<void> {
  render(<Harness initial={{ ...TAB, ...initial }} />);
  await waitFor(() => expect(rows().length).toBeGreaterThan(0));
  await settle();
}

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
  // The scroller as an engine lays it out: ten rows tall over the whole list.
  const isList = (el: HTMLElement): boolean => el.getAttribute('data-testid') === 'git-tool-list';
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? 10 * ROW_PX : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return isList(this) ? Math.max(10, Number(this.getAttribute('data-total'))) * ROW_PX : 0;
    },
  });
});

beforeEach(() => {
  history = line(LONG);
  refs = [{ name: 'main', kind: 'local', sha: `w${LONG}` }];
  calls = [];
  holdText = null;
  refuseText = null;
  tabNow = TAB;
  listeners.clear();
  mockCall.mockReset();
  mockCall.mockImplementation((type: string, request: Ask) => {
    calls.push({ type, request });
    if (type === 'oh.workspaceTree.listRefs') return Promise.resolve({ ok: true, refs, current: 'main' });
    if (type === 'oh.workspaceTree.logRows') {
      const answer = (): WorkspaceTreeLogRowsWire =>
        request.text !== undefined && refuseText !== null ? refuseText : listRows(request);
      if (request.text === undefined || holdText === null) return Promise.resolve(answer());
      return new Promise((resolve) => holdText?.push(() => resolve(answer())));
    }
    if (type === 'oh.workspaceTree.locateLogRow') return Promise.resolve(locateRow(request));
    return Promise.resolve({ ok: true });
  });
});

afterEach(cleanup);

describe('GitLogView — the text field over the whole history', () => {
  it('asks the host for the list under the text — every match of the history, by row', async () => {
    await mount();
    expect(total()).toBe(String(LONG));
    expect(listAsks().at(-1)).toEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true });

    await apply({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    expect(listAsks().at(-1)).toEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true, text: 'probe' });
    // Fifty commits of five hundred match — the oldest of them far past the rows first read.
    expect(rows()).toEqual(probes().slice(0, rows().length));
    expect(probes()).toHaveLength(50);
    expect(probes().at(-1)).toBe('w10');
  });

  it('calls no verb but the list’s own, whatever is applied', async () => {
    await mount();
    await apply({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    await apply({ filter: 'zzz' });
    await waitFor(() => expect(screen.queryByTestId('git-tool-empty')).not.toBeNull());
    await apply({ filter: '' });
    await waitFor(() => expect(total()).toBe(String(LONG)));
    expect(new Set(calls.map((call) => call.type))).toEqual(
      new Set(['oh.workspaceTree.listRefs', 'oh.workspaceTree.logRows']),
    );
  });

  it('paints each row where the text matched it — a subject, an author’s name', async () => {
    await mount({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    const first = screen.getAllByTestId('git-tool-row')[0];
    expect(Array.from(first.querySelectorAll('[data-testid="git-tool-match"]'), (mark) => mark.textContent)).toEqual([
      'Probe',
    ]);

    await apply({ filter: 'jane' });
    await waitFor(() => expect(total()).toBe('125'));
    expect(screen.getAllByTestId('git-tool-row')[0].querySelector('[data-testid="git-tool-match"]')?.textContent).toBe(
      'Jane',
    );
    // With no text applied nothing is painted.
    await apply({ filter: '' });
    await waitFor(() => expect(total()).toBe(String(LONG)));
    expect(screen.queryAllByTestId('git-tool-match')).toHaveLength(0);
  });

  it('sends the text without the blanks around it, and each toggle only when it is on', async () => {
    await mount({ filter: '  probe  ' });
    await waitFor(() => expect(total()).toBe('50'));
    expect(listAsks().at(-1)).toEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true, text: 'probe' });

    await apply({ filter: '^Probe .* 4\\d0$', filterRegex: true, filterCase: true });
    await waitFor(() => expect(total()).toBe('10'));
    expect(listAsks().at(-1)).toEqual({
      workspaceId: 'ws-1',
      key: 'log:1',
      allRefs: true,
      text: '^Probe .* 4\\d0$',
      regex: true,
      matchCase: true,
    });
    // The case is held: the same pattern in lower case matches nothing.
    await apply({ filter: '^probe .* 4\\d0$' });
    await waitFor(() => expect(screen.queryByTestId('git-tool-empty')).not.toBeNull());
  });

  it('sends the scope and the other sifts with the text — one ask names the list', async () => {
    refs = [
      { name: 'main', kind: 'local', sha: `w${LONG}` },
      { name: 'feature/orders-v2', kind: 'local', sha: 'w450' },
    ];
    await mount({ filter: 'probe', selectedRefs: ['feature/orders-v2'], noMerges: true, firstParent: true });
    expect(listAsks().at(-1)).toEqual({
      workspaceId: 'ws-1',
      key: 'log:1',
      refs: ['feature/orders-v2'],
      noMerges: true,
      firstParent: true,
      text: 'probe',
    });
  });

  it('keeps the rows before under the pulse until the text’s own list answers', async () => {
    await mount();
    const before = rows();
    holdText = [];
    await apply({ filter: 'probe' });
    await waitFor(() => expect(holdText).toHaveLength(1));
    expect(rows()).toEqual(before);
    expect(total()).toBe(String(LONG));
    expect(screen.queryByTestId('oh-send-pulse')).not.toBeNull();
    expect(screen.queryByTestId('git-tool-empty')).toBeNull();

    await settle(() => holdText?.[0]());
    await waitFor(() => expect(total()).toBe('50'));
  });

  it('says “no matches” once the host has answered that nothing matches — never before', async () => {
    await mount();
    holdText = [];
    await apply({ filter: 'zzz' });
    await waitFor(() => expect(holdText).toHaveLength(1));
    expect(screen.queryByTestId('git-tool-empty')).toBeNull();

    await settle(() => holdText?.[0]());
    await waitFor(() =>
      expect(screen.getByTestId('git-tool-empty').textContent).toContain('No commits matching filters'),
    );
    expect(screen.getByTestId('git-tool-reset-filters')).toBeTruthy();

    // Another text over that empty list: the list is not known to be empty for it.
    await apply({ filter: 'probe' });
    await waitFor(() => expect(holdText).toHaveLength(2));
    expect(screen.queryByTestId('git-tool-empty')).toBeNull();
    expect(screen.getByTestId('git-tool-list-pending')).toBeTruthy();
    await settle(() => holdText?.[1]());
    await waitFor(() => expect(total()).toBe('50'));
  });

  it('marks a text the field cannot take and asks nobody for it — the list stays the one before', async () => {
    await mount();
    const asked = listAsks().length;
    const invalid: Array<Partial<GitLogTabState>> = [
      { filter: '(', filterRegex: true },
      { filter: 'a'.repeat(201), filterRegex: false },
      { filter: 'probe\tgateway', filterRegex: false },
    ];
    for (const next of invalid) {
      await apply(next);
      await settle();
      expect(screen.getByTestId('git-tool-filter').closest('.ant-input-affix-wrapper')?.className).toContain(
        'status-error',
      );
      expect(total()).toBe(String(LONG));
      expect(listAsks().every((ask) => ask.text === undefined)).toBe(true);
      expect(listAsks()).toHaveLength(asked);
    }
    // The same text as a plain one is a search.
    await apply({ filter: '(', filterRegex: false });
    await waitFor(() => expect(listAsks().at(-1)?.text).toBe('('));
    expect(screen.getByTestId('git-tool-filter').closest('.ant-input-affix-wrapper')?.className).not.toContain(
      'status-error',
    );
  });

  it('shows the list’s refusal for a pattern that ran out of time, and lists nothing as its answer', async () => {
    await mount();
    refuseText = { ok: false, reason: 'search-timeout' };
    await apply({ filter: '(a+)+$', filterRegex: true });
    await waitFor(() => expect(screen.getByTestId('git-tool-error').textContent).toContain('search-timeout'));
    expect(rows()).toEqual([]);

    // Taken off, the whole list is back and the refusal gone.
    await apply({ filter: '' });
    await waitFor(() => expect(total()).toBe(String(LONG)));
    expect(screen.queryByTestId('git-tool-error')).toBeNull();
  });

  it('enters a text’s list on the tab’s commit, and the whole list on it again when the text is taken off', async () => {
    await mount({ selectedSha: 'w300' });
    await waitFor(() => expect(selected()).toEqual(['w300']));

    await apply({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    // The row was asked under the text's own ask.
    const located = calls.filter((call) => call.type === 'oh.workspaceTree.locateLogRow').at(-1);
    expect(located?.request).toMatchObject({ text: 'probe', target: 'w300' });
    await waitFor(() => expect(selected()).toEqual(['w300']));
    expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull();

    await apply({ filter: '' });
    await waitFor(() => expect(total()).toBe(String(LONG)));
    await waitFor(() => expect(selected()).toEqual(['w300']));
    expect(tabNow.selectedSha).toBe('w300');
    expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull();
  });

  it('keeps the tab’s commit through a text that leaves it out — no row selected, the commit back with the text off', async () => {
    await mount({ selectedSha: 'w301' });
    await waitFor(() => expect(selected()).toEqual(['w301']));

    await apply({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    await settle();
    expect(selected()).toEqual([]);
    expect(tabNow.selectedSha).toBe('w301');

    await apply({ filter: '' });
    await waitFor(() => expect(selected()).toEqual(['w301']));
  });

  it('reads a row of the text’s list for the details', async () => {
    await mount({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    expect(screen.getByTestId('git-tool-detail-placeholder')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('git-tool-row')[1]);
    await waitFor(() => expect(screen.queryByTestId('git-tool-detail-placeholder')).toBeNull());
    expect(tabNow.selectedSha).toBe('w490');
  });

  it('reads the same ask again on a frame of the repo — the text still part of it', async () => {
    await mount({ filter: 'probe' });
    await waitFor(() => expect(total()).toBe('50'));
    const asked = listAsks().length;
    history = line(LONG + 10);
    await emitStatus();
    await waitFor(() => expect(total()).toBe('51'));
    expect(listAsks().length).toBeGreaterThan(asked);
    expect(listAsks().at(-1)).toEqual({ workspaceId: 'ws-1', key: 'log:1', allRefs: true, text: 'probe' });
  });
});
