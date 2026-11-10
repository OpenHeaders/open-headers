/**
 * useConflictAnswers — the conflict editor for a pass whose refusal
 * carries files to answer: a Cherry-Pick, a Revert, a Pull, a branch
 * Merge. The host refuses `conflicts` with the files both sides changed
 * and writes nothing; the person resolves them in the shared merge
 * editor, and the same verb goes again with the answers.
 *
 * The editor stays open while the host cannot take the answers — a file
 * that does not read is marked, and a branch that moved while the
 * editor was open brings the files back as they stand now. It closes
 * when the pass is over, whichever way, and hands the verb's answer
 * back. Cancel leaves the branch and the tree as they were.
 */

import type {
  WorkspaceTreeApplyCommitResolutionWire,
  WorkspaceTreeApplyCommitResolveWire,
} from '@openheaders/core/bridge';
import { useUiTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  buildCommitMergeSession,
  type CommitMergeAnswer,
  type CommitMergeApplyResult,
} from '@openheaders/ui/shared/conflicts/commit-merge-adapter';
import { MergeConflictModal } from '@openheaders/ui/shared/merge-editor';
import { App as AntApp } from 'antd';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

/** What a verb's answer carries when it is about the files both sides changed. */
export interface ConflictsRefusal {
  ok: boolean;
  reason?: string;
  detail?: string;
  /** `conflicts`: the files to answer. */
  resolve?: WorkspaceTreeApplyCommitResolveWire;
  /** `resolution-invalid`: the answered file that could not be taken. */
  file?: string;
}

export interface ConflictAnswers {
  /**
   * Open the editor over the files of a `conflicts` refusal. `send` runs
   * the verb again with the answers. Resolves with the verb's answer
   * once the pass is over, or null when the person cancelled — nothing
   * was written and nothing is said.
   */
  answer: <R extends ConflictsRefusal>(
    title: string,
    resolve: WorkspaceTreeApplyCommitResolveWire,
    send: (resolution: WorkspaceTreeApplyCommitResolutionWire) => Promise<R>,
  ) => Promise<R | null>;
  /** The editor — mount once in the caller's tree. */
  dialog: ReactNode;
}

/** One pass waiting on the editor. */
interface OpenConflict {
  title: string;
  resolve: WorkspaceTreeApplyCommitResolveWire;
  /** Send the answers made against `token`; resolves `ok` once the pass is over. */
  apply: (token: string, answers: CommitMergeAnswer[]) => Promise<CommitMergeApplyResult>;
  cancel: () => void;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useConflictAnswers(): ConflictAnswers {
  const t = useT();
  const { notification } = AntApp.useApp();
  const { isDarkMode, monacoTheme } = useUiTheme();
  const [conflict, setConflict] = useState<OpenConflict | null>(null);

  const answer = useCallback(
    <R extends ConflictsRefusal>(
      title: string,
      resolve: WorkspaceTreeApplyCommitResolveWire,
      send: (resolution: WorkspaceTreeApplyCommitResolutionWire) => Promise<R>,
    ): Promise<R | null> =>
      new Promise((settle) => {
        const cancel = (): void => settle(null);
        const apply = async (token: string, answers: CommitMergeAnswer[]): Promise<CommitMergeApplyResult> => {
          let result: R;
          try {
            result = await send({ token, files: answers });
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
            setConflict({ title, resolve: result.resolve, apply, cancel });
            return { ok: false, error: stale };
          }
          // Recorded, or refused for a reason no answer changes — the caller takes it from here.
          settle(result);
          return { ok: true };
        };
        setConflict({ title, resolve, apply, cancel });
      }),
    [t, notification],
  );

  const session = useMemo(() => {
    if (conflict === null) return null;
    const { title, resolve, apply, cancel } = conflict;
    return buildCommitMergeSession({
      title,
      files: resolve.files,
      apply: (answers) => apply(resolve.token, answers),
      onCancel: cancel,
    });
  }, [conflict]);

  const dialog =
    conflict !== null && session !== null ? (
      <MergeConflictModal
        key={conflict.resolve.token}
        open
        session={session}
        isDarkMode={isDarkMode}
        monacoTheme={monacoTheme}
        surfaceId="git"
        // A set may already have opened the next pass's conflict — only this one closes.
        onClose={() => setConflict((open) => (open === conflict ? null : open))}
      />
    ) : null;

  return { answer, dialog };
}
