/**
 * CommitList — a list of NAMED commits, every one of them drawn: the
 * compare pane's two sides (the log's own list, over the whole history
 * by row number, is `LogRowList`). Graph
 * cell, subject, the right-aligned ref label column (or the labels
 * before the subject with References on the Left), the short hash (off
 * by default), author, and the graduated date column — the eye menu's
 * Columns decide which of the last three show; subject, author, date
 * and hash in one face and one foreground, all four greyed on a merge
 * commit (the reference's reading). Rows reachable
 * from HEAD carry the reference's soft current-branch band (the
 * stylesheet paints it under the hover and the selection). The graph's
 * cells arrive from the orchestrator and are null where no graph joins
 * the commits listed (cells degrade to plain dots). Empty states:
 * filters-active answers "no matches" with a reset action; a genuinely
 * empty repo keeps the standing first-commit hint.
 *
 * Selection (the shared library): a click selects a row alone,
 * Cmd/Ctrl+click toggles it, Shift+click selects the range from the
 * anchor; Up/Down move the cursor (Shift extends). The tab remembers
 * ONE commit — the details commit — and the list reports it on every
 * gesture (the clicked row while it stays selected, else the first
 * survivor) and the selection itself in list order, so the details
 * pane can show a multi-selection's files as one set and a card per
 * commit. A commit the tab remembers
 * (a navigate from the rail or the toolbar, the tab's own restore)
 * becomes the selection when its row is visible.
 *
 * The row menu (the reference): a right-click on an unselected row
 * selects it alone and opens the menu over it; on a selected row the
 * menu covers the set. Left / Right walk to the child / parent commit
 * within the list (the menu's Go to rows).
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Dropdown, type MenuProps, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { clickModifiers, useMultiSelection } from '@openheaders/ui/shared/selection';
import { commitsApply } from './commit-apply';
import CommitListEmpty from './CommitListEmpty';
import CommitRowCells, { COMMIT_ROW_LAYOUT, type CommitRowColumns } from './CommitRowCells';
import { contextMenuAlign } from './git-menu-overflow';
import GraphCell from './GraphCell';
import type { GraphCellRow } from './log-cell';
import type { HourCycle } from './log-date';
import { childInList, parentInList } from './log-neighbors';
import type { LogRowMenuTarget } from './log-row-menu';
import { commitClickOutcome, stepTarget } from './log-selection';
import type { CommitSignature } from './use-commit-signatures';

export interface CommitListProps {
  entries: readonly WorkspaceTreeLogEntryWire[];
  /** The commits' graph cells, row for row; null where no graph joins them. */
  graph: readonly GraphCellRow[] | null;
  refsBySha: ReadonlyMap<string, WorkspaceTreeRefWire[]>;
  /** The checked-out commit — its graph dot is the hollow ring and its ref hover leads with HEAD. */
  headSha: string | null;
  /** Commits reachable from HEAD — the reference's current-branch band; null when off, withheld or unknown. */
  currentBranchShas?: ReadonlySet<string> | null;
  /** The details commit the tab remembers. */
  selectedSha: string | null;
  /** The details commit after a gesture — null when nothing stays selected. */
  onSelect: (sha: string | null) => void;
  /** The row selection in list order (newest first) after every change — the details pane's multi-selection feed. */
  onSelectionChange?: (shas: readonly string[]) => void;
  /** True when a text filter or ref scope is active — drives the
   *  no-matches empty state and its reset action. */
  filtersActive: boolean;
  onResetFilters: () => void;
  /** Eye menu — Show > Compact References View: one ref label per row (off: every label inline). */
  compactRefs?: boolean;
  /** Eye menu — Show > References on the Left: the ref labels before the subject. */
  refsOnLeft?: boolean;
  /** Eye menu — Show > Tag Names: a tag's name beside its glyph (the glyph always shows). */
  showTagChips?: boolean;
  /** Eye menu — Show > Commit Timestamp: time on older dates. */
  showTimestamp?: boolean;
  /** Eye menu — Show > Columns: the author column. */
  showAuthor?: boolean;
  /** Eye menu — Show > Columns: the short hash column. */
  showHash?: boolean;
  /** Eye menu — Show > Columns: the date column. */
  showDate?: boolean;
  /** Eye menu — Show > Columns: the signature column, at the far end. */
  showSignature?: boolean;
  /** The window's signed commits by sha — what the signature column marks. */
  signatures?: ReadonlyMap<string, CommitSignature>;
  /** Eye menu — Highlight > Merge Commits: dim merge subjects. */
  dimMergeCommits?: boolean;
  /** The workbench clock format's hour cycle for the date column. */
  hourCycle?: HourCycle;
  /** The row's right-click menu over the commits it covers; absent = no menu. */
  rowMenu?: (target: LogRowMenuTarget) => MenuProps;
}

const NO_REFS: readonly WorkspaceTreeRefWire[] = [];

const CommitList: React.FC<CommitListProps> = ({
  entries,
  graph,
  refsBySha,
  headSha,
  currentBranchShas = null,
  selectedSha,
  onSelect,
  onSelectionChange,
  filtersActive,
  onResetFilters,
  compactRefs = true,
  refsOnLeft = false,
  showTagChips = true,
  showTimestamp = true,
  showAuthor = true,
  showHash = false,
  showDate = true,
  showSignature = false,
  signatures,
  dimMergeCommits = true,
  hourCycle = 'h23',
  rowMenu,
}) => {
  const { token } = theme.useToken();
  const columns = useMemo<CommitRowColumns>(
    () => ({
      compactRefs,
      refsOnLeft,
      showTagChips,
      showTimestamp,
      showAuthor,
      showHash,
      showDate,
      showSignature,
      dimMergeCommits,
      hourCycle,
    }),
    [
      compactRefs,
      refsOnLeft,
      showTagChips,
      showTimestamp,
      showAuthor,
      showHash,
      showDate,
      showSignature,
      dimMergeCommits,
      hourCycle,
    ],
  );
  const listRef = useRef<HTMLDivElement>(null);
  const order = useMemo(() => entries.map((entry) => entry.sha), [entries]);
  const { selection, isSelected, click, step, contextMenu, clear } = useMultiSelection(order);

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

  // The right-click rule: an unselected row becomes the selection
  // alone (and the details commit); a selected row keeps the set.
  const handleContextMenu = (sha: string): void => {
    contextMenu(sha);
    if (!isSelected(sha)) onSelect(sha);
  };

  /** The row's menu target — the whole selection when the row sits in a wider one. */
  const menuTargetFor = (sha: string): LogRowMenuTarget => {
    const shas = isSelected(sha) && selection.ids.size >= 2 ? order.filter((id) => selection.ids.has(id)) : [sha];
    return {
      shas,
      child: shas.length === 1 ? childInList(entries, sha) : null,
      parent: shas.length === 1 ? parentInList(entries, sha) : null,
      applies: commitsApply(entries, shas),
    };
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

  /**
   * The row menu wrapper — antd composes the trigger with the row's own
   * onContextMenu. Focus returns to the row when the menu closes (a
   * verb may have moved it elsewhere — then it stays), so the arrows
   * keep walking from the commit the menu served.
   */
  const withRowMenu = (sha: string, row: React.ReactElement): React.ReactNode =>
    rowMenu === undefined ? (
      row
    ) : (
      <Dropdown
        key={sha}
        menu={rowMenu(menuTargetFor(sha))}
        trigger={['contextMenu']}
        align={contextMenuAlign}
        classNames={{ root: 'commit-tool-row-menu' }}
        onOpenChange={(open) => {
          if (open) return;
          const active = document.activeElement;
          const idle = active === null || active === document.body || active.closest('.commit-tool-row-menu') !== null;
          if (idle) listRef.current?.querySelector<HTMLElement>(`[data-sha="${sha}"]`)?.focus({ preventScroll: true });
        }}
      >
        {row}
      </Dropdown>
    );

  if (entries.length === 0) {
    return <CommitListEmpty filtersActive={filtersActive} onResetFilters={onResetFilters} />;
  }

  return (
    <div
      ref={listRef}
      className="git-tool-commit-list"
      onKeyDown={handleKeyDown}
      style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}
      data-testid="git-tool-list"
    >
      {entries.map((entry, index) => {
        const selected = isSelected(entry.sha);
        const onCurrentBranch = currentBranchShas !== null && currentBranchShas.has(entry.sha);
        return withRowMenu(
          entry.sha,
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
            data-current-branch={onCurrentBranch || undefined}
          >
            <GraphCell
              row={graph?.[index] ?? null}
              isHead={entry.sha === headSha}
              fallbackColor={token.colorTextQuaternary}
            />
            <CommitRowCells
              entry={entry}
              refs={refsBySha.get(entry.sha) ?? NO_REFS}
              isHead={entry.sha === headSha}
              columns={columns}
              signature={signatures?.get(entry.sha)}
            />
          </button>,
        );
      })}
    </div>
  );
};

export default CommitList;
