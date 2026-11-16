/**
 * LogRow — one row of the log's list over row numbers: the commit's
 * graph cell and its cells once the host has sent the row, an empty row
 * of the same height until then (the list never moves when a row
 * lands). Held still while nothing it shows changed — a scroll mounts
 * the rows that enter and draws no other again.
 */

import type { WorkspaceTreeLogRowWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { LogTextRange } from '@openheaders/core/workspace-tree';
import { theme } from 'antd';
import type React from 'react';
import { memo, useMemo } from 'react';
import CommitRowCells, { COMMIT_ROW_LAYOUT, type CommitRowColumns } from './CommitRowCells';
import GraphCell from './GraphCell';
import { type GraphHighlight, logCellRow } from './log-cell';
import type { CommitSignature } from './use-commit-signatures';

export interface LogRowProps {
  /** The row's number in the list. */
  number: number;
  /** The row as the host sent it; null for one not read yet. */
  row: WorkspaceTreeLogRowWire | null;
  selected: boolean;
  /** The refs that point at the commit. */
  refs: readonly WorkspaceTreeRefWire[];
  /** The checked-out commit — the hollow ring. */
  isHead: boolean;
  /** The current-branch band is on and the checked-out commit reaches this one. */
  onCurrentBranch: boolean;
  /** The lit run, where this row's cell draws a part of it; null otherwise. */
  litRun: number | null;
  /** The row's own part in the lit run. */
  highlight: GraphHighlight | null;
  columns: CommitRowColumns;
  signature?: CommitSignature;
  matchRanges?: (text: string) => readonly LogTextRange[];
  matchShaRanges?: (sha: string) => readonly LogTextRange[];
  onClick: (row: number, event: React.MouseEvent) => void;
  /** The pointer entered (true) or left (false) the row's graph cell. */
  onHover: (row: number, hovering: boolean) => void;
  /** A press on the row's graph cell. */
  onToggleRun: (row: number) => void;
}

const LogRow: React.FC<LogRowProps> = ({
  number,
  row,
  selected,
  refs,
  isHead,
  onCurrentBranch,
  litRun,
  highlight,
  columns,
  signature,
  matchRanges,
  matchShaRanges,
  onClick,
  onHover,
  onToggleRun,
}) => {
  const { token } = theme.useToken();
  const cell = useMemo(() => (row === null ? null : logCellRow(row.cell, litRun)), [row, litRun]);
  return (
    // No focus of its own: a click lands the focus on the list, which holds the keys — a row scrolled away takes none with it.
    <div
      role="option"
      aria-selected={selected}
      className={selected ? 'git-tool-row selected' : 'git-tool-row'}
      onClick={(event) => onClick(number, event)}
      style={{ ...COMMIT_ROW_LAYOUT, color: token.colorText }}
      data-testid="git-tool-row"
      data-row={number}
      data-sha={row?.entry.sha}
      data-pending={row === null || undefined}
      data-selected={selected || undefined}
      data-current-branch={onCurrentBranch || undefined}
    >
      {row !== null && (
        <>
          <GraphCell
            row={cell}
            isHead={isHead}
            fallbackColor={token.colorTextQuaternary}
            highlight={highlight}
            onHover={(hovering) => onHover(number, hovering)}
            onToggle={() => onToggleRun(number)}
          />
          <CommitRowCells
            entry={row.entry}
            refs={refs}
            isHead={isHead}
            columns={columns}
            signature={signature}
            matchRanges={matchRanges}
            matchShaRanges={matchShaRanges}
          />
        </>
      )}
    </div>
  );
};

export default memo(LogRow);
