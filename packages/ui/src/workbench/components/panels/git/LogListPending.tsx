/**
 * LogListPending — what the log's list says while the list asked for has
 * no answer and no row is held to stand in for it: that its commits are
 * being read. A repo just bound, a long history read for the first time,
 * a pattern run over all of it — the pane is otherwise bare for as long
 * as the host takes.
 *
 * The line is held back for a moment (the stylesheet's
 * `git-tool-list-pending__line`): a list answered at once never flashes
 * it. The pulse above is the sign of work from the first frame; the
 * words are for a wait that lasts.
 */

import { theme } from 'antd';
import type React from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { GIT_TEXT_SIZE } from './git-type-scale';

const LogListPending: React.FC = () => {
  const { token } = theme.useToken();
  const { t } = useLocale();
  return (
    <div
      style={{
        flex: '1 1 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: GIT_TEXT_SIZE,
        color: token.colorTextSecondary,
      }}
      data-testid="git-tool-list-pending"
    >
      <span className="git-tool-list-pending__line">{t('workbench.gitLog.loading')}</span>
    </div>
  );
};

export default LogListPending;
