/**
 * PushCommitList — the Push window's left pane: the target line
 * (`main → origin : main`, the reference anatomy) and, indented under
 * it, one row per commit that would go, subject with the author and
 * the graduated date. A branch with no upstream names the rule the
 * host applies on the first push; a detached HEAD and an up-to-date
 * branch each say so in place of rows. Pure presentation.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { formatLogDate } from '../log-date';
import type { PushTarget } from './push-window-model';

export interface PushCommitListProps {
  target: PushTarget;
  entries: readonly WorkspaceTreeLogEntryWire[];
  selectedSha: string | null;
  onSelect: (sha: string) => void;
  /** The list is still arriving — the empty note waits. */
  loading: boolean;
}

const ROW_HEIGHT = 24;

const PushCommitList: React.FC<PushCommitListProps> = ({ target, entries, selectedSha, onSelect, loading }) => {
  const { token } = theme.useToken();
  const { locale, t } = useLocale();

  const targetLine = (): React.ReactNode => {
    if (target.kind === 'detached') return <span data-testid="git-push-target-detached">{t('workbench.gitPush.detached')}</span>;
    if (target.kind === 'none') return <span data-testid="git-push-target-none">{t('workbench.gitPush.nothing')}</span>;
    const arrow = <span style={{ color: token.colorTextTertiary, margin: '0 6px' }}>→</span>;
    if (target.kind === 'new-upstream') {
      return (
        <span data-testid="git-push-target" data-kind="new-upstream">
          <span style={{ fontWeight: 600 }}>{target.branch}</span>
          {arrow}
          <span style={{ color: token.colorTextSecondary }}>{t('workbench.gitPush.noUpstream')}</span>
        </span>
      );
    }
    return (
      <span data-testid="git-push-target" data-kind="upstream" data-upstream={target.upstream}>
        <span style={{ fontWeight: 600 }}>{target.branch}</span>
        {arrow}
        <span style={{ color: token.colorPrimary }}>{target.remote}</span>
        <span style={{ color: token.colorTextTertiary, margin: '0 4px' }}>:</span>
        <span style={{ color: token.colorPrimary }}>{target.remoteBranch}</span>
      </span>
    );
  };

  const note =
    !loading && entries.length === 0 && (target.kind === 'upstream' || target.kind === 'new-upstream')
      ? t('workbench.gitPush.nothing')
      : null;

  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '6px 0' }} data-testid="git-push-list">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: ROW_HEIGHT,
          padding: '0 12px',
          fontSize: 12,
          color: token.colorText,
          whiteSpace: 'nowrap',
        }}
      >
        {targetLine()}
      </div>
      {note !== null && (
        <div
          style={{ padding: '2px 12px 0 36px', fontSize: 12, color: token.colorTextSecondary }}
          data-testid="git-push-empty"
        >
          {note}
        </div>
      )}
      {entries.map((entry) => {
        const isSelected = entry.sha === selectedSha;
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
              height: ROW_HEIGHT,
              padding: '0 12px 0 36px',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: token.colorText,
            }}
            data-testid="git-push-row"
            data-sha={entry.sha}
          >
            <span
              style={{
                flex: '1 1 auto',
                minWidth: 0,
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.subject}
            </span>
            <span style={{ flex: '0 0 auto', fontSize: 11.5, fontWeight: 600, color: token.colorTextSecondary }}>
              {entry.authorName}
            </span>
            <span
              title={new Date(entry.authoredAt).toLocaleString(locale)}
              style={{ flex: '0 0 auto', minWidth: 64, textAlign: 'right', fontSize: 11.5, color: token.colorTextSecondary }}
            >
              {formatLogDate(entry.authoredAt, locale, (time) => t('workbench.gitLog.date.yesterday', { time }), true)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default PushCommitList;
