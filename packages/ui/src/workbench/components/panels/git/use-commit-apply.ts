/**
 * useCommitApply — the log's Cherry-Pick and Revert Commit: one host
 * verb per commit, in apply order, stopping at the first one the host
 * does not record. The host converges the commit's own change and
 * commits it, or refuses with nothing written — the surface only says
 * what happened: the finished toast, what was left out, the files the
 * branch kept, or why the commit was not applied.
 */

import { hostBridge, type WorkspaceTreeApplyCommitWire } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { type CommitApplyMode, commitApplyOrder, shortSha } from './commit-apply';
import { keptLocalNotice, namePaths } from './kept-local';

export interface CommitApplyActions {
  /** Apply the commits' own changes onto the current branch (list order in, newest first). */
  cherryPick: (shas: readonly string[]) => void;
  /** Undo the commits' own changes on the current branch. */
  revert: (shas: readonly string[]) => void;
}

type Refusal = Extract<WorkspaceTreeApplyCommitWire, { ok: false }>;

export function useCommitApply(workspaceId: string): CommitApplyActions {
  const t = useT();
  const { notification } = AntApp.useApp();

  const refusalTitle = (mode: CommitApplyMode, sha: string, refusal: Refusal): string => {
    const commit = shortSha(sha);
    if (refusal.reason === 'conflicts') {
      return t('workbench.gitLog.applyCommit.conflicts', { commit, files: namePaths(refusal.conflicts ?? []) });
    }
    if (refusal.reason === 'unsupported-commit') return t('workbench.gitLog.applyCommit.unsupported', { commit });
    if (refusal.reason === 'empty') {
      return t(
        mode === 'pick' ? 'workbench.gitLog.applyCommit.pickEmpty' : 'workbench.gitLog.applyCommit.revertEmpty',
        { commit },
      );
    }
    return t(
      mode === 'pick' ? 'workbench.gitLog.applyCommit.pickFailed' : 'workbench.gitLog.applyCommit.revertFailed',
      { commit, detail: refusal.detail ?? refusal.reason },
    );
  };

  /** What a commit's pass left behind, whether it recorded a commit or not. */
  const sayRemainder = (result: WorkspaceTreeApplyCommitWire): void => {
    if (result.skipped !== undefined && result.skipped.length > 0) {
      notification.warning({
        title: t('workbench.gitLog.applyCommit.leftOut', { files: namePaths(result.skipped.map((skip) => skip.path)) }),
        duration: 0,
      });
    }
    const kept = keptLocalNotice(result.keptLocal, t);
    if (kept !== null) notification.warning({ title: kept, duration: 0 });
  };

  const run = async (shas: readonly string[], mode: CommitApplyMode): Promise<void> => {
    let applied = 0;
    for (const sha of commitApplyOrder(shas, mode)) {
      try {
        const result = await hostBridge.call('oh.workspaceTree.applyCommit', { workspaceId, sha, mode });
        sayRemainder(result);
        if (!result.ok) {
          notification.error({ title: refusalTitle(mode, sha, result), duration: 0 });
          break;
        }
        applied += 1;
      } catch (err) {
        notification.error({
          title: t(
            mode === 'pick' ? 'workbench.gitLog.applyCommit.pickFailed' : 'workbench.gitLog.applyCommit.revertFailed',
            { commit: shortSha(sha), detail: err instanceof Error ? err.message : String(err) },
          ),
          duration: 0,
        });
        break;
      }
    }
    if (applied > 0) {
      notification.success({
        title: t(mode === 'pick' ? 'workbench.gitLog.applyCommit.picked' : 'workbench.gitLog.applyCommit.reverted'),
        duration: 3,
      });
    }
  };

  return {
    cherryPick: (shas) => void run(shas, 'pick'),
    revert: (shas) => void run(shas, 'revert'),
  };
}
