// @vitest-environment jsdom
/**
 * The two commit lists on the shared selection model: the log's
 * `CommitList` reports the details commit and the selection (list
 * order) on every gesture (plain / Shift / Cmd clicks, Up/Down with Shift) and
 * follows the tab's remembered commit; the Push window's
 * `PushCommitList` reports the selection with its details commit and
 * returns to the target row when nothing stays selected.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import CommitList from '@openheaders/ui/workbench/components/panels/git/CommitList';
import { computeLogGraph } from '@openheaders/ui/workbench/components/panels/git/graph';
import PushCommitList from '@openheaders/ui/workbench/components/panels/git/push/PushCommitList';
import type { PushSelection } from '@openheaders/ui/workbench/components/panels/git/push/push-window-model';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

function entry(sha: string): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents: [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-06T10:00:00.000Z',
    subject: `commit ${sha}`,
    coAuthors: [],
    files: [{ path: `docs/${sha}.md`, status: 'M' }],
  };
}

const ENTRIES = ['c1', 'c2', 'c3', 'c4'].map(entry);

beforeAll(() => {
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

afterEach(() => {
  cleanup();
});

const row = (sha: string): HTMLElement => {
  const found = screen.getAllByTestId('git-tool-row').find((el) => el.getAttribute('data-sha') === sha);
  if (!found) throw new Error(`no row ${sha}`);
  return found;
};

const selectedShas = (): string[] =>
  screen
    .getAllByTestId('git-tool-row')
    .filter((el) => el.getAttribute('data-selected') === 'true')
    .map((el) => el.getAttribute('data-sha') ?? '');

/** The orchestrator's part: the tab remembers the commit the list reports; `navigate` is a change from outside. */
const LogHarness: React.FC<{
  initial: string | null;
  navigate?: string | null;
  onSelect: (sha: string | null) => void;
  onSelection: (shas: readonly string[]) => void;
}> = ({ initial, navigate, onSelect, onSelection }) => {
  const [selectedSha, setSelectedSha] = useState(initial);
  useEffect(() => {
    if (navigate !== undefined) setSelectedSha(navigate);
  }, [navigate]);
  return (
    <CommitList
      entries={ENTRIES}
      graph={null}
      refsBySha={new Map()}
      headSha={null}
      selectedSha={selectedSha}
      onSelect={(sha) => {
        setSelectedSha(sha);
        onSelect(sha);
      }}
      onSelectionChange={onSelection}
      filtersActive={false}
      onResetFilters={() => undefined}
    />
  );
};

describe('CommitList — the current-branch band (S41, S43)', () => {
  it('rows reachable from HEAD carry the band attribute (the stylesheet paints it); a selected row keeps its selection', () => {
    render(
      <CommitList
        entries={ENTRIES}
        graph={null}
        refsBySha={new Map()}
        headSha={null}
        currentBranchShas={new Set([ENTRIES[0].sha, ENTRIES[1].sha])}
        selectedSha={ENTRIES[1].sha}
        onSelect={() => undefined}
        onSelectionChange={() => undefined}
        filtersActive={false}
        onResetFilters={() => undefined}
      />,
    );
    const rows = screen.getAllByTestId('git-tool-row');
    expect(rows.map((row) => row.getAttribute('data-current-branch'))).toEqual([
      'true',
      'true',
      ...ENTRIES.slice(2).map(() => null),
    ]);
    expect(rows[0].style.background).toBe('');
    expect(rows[1].getAttribute('data-selected')).toBe('true');
  });
});

describe('CommitList — the columns (S46)', () => {
  it('author and date show by default and the hash does not; each column follows its flag', () => {
    const { rerender } = render(
      <CommitList
        entries={ENTRIES}
        graph={null}
        refsBySha={new Map()}
        headSha={null}
        selectedSha={null}
        onSelect={() => undefined}
        onSelectionChange={() => undefined}
        filtersActive={false}
        onResetFilters={() => undefined}
      />,
    );
    expect(screen.getAllByTestId('git-tool-row-author')).toHaveLength(ENTRIES.length);
    expect(screen.getAllByTestId('git-tool-row-date')).toHaveLength(ENTRIES.length);
    expect(screen.queryAllByTestId('git-tool-row-hash')).toHaveLength(0);
    rerender(
      <CommitList
        entries={ENTRIES}
        graph={null}
        refsBySha={new Map()}
        headSha={null}
        selectedSha={null}
        onSelect={() => undefined}
        onSelectionChange={() => undefined}
        filtersActive={false}
        onResetFilters={() => undefined}
        showAuthor={false}
        showHash={true}
        showDate={false}
      />,
    );
    expect(screen.queryAllByTestId('git-tool-row-author')).toHaveLength(0);
    expect(screen.queryAllByTestId('git-tool-row-date')).toHaveLength(0);
    const hashes = screen.getAllByTestId('git-tool-row-hash');
    expect(hashes).toHaveLength(ENTRIES.length);
    expect(hashes[0].textContent).toBe(ENTRIES[0].sha.slice(0, 7));
  });
});

describe('CommitList — the graph cell (S45)', () => {
  it('the checked-out commit draws the hollow ring with its centre dot; every other row a filled dot', () => {
    render(
      <CommitList
        entries={ENTRIES}
        graph={null}
        refsBySha={new Map()}
        headSha={ENTRIES[1].sha}
        selectedSha={null}
        onSelect={() => undefined}
        onSelectionChange={() => undefined}
        filtersActive={false}
        onResetFilters={() => undefined}
      />,
    );
    const cells = screen.getAllByTestId('git-tool-graph-cell');
    expect(cells.map((cell) => cell.getAttribute('data-head'))).toEqual([null, 'true', null, null]);
    expect(cells[1].querySelectorAll('circle')).toHaveLength(2);
    expect(cells[1].querySelector('circle')?.getAttribute('fill')).toBe('none');
    expect(cells[0].querySelectorAll('circle')).toHaveLength(1);
  });

  it('the pointer over a cell lights its linear fragment — ends and interior — and a click reports it; the row click stays a selection', () => {
    // c4 -> c3 -> c2 -> c1, HEAD on c4: the whole run is one fragment with c4 and c1 its ends.
    const chain = ENTRIES.map((e, i) => ({ ...e, parents: i === 0 ? [] : [ENTRIES[i - 1].sha] })).reverse();
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    render(
      <CommitList
        entries={chain}
        graph={computeLogGraph(chain, { headSha: 'c4' })}
        refsBySha={new Map()}
        headSha="c4"
        selectedSha={null}
        onSelect={onSelect}
        onSelectionChange={() => undefined}
        filtersActive={false}
        onResetFilters={() => undefined}
        anchors={new Set(['c4'])}
        onToggleFragment={onToggle}
      />,
    );
    const cells = screen.getAllByTestId('git-tool-graph-cell');
    expect(cells.map((cell) => cell.getAttribute('data-highlight'))).toEqual([null, null, null, null]);
    fireEvent.mouseEnter(cells[1]);
    expect(cells.map((cell) => cell.getAttribute('data-highlight'))).toEqual(['end', 'interior', 'interior', 'end']);
    fireEvent.click(cells[1]);
    expect(onToggle).toHaveBeenCalledWith({ top: 'c4', bottom: 'c1', interior: ['c3', 'c2'] });
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.mouseLeave(cells[1]);
    expect(cells.map((cell) => cell.getAttribute('data-highlight'))).toEqual([null, null, null, null]);
  });

  it('a filtered list (no layout) lights nothing', () => {
    const chain = ENTRIES.map((e, i) => ({ ...e, parents: i === 0 ? [] : [ENTRIES[i - 1].sha] })).reverse();
    render(
      <CommitList
        entries={chain}
        graph={null}
        refsBySha={new Map()}
        headSha="c4"
        selectedSha={null}
        onSelect={() => undefined}
        onSelectionChange={() => undefined}
        filtersActive={true}
        onResetFilters={() => undefined}
        anchors={new Set(['c4'])}
      />,
    );
    const cells = screen.getAllByTestId('git-tool-graph-cell');
    fireEvent.mouseEnter(cells[1]);
    expect(cells.map((cell) => cell.getAttribute('data-highlight'))).toEqual([null, null, null, null]);
  });
});

describe('CommitList — the log rows on the shared selection model', () => {
  function renderList(selectedSha: string | null) {
    const onSelect = vi.fn<(sha: string | null) => void>();
    const onSelection = vi.fn<(shas: readonly string[]) => void>();
    const view = render(<LogHarness initial={selectedSha} onSelect={onSelect} onSelection={onSelection} />);
    return { onSelect, onSelection, view };
  }

  it('the tab’s remembered commit becomes the selection on mount', () => {
    renderList('c2');
    expect(selectedShas()).toEqual(['c2']);
  });

  it('Shift+click selects the range and reports the clicked commit with the selection in list order', () => {
    const { onSelect, onSelection } = renderList('c1');
    fireEvent.click(row('c3'), { shiftKey: true });
    expect(selectedShas()).toEqual(['c1', 'c2', 'c3']);
    expect(onSelect).toHaveBeenLastCalledWith('c3');
    expect(onSelection).toHaveBeenLastCalledWith(['c1', 'c2', 'c3']);
  });

  it('Cmd+click toggles a row in; toggling the details commit out follows the first survivor', () => {
    const { onSelect } = renderList('c1');
    fireEvent.click(row('c4'), { metaKey: true });
    expect(selectedShas()).toEqual(['c1', 'c4']);
    expect(onSelect).toHaveBeenLastCalledWith('c4');
    fireEvent.click(row('c4'), { metaKey: true });
    expect(selectedShas()).toEqual(['c1']);
    expect(onSelect).toHaveBeenLastCalledWith('c1');
  });

  it('toggling the only row out reports no commit', () => {
    const { onSelect } = renderList('c2');
    fireEvent.click(row('c2'), { ctrlKey: true });
    expect(selectedShas()).toEqual([]);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('a plain click collapses a range onto the clicked row', () => {
    const { onSelect } = renderList('c1');
    fireEvent.click(row('c3'), { shiftKey: true });
    fireEvent.click(row('c2'));
    expect(selectedShas()).toEqual(['c2']);
    expect(onSelect).toHaveBeenLastCalledWith('c2');
  });

  it('Down steps the cursor, Shift+Down extends the range', () => {
    const { onSelect, onSelection } = renderList('c1');
    fireEvent.keyDown(row('c1'), { key: 'ArrowDown' });
    expect(selectedShas()).toEqual(['c2']);
    expect(onSelect).toHaveBeenLastCalledWith('c2');
    fireEvent.keyDown(row('c2'), { key: 'ArrowDown', shiftKey: true });
    expect(selectedShas()).toEqual(['c2', 'c3']);
    expect(onSelection).toHaveBeenLastCalledWith(['c2', 'c3']);
    fireEvent.keyDown(row('c3'), { key: 'ArrowUp', shiftKey: true });
    expect(selectedShas()).toEqual(['c2']);
  });

  it('a navigate from outside (the tab’s commit changes) selects that row alone', () => {
    const { view, onSelect, onSelection } = renderList('c1');
    fireEvent.click(row('c3'), { shiftKey: true });
    expect(selectedShas()).toEqual(['c1', 'c2', 'c3']);
    view.rerender(<LogHarness initial="c1" navigate="c4" onSelect={onSelect} onSelection={onSelection} />);
    expect(selectedShas()).toEqual(['c4']);
  });
});

describe('PushCommitList — the Push window’s commit rows', () => {
  const pushRow = (sha: string): HTMLElement => {
    const found = screen.getAllByTestId('git-push-row').find((el) => el.getAttribute('data-sha') === sha);
    if (!found) throw new Error(`no row ${sha}`);
    return found;
  };

  /** The window's part: it holds the selection the list reports. */
  const PushHarness: React.FC<{ initial: PushSelection; onSelect: (selection: PushSelection) => void }> = ({
    initial,
    onSelect,
  }) => {
    const [selection, setSelection] = useState<PushSelection>(initial);
    return (
      <PushCommitList
        target={{ kind: 'upstream', branch: 'main', remote: 'origin', remoteBranch: 'main', upstream: 'origin/main' }}
        entries={ENTRIES}
        selection={selection}
        onSelect={(next) => {
          setSelection(next);
          onSelect(next);
        }}
        loading={false}
      />
    );
  };

  function renderPush(selection: PushSelection) {
    const onSelect = vi.fn<(selection: PushSelection) => void>();
    render(<PushHarness initial={selection} onSelect={onSelect} />);
    return { onSelect };
  }

  it('opens on the target row; a click on a commit reports it as the selection', () => {
    const { onSelect } = renderPush('all');
    expect(screen.getByTestId('git-push-target-row').getAttribute('data-selected')).toBe('true');
    fireEvent.click(pushRow('c2'));
    expect(onSelect).toHaveBeenLastCalledWith({ sha: 'c2', shas: ['c2'] });
  });

  it('Shift+click reports the range with the clicked commit leading', () => {
    const { onSelect } = renderPush('all');
    fireEvent.click(pushRow('c1'));
    fireEvent.click(pushRow('c3'), { shiftKey: true });
    const last = onSelect.mock.lastCall?.[0];
    expect(last).not.toBe('all');
    if (last === 'all' || last === undefined) throw new Error('expected a commit selection');
    expect(last.sha).toBe('c3');
    expect([...last.shas].sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('toggling the only commit out returns to the target row', () => {
    const { onSelect } = renderPush('all');
    fireEvent.click(pushRow('c2'));
    fireEvent.click(pushRow('c2'), { metaKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('all');
  });

  it('Down from the target row lands on the first commit', () => {
    const { onSelect } = renderPush('all');
    fireEvent.keyDown(screen.getByTestId('git-push-target-row'), { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenLastCalledWith({ sha: 'c1', shas: ['c1'] });
  });
});
