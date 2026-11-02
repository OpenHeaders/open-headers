/**
 * CommitToolPanel — the Commit tool window (companion of the Git
 * window, S22): the checkable changes tree over the `changes` verb,
 * the working-tree diff on double-click, and the user-driven pathspec
 * commit with Amend / Sign-off / per-commit hooks. Unbound, the body
 * IS the bind gesture (GitBindForm — the same posture as the Git
 * window); bound, the window refetches on `workspaceTreeGitStatus`
 * frames — no polling. The user's real index is never touched; every
 * write rides the workspace-tree verb table.
 */

import {
  hostBridge,
  type WorkspaceTreeFileDiffPairWire,
  type WorkspaceTreeForcePushStateWire,
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
import DiffModal from '../DiffModal';
import ForcePushBanner from '../ForcePushBanner';
import { GIT_PRIMARY_TAB_KEY, getGitPanelWorkbench } from '../git-panel-view-store';
import CreateBranchModal from '../rail/CreateBranchModal';
import {
  type CheckedState,
  checkedOnly,
  checkedPaths,
  type CommitMenuTarget,
  countChanges,
  EMPTY_CHECKED_STATE,
  setPathsChecked,
  splitChangeGroups,
} from './commit-model';
import { buildCommitRowMenu, buildIgnoredRowMenu, type CommitRowMenuHandlers } from './commit-row-menu';
import CompareBranchModal from './CompareBranchModal';
import {
  type CommitViewPrefs,
  getCommitViewPrefs,
  patchCommitViewPrefs,
  pushCommitMessageHistory,
  subscribeCommitViewPrefs,
} from './commit-view-prefs';
import CommitChangesTree, { type CommitChangesTreeHandle } from './CommitChangesTree';
import CommitForm, { type CommitFormHandle } from './CommitForm';
import CommitToolbar from './CommitToolbar';
import PushNewBranchAlert from './PushNewBranchAlert';

export interface CommitToolPanelProps {
  info: InfoPopoverContent;
  onHide: () => void;
}

const CommitToolPanel: React.FC<CommitToolPanelProps> = ({ info, onHide }) => {
  const { t } = useLocale();
  const { message } = AntApp.useApp();
  const headerWiring = useMemo(() => createPanelHeaderWiring({ onHide }), [onHide]);
  const workspaceId = useActiveWorkspaceId();

  const [bound, setBound] = useState(false);
  const [rootDir, setRootDir] = useState<string | null>(null);
  const [bypassHooksSetting, setBypassHooksSetting] = useState(false);
  const [rows, setRows] = useState<WorkspaceTreeWorkingChangeWire[]>([]);
  const [checked, setChecked] = useState<CheckedState>(EMPTY_CHECKED_STATE);
  const [amend, setAmend] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<WorkspaceTreeFileDiffPairWire | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [headSha, setHeadSha] = useState<string | null>(null);
  const [forcePush, setForcePush] = useState<WorkspaceTreeForcePushStateWire | null>(null);
  const [pushRecovery, setPushRecovery] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [createBranchFrom, setCreateBranchFrom] = useState<string | null>(null);
  const treeRef = useRef<CommitChangesTreeHandle>(null);
  const formRef = useRef<CommitFormHandle>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const preAmendDraft = useRef<string | null>(null);

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

  // Bind lifeline + hooks-setting seed: hydrate once, then fold frames.
  const hydrate = useCallback(async (): Promise<void> => {
    if (workspaceId === null) {
      setBound(false);
      return;
    }
    try {
      const list = await hostBridge.call('oh.workspaceTree.list');
      const binding = list.bindings.find((row) => row.workspaceId === workspaceId) ?? null;
      setBound(binding !== null);
      setRootDir(binding?.rootDir ?? null);
      if (binding === null) return;
      const status = await hostBridge.call('oh.workspaceTree.gitStatus', { workspaceId });
      setBypassHooksSetting(status.bypassHooks);
      setCurrentBranch(status.branch);
      setHeadSha(status.headSha);
      setForcePush(status.forcePush);
    } catch {
      setBound(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!bound) return;
    void refreshChanges();
  }, [bound, refreshChanges]);

  useEffect(() => {
    if (workspaceId === null) return;
    return hostBridge.subscribe('workspaceTreeGitStatus', (payload) => {
      if (payload.workspaceId !== workspaceId) return;
      setBound(payload.status.bound);
      if (!payload.status.bound) return;
      setBypassHooksSetting(payload.status.bypassHooks);
      setCurrentBranch(payload.status.branch);
      setHeadSha(payload.status.headSha);
      setForcePush(payload.status.forcePush);
      void refreshChanges();
    });
  }, [workspaceId, refreshChanges]);

  const groups = useMemo(() => splitChangeGroups(rows), [rows]);
  const counter = useMemo(() => countChanges(rows), [rows]);
  const paths = useMemo(() => checkedPaths(rows, checked), [rows, checked]);
  const runGitHooks = prefs.runGitHooks ?? !bypassHooksSetting;
  const canCommit = bound && !committing && prefs.draft.trim().length > 0 && (paths.length > 0 || amend);

  const handleSetChecked = useCallback(
    (target: readonly string[], value: boolean): void => {
      setChecked((prev) => setPathsChecked(rows, prev, target, value));
    },
    [rows],
  );

  // Amend prefill (the reference gesture): checking Amend swaps the box to
  // HEAD's subject, unchecking restores the stashed draft.
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
            }
          })
          .catch(() => undefined);
      } else if (preAmendDraft.current !== null) {
        patchCommitViewPrefs(workspaceId, { draft: preAmendDraft.current });
        preAmendDraft.current = null;
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

  // Push's typed refusals (§8.2 / §16): a non-fast-forward names the
  // pull-first way out, a rewrite points at the banner, a read-only
  // remote raises the Push-as-New-Branch recovery instead of an error.
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
    const failed = t('workbench.commitTool.errors.pushFailed');
    if (push.reason === 'rejected') {
      setError(`${failed}\n${t('workbench.commitTool.errors.pushRejected')}`);
    } else if (push.reason === 'force-push') {
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
        pushCommitMessageHistory(workspaceId, prefs.draft);
        patchCommitViewPrefs(workspaceId, { draft: '' });
        preAmendDraft.current = null;
        setAmend(false);
        setChecked(EMPTY_CHECKED_STATE);
        message.success(t('workbench.commitTool.committed', { sha: (result.sha ?? '').slice(0, 8) }));
        await refreshChanges();
        if (andPush) await pushCurrent();
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
      pushCurrent,
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

  const handlePull = useCallback(async (): Promise<void> => {
    if (workspaceId === null) return;
    try {
      const result = await hostBridge.call('oh.workspaceTree.pull', { workspaceId });
      if (!result.ok) {
        setError(
          result.reason === 'force-push'
            ? t('workbench.commitTool.errors.historyRewritten')
            : t('workbench.commitTool.menu.pullFailed', { detail: result.detail ?? result.reason }),
        );
        return;
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
      await refreshChanges();
    } catch (err) {
      setError((err as Error).message);
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

  // Add to .gitignore ▸ — the row leaves Unversioned Files on the
  // refetch (and joins Ignored Files while Show Ignored Files is on).
  const handleIgnorePath = useCallback(
    async (filePath: string, target: 'gitignore' | 'exclude'): Promise<void> => {
      if (workspaceId === null) return;
      try {
        const result = await hostBridge.call('oh.workspaceTree.ignorePath', { workspaceId, path: filePath, target });
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
      onPush: () => void pushCurrent(),
      onPull: () => void handlePull(),
      onFetch: () => void handleFetch(),
      onCompareWithBranch: () => setCompareOpen(true),
      onBranches: handleBranches,
      onNewBranch: () => setCreateBranchFrom(currentBranch ?? headSha?.slice(0, 8) ?? 'HEAD'),
      onIgnorePath: (filePath, target) => void handleIgnorePath(filePath, target),
      onUnignorePath: (filePath, target) => void handleUnignorePath(filePath, target),
    }),
    [
      handleCommitPaths,
      handleOpenDiff,
      refreshChanges,
      pushCurrent,
      handlePull,
      handleFetch,
      handleBranches,
      handleIgnorePath,
      handleUnignorePath,
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
              onBound={() => void hydrate()}
              onAdopted={() => void hydrate()}
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
          action={
            <Button
              size="small"
              onClick={() => setCreateBranchFrom(detachedSha.slice(0, 8))}
              data-testid="commit-tool-detached-new-branch"
            >
              {t('workbench.commitTool.detached.newBranch')}
            </Button>
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
        counter={counter}
        history={prefs.history}
        onPickHistory={(picked) => patchPrefs({ draft: picked })}
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
      <CompareBranchModal
        workspaceId={workspaceId}
        open={compareOpen}
        container={panelRef.current}
        onClose={() => setCompareOpen(false)}
        onPick={handleComparePick}
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
