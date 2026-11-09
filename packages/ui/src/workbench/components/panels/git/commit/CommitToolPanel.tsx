/**
 * CommitToolPanel — the Commit tool window (companion of the Git
 * window, S22): the checkable changes tree over the `changes` verb,
 * the working-tree diff on double-click, and the user-driven pathspec
 * commit with Amend / Sign-off / per-commit hooks. Unbound, the body
 * IS the bind gesture (GitBindForm — the same posture as the Git
 * window); the posture (bound, root, status) reads from the ONE git
 * status store and, bound, the window refetches its changes on every
 * status frame the store folds — no polling. The user's real index is never touched; every
 * write rides the workspace-tree verb table.
 */

import {
  hostBridge,
  type WorkspaceTreeFileDiffPairWire,
  type WorkspaceTreeWorkingChangeWire,
} from '@openheaders/core/bridge';
import { Alert, App as AntApp, Button } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { postGitPanelReveal } from '../../../../data/git-panel-reveal';
import GitBindForm from '../../../git/GitBindForm';
import { localWorkspaceTreeTransport } from '../../../git/transport';
import { refreshWorkspaceGit, useWorkspaceGitSnapshot } from '../../../../stores/git-status-store';
import DiffModal from '../DiffModal';
import ForcePushBanner from '../ForcePushBanner';
import { keptLocalNotice } from '../kept-local';
import { GIT_PRIMARY_TAB_KEY, getGitPanelWorkbench } from '../git-panel-view-store';
import CreateBranchModal from '../rail/CreateBranchModal';
import RemotesModal from '../remotes/RemotesModal';
import {
  type CheckedState,
  checkedOnly,
  checkedPaths,
  type CommitAuthor,
  commitAuthorOf,
  type CommitMenuTarget,
  countChanges,
  EMPTY_CHECKED_STATE,
  rollbackPaths,
  setPathsChecked,
  splitChangeGroups,
} from './commit-model';
import { buildCommitRowMenu, buildIgnoredRowMenu, type CommitRowMenuHandlers } from './commit-row-menu';
import CompareBranchModal from './CompareBranchModal';
import { COMMIT_MESSAGE_HISTORY_LIMIT, commitMessageHistory } from './commit-message-history';
import {
  type CommitViewPrefs,
  getCommitViewPrefs,
  patchCommitViewPrefs,
  subscribeCommitViewPrefs,
} from './commit-view-prefs';
import CommitChangesTree, { type CommitChangesTreeHandle } from './CommitChangesTree';
import CommitForm, { type CommitFormHandle } from './CommitForm';
import CommitToolbar from './CommitToolbar';
import PushCommitsModal from '../push/PushCommitsModal';
import PushRejectedModal from '../push/PushRejectedModal';
import PushNewBranchAlert from './PushNewBranchAlert';

export interface CommitToolPanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
}

const CommitToolPanel: React.FC<CommitToolPanelProps> = ({ info, onHide }) => {
  const { t } = useLocale();
  const { message, modal } = AntApp.useApp();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const workspaceId = useActiveWorkspaceId();

  const [rows, setRows] = useState<WorkspaceTreeWorkingChangeWire[]>([]);
  const [selectedRows, setSelectedRows] = useState<readonly WorkspaceTreeWorkingChangeWire[]>([]);
  const [checked, setChecked] = useState<CheckedState>(EMPTY_CHECKED_STATE);
  const [amend, setAmend] = useState(false);
  const [amendAuthor, setAmendAuthor] = useState<CommitAuthor | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<WorkspaceTreeFileDiffPairWire | null>(null);
  const [pushRecovery, setPushRecovery] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [pushRejected, setPushRejected] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);
  const [createBranchFrom, setCreateBranchFrom] = useState<string | null>(null);
  const treeRef = useRef<CommitChangesTreeHandle>(null);
  const formRef = useRef<CommitFormHandle>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const preAmendDraft = useRef<string | null>(null);

  // The posture from the one git status store: hydrated on first
  // read, folded from status frames after.
  const snapshot = useWorkspaceGitSnapshot(workspaceId);
  const { bound, rootDir, status } = snapshot;
  const bypassHooksSetting = status?.bypassHooks ?? false;
  const currentBranch = status?.branch ?? null;
  const headSha = status?.headSha ?? null;
  const forcePush = status?.forcePush ?? null;
  const refresh = useCallback((): void => {
    if (workspaceId !== null) refreshWorkspaceGit(workspaceId);
  }, [workspaceId]);

  const prefs: CommitViewPrefs = useSyncExternalStore(
    useCallback(
      (listener) => (workspaceId !== null ? subscribeCommitViewPrefs(workspaceId, listener) : () => undefined),
      [workspaceId],
    ),
    () => (workspaceId !== null ? getCommitViewPrefs(workspaceId) : getCommitViewPrefs('')),
  );
  const patchPrefs = useCallback(
    (patch: Partial<CommitViewPrefs>): void => {
      if (workspaceId !== null) patchCommitViewPrefs(workspaceId, patch);
    },
    [workspaceId],
  );

  const refreshChanges = useCallback(async (): Promise<void> => {
    if (workspaceId === null) return;
    try {
      const result = await hostBridge.call('oh.workspaceTree.changes', {
        workspaceId,
        ...(prefs.showIgnored ? { includeIgnored: true } : {}),
      });
      if (result.ok) setRows(result.changes);
      else if (result.reason === 'not-bound' || result.reason === 'not-a-repo') setRows([]);
    } catch {
      // Host without the verb table — the window stays empty.
    }
  }, [workspaceId, prefs.showIgnored]);

  // The changes follow every status frame — a new frame is a new
  // status object in the store; the first read lands the same way.
  useEffect(() => {
    if (status !== null) void refreshChanges();
  }, [status, refreshChanges]);

  const groups = useMemo(() => splitChangeGroups(rows), [rows]);
  const counter = useMemo(() => countChanges(rows), [rows]);
  const paths = useMemo(() => checkedPaths(rows, checked), [rows, checked]);
  const toolbarRollback = useMemo(() => rollbackPaths(selectedRows), [selectedRows]);
  const runGitHooks = prefs.runGitHooks ?? !bypassHooksSetting;
  const canCommit = bound && !committing && prefs.draft.trim().length > 0 && (paths.length > 0 || amend);

  const handleSetChecked = useCallback(
    (target: readonly string[], value: boolean): void => {
      setChecked((prev) => setPathsChecked(rows, prev, target, value));
    },
    [rows],
  );

  // The Commit Message History popup reads the bound repo's own log on
  // every open — a reseeded or rebound repo shows its own subjects.
  const loadHistory = useCallback((): void => {
    if (workspaceId === null) return;
    void hostBridge
      .call('oh.workspaceTree.log', { workspaceId, limit: COMMIT_MESSAGE_HISTORY_LIMIT })
      .then((result) => {
        setHistory(result.ok ? commitMessageHistory(result.entries) : []);
      })
      .catch(() => setHistory([]));
  }, [workspaceId]);

  // Amend prefill (the reference gesture): checking Amend swaps the box to
  // HEAD's subject, selected whole with the caret at its start;
  // unchecking restores the stashed draft.
  const handleAmendChange = useCallback(
    (next: boolean): void => {
      setAmend(next);
      if (workspaceId === null) return;
      if (next) {
        preAmendDraft.current = getCommitViewPrefs(workspaceId).draft;
        void hostBridge
          .call('oh.workspaceTree.log', { workspaceId, limit: 1 })
          .then((result) => {
            if (result.ok && result.entries.length > 0) {
              patchCommitViewPrefs(workspaceId, { draft: result.entries[0].subject });
              setAmendAuthor(commitAuthorOf(result.entries[0]));
              formRef.current?.selectMessage();
            }
          })
          .catch(() => undefined);
      } else {
        setAmendAuthor(null);
        if (preAmendDraft.current !== null) {
          patchCommitViewPrefs(workspaceId, { draft: preAmendDraft.current });
          preAmendDraft.current = null;
        }
      }
    },
    [workspaceId],
  );

  const commitErrorText = useCallback(
    (reason: string, detail?: string): string => {
      let label: string;
      switch (reason) {
        case 'not-bound':
        case 'not-a-repo':
          label = t('workbench.commitTool.errors.notARepo');
          break;
        case 'git-unavailable':
          label = t('workbench.commitTool.errors.gitUnavailable');
          break;
        case 'empty-message':
          label = t('workbench.commitTool.errors.emptyMessage');
          break;
        case 'invalid-paths':
        case 'no-paths':
          label = t('workbench.commitTool.errors.noPaths');
          break;
        case 'amend-unborn':
          label = t('workbench.commitTool.errors.amendUnborn');
          break;
        case 'amend-merge':
          label = t('workbench.commitTool.errors.amendMerge');
          break;
        case 'amend-pushed':
          label = t('workbench.commitTool.errors.amendPushed');
          break;
        case 'stage-failed':
          label = t('workbench.commitTool.errors.stageFailed');
          break;
        default:
          label = t('workbench.commitTool.errors.commitFailed');
          break;
      }
      return detail !== undefined && detail.length > 0 ? `${label}\n${detail}` : label;
    },
    [t],
  );

  // Push's typed refusals (§8.2 / §16): a non-fast-forward raises the
  // Push Rejected prompt (Merge = pull, then push again), a rewrite
  // points at the banner, a read-only remote raises the
  // Push-as-New-Branch recovery instead of an error.
  const pushCurrent = useCallback(async (): Promise<void> => {
    if (workspaceId === null) return;
    const push = await hostBridge.call('oh.workspaceTree.push', { workspaceId });
    if (push.ok) {
      setPushRecovery(false);
      message.success(t(push.pushed ? 'workbench.commitTool.pushed' : 'workbench.commitTool.nothingToPush'));
      return;
    }
    if (push.reason === 'no-permission') {
      setPushRecovery(true);
      return;
    }
    if (push.reason === 'rejected') {
      setPushRejected(true);
      return;
    }
    const failed = t('workbench.commitTool.errors.pushFailed');
    if (push.reason === 'force-push') {
      setError(`${failed}\n${t('workbench.commitTool.errors.historyRewritten')}`);
    } else {
      setError(push.detail !== undefined && push.detail.length > 0 ? `${failed}\n${push.detail}` : failed);
    }
  }, [workspaceId, message, t]);

  const handleCommit = useCallback(
    async (andPush: boolean): Promise<void> => {
      if (workspaceId === null) return;
      setCommitting(true);
      setError(null);
      try {
        const result = await hostBridge.call('oh.workspaceTree.userCommit', {
          workspaceId,
          message: prefs.draft,
          paths,
          ...(amend ? { amend: true } : {}),
          ...(prefs.signOff ? { signOff: true } : {}),
          ...(runGitHooks ? {} : { bypassHooks: true }),
        });
        if (!result.ok) {
          setError(commitErrorText(result.reason, result.detail));
          return;
        }
        if (!result.committed) {
          message.info(t('workbench.commitTool.nothingToCommit'));
          return;
        }
        patchCommitViewPrefs(workspaceId, { draft: '' });
        preAmendDraft.current = null;
        setAmend(false);
        setAmendAuthor(null);
        setChecked(EMPTY_CHECKED_STATE);
        message.success(t('workbench.commitTool.committed', { sha: (result.sha ?? '').slice(0, 8) }));
        await refreshChanges();
        if (andPush) setPushOpen(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setCommitting(false);
      }
    },
    [
      workspaceId,
      prefs.draft,
      prefs.signOff,
      paths,
      amend,
      runGitHooks,
      commitErrorText,
      message,
      refreshChanges,
      t,
    ],
  );

  const handleOpenDiff = useCallback(
    async (filePath: string): Promise<void> => {
      if (workspaceId === null) return;
      try {
        const result = await hostBridge.call('oh.workspaceTree.workingFileDiff', { workspaceId, path: filePath });
        if (result.ok) setDiff(result.diff);
      } catch {
        // Host without the verb — double-click stays inert.
      }
    },
    [workspaceId],
  );

  // Commit File… (reference gesture, scoped to our own commit UI): check
  // ONLY that file and land in the message box.
  const handleCommitPaths = useCallback(
    (paths: readonly string[]): void => {
      setChecked(checkedOnly(rows, paths));
      formRef.current?.focusMessage();
    },
    [rows],
  );

  // Answers whether the pull landed — the Push Rejected prompt's Merge
  // pushes again only then.
  const handlePull = useCallback(async (): Promise<boolean> => {
    if (workspaceId === null) return false;
    try {
      const result = await hostBridge.call('oh.workspaceTree.pull', { workspaceId });
      if (!result.ok) {
        setError(
          result.reason === 'force-push'
            ? t('workbench.commitTool.errors.historyRewritten')
            : t('workbench.commitTool.menu.pullFailed', { detail: result.detail ?? result.reason }),
        );
        return false;
      }
      if (!result.upToDate && result.history !== undefined) {
        // §3.4: no merge base — every remote file was treated as
        // changed; the user learns why (shallow clone or unrelated
        // histories) instead of a plain "finished".
        message.warning(
          t(
            result.history === 'shallow'
              ? 'workbench.commitTool.menu.pullDoneShallow'
              : 'workbench.commitTool.menu.pullDoneUnrelated',
          ),
        );
      } else {
        message.success(
          t(result.upToDate ? 'workbench.commitTool.menu.pullUpToDate' : 'workbench.commitTool.menu.pullDone'),
        );
      }
      const kept = result.upToDate ? null : keptLocalNotice(result.keptLocal, t);
      if (kept !== null) message.warning(kept, 8);
      await refreshChanges();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, [workspaceId, message, refreshChanges, t]);

  const handleFetch = useCallback(async (): Promise<void> => {
    if (workspaceId === null) return;
    try {
      const result = await hostBridge.call('oh.workspaceTree.fetch', { workspaceId });
      if (result.ok) message.success(t('workbench.commitTool.menu.fetchDone'));
      else setError(t('workbench.gitLog.fetch.failed', { detail: result.detail ?? result.reason }));
    } catch (err) {
      setError((err as Error).message);
    }
  }, [workspaceId, message, t]);

  // Add to .gitignore ▸ — one entry per path (a selection's files in
  // sequence, the first refusal stops the pass); the rows leave
  // Unversioned Files on the refetch (and join Ignored Files while
  // Show Ignored Files is on).
  const handleIgnorePaths = useCallback(
    async (paths: readonly string[], target: 'gitignore' | 'exclude'): Promise<void> => {
      if (workspaceId === null) return;
      try {
        for (const filePath of paths) {
          const result = await hostBridge.call('oh.workspaceTree.ignorePath', { workspaceId, path: filePath, target });
          if (!result.ok) {
            setError(t('workbench.commitTool.menu.ignoreFailed', { detail: result.detail ?? result.reason }));
            return;
          }
        }
        await refreshChanges();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [workspaceId, refreshChanges, t],
  );

  // Add to VCS — the rows leave Unversioned Files for Changes (added)
  // on the refetch; nothing is staged.
  const handleAddToVcs = useCallback(
    async (paths: readonly string[]): Promise<void> => {
      if (workspaceId === null) return;
      try {
        const result = await hostBridge.call('oh.workspaceTree.addToVcs', { workspaceId, paths: [...paths] });
        if (!result.ok) {
          setError(t('workbench.commitTool.menu.addToVcsFailed', { detail: result.detail ?? result.reason }));
          return;
        }
        await refreshChanges();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [workspaceId, refreshChanges, t],
  );

  // Rollback… over added rows — confirmed first (the count in the
  // title); the rows return to Unversioned Files on the refetch, the
  // files stay on disk.
  const handleRollbackPaths = useCallback(
    (paths: readonly string[]): void => {
      if (workspaceId === null || paths.length === 0) return;
      const files =
        paths.length === 1 ? t('workbench.commitTool.oneFile') : t('workbench.gitLog.filesCount', { count: paths.length });
      modal.confirm({
        title: t('workbench.commitTool.rollbackAdded.confirmTitle', { files }),
        content: t('workbench.commitTool.rollbackAdded.confirmBody'),
        okText: t('workbench.commitTool.rollbackAdded.ok'),
        onOk: async () => {
          try {
            const result = await hostBridge.call('oh.workspaceTree.unaddPaths', { workspaceId, paths: [...paths] });
            if (!result.ok) {
              setError(t('workbench.commitTool.menu.rollbackFailed', { detail: result.detail ?? result.reason }));
            }
            await refreshChanges();
          } catch (err) {
            setError((err as Error).message);
          }
        },
      });
    },
    [workspaceId, refreshChanges, t, modal],
  );

  // Delete… — confirmed first (the count in the title); a tracked row
  // reads as deleted on the refetch, an unversioned one is gone.
  const handleDeletePaths = useCallback(
    (paths: readonly string[]): void => {
      if (workspaceId === null || paths.length === 0) return;
      const files =
        paths.length === 1 ? t('workbench.commitTool.oneFile') : t('workbench.gitLog.filesCount', { count: paths.length });
      modal.confirm({
        title: t('workbench.commitTool.delete.confirmTitle', { files }),
        content: t('workbench.commitTool.delete.confirmBody'),
        okText: t('workbench.commitTool.delete.ok'),
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            const result = await hostBridge.call('oh.workspaceTree.deletePaths', { workspaceId, paths: [...paths] });
            if (!result.ok) {
              setError(t('workbench.commitTool.menu.deleteFailed', { detail: result.detail ?? result.reason }));
            }
            await refreshChanges();
          } catch (err) {
            setError((err as Error).message);
          }
        },
      });
    },
    [workspaceId, refreshChanges, t, modal],
  );

  // Stop Ignoring — deletes the exact entry; the row rejoins
  // Unversioned Files on the refetch.
  const handleUnignorePath = useCallback(
    async (filePath: string, target: 'gitignore' | 'exclude'): Promise<void> => {
      if (workspaceId === null) return;
      try {
        const result = await hostBridge.call('oh.workspaceTree.unignorePath', { workspaceId, path: filePath, target });
        if (!result.ok) {
          setError(t('workbench.commitTool.menu.ignoreFailed', { detail: result.detail ?? result.reason }));
          return;
        }
        await refreshChanges();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [workspaceId, refreshChanges, t],
  );

  // Compare with Branch or Tag… — the picked ref opens the Git
  // window's Compare-with-Current tab via the shared registry.
  const handleComparePick = useCallback(
    (ref: string): void => {
      setCompareOpen(false);
      if (workspaceId === null) return;
      getGitPanelWorkbench(workspaceId).registry.openCompare(ref);
      postGitPanelReveal();
    },
    [workspaceId],
  );

  // Branches… — reveal the Git window on its primary log tab with the
  // ref rail expanded.
  const handleBranches = useCallback((): void => {
    if (workspaceId === null) return;
    const { registry } = getGitPanelWorkbench(workspaceId);
    registry.patchLogTab(GIT_PRIMARY_TAB_KEY, { refsCollapsed: false });
    registry.activateTab(GIT_PRIMARY_TAB_KEY);
    postGitPanelReveal();
  }, [workspaceId]);

  const rowMenuHandlers = useMemo<CommitRowMenuHandlers>(
    () => ({
      onCommitPaths: handleCommitPaths,
      onShowDiff: (filePath) => void handleOpenDiff(filePath),
      onRefresh: () => void refreshChanges(),
      onPush: () => setPushOpen(true),
      onPull: () => void handlePull(),
      onFetch: () => void handleFetch(),
      onCompareWithBranch: () => setCompareOpen(true),
      onBranches: handleBranches,
      onNewBranch: () => setCreateBranchFrom(currentBranch ?? headSha?.slice(0, 8) ?? 'HEAD'),
      onManageRemotes: () => setRemotesOpen(true),
      onIgnorePaths: (paths, target) => void handleIgnorePaths(paths, target),
      onUnignorePath: (filePath, target) => void handleUnignorePath(filePath, target),
      onAddToVcs: (paths) => void handleAddToVcs(paths),
      onRollbackPaths: handleRollbackPaths,
      onDeletePaths: handleDeletePaths,
    }),
    [
      handleCommitPaths,
      handleOpenDiff,
      refreshChanges,
      pushCurrent,
      handlePull,
      handleFetch,
      handleBranches,
      handleIgnorePaths,
      handleUnignorePath,
      handleAddToVcs,
      handleRollbackPaths,
      handleDeletePaths,
      currentBranch,
      headSha,
    ],
  );

  // §3.4: a detached HEAD follows the tree read-write like any other
  // state, but a commit made here belongs to no branch — the window
  // says so once and offers the way out (New Branch anchors at HEAD).
  const detachedSha = currentBranch === null ? headSha : null;

  const rowMenu = useCallback(
    (target: CommitMenuTarget) =>
      target.kind === 'file' && target.row.ignored
        ? buildIgnoredRowMenu(target.row, t, rowMenuHandlers)
        : buildCommitRowMenu(target, t, rowMenuHandlers),
    [t, rowMenuHandlers],
  );

  if (workspaceId === null || !bound) {
    return (
      <div className="rules-bottom-panel">
        <PanelHeader
          wiring={headerWiring}
          title={<strong>{t('workbench.toolWindows.commit')}</strong>}
          info={info}
        />
        <div
          style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex' }}
          data-testid="commit-tool-not-bound"
        >
          <div style={{ width: 'min(560px, 92%)', margin: 'auto', padding: '18px 0' }}>
            <GitBindForm
              call={localWorkspaceTreeTransport}
              workspaceId={workspaceId}
              allowFolderPicker
              onBound={refresh}
              onAdopted={refresh}
              testidPrefix="commit-tool-bind"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="rules-bottom-panel commit-tool-panel" data-testid="commit-tool-panel">
      <PanelHeader
        wiring={headerWiring}
        title={
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
            <strong style={{ flexShrink: 0 }}>{t('workbench.toolWindows.commit')}</strong>
            <InfoTrigger content={info} className="rules-panel-header-info" />
          </div>
        }
      />
      {detachedSha !== null && (
        <Alert
          type="warning"
          showIcon
          title={
            <span style={{ fontSize: 12 }}>
              {t('workbench.commitTool.detached.message', { sha: detachedSha.slice(0, 8) })}
            </span>
          }
          description={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="small"
                onClick={() => setCreateBranchFrom(detachedSha.slice(0, 8))}
                data-testid="commit-tool-detached-new-branch"
              >
                {t('workbench.commitTool.detached.newBranch')}
              </Button>
            </div>
          }
          style={{ borderRadius: 0 }}
          data-testid="commit-tool-detached"
        />
      )}
      {forcePush !== null && (
        <ForcePushBanner workspaceId={workspaceId} state={forcePush} testidPrefix="commit-tool" />
      )}
      <CommitToolbar
        onRefresh={() => void refreshChanges()}
        rollbackPaths={toolbarRollback}
        onRollback={handleRollbackPaths}
        prefs={prefs}
        onPatchPrefs={patchPrefs}
        onExpandAll={() => treeRef.current?.expandAll()}
        onCollapseAll={() => treeRef.current?.collapseAll()}
      />
      <CommitChangesTree
        ref={treeRef}
        groups={groups}
        checked={checked}
        onSetChecked={handleSetChecked}
        onOpenFile={(filePath) => void handleOpenDiff(filePath)}
        groupByDirectory={prefs.groupByDirectory}
        showIgnored={prefs.showIgnored}
        rootLabel={rootDir === null ? '' : (rootDir.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '')}
        rowMenu={rowMenu}
        onSelectionChange={setSelectedRows}
      />
      {pushRecovery && (
        <PushNewBranchAlert
          workspaceId={workspaceId}
          onPushed={(branch) => {
            setPushRecovery(false);
            message.success(t('workbench.commitTool.pushNoPermission.pushed', { branch }));
          }}
          onClose={() => setPushRecovery(false)}
        />
      )}
      <CommitForm
        ref={formRef}
        draft={prefs.draft}
        onDraftChange={(draft) => patchPrefs({ draft })}
        amend={amend}
        onAmendChange={handleAmendChange}
        amendAuthor={amendAuthor}
        counter={counter}
        history={history}
        onHistoryOpen={loadHistory}
        signOff={prefs.signOff}
        onSignOffChange={(signOff) => patchPrefs({ signOff })}
        runGitHooks={runGitHooks}
        onRunGitHooksChange={(next) => patchPrefs({ runGitHooks: next })}
        committing={committing}
        canCommit={canCommit}
        onCommit={(andPush) => void handleCommit(andPush)}
        error={error}
        onDismissError={() => setError(null)}
      />
      <DiffModal diff={diff} onClose={() => setDiff(null)} />
      <PushCommitsModal
        workspaceId={workspaceId}
        open={pushOpen}
        onClose={() => setPushOpen(false)}
        onConfirm={pushCurrent}
      />
      <PushRejectedModal
        open={pushRejected}
        branch={currentBranch ?? 'HEAD'}
        onCancel={() => setPushRejected(false)}
        onMerge={() => {
          setPushRejected(false);
          void handlePull().then((landed) => (landed ? pushCurrent() : undefined));
        }}
      />
      <CompareBranchModal
        workspaceId={workspaceId}
        open={compareOpen}
        container={panelRef.current}
        onClose={() => setCompareOpen(false)}
        onPick={handleComparePick}
      />
      <RemotesModal
        workspaceId={workspaceId}
        open={remotesOpen}
        container={panelRef.current}
        onClose={() => setRemotesOpen(false)}
      />
      <CreateBranchModal
        workspaceId={workspaceId}
        from={createBranchFrom}
        fromRef={undefined}
        container={panelRef.current}
        onClose={() => setCreateBranchFrom(null)}
        onCreated={(branch, from, checkedOut) => {
          if (checkedOut) {
            message.success(t('workbench.gitLog.createBranch.checkedOut', { branch, from }));
          }
        }}
      />
    </div>
  );
};

export default CommitToolPanel;
