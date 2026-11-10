/**
 * useCommitApply — the log's Cherry-Pick and Revert Commit: one host
 * verb per commit, in apply order, stopping at the first one the host
 * does not record. The host converges the commit's own change and
 * commits it, or refuses with nothing written — the surface says what
 * happened: the finished toast, what was left out, the files the
 * branch kept, the uncommitted work that was committed first (only in
 * a file the commit's change wrote), or why the commit was not applied.
 *
 * A commit that changed a document the branch also changed is answered
 * in the shared merge editor: the host's refusal carries the files, the
 * person resolves them, and the same verb goes again with the answers.
 * The set waits on the editor and resumes after it; Cancel leaves the
 * branch as it was and ends the set.
 */

import {
  hostBridge,
  type WorkspaceTreeApplyCommitResolveWire,
  type WorkspaceTreeApplyCommitWire,
} from '@openheaders/core/bridge';
import { useUiTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  buildCommitMergeSession,
  type CommitMergeApplyResult,
} from '@openheaders/ui/shared/conflicts/commit-merge-adapter';
import { MergeConflictModal } from '@openheaders/ui/shared/merge-editor';
import { App as AntApp } from 'antd';
import { type ReactNode, useMemo, useState } from 'react';
import { type CommitApplyMode, commitApplyOrder, shortSha } from './commit-apply';
import { keptLocalNotice, namePaths } from './kept-local';

export interface CommitApplyActions {
  /** Apply the commits' own changes onto the current branch (list order in, newest first). */
  cherryPick: (shas: readonly string[]) => void;
  /** Undo the commits' own changes on the current branch. */
  revert: (shas: readonly string[]) => void;
  /** The conflict editor — mount once in the caller's tree. */
  dialogs: ReactNode;
}

type Refusal = Extract<WorkspaceTreeApplyCommitWire, { ok: false }>;

/** One commit waiting on the editor. `settle` hands the set its answer — null when the person cancelled. */
interface OpenConflict {
  sha: string;
  mode: CommitApplyMode;
  resolve: WorkspaceTreeApplyCommitResolveWire;
  settle: (result: WorkspaceTreeApplyCommitWire | null) => void;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useCommitApply(workspaceId: string): CommitApplyActions {
  const t = useT();
  const { notification } = AntApp.useApp();
  const { isDarkMode, monacoTheme } = useUiTheme();
  const [conflict, setConflict] = useState<OpenConflict | null>(null);

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
    if (result.skipped !== undefined && result.skipped.length > 0) {
      notification.warning({
        title: t('workbench.gitLog.applyCommit.leftOut', { files: namePaths(result.skipped.map((skip) => skip.path)) }),
        duration: 0,
      });
    }
    const kept = keptLocalNotice(result.keptLocal, t);
    if (kept !== null) notification.warning({ title: kept, duration: 0 });
    if (result.ok && result.committedLocal !== undefined && result.committedLocal.length > 0) {
      notification.info({
        title: t('workbench.gitLog.applyCommit.localFirst', { files: namePaths(result.committedLocal) }),
        duration: 0,
      });
    }
  };

  const answerInEditor = (
    sha: string,
    mode: CommitApplyMode,
    resolve: WorkspaceTreeApplyCommitResolveWire,
  ): Promise<WorkspaceTreeApplyCommitWire | null> =>
    new Promise((settle) => {
      setConflict({ sha, mode, resolve, settle });
    });

  const run = async (shas: readonly string[], mode: CommitApplyMode): Promise<void> => {
    let applied = 0;
    for (const sha of commitApplyOrder(shas, mode)) {
      try {
        let result = await hostBridge.call('oh.workspaceTree.applyCommit', { workspaceId, sha, mode });
        if (!result.ok && result.reason === 'conflicts' && result.resolve !== undefined) {
          const answered = await answerInEditor(sha, mode, result.resolve);
          if (answered === null) break;
          result = answered;
        }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: the session is the open conflict's — a new one is a new session
  const session = useMemo(() => {
    if (conflict === null) return null;
    const { sha, mode, resolve, settle } = conflict;
    const apply = async (answers: { path: string; content: string }[]): Promise<CommitMergeApplyResult> => {
      let result: WorkspaceTreeApplyCommitWire;
      try {
        result = await hostBridge.call('oh.workspaceTree.applyCommit', {
          workspaceId,
          sha,
          mode,
          resolution: { token: resolve.token, files: answers },
        });
      } catch (err) {
        return { ok: false, error: messageOf(err) };
      }
      if (!result.ok && result.reason === 'resolution-invalid') {
        return {
          ok: false,
          error: result.detail ?? result.reason,
          ...(result.file !== undefined ? { path: result.file } : {}),
        };
      }
      if (!result.ok && result.reason === 'conflicts' && result.resolve !== undefined) {
        // The branch moved while the editor was open — the same question, as it stands now.
        const stale = t('workbench.gitLog.applyCommit.resolveStale');
        notification.warning({ title: stale, duration: 0 });
        setConflict({ sha, mode, resolve: result.resolve, settle });
        return { ok: false, error: stale };
      }
      // Recorded, or refused for a reason no answer changes — the set takes it from here.
      settle(result);
      return { ok: true };
    };
    return buildCommitMergeSession({
      title: t(
        mode === 'pick'
          ? 'workbench.gitLog.applyCommit.resolvePickTitle'
          : 'workbench.gitLog.applyCommit.resolveRevertTitle',
        { commit: shortSha(sha) },
      ),
      files: resolve.files,
      apply,
      onCancel: () => settle(null),
    });
  }, [conflict]);

  const dialogs =
    conflict !== null && session !== null ? (
      <MergeConflictModal
        key={conflict.resolve.token}
        open
        session={session}
        isDarkMode={isDarkMode}
        monacoTheme={monacoTheme}
        surfaceId="git"
        // The set may already have opened the next commit's conflict — only this one closes.
        onClose={() => setConflict((open) => (open === conflict ? null : open))}
      />
    ) : null;

  return {
    cherryPick: (shas) => void run(shas, 'pick'),
    revert: (shas) => void run(shas, 'revert'),
    dialogs,
  };
}
