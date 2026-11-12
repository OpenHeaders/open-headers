/**
 * useConflictAnswers — how a pass whose refusal carries files is
 * answered: a Cherry-Pick, a Revert, a Pull, a branch Merge. The host
 * refuses `conflicts` with the files both sides changed and writes
 * nothing; the same verb goes again with the answers.
 *
 * The files are named first, in a small dialog under the pass's title
 * (`ConflictFilesModal`). There the person takes one side for all of
 * them — the host rules every value both sides changed for that side
 * and keeps what only one side changed — or asks for the shared merge
 * editor, which never opens unannounced. Cancel at either ends the pass
 * the same way: the branch and the tree stay as they were.
 *
 * Either stays open while the host cannot take the answers — a file
 * that does not read is marked in the editor, and a branch that moved
 * meanwhile brings the files back as they stand now. It closes when the
 * pass is over, whichever way, and hands the verb's answer back.
 */

import type {
  WorkspaceTreeApplyCommitResolutionWire,
  WorkspaceTreeApplyCommitResolveWire,
} from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { CommitMergeAnswer, CommitMergeApplyResult } from '@openheaders/ui/shared/conflicts/commit-merge-adapter';
import { App as AntApp } from 'antd';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import ConflictEditor from './ConflictEditor';
import ConflictFilesModal, { type ConflictSide } from './ConflictFilesModal';

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
   * Name the files of a `conflicts` refusal and take the person's
   * answer — one side for all, or each file in the editor. `send` runs
   * the verb again with it. Resolves with the verb's answer once the
   * pass is over, or null when the person cancelled — nothing was
   * written and nothing is said.
   */
  answer: <R extends ConflictsRefusal>(
    title: string,
    resolve: WorkspaceTreeApplyCommitResolveWire,
    send: (resolution: WorkspaceTreeApplyCommitResolutionWire) => Promise<R>,
  ) => Promise<R | null>;
  /** The files dialog and the editor — mount once in the caller's tree. */
  dialog: ReactNode;
}

type ConflictStep = 'files' | 'editor';

/** How an answer fared. `again` = the branch moved, and the files are asked again as they stand. */
type Delivery = CommitMergeApplyResult | { ok: false; error: string; again: true };

/** One pass waiting on the person. */
interface OpenConflict {
  /** `files` names what both sides changed; `editor` is where each is answered. */
  step: ConflictStep;
  title: string;
  resolve: WorkspaceTreeApplyCommitResolveWire;
  /** Send an answer made at `step`; resolves `ok` once the pass is over. */
  deliver: (resolution: WorkspaceTreeApplyCommitResolutionWire, step: ConflictStep) => Promise<Delivery>;
  cancel: () => void;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useConflictAnswers(): ConflictAnswers {
  const t = useT();
  const { notification } = AntApp.useApp();
  const [conflict, setConflict] = useState<OpenConflict | null>(null);
  const [sending, setSending] = useState<ConflictSide | null>(null);

  const answer = useCallback(
    <R extends ConflictsRefusal>(
      title: string,
      resolve: WorkspaceTreeApplyCommitResolveWire,
      send: (resolution: WorkspaceTreeApplyCommitResolutionWire) => Promise<R>,
    ): Promise<R | null> =>
      new Promise((settle) => {
        const cancel = (): void => settle(null);
        const deliver = async (
          resolution: WorkspaceTreeApplyCommitResolutionWire,
          step: ConflictStep,
        ): Promise<Delivery> => {
          let result: R;
          try {
            result = await send(resolution);
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
            // The branch moved while the answer was being made — the same question, as it stands now.
            const stale = t('workbench.gitLog.applyCommit.resolveStale');
            notification.warning({ title: stale, duration: 0 });
            setConflict({ step, title, resolve: result.resolve, deliver, cancel });
            return { ok: false, error: stale, again: true };
          }
          // Recorded, or refused for a reason no answer changes — the caller takes it from here.
          settle(result);
          return { ok: true };
        };
        setConflict({ step: 'files', title, resolve, deliver, cancel });
      }),
    [t, notification],
  );

  const reviewed = conflict !== null && conflict.step === 'editor' ? conflict : null;
  const sendAnswers = useMemo(
    () =>
      reviewed === null
        ? null
        : (answers: CommitMergeAnswer[]) =>
            reviewed.deliver({ token: reviewed.resolve.token, files: answers }, 'editor'),
    [reviewed],
  );

  const listed = conflict !== null && conflict.step === 'files' ? conflict : null;

  // One side for every file. A branch that moved brings the files back
  // in this same dialog (`deliver` says so); any other failure is said
  // here, with the dialog left as it was.
  const takeSide = async (side: ConflictSide): Promise<void> => {
    if (listed === null || sending !== null) return;
    setSending(side);
    const outcome = await listed.deliver({ token: listed.resolve.token, side }, 'files');
    setSending(null);
    if (outcome.ok) setConflict((open) => (open === listed ? null : open));
    else if (!('again' in outcome)) notification.error({ title: outcome.error });
  };

  const dialog = (
    <>
      <ConflictFilesModal
        prompt={listed !== null ? { title: listed.title, files: listed.resolve.files.map((file) => file.path) } : null}
        sending={sending}
        onSide={(side) => void takeSide(side)}
        onReview={() => {
          if (listed !== null) setConflict({ ...listed, step: 'editor' });
        }}
        onCancel={() => {
          listed?.cancel();
          setConflict(null);
        }}
      />
      {reviewed !== null && sendAnswers !== null ? (
        <ConflictEditor
          key={reviewed.resolve.token}
          title={reviewed.title}
          files={reviewed.resolve.files}
          apply={sendAnswers}
          onCancel={reviewed.cancel}
          // A set may already have opened the next pass's conflict — only this one closes.
          onClose={() => setConflict((open) => (open === reviewed ? null : open))}
        />
      ) : null}
    </>
  );

  return { answer, dialog };
}
