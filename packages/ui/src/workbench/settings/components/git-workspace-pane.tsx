/**
 * GitWorkspacePane — right-pane renderer for the Git category (Node
 * hosts; desktop-gated at the category). The GIT_PLAN.md §9 settings
 * card: bind the active workspace to an on-disk folder (init when
 * empty), surface the four typed bind refusals, list the tree's
 * quarantined documents, and unbind — plus the Phase 3 git section:
 * install-git degradation, porcelain dirty count, the explicit Commit
 * gesture with its semantic message draft, and the auto-commit cadence
 * toggle. Remote/branch surfaces arrive with Phases 4–6.
 *
 * Host surface: the `oh.workspaceTree.*` channels answered by the
 * daemon spine's workspace-tree runtime; the folder picker is the
 * desktop shell's native dialog with a plain path input as the
 * universal fallback.
 *
 * Reused by the daemon admin console (GIT_PLAN.md §11.5) with an
 * injected `transport` that rides the gated
 * `oh.daemon.workspaceTree.dispatch` wire channel — same card, same
 * verbs, remote daemon. There the native picker is absent
 * (`allowFolderPicker: false`) and the workspace is the console's
 * explicit pick rather than the active one.
 */

import {
  hostBridge,
  type WorkspaceTreeCommitCadence,
  type WorkspaceTreeGitStatusWire,
  type WorkspaceTreeLogEntryWire,
} from '@openheaders/core/bridge';
import { Alert, App as AntApp, Button, Input, Modal, Popconfirm, Select, Switch, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import GitBindForm from '../../components/git/GitBindForm';
import { localWorkspaceTreeTransport, type WorkspaceTreeTransport } from '../../components/git/transport';
import { resolveLabel, resolveOptionalDescription } from '../localize';
import type { CategoryPaneProps } from '../types';

export type { WorkspaceTreeRpcType, WorkspaceTreeTransport } from '../../components/git/transport';

interface BindingRow {
  workspaceId: string;
  rootDir: string;
  issues: Array<{ path: string; message: string }>;
}

type GitStatusRow = WorkspaceTreeGitStatusWire;

export interface GitWorkspacePaneProps extends Partial<CategoryPaneProps> {
  /** Host call seam; defaults to the local `hostBridge.call`. */
  transport?: WorkspaceTreeTransport;
  /** Explicit workspace (admin console); defaults to the active one. */
  workspaceId?: string;
  /** False on hosts without a native folder dialog (remote daemon). */
  allowFolderPicker?: boolean;
}

const GitWorkspacePane: React.FC<GitWorkspacePaneProps> = ({
  category,
  transport,
  workspaceId: explicitWorkspaceId,
  allowFolderPicker = true,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { message } = AntApp.useApp();
  const call = transport ?? localWorkspaceTreeTransport;
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaceId = explicitWorkspaceId ?? activeWorkspaceId;
  const [bindings, setBindings] = useState<BindingRow[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusRow | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushFailure, setPushFailure] = useState<{ reason: string; detail?: string } | null>(null);
  const [branchDraft, setBranchDraft] = useState('');
  const [pushingBranch, setPushingBranch] = useState(false);
  const [resolving, setResolving] = useState<'abandon' | 'rescue' | 'reapply' | null>(null);
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

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const result = await call('oh.workspaceTree.list');
      setBindings(result.bindings);
    } catch {
      setBindings([]);
    }
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const binding = bindings.find((row) => row.workspaceId === workspaceId) ?? null;

  const refreshGitStatus = useCallback(async (): Promise<void> => {
    if (workspaceId === null) {
      setGitStatus(null);
      return;
    }
    try {
      setGitStatus(await call('oh.workspaceTree.gitStatus', { workspaceId }));
    } catch {
      setGitStatus(null);
    }
  }, [workspaceId, call]);

  useEffect(() => {
    if (binding !== null) void refreshGitStatus();
    else setGitStatus(null);
  }, [binding, refreshGitStatus]);

  // Live refresh: the Node host pushes a fresh git status after every
  // pass that can move `git status` (materialize, sweep, commit) and on
  // setting changes — the mount RPC above is only the hydration read.
  useEffect(() => {
    if (workspaceId === null) return;
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      setGitStatus(payload.status.bound ? payload.status : null);
    });
  }, [workspaceId]);

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

  const setAutoPush = async (autoPushOnCommit: boolean): Promise<void> => {
    if (workspaceId === null) return;
    try {
      await call('oh.workspaceTree.setAutoPushOnCommit', { workspaceId, autoPushOnCommit });
      await refreshGitStatus();
    } catch (err) {
      message.error((err as Error).message);
    }
  };

  const resolveForcePush = async (choice: 'abandon' | 'rescue' | 'reapply'): Promise<void> => {
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

  const switchBranch = async (branch: string, dirtyAction?: 'commit' | 'stash' | 'discard'): Promise<void> => {
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

  const onBound = (initialized: boolean): void => {
    message.success(
      initialized ? t('workbench.settings.gitPane.boundInitialized') : t('workbench.settings.gitPane.bound'),
    );
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
    <div style={category !== undefined ? { padding: '14px 18px 20px', maxWidth: 760 } : undefined}>
      {category !== undefined && (
        <header style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: token.colorText, letterSpacing: -0.1 }}>
            {resolveLabel(category, t)}
          </h2>
          {resolveOptionalDescription(category, t) && (
            <p style={{ margin: '1px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
              {resolveOptionalDescription(category, t)}
            </p>
          )}
        </header>
      )}

      {binding !== null ? (
        <section>
          <div className="settings-card" style={{ padding: '10px 14px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 6 }}>
              {t('workbench.settings.gitPane.boundTitle')}
            </div>
            <div style={{ fontFamily: token.fontFamilyCode, fontSize: 11.5, color: token.colorText }}>
              {binding.rootDir}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: token.colorTextSecondary }}>
              {t('workbench.settings.gitPane.boundBody')}
            </p>
            {binding.issues.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 10 }}
                data-testid="git-pane-issues-alert"
                message={
                  <span style={{ fontSize: 12 }}>
                    {t('workbench.settings.gitPane.issuesTitle', { count: binding.issues.length })}
                  </span>
                }
                description={
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5 }}>
                    {binding.issues.map((issue) => (
                      <li key={issue.path}>
                        <span style={{ fontFamily: token.fontFamilyCode }}>{issue.path}</span> — {issue.message}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
            {gitStatus !== null && !gitStatus.git.available && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 10 }}
                message={<span style={{ fontSize: 12 }}>{t('workbench.settings.gitPane.git.missing.title')}</span>}
                description={
                  <span style={{ fontSize: 11.5 }}>
                    {gitStatus.git.reason === 'below-floor'
                      ? t('workbench.settings.gitPane.git.belowFloor.body', { version: gitStatus.git.version ?? '' })
                      : t('workbench.settings.gitPane.git.missing.body')}
                  </span>
                }
              />
            )}
            {gitStatus !== null && gitStatus.git.available && gitStatus.repo && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 4 }}>
                  {t('workbench.settings.gitPane.git.title')}
                </div>
                {gitStatus.forcePush !== null && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 10 }}
                    data-testid="git-pane-force-push-alert"
                    message={
                      <span style={{ fontSize: 12 }}>{t('workbench.settings.gitPane.git.forcePush.title')}</span>
                    }
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
                        {resolveError !== null && (
                          <div style={{ marginTop: 6, color: token.colorError }}>{resolveError}</div>
                        )}
                      </div>
                    }
                  />
                )}
                <div
                  style={{
                    fontSize: 11.5,
                    color: (gitStatus.dirtyFiles ?? 0) > 0 ? token.colorText : token.colorTextSecondary,
                  }}
                  data-testid="git-pane-dirty-count"
                >
                  {(gitStatus.dirtyFiles ?? 0) > 0
                    ? t('workbench.settings.gitPane.git.dirtyCount', { count: gitStatus.dirtyFiles ?? 0 })
                    : t('workbench.settings.gitPane.git.clean')}
                </div>
                {gitStatus.userIndexBusy && (
                  <div
                    style={{ marginTop: 4, fontSize: 11.5, color: token.colorTextSecondary }}
                    data-testid="git-pane-index-busy"
                  >
                    {t('workbench.settings.gitPane.git.indexBusy')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span
                    style={{ fontSize: 11.5, color: token.colorTextSecondary, flex: 1 }}
                    data-testid="git-pane-remote-line"
                  >
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
                  <div style={{ marginTop: 6, fontSize: 12, color: token.colorError }} data-testid="git-pane-pull-error">
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
                      <span style={{ fontSize: 12 }}>
                        {t('workbench.settings.gitPane.git.pushNoPermission.title')}
                      </span>
                    }
                    description={
                      <div style={{ fontSize: 11.5 }}>
                        <p style={{ margin: '0 0 8px' }}>
                          {t('workbench.settings.gitPane.git.pushNoPermission.body')}
                        </p>
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
                  <div style={{ marginTop: 6, fontSize: 12, color: token.colorError }}>
                    {t('workbench.settings.gitPane.git.pushFailed', {
                      detail: pushFailure.detail ?? pushFailure.reason,
                    })}
                  </div>
                )}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: token.colorText, marginBottom: 4 }}>
                    {t('workbench.settings.gitPane.git.branch.title')}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                          ...(gitStatus.upstream !== null
                            ? [{ value: gitStatus.upstream, label: gitStatus.upstream }]
                            : []),
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
                    <div
                      style={{ marginTop: 6, fontSize: 12, color: token.colorError }}
                      data-testid="git-pane-branch-error"
                    >
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
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
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
                    disabled={(gitStatus.dirtyFiles ?? 0) === 0}
                    onClick={() => void commit()}
                    data-testid="git-pane-commit-button"
                  >
                    {t('workbench.settings.gitPane.git.commitButton')}
                  </Button>
                </div>
                {commitError !== null && (
                  <div style={{ marginTop: 6, fontSize: 12, color: token.colorError }} data-testid="git-pane-commit-error">
                    {commitError}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                    {t('workbench.settings.gitPane.git.cadenceLabel')}
                  </span>
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
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <Switch
                    size="small"
                    checked={gitStatus.bypassHooks}
                    onChange={(checked) => void setBypassHooks(checked)}
                    data-testid="git-pane-bypass-hooks-switch"
                  />
                  <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                    {t('workbench.settings.gitPane.git.bypassHooksLabel')}
                  </span>
                </div>
                {gitStatus.bypassHooks && (
                  <div
                    style={{ marginTop: 4, fontSize: 11.5, color: token.colorWarningText }}
                    data-testid="git-pane-bypass-hooks-warning"
                  >
                    {t('workbench.settings.gitPane.git.bypassHooksWarning')}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <Switch
                    size="small"
                    checked={gitStatus.autoPushOnCommit}
                    onChange={(checked) => void setAutoPush(checked)}
                    data-testid="git-pane-auto-push-switch"
                  />
                  <span style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                    {t('workbench.settings.gitPane.git.autoPushLabel')}
                  </span>
                </div>
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: token.colorText, flex: 1 }}>
                      {t('workbench.settings.gitPane.git.history.title')}
                    </span>
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
                    <div
                      style={{ marginTop: 6, fontSize: 12, color: token.colorError }}
                      data-testid="git-pane-history-error"
                    >
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
                      <ul
                        style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}
                        data-testid="git-pane-history-list"
                      >
                        {history.map((entry) => (
                          <li
                            key={entry.sha}
                            style={{ padding: '6px 0', borderTop: `1px solid ${token.colorBorderSecondary}` }}
                            data-testid="git-pane-history-entry"
                          >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                              <span
                                style={{ fontFamily: token.fontFamilyCode, fontSize: 11, color: token.colorTextSecondary }}
                              >
                                {entry.sha.slice(0, 7)}
                              </span>
                              <span style={{ fontSize: 11.5, color: token.colorText, flex: 1 }}>{entry.subject}</span>
                            </div>
                            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                              {t('workbench.settings.gitPane.git.history.authorLine', {
                                author: entry.authorName,
                                date: new Date(entry.authoredAt).toLocaleString(),
                              })}
                            </div>
                            {entry.coAuthors.length > 0 && (
                              <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                {t('workbench.settings.gitPane.git.history.coAuthors', {
                                  authors: entry.coAuthors.join(', '),
                                })}
                              </div>
                            )}
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
                      <ul
                        style={{ listStyle: 'none', margin: 0, padding: 0 }}
                        data-testid="git-pane-file-history-list"
                      >
                        {fileHistory.entries.map((entry) => (
                          <li
                            key={entry.sha}
                            style={{ padding: '6px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
                            data-testid="git-pane-file-history-entry"
                          >
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                              <span
                                style={{ fontFamily: token.fontFamilyCode, fontSize: 11, color: token.colorTextSecondary }}
                              >
                                {entry.sha.slice(0, 7)}
                              </span>
                              <span style={{ fontSize: 12, color: token.colorText, flex: 1 }}>{entry.subject}</span>
                            </div>
                            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                              {t('workbench.settings.gitPane.git.history.authorLine', {
                                author: entry.authorName,
                                date: new Date(entry.authoredAt).toLocaleString(),
                              })}
                            </div>
                            {entry.coAuthors.length > 0 && (
                              <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                                {t('workbench.settings.gitPane.git.history.coAuthors', {
                                  authors: entry.coAuthors.join(', '),
                                })}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Modal>
                </div>
              </div>
            )}
            <div style={{ padding: '10px 0 2px' }}>
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
        </section>
      ) : (
        <section>
          <div className="settings-card" style={{ padding: '10px 14px 12px' }}>
            <GitBindForm
              call={call}
              workspaceId={workspaceId}
              allowFolderPicker={allowFolderPicker}
              onBound={onBound}
              testidPrefix="git-pane"
            />
          </div>
        </section>
      )}
    </div>
  );
};

export default GitWorkspacePane;
