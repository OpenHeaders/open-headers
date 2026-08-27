/**
 * Git › Repository sections — operating the bound repository: Working
 * tree (the force-push incident banner, dirty count, upstream line
 * with Pull / Push and their typed failures), Branches (switch with the
 * dirty prompt, create, merge), Commit (the explicit gesture with its
 * semantic draft) and History (the recent log with per-file history).
 * Shared by the Repository page and the Server Admin git card; without
 * a bound repository the sections give way to a pointer at the Folder
 * page.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { Alert, App as AntApp, Button, Input, Modal, Popconfirm, Select, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { PaneSection } from '../pane-chrome';
import GitNeedsRepoNote from './git-needs-repo-note';
import type { WorkspaceGit } from './use-workspace-git';

type ForcePushChoice = 'abandon' | 'rescue' | 'reapply';
type DirtyAction = 'commit' | 'stash' | 'discard';

const LogEntryLines: React.FC<{ entry: WorkspaceTreeLogEntryWire; subjectSize: number }> = ({
  entry,
  subjectSize,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontFamily: token.fontFamilyCode, fontSize: 11, color: token.colorTextSecondary }}>
          {entry.sha.slice(0, 7)}
        </span>
        <span style={{ fontSize: subjectSize, color: token.colorText, flex: 1 }}>{entry.subject}</span>
      </div>
      <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
        {t('workbench.settings.gitPane.git.history.authorLine', {
          author: entry.authorName,
          date: new Date(entry.authoredAt).toLocaleString(),
        })}
      </div>
      {entry.coAuthors.length > 0 && (
        <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
          {t('workbench.settings.gitPane.git.history.coAuthors', { authors: entry.coAuthors.join(', ') })}
        </div>
      )}
    </>
  );
};

const GitRepositorySection: React.FC<{ git: WorkspaceGit }> = ({ git }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const { call, workspaceId, gitStatus, refresh, refreshGitStatus } = git;
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushFailure, setPushFailure] = useState<{ reason: string; detail?: string } | null>(null);
  const [branchDraft, setBranchDraft] = useState('');
  const [pushingBranch, setPushingBranch] = useState(false);
  const [resolving, setResolving] = useState<ForcePushChoice | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [switchPrompt, setSwitchPrompt] = useState<{ branch: string; dirtyFiles: number } | null>(null);
  const [switching, setSwitching] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [mergeRef, setMergeRef] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [fileHistory, setFileHistory] = useState<{ path: string; entries: WorkspaceTreeLogEntryWire[] } | null>(null);
  const [fileHistoryLoading, setFileHistoryLoading] = useState<string | null>(null);

  const commit = async (): Promise<void> => {
    if (workspaceId === null) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const trimmed = commitMessage.trim();
      const result = await call('oh.workspaceTree.commit', {
        workspaceId,
        ...(trimmed !== '' ? { message: trimmed } : {}),
      });
      if (result.ok && result.committed) {
        setCommitMessage('');
        message.success(t('workbench.settings.gitPane.git.committed', { sha: (result.sha ?? '').slice(0, 7) }));
      } else if (result.ok) {
        message.info(t('workbench.settings.gitPane.git.nothingToCommit'));
      } else {
        setCommitError(
          t('workbench.settings.gitPane.git.commitFailed', { detail: result.detail ?? result.reason }),
        );
      }
      await refreshGitStatus();
    } catch (err) {
      setCommitError((err as Error).message);
    } finally {
      setCommitting(false);
    }
  };

  const pull = async (): Promise<void> => {
    if (workspaceId === null) return;
    setPulling(true);
    setPullError(null);
    try {
      const result = await call('oh.workspaceTree.pull', { workspaceId });
      if (result.ok && result.upToDate) {
        message.info(t('workbench.settings.gitPane.git.upToDate'));
      } else if (result.ok) {
        message.success(t('workbench.settings.gitPane.git.pulled', { sha: result.sha.slice(0, 7) }));
      } else {
        setPullError(t('workbench.settings.gitPane.git.pullFailed', { detail: result.detail ?? result.reason }));
      }
      await refreshGitStatus();
      await refresh();
    } catch (err) {
      setPullError((err as Error).message);
    } finally {
      setPulling(false);
    }
  };

  const push = async (): Promise<void> => {
    if (workspaceId === null) return;
    setPushing(true);
    setPushFailure(null);
    try {
      const result = await call('oh.workspaceTree.push', { workspaceId });
      if (result.ok && result.pushed) {
        message.success(t('workbench.settings.gitPane.git.pushed', { sha: result.remoteSha.slice(0, 7) }));
      } else if (result.ok) {
        message.info(t('workbench.settings.gitPane.git.nothingToPush'));
      } else {
        setPushFailure({ reason: result.reason, ...(result.detail !== undefined ? { detail: result.detail } : {}) });
      }
      await refreshGitStatus();
    } catch (err) {
      setPushFailure({ reason: 'push-failed', detail: (err as Error).message });
    } finally {
      setPushing(false);
    }
  };

  const pushNewBranch = async (): Promise<void> => {
    const branch = branchDraft.trim();
    if (workspaceId === null || branch === '') return;
    setPushingBranch(true);
    try {
      const result = await call('oh.workspaceTree.pushNewBranch', { workspaceId, branch });
      if (result.ok) {
        setBranchDraft('');
        setPushFailure(null);
        message.success(t('workbench.settings.gitPane.git.exportedBranch', { branch }));
      } else {
        message.error(
          t('workbench.settings.gitPane.git.pushFailed', { detail: result.detail ?? result.reason }),
        );
      }
      await refreshGitStatus();
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setPushingBranch(false);
    }
  };

  const resolveForcePush = async (choice: ForcePushChoice): Promise<void> => {
    if (workspaceId === null) return;
    setResolving(choice);
    setResolveError(null);
    try {
      const result = await call('oh.workspaceTree.resolveForcePush', { workspaceId, choice });
      if (result.ok) {
        message.success(
          result.rescueBranch !== null
            ? t('workbench.settings.gitPane.git.forcePush.rescued', { branch: result.rescueBranch })
            : t('workbench.settings.gitPane.git.forcePush.resolved', { sha: result.sha.slice(0, 7) }),
        );
      } else {
        setResolveError(
          t('workbench.settings.gitPane.git.forcePush.failed', { detail: result.detail ?? result.reason }),
        );
      }
      await refreshGitStatus();
      await refresh();
    } catch (err) {
      setResolveError((err as Error).message);
    } finally {
      setResolving(null);
    }
  };

  const switchBranch = async (branch: string, dirtyAction?: DirtyAction): Promise<void> => {
    if (workspaceId === null) return;
    setSwitching(true);
    setBranchError(null);
    try {
      const result = await call('oh.workspaceTree.switchBranch', {
        workspaceId,
        branch,
        ...(dirtyAction !== undefined ? { dirtyAction } : {}),
      });
      if (result.ok) {
        setSwitchPrompt(null);
        if (result.switched) {
          message.success(t('workbench.settings.gitPane.git.branch.switched', { branch }));
        }
      } else if (result.reason === 'dirty') {
        setSwitchPrompt({ branch, dirtyFiles: result.dirtyFiles ?? 0 });
      } else {
        setSwitchPrompt(null);
        setBranchError(
          t('workbench.settings.gitPane.git.branch.switchFailed', { detail: result.detail ?? result.reason }),
        );
      }
      await refreshGitStatus();
      await refresh();
    } catch (err) {
      setBranchError((err as Error).message);
    } finally {
      setSwitching(false);
    }
  };

  const createBranch = async (): Promise<void> => {
    const branch = createDraft.trim();
    if (workspaceId === null || branch === '') return;
    setCreating(true);
    setBranchError(null);
    try {
      const result = await call('oh.workspaceTree.createBranch', { workspaceId, branch });
      if (result.ok) {
        setCreateDraft('');
        message.success(t('workbench.settings.gitPane.git.branch.created', { branch }));
      } else {
        setBranchError(
          t('workbench.settings.gitPane.git.branch.createFailed', { detail: result.detail ?? result.reason }),
        );
      }
      await refreshGitStatus();
    } catch (err) {
      setBranchError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const mergeBranch = async (): Promise<void> => {
    if (workspaceId === null || mergeRef === null) return;
    setMerging(true);
    setBranchError(null);
    try {
      const result = await call('oh.workspaceTree.mergeBranch', { workspaceId, ref: mergeRef });
      if (result.ok && result.upToDate) {
        message.info(t('workbench.settings.gitPane.git.branch.mergeUpToDate'));
      } else if (result.ok) {
        setMergeRef(null);
        message.success(t('workbench.settings.gitPane.git.branch.merged', { sha: result.sha.slice(0, 7) }));
      } else {
        setBranchError(
          t('workbench.settings.gitPane.git.branch.mergeFailed', { detail: result.detail ?? result.reason }),
        );
      }
      await refreshGitStatus();
      await refresh();
    } catch (err) {
      setBranchError((err as Error).message);
    } finally {
      setMerging(false);
    }
  };

  const toggleHistory = async (): Promise<void> => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    if (workspaceId === null) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const result = await call('oh.workspaceTree.log', { workspaceId, limit: 20 });
      if (result.ok) {
        setHistory(result.entries);
        setHistoryOpen(true);
      } else {
        setHistoryError(
          t('workbench.settings.gitPane.git.history.loadFailed', { detail: result.detail ?? result.reason }),
        );
      }
    } catch (err) {
      setHistoryError((err as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openFileHistory = async (filePath: string): Promise<void> => {
    if (workspaceId === null) return;
    setFileHistoryLoading(filePath);
    try {
      const result = await call('oh.workspaceTree.fileLog', { workspaceId, path: filePath, limit: 20 });
      if (result.ok) {
        setFileHistory({ path: filePath, entries: result.entries });
      } else {
        message.error(
          t('workbench.settings.gitPane.git.history.loadFailed', { detail: result.detail ?? result.reason }),
        );
      }
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setFileHistoryLoading(null);
    }
  };

  if (gitStatus === null || !gitStatus.git.available || !gitStatus.repo) {
    return <GitNeedsRepoNote />;
  }

  const dirtyFiles = gitStatus.dirtyFiles ?? 0;
  const errorLine = { marginTop: 6, fontSize: 12, color: token.colorError };

  return (
    <>
      <PaneSection title={t('workbench.settings.category.gitRepository.sub.working-tree')}>
        {gitStatus.forcePush !== null && (
          <Alert
            type="error"
            showIcon
            style={{ margin: '3px 0 10px' }}
            data-testid="git-pane-force-push-alert"
            message={<span style={{ fontSize: 12 }}>{t('workbench.settings.gitPane.git.forcePush.title')}</span>}
            description={
              <div style={{ fontSize: 11.5 }}>
                <p style={{ margin: '0 0 8px' }}>
                  {t('workbench.settings.gitPane.git.forcePush.body', {
                    sha: gitStatus.forcePush.lastSyncedSha.slice(0, 7),
                  })}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Popconfirm
                    title={t('workbench.settings.gitPane.git.forcePush.abandonConfirm.title')}
                    description={t('workbench.settings.gitPane.git.forcePush.abandonConfirm.body')}
                    okText={t('workbench.settings.gitPane.git.forcePush.abandonConfirm.ok')}
                    okButtonProps={{ danger: true }}
                    onConfirm={() => void resolveForcePush('abandon')}
                  >
                    <Button
                      danger
                      size="small"
                      loading={resolving === 'abandon'}
                      disabled={resolving !== null && resolving !== 'abandon'}
                      data-testid="git-pane-force-push-abandon"
                    >
                      {t('workbench.settings.gitPane.git.forcePush.abandon')}
                    </Button>
                  </Popconfirm>
                  <Button
                    size="small"
                    loading={resolving === 'rescue'}
                    disabled={resolving !== null && resolving !== 'rescue'}
                    onClick={() => void resolveForcePush('rescue')}
                    data-testid="git-pane-force-push-rescue"
                  >
                    {t('workbench.settings.gitPane.git.forcePush.rescue')}
                  </Button>
                  <Button
                    size="small"
                    loading={resolving === 'reapply'}
                    disabled={resolving !== null && resolving !== 'reapply'}
                    onClick={() => void resolveForcePush('reapply')}
                    data-testid="git-pane-force-push-reapply"
                  >
                    {t('workbench.settings.gitPane.git.forcePush.reapply')}
                  </Button>
                </div>
                {resolveError !== null && <div style={{ marginTop: 6, color: token.colorError }}>{resolveError}</div>}
              </div>
            }
          />
        )}
        <div
          style={{
            padding: '3px 0',
            fontSize: 11.5,
            color: dirtyFiles > 0 ? token.colorText : token.colorTextSecondary,
          }}
          data-testid="git-pane-dirty-count"
        >
          {dirtyFiles > 0
            ? t('workbench.settings.gitPane.git.dirtyCount', { count: dirtyFiles })
            : t('workbench.settings.gitPane.git.clean')}
        </div>
        {gitStatus.userIndexBusy && (
          <div style={{ fontSize: 11.5, color: token.colorTextSecondary }} data-testid="git-pane-index-busy">
            {t('workbench.settings.gitPane.git.indexBusy')}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 11.5, color: token.colorTextSecondary, flex: 1 }} data-testid="git-pane-remote-line">
            {gitStatus.upstream === null
              ? t('workbench.settings.gitPane.git.noUpstream')
              : (gitStatus.ahead ?? 0) === 0 && (gitStatus.behind ?? 0) === 0
                ? t('workbench.settings.gitPane.git.remoteInSync', { upstream: gitStatus.upstream })
                : t('workbench.settings.gitPane.git.remoteStatus', {
                    upstream: gitStatus.upstream,
                    ahead: gitStatus.ahead ?? 0,
                    behind: gitStatus.behind ?? 0,
                  })}
          </span>
          <Button
            size="small"
            loading={pulling}
            disabled={gitStatus.upstream === null || gitStatus.forcePush !== null}
            onClick={() => void pull()}
            data-testid="git-pane-pull-button"
          >
            {t('workbench.settings.gitPane.git.pullButton')}
          </Button>
          <Button
            size="small"
            loading={pushing}
            disabled={gitStatus.forcePush !== null}
            onClick={() => void push()}
            data-testid="git-pane-push-button"
          >
            {t('workbench.settings.gitPane.git.pushButton')}
          </Button>
        </div>
        {pullError !== null && (
          <div style={errorLine} data-testid="git-pane-pull-error">
            {pullError}
          </div>
        )}
        {pushFailure !== null && pushFailure.reason === 'rejected' && (
          <div
            style={{ marginTop: 6, fontSize: 11.5, color: token.colorWarningText }}
            data-testid="git-pane-push-rejected"
          >
            {t('workbench.settings.gitPane.git.pushRejected')}
          </div>
        )}
        {pushFailure !== null && pushFailure.reason === 'no-permission' && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 8 }}
            data-testid="git-pane-push-no-permission"
            message={
              <span style={{ fontSize: 12 }}>{t('workbench.settings.gitPane.git.pushNoPermission.title')}</span>
            }
            description={
              <div style={{ fontSize: 11.5 }}>
                <p style={{ margin: '0 0 8px' }}>{t('workbench.settings.gitPane.git.pushNoPermission.body')}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input
                    size="small"
                    value={branchDraft}
                    onChange={(e) => setBranchDraft(e.target.value)}
                    placeholder={t('workbench.settings.gitPane.git.exportBranchPlaceholder')}
                    style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5, maxWidth: 260 }}
                    data-testid="git-pane-export-branch-input"
                  />
                  <Button
                    size="small"
                    loading={pushingBranch}
                    disabled={branchDraft.trim() === ''}
                    onClick={() => void pushNewBranch()}
                    data-testid="git-pane-export-branch-button"
                  >
                    {t('workbench.settings.gitPane.git.exportBranchButton')}
                  </Button>
                </div>
              </div>
            }
          />
        )}
        {pushFailure !== null && pushFailure.reason !== 'rejected' && pushFailure.reason !== 'no-permission' && (
          <div style={errorLine}>
            {t('workbench.settings.gitPane.git.pushFailed', { detail: pushFailure.detail ?? pushFailure.reason })}
          </div>
        )}
      </PaneSection>

      <PaneSection title={t('workbench.settings.category.gitRepository.sub.branches')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
          <span
            style={{ fontSize: 11.5, color: token.colorTextSecondary, flex: 1 }}
            data-testid="git-pane-branch-current"
          >
            {gitStatus.branch !== null
              ? t('workbench.settings.gitPane.git.branch.current', { branch: gitStatus.branch })
              : t('workbench.settings.gitPane.git.branch.detached')}
          </span>
          {gitStatus.branches.length > 1 && (
            <>
              <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                {t('workbench.settings.gitPane.git.branch.switchLabel')}
              </span>
              <Select
                size="small"
                value={gitStatus.branch}
                disabled={switching}
                onChange={(value) => {
                  if (value !== null && value !== gitStatus.branch) void switchBranch(value);
                }}
                style={{ width: 180 }}
                options={gitStatus.branches.map((name) => ({ value: name, label: name }))}
                data-testid="git-pane-branch-select"
              />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
          <Input
            size="small"
            value={createDraft}
            onChange={(e) => setCreateDraft(e.target.value)}
            placeholder={t('workbench.settings.gitPane.git.branch.createPlaceholder')}
            style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5, maxWidth: 260 }}
            data-testid="git-pane-branch-create-input"
          />
          <Button
            size="small"
            loading={creating}
            disabled={createDraft.trim() === ''}
            onClick={() => void createBranch()}
            data-testid="git-pane-branch-create-button"
          >
            {t('workbench.settings.gitPane.git.branch.createButton')}
          </Button>
        </div>
        {(gitStatus.branches.length > 1 || gitStatus.upstream !== null) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
              {t('workbench.settings.gitPane.git.branch.mergeLabel')}
            </span>
            <Select
              size="small"
              value={mergeRef}
              disabled={merging}
              onChange={(value) => setMergeRef(value)}
              style={{ width: 200 }}
              options={[
                ...gitStatus.branches
                  .filter((name) => name !== gitStatus.branch)
                  .map((name) => ({ value: name, label: name })),
                ...(gitStatus.upstream !== null ? [{ value: gitStatus.upstream, label: gitStatus.upstream }] : []),
              ]}
              data-testid="git-pane-merge-select"
            />
            <Button
              size="small"
              loading={merging}
              disabled={mergeRef === null || gitStatus.forcePush !== null}
              onClick={() => void mergeBranch()}
              data-testid="git-pane-merge-button"
            >
              {t('workbench.settings.gitPane.git.branch.mergeButton')}
            </Button>
          </div>
        )}
        {branchError !== null && (
          <div style={errorLine} data-testid="git-pane-branch-error">
            {branchError}
          </div>
        )}
        <Modal
          open={switchPrompt !== null}
          title={t('workbench.settings.gitPane.git.branch.dirtyTitle')}
          onCancel={() => setSwitchPrompt(null)}
          footer={null}
          data-testid="git-pane-switch-modal"
        >
          <p style={{ fontSize: 12.5, margin: '0 0 14px' }}>
            {switchPrompt !== null
              ? t('workbench.settings.gitPane.git.branch.dirtyBody', {
                  count: switchPrompt.dirtyFiles,
                  branch: switchPrompt.branch,
                })
              : ''}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Popconfirm
              title={t('workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.title')}
              description={t('workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.body')}
              okText={t('workbench.settings.gitPane.git.branch.dirtyDiscardConfirm.ok')}
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                if (switchPrompt !== null) void switchBranch(switchPrompt.branch, 'discard');
              }}
            >
              <Button danger size="small" loading={switching} data-testid="git-pane-switch-discard">
                {t('workbench.settings.gitPane.git.branch.dirtyDiscard')}
              </Button>
            </Popconfirm>
            <Button
              size="small"
              loading={switching}
              onClick={() => {
                if (switchPrompt !== null) void switchBranch(switchPrompt.branch, 'stash');
              }}
              data-testid="git-pane-switch-stash"
            >
              {t('workbench.settings.gitPane.git.branch.dirtyStash')}
            </Button>
            <Button
              type="primary"
              size="small"
              loading={switching}
              onClick={() => {
                if (switchPrompt !== null) void switchBranch(switchPrompt.branch, 'commit');
              }}
              data-testid="git-pane-switch-commit"
            >
              {t('workbench.settings.gitPane.git.branch.dirtyCommit')}
            </Button>
          </div>
        </Modal>
      </PaneSection>

      <PaneSection title={t('workbench.settings.category.gitRepository.sub.commit')}>
        <div style={{ display: 'flex', gap: 8, padding: '3px 0' }}>
          <Input
            value={commitMessage}
            onChange={(e) => {
              setCommitMessage(e.target.value);
              setCommitError(null);
            }}
            placeholder={gitStatus.suggestedMessage || t('workbench.settings.gitPane.git.messagePlaceholder')}
            style={{ fontSize: 11.5 }}
            data-testid="git-pane-commit-message"
          />
          <Button
            type="primary"
            size="small"
            style={{ height: 'auto' }}
            loading={committing}
            disabled={dirtyFiles === 0}
            onClick={() => void commit()}
            data-testid="git-pane-commit-button"
          >
            {t('workbench.settings.gitPane.git.commitButton')}
          </Button>
        </div>
        {commitError !== null && (
          <div style={errorLine} data-testid="git-pane-commit-error">
            {commitError}
          </div>
        )}
      </PaneSection>

      <PaneSection title={t('workbench.settings.category.gitRepository.sub.history')}>
        <div style={{ padding: '3px 0' }}>
          <Button
            size="small"
            loading={historyLoading}
            onClick={() => void toggleHistory()}
            data-testid="git-pane-history-toggle"
          >
            {historyOpen
              ? t('workbench.settings.gitPane.git.history.hide')
              : t('workbench.settings.gitPane.git.history.show')}
          </Button>
        </div>
        {historyError !== null && (
          <div style={errorLine} data-testid="git-pane-history-error">
            {historyError}
          </div>
        )}
        {historyOpen &&
          (history.length === 0 ? (
            <div
              style={{ marginTop: 8, fontSize: 11.5, color: token.colorTextSecondary }}
              data-testid="git-pane-history-empty"
            >
              {t('workbench.settings.gitPane.git.history.empty')}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }} data-testid="git-pane-history-list">
              {history.map((entry) => (
                <li
                  key={entry.sha}
                  style={{ padding: '6px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}
                  data-testid="git-pane-history-entry"
                >
                  <LogEntryLines entry={entry} subjectSize={11.5} />
                  {entry.files.length > 0 && (
                    <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
                      {entry.files.map((file) => (
                        <li key={`${entry.sha}:${file.path}`}>
                          <Button
                            type="link"
                            size="small"
                            loading={fileHistoryLoading === file.path}
                            onClick={() => void openFileHistory(file.path)}
                            style={{ padding: 0, height: 'auto', fontSize: 11 }}
                            data-testid="git-pane-history-file"
                          >
                            <span style={{ fontFamily: token.fontFamilyCode }}>
                              {file.status} {file.path}
                            </span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ))}
        <Modal
          open={fileHistory !== null}
          title={
            fileHistory !== null
              ? t('workbench.settings.gitPane.git.history.fileTitle', { path: fileHistory.path })
              : ''
          }
          onCancel={() => setFileHistory(null)}
          footer={null}
          data-testid="git-pane-file-history-modal"
        >
          {fileHistory !== null && fileHistory.entries.length === 0 && (
            <p style={{ fontSize: 12, margin: 0 }} data-testid="git-pane-file-history-empty">
              {t('workbench.settings.gitPane.git.history.fileEmpty')}
            </p>
          )}
          {fileHistory !== null && fileHistory.entries.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="git-pane-file-history-list">
              {fileHistory.entries.map((entry) => (
                <li
                  key={entry.sha}
                  style={{ padding: '6px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
                  data-testid="git-pane-file-history-entry"
                >
                  <LogEntryLines entry={entry} subjectSize={12} />
                </li>
              ))}
            </ul>
          )}
        </Modal>
      </PaneSection>
    </>
  );
};

export default GitRepositorySection;
