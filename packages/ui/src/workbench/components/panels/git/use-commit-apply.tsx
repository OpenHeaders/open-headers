/**
 * useCommitApply — the log's Cherry-Pick and Revert Commit: one host
 * verb per commit, in apply order, stopping at the first one the host
 * does not record. The host converges the commit's own change and
 * commits it, or refuses with nothing written — the surface says what
 * happened: the finished toast, what was left out, the files the
 * branch kept, the uncommitted work that was committed first (only in
 * a file the commit's change wrote), or why the commit was not applied.
 *
 * What the host asks before it writes goes through the shared answers
 * (`use-pass-answers`): a commit whose change would write a file that
 * holds uncommitted work is asked about first, and a commit that
 * changed a document the branch also changed is answered in the merge
 * editor. The set waits on each and resumes after it; Cancel leaves the
 * branch as it was and ends the set.
 */

import { hostBridge, type WorkspaceTreeApplyCommitWire } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import type { ReactNode } from 'react';
import { type CommitApplyMode, commitApplyOrder, shortSha } from './commit-apply';
import { committedLocalNotice, keptLocalNotice, leftOutNotice, namePaths } from './kept-local';
import { usePassAnswers } from './use-pass-answers';

export interface CommitApplyActions {
  /** Apply the commits' own changes onto the current branch (list order in, newest first). */
  cherryPick: (shas: readonly string[]) => void;
  /** Undo the commits' own changes on the current branch. */
  revert: (shas: readonly string[]) => void;
  /** The uncommitted-work question and the conflict editor — mount once in the caller's tree. */
  dialogs: ReactNode;
}

type Refusal = Extract<WorkspaceTreeApplyCommitWire, { ok: false }>;

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useCommitApply(workspaceId: string, container: HTMLElement | null): CommitApplyActions {
  const t = useT();
  const { notification } = AntApp.useApp();
  const answers = usePassAnswers(container);

  const refusalTitle = (mode: CommitApplyMode, sha: string, refusal: Refusal): string => {
    const commit = shortSha(sha);
    if (refusal.reason === 'conflicts') {
      return t(
        refusal.tooLarge === true
          ? 'workbench.gitLog.applyCommit.conflictsTooLarge'
          : 'workbench.gitLog.applyCommit.conflicts',
        { commit, files: namePaths(refusal.conflicts ?? []) },
      );
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
    const leftOut = leftOutNotice(result.skipped, t);
    if (leftOut !== null) notification.warning({ title: leftOut, duration: 0 });
    const kept = keptLocalNotice(result.keptLocal, t);
    if (kept !== null) notification.warning({ title: kept, duration: 0 });
    const first = result.ok ? committedLocalNotice(result.committedLocal, t) : null;
    if (first !== null) notification.info({ title: first, duration: 0 });
  };

  const run = async (shas: readonly string[], mode: CommitApplyMode): Promise<void> => {
    let applied = 0;
    for (const sha of commitApplyOrder(shas, mode)) {
      try {
        const result = await answers.run({ kind: mode, sha }, (given) =>
          hostBridge.call('oh.workspaceTree.applyCommit', { workspaceId, sha, mode, ...given }),
        );
        if (result === null) break;
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
            { commit: shortSha(sha), detail: messageOf(err) },
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
    dialogs: answers.dialogs,
  };
}
