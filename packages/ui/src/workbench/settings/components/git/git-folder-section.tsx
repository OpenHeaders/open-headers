/**
 * Git › Folder sections — Binding (the bound folder with the files not
 * taken in and the Unbind gesture, or the bind form while unbound) and
 * Requirements (the git install the tree needs: found, missing, or
 * below the version floor). Shared by the Folder page and the Server
 * Admin git card; the caller owns the status spine.
 */

import { Alert, App as AntApp, Button, Popconfirm, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import GitBindForm from '../../../components/git/GitBindForm';
import { PaneSection } from '../pane-chrome';
import GitIssueList from './git-issue-list';
import type { WorkspaceGit } from './use-workspace-git';

export interface GitFolderSectionProps {
  git: WorkspaceGit;
  /** False on hosts without a native folder dialog (remote daemon). */
  allowFolderPicker: boolean;
}

const GitFolderSection: React.FC<GitFolderSectionProps> = ({ git, allowFolderPicker }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const { call, workspaceId, binding, gitStatus, refresh } = git;

  const onBound = (initialized: boolean): void => {
    message.success(
      initialized ? t('workbench.settings.gitPane.boundInitialized') : t('workbench.settings.gitPane.bound'),
    );
    void refresh();
  };

  const onAdopted = (_workspaceId: string, name: string): void => {
    message.success(t('workbench.settings.gitPane.adopted', { name }));
    void refresh();
  };

  const unbind = async (): Promise<void> => {
    if (workspaceId === null) return;
    try {
      await call('oh.workspaceTree.unbind', { workspaceId });
      message.success(t('workbench.settings.gitPane.unbound'));
      await refresh();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  return (
    <>
      <PaneSection title={t('workbench.settings.category.gitFolder.sub.binding')}>
        {binding !== null ? (
          <div style={{ padding: '3px 0' }}>
            <div style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5, color: token.colorText }}>
              {binding.rootDir}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
              {t('workbench.settings.gitPane.boundBody')}
            </p>
            {binding.issues.length > 0 && <GitIssueList issues={binding.issues} />}
            <div style={{ marginTop: 10 }}>
              <Popconfirm
                title={t('workbench.settings.gitPane.unbindConfirm.title')}
                description={t('workbench.settings.gitPane.unbindConfirm.body')}
                okText={t('workbench.settings.gitPane.unbindConfirm.ok')}
                okButtonProps={{ danger: true }}
                onConfirm={() => void unbind()}
              >
                <Button danger size="small" data-testid="git-pane-unbind-button">
                  {t('workbench.settings.gitPane.unbindButton')}
                </Button>
              </Popconfirm>
            </div>
          </div>
        ) : (
          <div style={{ padding: '3px 0' }}>
            <GitBindForm
              call={call}
              workspaceId={workspaceId}
              allowFolderPicker={allowFolderPicker}
              onBound={onBound}
              onAdopted={onAdopted}
              testidPrefix="git-pane"
            />
          </div>
        )}
      </PaneSection>
      {gitStatus !== null && (
        <PaneSection title={t('workbench.settings.category.gitFolder.sub.requirements')}>
          {gitStatus.git.available ? (
            <div
              style={{ padding: '3px 0', fontSize: 11.5, color: token.colorTextSecondary }}
              data-testid="git-pane-git-available"
            >
              {t('workbench.settings.gitPane.git.available', { version: gitStatus.git.version })}
            </div>
          ) : (
            <Alert
              type="warning"
              showIcon
              style={{ margin: '3px 0' }}
              title={<span style={{ fontSize: 12 }}>{t('workbench.settings.gitPane.git.missing.title')}</span>}
              description={
                <span style={{ fontSize: 11.5 }}>
                  {gitStatus.git.reason === 'below-floor'
                    ? t('workbench.settings.gitPane.git.belowFloor.body', { version: gitStatus.git.version ?? '' })
                    : t('workbench.settings.gitPane.git.missing.body')}
                </span>
              }
            />
          )}
        </PaneSection>
      )}
    </>
  );
};

export default GitFolderSection;
