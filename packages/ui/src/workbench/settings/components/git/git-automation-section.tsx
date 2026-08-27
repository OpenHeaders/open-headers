/**
 * Git › Automation sections — Commits (the auto-commit cadence and the
 * explicit `--no-verify` opt-in) and Remote (push after every commit).
 * The three values live on the daemon's binding record, not the
 * settings store, so the rows are `FieldRow`s over the workspace-tree
 * verbs with no reset. Shared by the Automation page and the Server
 * Admin git card; without a bound repository the sections give way to
 * the pointer at the Folder page.
 */

import type { WorkspaceTreeCommitCadence } from '@openheaders/core/bridge';
import { App as AntApp, Select, Switch, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../../fields/FieldRow';
import { PaneSection } from '../pane-chrome';
import GitNeedsRepoNote from './git-needs-repo-note';
import type { WorkspaceGit } from './use-workspace-git';

const GitAutomationSection: React.FC<{ git: WorkspaceGit }> = ({ git }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const { call, workspaceId, gitStatus, refreshGitStatus } = git;

  const setCadence = async (cadence: WorkspaceTreeCommitCadence): Promise<void> => {
    if (workspaceId === null) return;
    try {
      await call('oh.workspaceTree.setCommitCadence', { workspaceId, cadence });
      await refreshGitStatus();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const setBypassHooks = async (bypassHooks: boolean): Promise<void> => {
    if (workspaceId === null) return;
    try {
      await call('oh.workspaceTree.setBypassHooks', { workspaceId, bypassHooks });
      await refreshGitStatus();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const setAutoPush = async (autoPushOnCommit: boolean): Promise<void> => {
    if (workspaceId === null) return;
    try {
      await call('oh.workspaceTree.setAutoPushOnCommit', { workspaceId, autoPushOnCommit });
      await refreshGitStatus();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  if (gitStatus === null || !gitStatus.git.available || !gitStatus.repo) {
    return <GitNeedsRepoNote />;
  }

  return (
    <>
      <PaneSection title={t('workbench.settings.category.gitAutomation.sub.commits')}>
        <FieldRow
          settingKey="git.commitCadence"
          label={t('workbench.settings.gitPane.git.cadenceLabel')}
          description={t('workbench.settings.gitPane.git.cadenceDescription')}
          resettable={false}
        >
          <Select
            size="small"
            value={gitStatus.cadence}
            onChange={(value) => void setCadence(value)}
            style={{ width: 220 }}
            options={[
              { value: 'off', label: t('workbench.settings.gitPane.git.cadenceOff') },
              { value: 'auto', label: t('workbench.settings.gitPane.git.cadenceAuto') },
              { value: 'on-blur', label: t('workbench.settings.gitPane.git.cadenceOnBlur') },
              { value: 'every-5m', label: t('workbench.settings.gitPane.git.cadenceEvery', { minutes: 5 }) },
              { value: 'every-15m', label: t('workbench.settings.gitPane.git.cadenceEvery', { minutes: 15 }) },
              { value: 'every-30m', label: t('workbench.settings.gitPane.git.cadenceEvery', { minutes: 30 }) },
            ]}
            data-testid="git-pane-cadence-select"
          />
        </FieldRow>
        <FieldRow
          settingKey="git.bypassHooks"
          label={t('workbench.settings.gitPane.git.bypassHooksLabel')}
          description={t('workbench.settings.gitPane.git.bypassHooksDescription')}
          resettable={false}
        >
          <Switch
            size="small"
            checked={gitStatus.bypassHooks}
            onChange={(checked) => void setBypassHooks(checked)}
            data-testid="git-pane-bypass-hooks-switch"
          />
        </FieldRow>
        {gitStatus.bypassHooks && (
          <div
            style={{ padding: '0 0 3px', fontSize: 11.5, color: token.colorWarningText }}
            data-testid="git-pane-bypass-hooks-warning"
          >
            {t('workbench.settings.gitPane.git.bypassHooksWarning')}
          </div>
        )}
      </PaneSection>
      <PaneSection title={t('workbench.settings.category.gitAutomation.sub.remote')}>
        <FieldRow
          settingKey="git.autoPushOnCommit"
          label={t('workbench.settings.gitPane.git.autoPushLabel')}
          description={t('workbench.settings.gitPane.git.autoPushDescription')}
          resettable={false}
        >
          <Switch
            size="small"
            checked={gitStatus.autoPushOnCommit}
            onChange={(checked) => void setAutoPush(checked)}
            data-testid="git-pane-auto-push-switch"
          />
        </FieldRow>
      </PaneSection>
    </>
  );
};

export default GitAutomationSection;
