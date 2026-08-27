/**
 * GitNeedsRepoNote — what the Automation and Repository pages show
 * while the workspace has no bound folder with a repository: one line
 * and a link to the Folder page, where the bind gesture lives.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { PaneSection } from '../pane-chrome';
import SettingsCategoryLink from '../settings-category-link';

export const GIT_FOLDER_CATEGORY = 'gitFolder';

const GitNeedsRepoNote: React.FC = () => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <PaneSection>
      <div
        style={{ padding: '3px 0', fontSize: 11.5, color: token.colorTextSecondary }}
        data-testid="git-pane-needs-repo"
      >
        {t('workbench.settings.gitPane.needsRepo')}{' '}
        <SettingsCategoryLink categoryId={GIT_FOLDER_CATEGORY} testid="git-pane-folder-link" />
      </div>
    </PaneSection>
  );
};

export default GitNeedsRepoNote;
