/**
 * CommitList — the log's middle pane: graph cell, subject, the
 * right-aligned ref label column, author, and the graduated date column
 * — subject, author and date in one foreground, all three greyed on a
 * merge commit (the reference's reading). Rows reachable
 * from HEAD carry the reference's soft current-branch band (the
 * stylesheet paints it under the hover and the selection). The graph
 * layout arrives from the orchestrator and is null while a text filter
 * hides rows (edges over a non-contiguous list would lie — cells
 * degrade to plain dots). Empty states: filters-active answers "no
 * matches" with a reset action; a genuinely empty repo keeps the
 * standing first-commit hint.
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
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { clickModifiers, useMultiSelection } from '@openheaders/ui/shared/selection';
import type { GraphRow } from './graph';
import GraphCell, { GRAPH_ROW_HEIGHT } from './GraphCell';
import { formatLogDate, formatLogDateTitle, type HourCycle } from './log-date';
import { commitClickOutcome, stepTarget } from './log-selection';
import RefRowLabel from './RefRowLabel';

export interface CommitListProps {
  entries: WorkspaceTreeLogEntryWire[];
  /** Per-entry graph rows aligned with `entries`; null while filtered. */
  graph: GraphRow[] | null;
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
  /** Navigate gesture: scroll the row for `sha` into view. The nonce
   *  distinguishes repeated navigations to the same sha. */
  scrollTo?: { sha: string; nonce: number } | null;
  /** Eye menu — Show > Tag Names: tag chips on rows. */
  showTagChips?: boolean;
  /** Eye menu — Show > Commit Timestamp: time on older dates. */
  showTimestamp?: boolean;
  /** Eye menu — Highlight > Merge Commits: dim merge subjects. */
  dimMergeCommits?: boolean;
  /** The workbench clock format's hour cycle for the date column. */
  hourCycle?: HourCycle;
}

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
  scrollTo,
  showTagChips = true,
  showTimestamp = true,
  dimMergeCommits = true,
  hourCycle = 'h23',
}) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const dateLabels = useMemo(
    () => ({
      today: (time: string) => t('workbench.gitLog.date.today', { time }),
      yesterday: (time: string) => t('workbench.gitLog.date.yesterday', { time }),
    }),
    [t],
  );
  const listRef = useRef<HTMLDivElement>(null);
  const order = useMemo(() => entries.map((entry) => entry.sha), [entries]);
  const { selection, isSelected, click, step, clear } = useMultiSelection(order);

  useEffect(() => {
    if (scrollTo === null || scrollTo === undefined || listRef.current === null) return;
    const row = listRef.current.querySelector(`[data-sha="${scrollTo.sha}"]`);
    row?.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, [scrollTo]);

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

  // Up/Down walk the rows from the cursor (Shift extends the range);
  // focus follows so the next arrow continues from the landed row.
  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const target = stepTarget(order, selection.lead ?? selectedSha, event.key === 'ArrowDown' ? 1 : -1);
    if (target === null) return;
    event.preventDefault();
    step(target, event.shiftKey);
    onSelect(target);
    const row = listRef.current?.querySelector<HTMLElement>(`[data-sha="${target}"]`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  };

  if (entries.length === 0) {
    return (
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          fontSize: 12,
          color: token.colorTextSecondary,
        }}
        data-testid="git-tool-empty"
      >
        <span>{filtersActive ? t('workbench.gitLog.noMatches') : t('workbench.gitLog.empty')}</span>
        {filtersActive && (
          <Button type="link" size="small" onClick={onResetFilters} data-testid="git-tool-reset-filters">
            {t('workbench.gitLog.resetFilters')}
          </Button>
        )}
      </div>
    );
  }

  const maxLanes = graph === null ? 1 : Math.max(1, ...graph.map((row) => row.laneCount));

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
        const isMerge = dimMergeCommits && entry.parents.length > 1;
        const row = graph?.[index] ?? null;
        const rowRefs = refsBySha.get(entry.sha) ?? [];
        const labelRefs = showTagChips ? rowRefs : rowRefs.filter((ref) => ref.kind !== 'tag');
        const onCurrentBranch = currentBranchShas !== null && currentBranchShas.has(entry.sha);
        const textColor = isMerge ? token.colorTextTertiary : token.colorText;
        return (
          <button
            key={entry.sha}
            type="button"
            className={selected ? 'git-tool-row selected' : 'git-tool-row'}
            onClick={(event) => handleClick(entry.sha, event)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              height: GRAPH_ROW_HEIGHT,
              padding: '0 12px 0 0',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: token.colorText,
            }}
            data-testid="git-tool-row"
            data-sha={entry.sha}
            data-selected={selected || undefined}
            data-current-branch={onCurrentBranch || undefined}
          >
            <GraphCell
              row={row}
              maxLanes={maxLanes}
              isHead={entry.sha === headSha}
              fallbackColor={token.colorTextQuaternary}
            />
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: textColor,
              }}
            >
              {entry.subject}
            </span>
            <RefRowLabel refs={labelRefs} isHead={entry.sha === headSha} />
            <span style={{ flex: '0 0 auto', fontSize: 12, color: textColor }}>{entry.authorName}</span>
            <span
              title={formatLogDateTitle(entry.authoredAt, locale, hourCycle)}
              style={{
                flex: '0 0 auto',
                minWidth: 64,
                textAlign: 'right',
                fontSize: 12,
                color: textColor,
              }}
            >
              {formatLogDate(entry.authoredAt, locale, dateLabels, { withTime: showTimestamp, hourCycle })}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CommitList;
