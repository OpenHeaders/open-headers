/**
 * CommitList — a list of NAMED commits, every one of them drawn: the
 * compare pane's two sides (the log's own list, over the whole history
 * by row number, is `LogRowList`). A plain dot — no graph joins the
 * commits named, and none is marked as the checked-out one — then the
 * row's cells as every list of commits draws them (`CommitRowCells`),
 * in the standing columns: subject, one ref label, author, the
 * graduated date. A side that names no commit is the pane's to say.
 *
 * Selection (the shared library): a click selects a row alone,
 * Cmd/Ctrl+click toggles it, Shift+click selects the range from the
 * anchor; Up/Down move the cursor (Shift extends), Left / Right walk to
 * the child / parent commit within the list; a right-click on an
 * unselected row selects it alone. The tab remembers ONE commit — the
 * details commit — and the list reports it on every gesture (the
 * clicked row while it stays selected, else the first survivor) and the
 * selection itself in list order, so the pane beside it can tell one
 * commit from several. A commit the tab remembers becomes the selection
 * when its row is listed.
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { clickModifiers, useMultiSelection } from '@openheaders/ui/shared/selection';
import CommitRowCells, {
  COMMIT_ROW_LAYOUT,
  type CommitRowColumns,
  DEFAULT_COMMIT_ROW_COLUMNS,
} from './CommitRowCells';
import GraphCell from './GraphCell';
import type { HourCycle } from './log-date';
import { childInList, parentInList } from './log-neighbors';
import { commitClickOutcome, stepTarget } from './log-selection';

export interface CommitListProps {
  entries: readonly WorkspaceTreeLogEntryWire[];
  refsBySha: ReadonlyMap<string, WorkspaceTreeRefWire[]>;
  /** The details commit the tab remembers. */
  selectedSha: string | null;
  /** The details commit after a gesture — null when nothing stays selected. */
  onSelect: (sha: string | null) => void;
  /** The row selection in list order (newest first) after every change — the details pane's multi-selection feed. */
  onSelectionChange?: (shas: readonly string[]) => void;
  /** The workbench clock format's hour cycle for the date column. */
  hourCycle?: HourCycle;
}

const NO_REFS: readonly WorkspaceTreeRefWire[] = [];

const CommitList: React.FC<CommitListProps> = ({
  entries,
  refsBySha,
  selectedSha,
  onSelect,
  onSelectionChange,
  hourCycle = DEFAULT_COMMIT_ROW_COLUMNS.hourCycle,
}) => {
  const { token } = theme.useToken();
  const columns = useMemo<CommitRowColumns>(() => ({ ...DEFAULT_COMMIT_ROW_COLUMNS, hourCycle }), [hourCycle]);
  const listRef = useRef<HTMLDivElement>(null);
  const order = useMemo(() => entries.map((entry) => entry.sha), [entries]);
  const { selection, isSelected, click, step, clear } = useMultiSelection(order);

  // The tab's commit leads the rows: a remembered commit whose row is
  // visible and not yet selected becomes the selection alone; a
  // cleared tab clears the rows. A remembered commit a filter hides
  // keeps its place in the tab and selects nothing.
  useEffect(() => {
    if (selectedSha === null) {
      if (selection.ids.size > 0) clear();
      return;
    }
    if (!selection.ids.has(selectedSha) && order.includes(selectedSha)) step(selectedSha, false);
  }, [selectedSha, selection, order, step, clear]);

  useEffect(() => {
    onSelectionChange?.(order.filter((sha) => selection.ids.has(sha)));
  }, [onSelectionChange, selection.ids, order]);

  const handleClick = (sha: string, event: React.MouseEvent): void => {
    const outcome = commitClickOutcome(selection, order, sha, clickModifiers(event));
    click(sha, event);
    onSelect(outcome.lead);
  };

  // A right-click on an unselected row makes it the details commit —
  // which the rows follow, so it is selected alone; a selected row
  // keeps the set.
  const handleContextMenu = (sha: string): void => {
    if (!isSelected(sha)) onSelect(sha);
  };

  // The keyboard lands on a row; focus follows so the next arrow
  // continues from the landed row.
  const land = (target: string, extend: boolean): void => {
    step(target, extend);
    onSelect(target);
    const row = listRef.current?.querySelector<HTMLElement>(`[data-sha="${target}"]`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  };

  // Up/Down walk the rows from the cursor (Shift extends the range);
  // Left/Right walk to the child / parent commit within the list.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    const cursor = selection.lead ?? selectedSha;
    let target: string | null = null;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      target = stepTarget(order, cursor, event.key === 'ArrowDown' ? 1 : -1);
    } else if (cursor !== null && event.key === 'ArrowLeft') {
      target = childInList(entries, cursor);
    } else if (cursor !== null && event.key === 'ArrowRight') {
      target = parentInList(entries, cursor);
    } else {
      return;
    }
    if (target === null) return;
    event.preventDefault();
    land(target, event.shiftKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp'));
  };

  return (
    <div
      ref={listRef}
      className="git-tool-commit-list"
      onKeyDown={handleKeyDown}
      style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}
      data-testid="git-tool-list"
    >
      {entries.map((entry) => {
        const selected = isSelected(entry.sha);
        return (
          <button
            key={entry.sha}
            type="button"
            className={selected ? 'git-tool-row selected' : 'git-tool-row'}
            onClick={(event) => handleClick(entry.sha, event)}
            onContextMenu={() => handleContextMenu(entry.sha)}
            style={{ ...COMMIT_ROW_LAYOUT, border: 'none', textAlign: 'left', color: token.colorText }}
            data-testid="git-tool-row"
            data-sha={entry.sha}
            data-selected={selected || undefined}
          >
            <GraphCell row={null} fallbackColor={token.colorTextQuaternary} />
            <CommitRowCells
              entry={entry}
              refs={refsBySha.get(entry.sha) ?? NO_REFS}
              isHead={false}
              columns={columns}
            />
          </button>
        );
      })}
    </div>
  );
};

export default CommitList;
