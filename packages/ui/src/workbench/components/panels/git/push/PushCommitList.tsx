/**
 * PushCommitList — the Push window's left pane: the target row
 * (`main → origin : main`, the reference anatomy — selected by default,
 * it stands for every commit) and, indented under it, one row per
 * commit that would go, subject with the author and the graduated
 * date. A branch with no upstream names the rule the
 * host applies on the first push; a detached HEAD and an up-to-date
 * branch each say so in place of rows.
 *
 * The commit rows carry the shared selection model: a click selects
 * one, Cmd/Ctrl+click toggles, Shift+click ranges from the anchor,
 * Up/Down walk the rows (Shift extends); the target row is its own
 * single selection and clears them. Every gesture reports the
 * selection with the commit the details follow.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { clickModifiers, selectOnStep, useMultiSelection } from '@openheaders/ui/shared/selection';
import { formatLogDate, formatLogDateTitle, type HourCycle } from '../log-date';
import { commitClickOutcome, stepTarget } from '../log-selection';
import type { PushSelection, PushTarget } from './push-window-model';

export interface PushCommitListProps {
  target: PushTarget;
  entries: readonly WorkspaceTreeLogEntryWire[];
  selection: PushSelection;
  onSelect: (selection: PushSelection) => void;
  /** The list is still arriving — the empty note waits. */
  loading: boolean;
  /** The workbench clock format's hour cycle for the date column. */
  hourCycle?: HourCycle;
}

const ROW_HEIGHT = 24;

const PushCommitList: React.FC<PushCommitListProps> = ({
  target,
  entries,
  selection,
  onSelect,
  loading,
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
  const rows = useMultiSelection(order);

  // The target row's selection owns the pane alone — the commit rows
  // clear (the window opens on it and returns to it on a reload).
  useEffect(() => {
    if (selection === 'all' && rows.selection.ids.size > 0) rows.clear();
  }, [selection, rows]);

  const handleRowClick = (sha: string, event: React.MouseEvent): void => {
    const outcome = commitClickOutcome(rows.selection, order, sha, clickModifiers(event));
    rows.click(sha, event);
    onSelect(outcome.lead === null ? 'all' : { sha: outcome.lead, shas: [...outcome.next.ids] });
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const lead = rows.selection.lead ?? (selection === 'all' ? null : selection.sha);
    const landing = stepTarget(order, lead, event.key === 'ArrowDown' ? 1 : -1);
    if (landing === null) return;
    event.preventDefault();
    const next = selectOnStep(rows.selection, order, landing, event.shiftKey);
    rows.step(landing, event.shiftKey);
    onSelect({ sha: landing, shas: [...next.ids] });
    const row = listRef.current?.querySelector<HTMLElement>(`[data-sha="${landing}"]`);
    row?.focus({ preventScroll: true });
    row?.scrollIntoView({ block: 'nearest' });
  };

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

  const selectable = (target.kind === 'upstream' || target.kind === 'new-upstream') && entries.length > 0;

  const note =
    !loading && entries.length === 0 && (target.kind === 'upstream' || target.kind === 'new-upstream')
      ? t('workbench.gitPush.nothing')
      : null;

  return (
    <div
      ref={listRef}
      className="git-tool-commit-list"
      onKeyDown={handleKeyDown}
      style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '6px 0' }}
      data-testid="git-push-list"
    >
      <button
        type="button"
        className={selection === 'all' && selectable ? 'git-tool-row selected' : 'git-tool-row'}
        onClick={() => {
          if (selectable) onSelect('all');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: ROW_HEIGHT,
          padding: '0 12px',
          border: 'none',
          textAlign: 'left',
          cursor: selectable ? 'pointer' : 'default',
          fontSize: 12,
          color: token.colorText,
          whiteSpace: 'nowrap',
        }}
        data-testid="git-push-target-row"
        data-selected={selection === 'all' && selectable ? 'true' : undefined}
      >
        {targetLine()}
      </button>
      {note !== null && (
        <div
          style={{ padding: '2px 12px 0 36px', fontSize: 12, color: token.colorTextSecondary }}
          data-testid="git-push-empty"
        >
          {note}
        </div>
      )}
      {entries.map((entry) => {
        const isSelected = selection !== 'all' && rows.isSelected(entry.sha);
        return (
          <button
            key={entry.sha}
            type="button"
            className={isSelected ? 'git-tool-row selected' : 'git-tool-row'}
            onClick={(event) => handleRowClick(entry.sha, event)}
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
            data-selected={isSelected || undefined}
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
            <span style={{ flex: '0 0 auto', fontSize: 12 }}>{entry.authorName}</span>
            <span
              title={formatLogDateTitle(entry.authoredAt, locale, hourCycle)}
              style={{ flex: '0 0 auto', minWidth: 64, textAlign: 'right', fontSize: 12 }}
            >
              {formatLogDate(entry.authoredAt, locale, dateLabels, { hourCycle })}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default PushCommitList;
