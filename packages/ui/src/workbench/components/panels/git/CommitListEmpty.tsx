/**
 * CommitListEmpty — what a list of commits says when it lists none:
 * "no matches" with a reset action while a filter is on, or the standing
 * first-commit hint in a repo with no commit yet. A list the host
 * refused lists none and says nothing of commits — why is said above
 * it; the reset stays, a filter being what may have refused it.
 */

import { Button, theme } from 'antd';
import type React from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { GIT_TEXT_SIZE } from './git-type-scale';

export interface CommitListEmptyProps {
  /** True when a text filter or ref scope is active — "no matches" and its reset action. */
  filtersActive: boolean;
  onResetFilters: () => void;
  /** The list was refused, not read: it is not known to hold no commit. */
  refused?: boolean;
}

const CommitListEmpty: React.FC<CommitListEmptyProps> = ({ filtersActive, onResetFilters, refused = false }) => {
  const { token } = theme.useToken();
  const { t } = useLocale();
  return (
    <div
      style={{
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        fontSize: GIT_TEXT_SIZE,
        color: token.colorTextSecondary,
      }}
      data-testid="git-tool-empty"
    >
      {!refused && <span>{filtersActive ? t('workbench.gitLog.noMatches') : t('workbench.gitLog.empty')}</span>}
      {filtersActive && (
        <Button type="link" size="small" onClick={onResetFilters} data-testid="git-tool-reset-filters">
          {t('workbench.gitLog.resetFilters')}
        </Button>
      )}
    </div>
  );
};

export default CommitListEmpty;
