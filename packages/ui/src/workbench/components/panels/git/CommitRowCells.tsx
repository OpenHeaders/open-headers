/**
 * CommitRowCells — what a commit's row shows beside its graph cell, the
 * same in every list of commits: the subject, the right-aligned ref
 * label column (or the labels before the subject with References on the
 * Left), the author, the graduated date, the short hash (off by
 * default) and the signature mark — the eye menu's Columns decide which
 * of the last four show; subject, author, date and hash in one face and
 * one foreground, all four greyed on a merge commit (the reference's
 * reading). The row itself — its element, its selection, its graph cell
 * — is the list's.
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import type { LogTextRange } from '@openheaders/core/workspace-tree';
import { theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { GIT_TEXT_SIZE } from './git-type-scale';
import { GRAPH_ROW_HEIGHT } from './GraphCell';
import { formatLogDate, formatLogDateTitle, type HourCycle } from './log-date';
import MatchedText from './MatchedText';
import RefRowLabel from './RefRowLabel';
import { shortSha } from './short-sha';
import SignatureMark from './SignatureMark';
import type { CommitSignature } from './use-commit-signatures';

/** What the eye menu decides of every row. */
export interface CommitRowColumns {
  /** Show > Compact References View: one ref label per row (off: every label inline). */
  compactRefs: boolean;
  /** Show > References on the Left: the ref labels before the subject. */
  refsOnLeft: boolean;
  /** Show > Tag Names: a tag's name beside its glyph (the glyph always shows). */
  showTagChips: boolean;
  /** Show > Commit Timestamp: time on older dates. */
  showTimestamp: boolean;
  showAuthor: boolean;
  showHash: boolean;
  showDate: boolean;
  /** The signature column, at the far end. */
  showSignature: boolean;
  /** Highlight > Merge Commits: dim a merge's row. */
  dimMergeCommits: boolean;
  /** The workbench clock format's hour cycle for the date column. */
  hourCycle: HourCycle;
}

export const DEFAULT_COMMIT_ROW_COLUMNS: CommitRowColumns = {
  compactRefs: true,
  refsOnLeft: false,
  showTagChips: true,
  showTimestamp: true,
  showAuthor: true,
  showHash: false,
  showDate: true,
  showSignature: false,
  dimMergeCommits: true,
  hourCycle: 'h23',
};

/** A commit row's own box — one height, its cells in a line, as wide as its list with its padding inside. */
export const COMMIT_ROW_LAYOUT: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  boxSizing: 'border-box',
  width: '100%',
  height: GRAPH_ROW_HEIGHT,
  padding: '0 12px 0 0',
  cursor: 'pointer',
};

export interface CommitRowCellsProps {
  entry: WorkspaceTreeLogEntryWire;
  /** The refs that point at the commit. */
  refs: readonly WorkspaceTreeRefWire[];
  /** The checked-out commit — its ref hover leads with HEAD. */
  isHead: boolean;
  columns: CommitRowColumns;
  signature?: CommitSignature;
  /** The text filter's matches in a subject or an author — painted where they stand; absent = no filter. */
  matchRanges?: (text: string) => readonly LogTextRange[];
}

const CommitRowCells: React.FC<CommitRowCellsProps> = ({ entry, refs, isHead, columns, signature, matchRanges }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  const dateLabels = useMemo(
    () => ({
      today: (time: string) => t('workbench.gitLog.date.today', { time }),
      yesterday: (time: string) => t('workbench.gitLog.date.yesterday', { time }),
    }),
    [t],
  );
  const isMerge = columns.dimMergeCommits && entry.parents.length > 1;
  const textColor = isMerge ? token.colorTextTertiary : token.colorText;
  const refLabel = (
    <RefRowLabel refs={refs} isHead={isHead} compact={columns.compactRefs} tagNames={columns.showTagChips} />
  );
  return (
    <>
      {columns.refsOnLeft && refLabel}
      <span
        style={{
          // The subject takes what is LEFT (the reference's reading): from a
          // zero basis it only grows into spare room, so the ref label
          // beside it keeps its whole width and is clipped only once the
          // subject is gone — the columns at the far end never move.
          flex: '1 1 0%',
          minWidth: 0,
          fontSize: GIT_TEXT_SIZE,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: textColor,
        }}
        data-testid="git-tool-row-subject"
      >
        <MatchedText text={entry.subject} ranges={matchRanges} />
      </span>
      {!columns.refsOnLeft && refLabel}
      {columns.showAuthor && (
        <span style={{ flex: '0 0 auto', fontSize: GIT_TEXT_SIZE, color: textColor }} data-testid="git-tool-row-author">
          <MatchedText text={entry.authorName} ranges={matchRanges} />
        </span>
      )}
      {columns.showDate && (
        <span
          title={formatLogDateTitle(entry.authoredAt, locale, columns.hourCycle)}
          style={{
            flex: '0 0 auto',
            minWidth: 64,
            textAlign: 'right',
            fontSize: GIT_TEXT_SIZE,
            color: textColor,
          }}
          data-testid="git-tool-row-date"
        >
          {formatLogDate(entry.authoredAt, locale, dateLabels, {
            withTime: columns.showTimestamp,
            hourCycle: columns.hourCycle,
          })}
        </span>
      )}
      {columns.showHash && (
        <span style={{ flex: '0 0 auto', fontSize: GIT_TEXT_SIZE, color: textColor }} data-testid="git-tool-row-hash">
          {shortSha(entry.sha)}
        </span>
      )}
      {columns.showSignature && (
        <span
          style={{ flex: '0 0 auto', display: 'inline-flex', justifyContent: 'center', width: 16 }}
          data-testid="git-tool-row-signature"
        >
          <SignatureMark signature={signature} />
        </span>
      )}
    </>
  );
};

export default CommitRowCells;
