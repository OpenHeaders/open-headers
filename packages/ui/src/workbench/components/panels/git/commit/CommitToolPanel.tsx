/**
 * CommitToolPanel — the Commit tool window (IDE companion of the Git
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
  type WorkspaceTreeWorkingChangeWire,
} from '@openheaders/core/bridge';
import { App as AntApp } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import GitBindForm from '../../../git/GitBindForm';
import { localWorkspaceTreeTransport } from '../../../git/transport';
import DiffModal from '../DiffModal';
import {
  type CheckedState,
  checkedPaths,
  countChanges,
  EMPTY_CHECKED_STATE,
  setPathsChecked,
  splitChangeGroups,
} from './commit-model';
import {
  type CommitViewPrefs,
  getCommitViewPrefs,
  patchCommitViewPrefs,
  pushCommitMessageHistory,
  subscribeCommitViewPrefs,
} from './commit-view-prefs';
import CommitChangesTree, { type CommitChangesTreeHandle } from './CommitChangesTree';
import CommitForm from './CommitForm';
import CommitToolbar from './CommitToolbar';

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
  const [bypassHooksSetting, setBypassHooksSetting] = useState(false);
  const [rows, setRows] = useState<WorkspaceTreeWorkingChangeWire[]>([]);
  const [checked, setChecked] = useState<CheckedState>(EMPTY_CHECKED_STATE);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [amend, setAmend] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<WorkspaceTreeFileDiffPairWire | null>(null);
  const treeRef = useRef<CommitChangesTreeHandle>(null);
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
      const isBound = list.bindings.some((row) => row.workspaceId === workspaceId);
      setBound(isBound);
      if (!isBound) return;
      const status = await hostBridge.call('oh.workspaceTree.gitStatus', { workspaceId });
      setBypassHooksSetting(status.bypassHooks);
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

  // Amend prefill (the IDE gesture): checking Amend swaps the box to
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
        if (andPush) {
          const push = await hostBridge.call('oh.workspaceTree.push', { workspaceId });
          if (push.ok) {
            message.success(t(push.pushed ? 'workbench.commitTool.pushed' : 'workbench.commitTool.nothingToPush'));
          } else {
            setError(
              push.detail !== undefined && push.detail.length > 0
                ? `${t('workbench.commitTool.errors.pushFailed')}\n${push.detail}`
                : t('workbench.commitTool.errors.pushFailed'),
            );
          }
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setCommitting(false);
      }
    },
    [workspaceId, prefs.draft, prefs.signOff, paths, amend, runGitHooks, commitErrorText, message, refreshChanges, t],
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
              testidPrefix="commit-tool-bind"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rules-bottom-panel commit-tool-panel" data-testid="commit-tool-panel">
      <PanelHeader
        wiring={headerWiring}
        title={
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
            <strong style={{ flexShrink: 0 }}>{t('workbench.toolWindows.commit')}</strong>
            <InfoTrigger content={info} className="rules-panel-header-info" />
          </div>
        }
      />
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
        selectedPath={selectedPath}
        onSelectFile={setSelectedPath}
        onOpenFile={(filePath) => void handleOpenDiff(filePath)}
        groupByDirectory={prefs.groupByDirectory}
        showIgnored={prefs.showIgnored}
      />
      <CommitForm
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
    </div>
  );
};

export default CommitToolPanel;
