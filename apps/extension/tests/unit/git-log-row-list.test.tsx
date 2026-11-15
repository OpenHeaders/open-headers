// @vitest-environment jsdom
/**
 * `LogRowList` — the log's list over row numbers, mounted: the rows
 * held are drawn and one not read yet is an empty row of the same
 * height; the rows mounted are reported; the selection, the keyboard
 * and the right-click rule run on row numbers and report the details
 * row; the pointer over a graph cell lights the run its row names and a
 * press asks for its fold; the graph column is as wide as the rows in
 * view need; and over a laid-out scroller only the rows around the
 * scroll position are mounted, a navigation bringing its row into view.
 */

import type { WorkspaceTreeLogRowWire, WorkspaceTreeLogRunWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { selectedRows as selectedRowNumbers, useRowSelection } from '@openheaders/ui/shared/selection';
import { DEFAULT_COMMIT_ROW_COLUMNS } from '@openheaders/ui/workbench/components/panels/git/CommitRowCells';
import LogRowList from '@openheaders/ui/workbench/components/panels/git/LogRowList';
import {
  type LogRowPages,
  type LogRowRange,
  type LogRowsAsk,
  NO_LOG_ROW_RANGE,
  NO_LOG_ROWS,
  takeLogRows,
} from '@openheaders/ui/workbench/components/panels/git/log-row-pages';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MenuProps } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ASK: LogRowsAsk = { workspaceId: 'ws-1', key: 'log:1', allRefs: true };
const ROW_PX = 26;

const sha = (row: number): string => row.toString(16).padStart(40, '0');

/** Rows 2…6 are one linear run: 2 its top, 6 its bottom, 3–5 the commits it hides. */
const RUN: WorkspaceTreeLogRunWire = { run: 7, first: sha(3), top: 2, bottom: 6, hidden: 3, folded: false };
const inRun = (row: number): boolean => row >= 2 && row <= 5;

function row(at: number, total: number, lanes = 1): WorkspaceTreeLogRowWire {
  return {
    entry: {
      sha: sha(at),
      parents: at + 1 < total ? [sha(at + 1)] : [],
      authorName: 'John Doe',
      authorEmail: 'john@openheaders.io',
      authoredAt: '2026-11-15T10:00:00.000Z',
      subject: `commit ${at}`,
      coAuthors: [],
      files: [],
      onHead: at >= 1,
    },
    cell: {
      lane: 0,
      color: 0,
      laneCount: lanes,
      edges: [
        ...(at > 0
          ? [
              {
                from: 0,
                to: 0,
                color: 0,
                span: 'top' as const,
                child: at - 1,
                parent: at,
                collapsed: false,
                ...(at >= 3 && at <= 6 ? { run: RUN.run } : {}),
              },
            ]
          : []),
        {
          from: 0,
          to: 0,
          color: 0,
          span: 'bottom' as const,
          child: at,
          parent: at + 1,
          collapsed: false,
          ...(inRun(at) ? { run: RUN.run } : {}),
        },
      ],
    },
    parents: [at + 1],
    child: at - 1,
    ...(inRun(at) ? { run: RUN.run } : {}),
  };
}

/** A list of `total` rows with the named pages held; `lanes` widens a row's cell. */
function holding(total: number, pages: number[] = [0], lanes: (at: number) => number = () => 1): LogRowPages {
  let held = NO_LOG_ROWS;
  for (const page of pages) {
    const rows: WorkspaceTreeLogRowWire[] = [];
    for (let at = page * 200; at < Math.min(total, page * 200 + 200); at += 1) rows.push(row(at, total, lanes(at)));
    held = takeLogRows(
      held,
      ASK,
      page * 200,
      { ok: true, list: 'g1', total, widest: 4, rows, runs: [RUN] },
      NO_LOG_ROW_RANGE,
    );
  }
  return held;
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
});

afterEach(() => {
  cleanup();
});

const rowEl = (at: number): HTMLElement => {
  const found = screen.getAllByTestId('git-tool-row').find((el) => el.getAttribute('data-row') === String(at));
  if (!found) throw new Error(`no row ${at}`);
  return found;
};
const mountedRows = (): number[] => screen.getAllByTestId('git-tool-row').map((el) => Number(el.dataset.row));
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

interface HarnessProps {
  held: LogRowPages;
  pending?: boolean;
  initial?: number | null;
  /** A change of the tab's row from outside the list. */
  navigate?: number | null;
  scrollTo?: { row: number; nonce: number } | null;
  band?: boolean;
  headSha?: string | null;
  refsBySha?: ReadonlyMap<string, readonly WorkspaceTreeRefWire[]>;
  filtersActive?: boolean;
  onResetFilters?: () => void;
  onSelect?: (row: number | null) => void;
  onWindow?: (mounted: LogRowRange) => void;
  onToggleRun?: (run: WorkspaceTreeLogRunWire, row: number) => void;
  /** The menu over a row, told the selection the view holds when it is made. */
  rowMenu?: (row: number, selected: number[]) => MenuProps;
}

/** The view's part: it holds the selection and remembers the row the list reports. */
const Harness: React.FC<HarnessProps> = ({
  held,
  pending = false,
  initial = null,
  navigate,
  scrollTo,
  band = false,
  headSha = null,
  refsBySha = new Map(),
  filtersActive = false,
  onResetFilters = () => undefined,
  onSelect,
  onWindow = () => undefined,
  onToggleRun,
  rowMenu,
}) => {
  const selection = useRowSelection(held.list);
  const [selectedRow, setSelectedRow] = useState(initial);
  useEffect(() => {
    if (navigate !== undefined) setSelectedRow(navigate);
  }, [navigate]);
  return (
    <LogRowList
      held={held}
      pending={pending}
      onWindow={onWindow}
      selection={selection}
      selectedRow={selectedRow}
      onSelect={(next) => {
        setSelectedRow(next);
        onSelect?.(next);
      }}
      refsBySha={refsBySha}
      headSha={headSha}
      band={band}
      filtersActive={filtersActive}
      onResetFilters={onResetFilters}
      scrollTo={scrollTo}
      columns={DEFAULT_COMMIT_ROW_COLUMNS}
      onToggleRun={onToggleRun}
      rowMenu={
        rowMenu === undefined ? undefined : (at) => rowMenu(at, selectedRowNumbers(selection.selection.ranges, 50))
      }
    />
  );
};

describe('LogRowList — the rows', () => {
  it('draws the rows held, each by its number and its commit', () => {
    render(<Harness held={holding(5)} />);
    expect(mountedRows()).toEqual([0, 1, 2, 3, 4]);
    expect(rowEl(3).getAttribute('data-sha')).toBe(sha(3));
    expect(rowEl(3).textContent).toContain('commit 3');
    expect(screen.getByTestId('git-tool-list').getAttribute('data-total')).toBe('5');
  });

  it('draws a row not read yet as an empty row of the same height', () => {
    // 300 rows, the first page held: a scroller with no height yet mounts the first 200.
    render(<Harness held={holding(300, [1])} />);
    expect(mountedRows()).toHaveLength(200);
    const pending = rowEl(10);
    expect(pending.getAttribute('data-pending')).toBe('true');
    expect(pending.getAttribute('data-sha')).toBeNull();
    expect(pending.children).toHaveLength(0);
    expect(pending.style.height).toBe(`${ROW_PX}px`);
  });

  it('reports the rows mounted, and again when the list’s length changes', () => {
    const onWindow = vi.fn();
    const { rerender } = render(<Harness held={holding(5)} onWindow={onWindow} />);
    expect(onWindow).toHaveBeenLastCalledWith({ first: 0, last: 4 });
    rerender(<Harness held={holding(300)} onWindow={onWindow} />);
    expect(onWindow).toHaveBeenLastCalledWith({ first: 0, last: 199 });
  });

  it('bands the rows the checked-out commit reaches while the band is on', () => {
    const { rerender } = render(<Harness held={holding(4)} band />);
    expect(mountedRows().map((at) => rowEl(at).getAttribute('data-current-branch'))).toEqual([
      null,
      'true',
      'true',
      'true',
    ]);
    rerender(<Harness held={holding(4)} />);
    expect(mountedRows().map((at) => rowEl(at).getAttribute('data-current-branch'))).toEqual([null, null, null, null]);
  });

  it('draws the checked-out commit as the ring', () => {
    render(<Harness held={holding(4)} headSha={sha(2)} />);
    expect(cellOf(2).getAttribute('data-head')).toBe('true');
    expect(cellOf(1).getAttribute('data-head')).toBeNull();
  });

  it('makes the graph column as wide as the rows in view need', () => {
    render(<Harness held={holding(6, [0], (at) => (at === 4 ? 3 : 1))} />);
    // 8 px of lead and 16 px a lane: every cell is as wide as the widest row's three lanes.
    expect(cellOf(0).getAttribute('width')).toBe('56');
    expect(cellOf(4).getAttribute('width')).toBe('56');
  });
});

describe('LogRowList — a list with no row', () => {
  it('says nothing of a list that has no answer yet', () => {
    render(<Harness held={NO_LOG_ROWS} pending />);
    expect(screen.getByTestId('git-tool-list-pending')).toBeTruthy();
    expect(screen.queryByTestId('git-tool-empty')).toBeNull();
  });

  it('says the repo has no commit, or that nothing matches with a way back', () => {
    const { rerender } = render(<Harness held={holding(0)} />);
    expect(screen.getByTestId('git-tool-empty')).toBeTruthy();
    expect(screen.queryByTestId('git-tool-reset-filters')).toBeNull();
    const onResetFilters = vi.fn();
    rerender(<Harness held={holding(0)} filtersActive onResetFilters={onResetFilters} />);
    fireEvent.click(screen.getByTestId('git-tool-reset-filters'));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });
});

describe('LogRowList — the selection', () => {
  it('a click selects the row alone and reports it; Shift ranges; Cmd toggles', () => {
    const onSelect = vi.fn();
    render(<Harness held={holding(8)} onSelect={onSelect} />);
    fireEvent.click(rowEl(1));
    expect(selectedRows()).toEqual([1]);
    expect(onSelect).toHaveBeenLastCalledWith(1);

    fireEvent.click(rowEl(4), { shiftKey: true });
    expect(selectedRows()).toEqual([1, 2, 3, 4]);
    expect(onSelect).toHaveBeenLastCalledWith(4);

    fireEvent.click(rowEl(6), { metaKey: true });
    expect(selectedRows()).toEqual([1, 2, 3, 4, 6]);
    expect(onSelect).toHaveBeenLastCalledWith(6);

    // Toggling the details row out: the details follow the first row still selected.
    fireEvent.click(rowEl(6), { metaKey: true });
    expect(selectedRows()).toEqual([1, 2, 3, 4]);
    expect(onSelect).toHaveBeenLastCalledWith(1);
  });

  it('reports no row once the last one is toggled out', () => {
    const onSelect = vi.fn();
    render(<Harness held={holding(8)} onSelect={onSelect} />);
    fireEvent.click(rowEl(2));
    fireEvent.click(rowEl(2), { metaKey: true });
    expect(selectedRows()).toEqual([]);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('follows the row the tab remembers: it becomes the selection alone, and none clears the rows', () => {
    const { rerender } = render(<Harness held={holding(8)} initial={3} />);
    expect(selectedRows()).toEqual([3]);
    rerender(<Harness held={holding(8)} initial={3} navigate={5} />);
    expect(selectedRows()).toEqual([5]);
    rerender(<Harness held={holding(8)} initial={3} navigate={null} />);
    expect(selectedRows()).toEqual([]);
  });

  it('keeps a wider selection the tab’s row sits in', () => {
    render(<Harness held={holding(8)} />);
    fireEvent.click(rowEl(1));
    fireEvent.click(rowEl(4), { shiftKey: true });
    expect(selectedRows()).toEqual([1, 2, 3, 4]);
  });

  it('holds the focus itself: a row is no focus target', () => {
    render(<Harness held={holding(4)} />);
    expect(screen.getByTestId('git-tool-list').getAttribute('tabindex')).toBe('0');
    expect(rowEl(1).getAttribute('tabindex')).toBeNull();
    expect(rowEl(1).tagName).toBe('DIV');
  });
});

describe('LogRowList — the keyboard', () => {
  it('Up and Down walk the rows from the cursor, held to the list’s ends; Shift extends', () => {
    const onSelect = vi.fn();
    render(<Harness held={holding(4)} onSelect={onSelect} />);
    const list = screen.getByTestId('git-tool-list');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRows()).toEqual([0]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown', shiftKey: true });
    expect(selectedRows()).toEqual([1, 2]);
    expect(onSelect).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectedRows()).toEqual([1]);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectedRows()).toEqual([0]);
    for (let press = 0; press < 6; press += 1) fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRows()).toEqual([3]);
  });

  it('Left walks to the child the row names and Right to its first parent, neither past the list', () => {
    const onSelect = vi.fn();
    render(<Harness held={holding(4)} initial={1} onSelect={onSelect} />);
    const list = screen.getByTestId('git-tool-list');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedRows()).toEqual([2]);
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedRows()).toEqual([3]);
    // Row 3's parent is past the list.
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedRows()).toEqual([3]);
    for (let press = 0; press < 5; press += 1) fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(selectedRows()).toEqual([0]);
    expect(onSelect).toHaveBeenLastCalledWith(0);
  });

  it('walks from the cursor — the last row clicked — where the details row is another', () => {
    render(<Harness held={holding(8)} />);
    const list = screen.getByTestId('git-tool-list');
    fireEvent.click(rowEl(1));
    fireEvent.click(rowEl(4), { shiftKey: true });
    // Row 3 toggled out: the details follow row 1, the cursor stays on row 3.
    fireEvent.click(rowEl(3), { metaKey: true });
    expect(selectedRows()).toEqual([1, 2, 4]);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRows()).toEqual([4]);
  });

  it('Left and Right do nothing with no cursor, and a Shift with them extends nothing', () => {
    render(<Harness held={holding(4)} />);
    const list = screen.getByTestId('git-tool-list');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(selectedRows()).toEqual([]);
    fireEvent.click(rowEl(1));
    fireEvent.keyDown(list, { key: 'ArrowRight', shiftKey: true });
    expect(selectedRows()).toEqual([2]);
  });
});

describe('LogRowList — the graph', () => {
  it('lights the run the row under the pointer names: its two ends and the rows between', () => {
    render(<Harness held={holding(8)} />);
    fireEvent.mouseEnter(cellOf(4));
    expect(mountedRows().map((at) => cellOf(at).getAttribute('data-highlight'))).toEqual([
      null,
      null,
      'end',
      'interior',
      'interior',
      'interior',
      'end',
      null,
    ]);
    // A lit edge wears its border — a wider path under its own: the edges that carry the run, in every cell they cross.
    const borders = (): number[] =>
      mountedRows().map((at) => cellOf(at).querySelectorAll('path[stroke-width="4"]').length);
    expect(borders()).toEqual([0, 0, 1, 2, 2, 2, 1, 0]);
    fireEvent.mouseLeave(cellOf(4));
    expect(mountedRows().map((at) => cellOf(at).getAttribute('data-highlight'))).toEqual(Array(8).fill(null));
    expect(borders()).toEqual(Array(8).fill(0));
  });

  it('lights nothing over a row that names no run', () => {
    render(<Harness held={holding(8)} />);
    fireEvent.mouseEnter(cellOf(7));
    expect(mountedRows().map((at) => cellOf(at).getAttribute('data-highlight'))).toEqual(Array(8).fill(null));
  });

  it('a press on a cell asks for its run’s fold and leaves the row’s selection alone', () => {
    const onToggleRun = vi.fn();
    const onSelect = vi.fn();
    render(<Harness held={holding(8)} onToggleRun={onToggleRun} onSelect={onSelect} />);
    fireEvent.click(cellOf(3));
    expect(onToggleRun).toHaveBeenCalledWith(RUN, 3);
    fireEvent.click(cellOf(7));
    expect(onToggleRun).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    expect(selectedRows()).toEqual([]);
  });
});

describe('LogRowList — the row menu', () => {
  /** A menu that records the row it was made for, and the selection the view held then. */
  const menuOf =
    (rows: number[], selections: number[][] = []) =>
    (at: number, selected: number[]): MenuProps => {
      rows.push(at);
      selections.push(selected);
      return { items: [{ key: 'probe', label: `menu of row ${at}` }] };
    };

  it('a right-click on an unselected row selects it alone and opens its menu', async () => {
    const asked: number[] = [];
    const onSelect = vi.fn();
    render(<Harness held={holding(8)} onSelect={onSelect} rowMenu={menuOf(asked)} />);
    fireEvent.click(rowEl(1));
    await act(async () => {
      fireEvent.contextMenu(rowEl(5));
    });
    expect(selectedRows()).toEqual([5]);
    expect(onSelect).toHaveBeenLastCalledWith(5);
    expect(asked.at(-1)).toBe(5);
    expect(await screen.findByText('menu of row 5')).toBeTruthy();

    // The next right-click's menu is the next row's.
    await act(async () => {
      fireEvent.contextMenu(rowEl(2));
    });
    expect(asked.at(-1)).toBe(2);
    expect(await screen.findByText('menu of row 2')).toBeTruthy();
  });

  it('makes the menu over the selection the right-click left, never the one before it', async () => {
    const asked: number[] = [];
    const selections: number[][] = [];
    render(<Harness held={holding(8)} rowMenu={menuOf(asked, selections)} />);
    fireEvent.click(rowEl(1));
    await act(async () => {
      fireEvent.contextMenu(rowEl(5));
    });
    expect(asked[0]).toBe(5);
    expect(selections[0]).toEqual([5]);
  });

  it('a right-click on a selected row keeps the set', async () => {
    const asked: number[] = [];
    const onSelect = vi.fn();
    render(<Harness held={holding(8)} onSelect={onSelect} rowMenu={menuOf(asked)} />);
    fireEvent.click(rowEl(1));
    fireEvent.click(rowEl(4), { shiftKey: true });
    onSelect.mockClear();
    await act(async () => {
      fireEvent.contextMenu(rowEl(2));
    });
    expect(selectedRows()).toEqual([1, 2, 3, 4]);
    expect(onSelect).not.toHaveBeenCalled();
    expect(asked.at(-1)).toBe(2);
  });

  it('lets the menu go on a right-click outside every row', async () => {
    const asked: number[] = [];
    render(<Harness held={holding(8)} rowMenu={menuOf(asked)} />);
    await act(async () => {
      fireEvent.contextMenu(rowEl(5));
    });
    await act(async () => {
      fireEvent.contextMenu(screen.getByTestId('git-tool-list'));
    });
    // No row's menu is held any more: a later render makes none.
    const made = asked.length;
    fireEvent.click(rowEl(1));
    expect(asked).toHaveLength(made);
  });

  it('makes no menu until a row is right-clicked', () => {
    const asked: number[] = [];
    render(<Harness held={holding(8)} rowMenu={menuOf(asked)} />);
    fireEvent.click(rowEl(1));
    expect(asked).toEqual([]);
  });
});

describe('LogRowList — over a laid-out scroller', () => {
  beforeEach(() => {
    viewportPx = 520;
  });

  it('mounts only the rows around the scroll position, each at its own place', () => {
    const onWindow = vi.fn();
    render(<Harness held={holding(10_000, [0, 2])} onWindow={onWindow} />);
    // 520 px of rows and 600 px beyond: 44 rows from the top.
    expect(mountedRows()).toEqual(Array.from({ length: 44 }, (_, at) => at));
    expect(onWindow).toHaveBeenLastCalledWith({ first: 0, last: 43 });

    const list = screen.getByTestId('git-tool-list');
    list.scrollTop = 500 * ROW_PX;
    fireEvent.scroll(list);
    expect(mountedRows()[0]).toBe(476);
    expect(mountedRows().at(-1)).toBe(543);
    expect(onWindow).toHaveBeenLastCalledWith({ first: 476, last: 543 });
    expect(rowEl(500).textContent).toContain('commit 500');
    expect((rowEl(476).parentElement as HTMLElement).style.top).toBe(`${476 * ROW_PX}px`);
    expect(((rowEl(476).parentElement as HTMLElement).parentElement as HTMLElement).style.height).toBe(
      `${10_000 * ROW_PX}px`,
    );
  });

  it('takes the graph column’s width from the rows the viewport shows, not the ones mounted beyond it', () => {
    // 20 rows show and 44 are mounted: row 30 is three lanes wide, under the viewport.
    render(<Harness held={holding(10_000, [0], (at) => (at === 30 ? 3 : 1))} />);
    expect(mountedRows()).toContain(30);
    expect(cellOf(0).getAttribute('width')).toBe('24');

    // Row 29 is the last one showing: row 30 sits right under the edge.
    const list = screen.getByTestId('git-tool-list');
    list.scrollTop = 10 * ROW_PX;
    fireEvent.scroll(list);
    expect(cellOf(29).getAttribute('width')).toBe('24');

    // A pixel of row 30 shows: the column is as wide as it needs.
    list.scrollTop = 10 * ROW_PX + 1;
    fireEvent.scroll(list);
    expect(cellOf(29).getAttribute('width')).toBe('56');

    // Row 31 at the viewport's top: row 30 is mounted above it, and the column is a lane wide again.
    list.scrollTop = 31 * ROW_PX;
    fireEvent.scroll(list);
    expect(mountedRows()).toContain(30);
    expect(cellOf(31).getAttribute('width')).toBe('24');
  });

  it('brings a navigation’s row into view, and the same row again on a new nonce', () => {
    const held = holding(10_000, [0]);
    const { rerender } = render(<Harness held={held} />);
    const list = screen.getByTestId('git-tool-list');
    rerender(<Harness held={held} scrollTo={{ row: 5_000, nonce: 1 }} />);
    expect(list.scrollTop).toBe(5_000 * ROW_PX - (520 - ROW_PX) / 2);
    expect(mountedRows()).toContain(5_000);

    list.scrollTop = 0;
    fireEvent.scroll(list);
    rerender(<Harness held={held} scrollTo={{ row: 5_000, nonce: 2 }} />);
    expect(list.scrollTop).toBe(5_000 * ROW_PX - (520 - ROW_PX) / 2);
  });

  it('brings the row the keyboard lands on into view', () => {
    render(<Harness held={holding(10_000, [0])} initial={19} />);
    const list = screen.getByTestId('git-tool-list');
    // 20 rows show: row 20 is the first one under the viewport.
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectedRows()).toEqual([20]);
    expect(list.scrollTop).toBe(21 * ROW_PX - 520);
  });
});
