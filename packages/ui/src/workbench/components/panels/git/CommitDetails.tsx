/**
 * CommitDetails — the detail pane's bottom half, IDE-log shape:
 * monospace subject, `sha author <email> on date` line, the HEAD /
 * branch / tag chips pointing at the commit, and the co-author
 * trailers. Pure presentation over one selected log entry.
 */

import type { WorkspaceTreeLogEntryWire, WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import RefChips from './RefChips';

export interface CommitDetailsProps {
  entry: WorkspaceTreeLogEntryWire;
  refsAtCommit: readonly WorkspaceTreeRefWire[];
  /** True when the commit is the checked-out HEAD — prepends the HEAD chip. */
  isHead: boolean;
}

const CommitDetails: React.FC<CommitDetailsProps> = ({ entry, refsAtCommit, isHead }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();
  return (
    <div style={{ padding: '8px 14px 10px' }} data-testid="git-tool-detail-info">
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: token.fontFamilyCode,
          color: token.colorText,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {entry.subject}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: token.colorTextSecondary }}>
        <span
          title={entry.sha}
          style={{ fontFamily: token.fontFamilyCode, fontSize: 11, userSelect: 'all' }}
          data-testid="git-tool-detail-sha"
        >
          {entry.sha.slice(0, 8)}
        </span>{' '}
        {t('workbench.gitLog.authorLine', {
          author: entry.authorName,
          email: entry.authorEmail,
          date: new Date(entry.authoredAt).toLocaleString(locale),
        })}
      </div>
      {(isHead || refsAtCommit.length > 0) && (
        <div style={{ marginTop: 6 }}>
          <RefChips refs={refsAtCommit} showHead={isHead} />
        </div>
      )}
      {entry.coAuthors.length > 0 && (
        <div
          style={{ marginTop: 6, fontSize: 11.5, color: token.colorTextSecondary }}
          data-testid="git-tool-detail-co-authors"
        >
          {t('workbench.gitLog.coAuthors', { authors: entry.coAuthors.join(', ') })}
        </div>
      )}
    </div>
  );
};

export default CommitDetails;
