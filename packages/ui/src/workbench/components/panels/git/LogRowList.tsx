/**
 * LogRowList — the log's middle pane over a list the HOST keeps whole:
 * a window of rows of one height over row numbers
 * (`shared/virtual-window`), drawn from the pages the view holds
 * (`log-row-pages.ts`). The scrollbar stands for the whole history, and
 * the rows mounted at its position are reported so the read follows the
 * view (`onWindow`). Where the position's rows are not all read, the
 * read rows nearest them stand in the viewport until they are
 * (`log-rows-drawn.ts`) — a scrollbar dragged through the history never
 * draws an empty list; a row is drawn empty only where no read one can
 * stand in. The rows drawn are HELD IN THE VIEWPORT: their holder keeps
 * to it wherever the scroller stands, and the list places them inside
 * it each time it reads the scroller. A scrollbar moves the scroller
 * before the list can draw for where it went; what is shown meanwhile
 * is the rows it showed — never a bare viewport.
 *
 * Selection is by ROW NUMBER (`shared/selection/row-selection`): a
 * click selects a row alone, Cmd/Ctrl+click toggles it, Shift+click
 * selects the range from the anchor; Up/Down move the cursor (Shift
 * extends), Left / Right walk to the child / first parent the row names.
 * The tab remembers ONE commit — the details row — and the list reports
 * it on every gesture; a row the tab remembers that is not selected
 * becomes the selection alone. The list itself holds the focus and the
 * keys, so a row scrolled out of the window takes neither with it.
 *
 * A listing is ENTERED on the tab's row, else at its top — before its
 * first rows are painted, so the list is never seen where the listing
 * before was looked at.
 *
 * The graph column (the reference): a row's cell arrives whole with the
 * row; the pointer over a cell lights the linear run the row names, and
 * a press on it asks for the run to be folded or opened again. A cell
 * is as wide as its own row draws: a row is indented by its own graph,
 * never by a wider row scrolled into view.
 *
 * The row menu (the reference): a right-click on an unselected row
 * selects it alone and opens the menu over it; on a selected row the
 * menu covers the set. One menu serves the list — it is made for the
 * row it opens on.
 */

import type { WorkspaceTreeLogRunWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { LogTextRange } from '@openheaders/core/workspace-tree';
import { Dropdown, type MenuProps } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { clickModifiers, type RowSelectionHandlers, rowSelected } from '@openheaders/ui/shared/selection';
import { useFixedRowWindow } from '@openheaders/ui/shared/virtual-window';
import CommitListEmpty from './CommitListEmpty';
import type { CommitRowColumns } from './CommitRowCells';
import { contextMenuAlign } from './git-menu-overflow';
import { GRAPH_ROW_HEIGHT } from './GraphCell';
import { logRowHighlight } from './log-cell';
import { type LogRowPages, type LogRowRange, logRowAt, logRunAt } from './log-row-pages';
import { logRowsDrawn } from './log-rows-drawn';
import { rowClickOutcome, stepRowTarget } from './log-row-selection';
import LogRow from './LogRow';
import type { CommitSignature } from './use-commit-signatures';

export interface LogRowListProps {
  /** The rows held, and the list they are of. */
  held: LogRowPages;
  /** The listing the held rows are of — what was asked before its folds; null while none is held. */
  listing: string | null;
  /** The list asked for has no answer yet: an empty list says nothing of itself. */
  pending: boolean;
  /** The host refused the list asked for: no row is drawn, and none is said to be missing. */
  refused: boolean;
  /** The rows mounted — what the read follows. */
  onWindow: (mounted: LogRowRange) => void;
  /** The row selection, in this list's row numbers. */
  selection: RowSelectionHandlers;
  /** The details row the tab remembers; null for none, or one this list does not hold. */
  selectedRow: number | null;
  /** The details row after a gesture — null when nothing stays selected. */
  onSelect: (row: number | null) => void;
  refsBySha: ReadonlyMap<string, readonly WorkspaceTreeRefWire[]>;
  /** The checked-out commit — its graph dot is the hollow ring and its ref hover leads with HEAD. */
  headSha: string | null;
  /** Highlight > Current Branch: the rows the checked-out commit reaches carry the band. */
  band: boolean;
  /** True when a text filter or ref scope is active — "no matches" and its reset action. */
  filtersActive: boolean;
  onResetFilters: () => void;
  /** Navigate gesture: bring the row into view. The nonce distinguishes repeated navigations to the same row. */
  scrollTo?: { row: number; nonce: number } | null;
  columns: CommitRowColumns;
  /** The signed commits by sha — what the signature column marks. */
  signatures?: ReadonlyMap<string, CommitSignature>;
  matchRanges?: (text: string) => readonly LogTextRange[];
  /** A press on a row's graph cell — fold the run it lights, or open it again; `row` is the row pressed. */
  onToggleRun?: (run: WorkspaceTreeLogRunWire, row: number) => void;
  /** The menu over a row — the view knows what the row's selection covers; absent = no menu. */
  rowMenu?: (row: number) => MenuProps;
}

const NO_REFS: readonly WorkspaceTreeRefWire[] = [];
const NO_MENU: MenuProps = { items: [] };

/** The row an event landed on; null for one outside every row. */
function rowOf(target: EventTarget): number | null {
  const row = target instanceof Element ? target.closest<HTMLElement>('[data-row]') : null;
  return row === null ? null : Number(row.dataset.row);
}

const LogRowList: React.FC<LogRowListProps> = ({
  held,
  listing,
  pending,
  refused,
  onWindow,
  selection,
  selectedRow,
  onSelect,
  refsBySha,
  headSha,
  band,
  filtersActive,
  onResetFilters,
  scrollTo,
  columns,
  signatures,
  matchRanges,
  onToggleRun,
  rowMenu,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const { total } = held;
  const rowWindow = useFixedRowWindow(listRef, total, GRAPH_ROW_HEIGHT);
  const { start, end, inView } = rowWindow;
  const { ranges, lead } = selection.selection;

  useEffect(() => {
    onWindow({ first: start, last: end - 1 });
  }, [onWindow, start, end]);

  // The row the pointer's graph cell is of, and the run it names.
  const [hovered, setHovered] = useState<number | null>(null);
  const lit = useMemo(() => {
    const run = hovered === null ? undefined : logRowAt(held, hovered)?.run;
    return hovered === null || run === undefined ? null : logRunAt(held, hovered, run);
  }, [held, hovered]);
  const hover = useCallback(
    (row: number, hovering: boolean) => setHovered((prev) => (hovering ? row : prev === row ? null : prev)),
    [],
  );

  // The position's own rows, or the read rows standing in for them.
  const drawn = logRowsDrawn(held, inView);

  // The rows are drawn in a holder that keeps to the viewport, and WHERE they stand in it is written here, where
  // the scroller is read: on its scroll, and after every draw. A scrollbar moves the scroller before the list
  // can draw for where it went — the frame shown meanwhile is the rows it showed, never an empty list.
  const rowsRef = useRef<HTMLDivElement>(null);
  // Where the first row drawn stands in the scroller's content; null for rows standing in, at the viewport's top.
  const rowsAt = useRef<number | null>(null);
  rowsAt.current = drawn.standing ? null : rowWindow.offsetPx;
  const place = useCallback((): void => {
    const list = listRef.current;
    const rows = rowsRef.current;
    if (list === null || rows === null) return;
    if (rowsAt.current === null) {
      rows.style.transform = '';
      return;
    }
    // On a whole pixel of the screen: rows that meet at a fraction of one show a hairline of what is under them.
    const ratio = window.devicePixelRatio || 1;
    rows.style.transform = `translateY(${Math.round((rowsAt.current - list.scrollTop) * ratio) / ratio}px)`;
  }, []);

  const bringIntoView = (row: number, align: 'center' | 'nearest'): void => {
    const top = rowWindow.scrollTopFor(row, align);
    if (top === null || listRef.current === null) return;
    listRef.current.scrollTop = top;
    rowWindow.remeasure();
  };

  // A listing is entered on the tab's row, else at its top — before it is painted. A fold, a frame of the repo
  // and a history read anew are the same listing: the list stays where it is looked at.
  useLayoutEffect(() => {
    if (listing !== null) bringIntoView(selectedRow ?? 0, 'center');
  }, [listing]);

  // Every draw is placed before it is painted — after the scroller was moved to where a listing is entered.
  useLayoutEffect(place);

  // A scroll is drawn inside its event, and the rows are placed for it before the event returns.
  const handleScroll = (): void => {
    rowWindow.onScroll();
    place();
  };

  // A navigation is its nonce: the same row asked for again comes into view again.
  useEffect(() => {
    if (scrollTo !== null && scrollTo !== undefined) bringIntoView(scrollTo.row, 'center');
  }, [scrollTo]);

  // The tab's row leads the rows: one the tab remembers that is not
  // selected becomes the selection alone; a tab with none clears them.
  useEffect(() => {
    if (selectedRow === null) {
      if (ranges.length > 0) selection.clear();
      return;
    }
    if (!rowSelected(ranges, selectedRow)) selection.step(selectedRow, false);
  }, [selectedRow, ranges, selection.clear, selection.step]);

  // The handlers the rows are given stand still: a row is drawn again for what it shows, never for a gesture elsewhere.
  const gestures = useRef({ selection, onSelect, onToggleRun, held });
  gestures.current = { selection, onSelect, onToggleRun, held };

  const click = useCallback((row: number, event: React.MouseEvent): void => {
    const now = gestures.current;
    const outcome = rowClickOutcome(now.selection.selection, row, clickModifiers(event));
    now.selection.click(row, event);
    now.onSelect(outcome.lead);
  }, []);

  const toggleRun = useCallback((row: number): void => {
    const now = gestures.current;
    const run = logRowAt(now.held, row)?.run;
    const named = run === undefined ? null : logRunAt(now.held, row, run);
    if (named !== null) now.onToggleRun?.(named, row);
  }, []);

  // The keyboard lands on a row, and the row comes into view.
  const land = (target: number, extend: boolean): void => {
    selection.step(target, extend);
    onSelect(target);
    bringIntoView(target, 'nearest');
  };

  // Up/Down walk the rows from the cursor (Shift extends the range);
  // Left/Right walk to the child / first parent the cursor's row names.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    const cursor = lead ?? selectedRow;
    let target: number | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      target = stepRowTarget(total, cursor, event.key === 'ArrowDown' ? 1 : -1);
    } else if (cursor !== null && event.key === 'ArrowLeft') {
      const child = logRowAt(held, cursor)?.child ?? -1;
      target = child >= 0 ? child : null;
    } else if (cursor !== null && event.key === 'ArrowRight') {
      const parent = logRowAt(held, cursor)?.parents[0];
      target = parent !== undefined && parent < total ? parent : null;
    } else {
      return;
    }
    if (target === null) return;
    event.preventDefault();
    land(target, event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'));
  };

  // The row the menu is of. A right-click outside every row opens none.
  const [menu, setMenu] = useState<{ row: number; open: boolean } | null>(null);

  // The right-click rule: an unselected row becomes the selection alone
  // (and the details row); a selected row keeps the set. Read on the way
  // DOWN, so the menu that opens on the same click is this row's — and a
  // menu already open moves to the row, where nothing says "open" again.
  const handleContextMenu = (event: React.MouseEvent): void => {
    const row = rowOf(event.target);
    setMenu((prev) => (row === null ? null : { row, open: prev?.open ?? false }));
    if (row === null) return;
    selection.contextMenu(row);
    if (!selection.isSelected(row)) onSelect(row);
  };

  // Focus returns to the list when the menu closes (a verb may have
  // moved it elsewhere — then it stays), so the arrows keep walking
  // from the row the menu served.
  const handleMenuOpenChange = (open: boolean): void => {
    setMenu((prev) => (prev === null ? null : { ...prev, open }));
    if (open) return;
    const active = document.activeElement;
    const idle = active === null || active === document.body || active.closest('.commit-tool-row-menu') !== null;
    if (idle) listRef.current?.focus({ preventScroll: true });
  };

  if (total === 0) {
    // Before the first answer the list is not known to be empty: the pulse above says it is being read.
    if (pending) return <div style={{ flex: '1 1 auto' }} data-testid="git-tool-list-pending" />;
    return <CommitListEmpty filtersActive={filtersActive} onResetFilters={onResetFilters} refused={refused} />;
  }

  const rows: React.ReactNode[] = [];
  const from = drawn.standing ? drawn.first : start;
  const to = drawn.standing ? drawn.last + 1 : end;
  for (let number = from; number < to; number += 1) {
    const row = logRowAt(held, number);
    const highlight = row === null ? null : logRowHighlight(number, row.run, lit);
    const draws =
      row !== null && lit !== null && (highlight !== null || row.cell.edges.some((edge) => edge.run === lit.run));
    rows.push(
      <LogRow
        key={number}
        number={number}
        row={row}
        selected={rowSelected(ranges, number)}
        refs={row === null ? NO_REFS : (refsBySha.get(row.entry.sha) ?? NO_REFS)}
        isHead={row !== null && row.entry.sha === headSha}
        onCurrentBranch={band && row?.entry.onHead === true}
        litRun={draws && lit !== null ? lit.run : null}
        highlight={highlight}
        columns={columns}
        signature={row === null ? undefined : signatures?.get(row.entry.sha)}
        matchRanges={matchRanges}
        onClick={click}
        onHover={hover}
        onToggleRun={toggleRun}
      />,
    );
  }

  const list = (
    <div
      ref={listRef}
      role="listbox"
      aria-multiselectable
      tabIndex={0}
      className="git-tool-commit-list"
      onKeyDown={handleKeyDown}
      onScroll={handleScroll}
      onContextMenuCapture={handleContextMenu}
      style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', outline: 'none' }}
      data-testid="git-tool-list"
      data-total={total}
      data-standing={drawn.standing || undefined}
    >
      <div style={{ height: rowWindow.spacerPx }}>
        {/* The holder keeps to the viewport wherever the scroller stands, and shows no row past its edges. */}
        <div style={{ position: 'sticky', top: 0, height: rowWindow.viewportPx, overflow: 'hidden' }}>
          <div ref={rowsRef} style={{ willChange: 'transform' }}>
            {rows}
          </div>
        </div>
      </div>
    </div>
  );

  if (rowMenu === undefined) return list;
  return (
    <Dropdown
      menu={menu === null ? NO_MENU : rowMenu(menu.row)}
      open={menu?.open === true}
      trigger={['contextMenu']}
      align={contextMenuAlign}
      classNames={{ root: 'commit-tool-row-menu' }}
      onOpenChange={handleMenuOpenChange}
    >
      {list}
    </Dropdown>
  );
};

export default LogRowList;
