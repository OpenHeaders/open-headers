/**
 * CommitList — the log's middle pane: graph cell, subject (dimmed for
 * merge commits, the IDE convention), inline ref chips, bold author,
 * and the graduated date column. The graph layout arrives from the
 * orchestrator and is null while a text filter hides rows (edges over a
 * non-contiguous list would lie — cells degrade to plain dots). Empty
 * states: filters-active answers "no matches" with a reset action; a
 * genuinely empty repo keeps the standing first-commit hint.
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Button, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import type { GraphRow } from './graph';
import GraphCell, { GRAPH_ROW_HEIGHT } from './GraphCell';
import { formatLogDate } from './log-date';
import RefChips from './RefChips';

export interface CommitListProps {
  entries: WorkspaceTreeLogEntryWire[];
  /** Per-entry graph rows aligned with `entries`; null while filtered. */
  graph: GraphRow[] | null;
  refsBySha: ReadonlyMap<string, WorkspaceTreeRefWire[]>;
  selectedSha: string | null;
  onSelect: (sha: string) => void;
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
}

const CommitList: React.FC<CommitListProps> = ({
  entries,
  graph,
  refsBySha,
  selectedSha,
  onSelect,
  filtersActive,
  onResetFilters,
  scrollTo,
  showTagChips = true,
  showTimestamp = true,
  dimMergeCommits = true,
}) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollTo === null || scrollTo === undefined || listRef.current === null) return;
    const row = listRef.current.querySelector(`[data-sha="${scrollTo.sha}"]`);
    row?.scrollIntoView({ behavior: 'instant', block: 'center' });
  }, [scrollTo]);

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
    <div ref={listRef} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }} data-testid="git-tool-list">
      {entries.map((entry, index) => {
        const isSelected = entry.sha === selectedSha;
        const isMerge = dimMergeCommits && entry.parents.length > 1;
        const row = graph?.[index] ?? null;
        const rowRefs = refsBySha.get(entry.sha) ?? [];
        const chipRefs = showTagChips ? rowRefs : rowRefs.filter((ref) => ref.kind !== 'tag');
        return (
          <button
            key={entry.sha}
            type="button"
            className={isSelected ? 'git-tool-row selected' : 'git-tool-row'}
            onClick={() => onSelect(entry.sha)}
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
          >
            <GraphCell row={row} maxLanes={maxLanes} fallbackColor={token.colorTextQuaternary} />
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  flex: '0 1 auto',
                  minWidth: 0,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: isMerge ? token.colorTextSecondary : token.colorText,
                }}
              >
                {entry.subject}
              </span>
              <RefChips refs={chipRefs} max={2} />
            </span>
            <span style={{ flex: '0 0 auto', fontSize: 11.5, fontWeight: 600, color: token.colorTextSecondary }}>
              {entry.authorName}
            </span>
            <span
              title={new Date(entry.authoredAt).toLocaleString(locale)}
              style={{
                flex: '0 0 auto',
                minWidth: 64,
                textAlign: 'right',
                fontSize: 11.5,
                color: token.colorTextSecondary,
              }}
            >
              {formatLogDate(entry.authoredAt, locale, (time) => t('workbench.gitLog.date.yesterday', { time }), showTimestamp)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CommitList;
