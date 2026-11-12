/**
 * usePassAnswers — everything a pass that lands another commit's work
 * may ask before it writes, on ONE path for every surface that can
 * start one: the log's Cherry-Pick and Revert, the branch verbs' Pull
 * and Merge, the Commit window's Pull, the settings card.
 *
 * The host decides before it writes and refuses with nothing changed:
 *
 *   `local-changes` — the pass would write a file that holds
 *                     uncommitted work; the person gives the word (and
 *                     the message) for committing that work first
 *                     (`use-local-changes-question`);
 *   `conflicts`     — both sides changed one value of a document, or
 *                     one of the user's own text files; the files are
 *                     named, and on the person's word resolved in the
 *                     merge editor (`use-conflict-answers`).
 *
 * Each answer rides the next call of the same verb, the word included
 * when the editor's answers go. Cancel at either sends nothing more and
 * says nothing: the branch and the tree stay as they were.
 *
 * What the surface says of the pass's files afterwards it says through
 * `say`, which lends it the workbench's names for them
 * (`use-named-notices`).
 */

import type { WorkspaceTreeApplyCommitResolutionWire } from '@openheaders/core/bridge';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { type ReactNode, useCallback } from 'react';
import { shortSha } from './commit-apply';
import type { LocalChangesOperation } from './LocalChangesFirstModal';
import { type NamedNotices, useNamedNotices } from './use-named-notices';
import { type ConflictsRefusal, useConflictAnswers } from './use-conflict-answers';
import { type CommitLocalWord, type LocalChangesRefusal, useLocalChangesQuestion } from './use-local-changes-question';

/** What the person answered so far — a verb sends what it is handed. */
export interface PassAnswerSet {
  commitLocal?: CommitLocalWord;
  resolution?: WorkspaceTreeApplyCommitResolutionWire;
}

/** What a verb's answer carries when it is one of the two questions. */
export interface PassRefusal extends LocalChangesRefusal, ConflictsRefusal {}

export interface PassAnswers {
  /**
   * Run `verb`, asking whatever it refuses to go on without, and running
   * it again with each answer. Resolves with the verb's last answer, or
   * null when the person cancelled a question.
   */
  run: <R extends PassRefusal>(
    operation: LocalChangesOperation,
    verb: (answers: PassAnswerSet) => Promise<R>,
  ) => Promise<R | null>;
  /** Say what a finished pass did with the person's files, the files named as the workbench names them. */
  say: NamedNotices['say'];
  /**
   * The question, the conflicts step and the conflict editor — mount once
   * in the caller's tree. All three center on the window, whichever
   * surface started the pass: they are about the repository, not the
   * tool window the verb was pressed in.
   */
  dialogs: ReactNode;
}

function editorTitle(operation: LocalChangesOperation, t: Translate): string {
  if (operation.kind === 'pull') return t('workbench.gitLog.resolve.pullTitle');
  if (operation.kind === 'merge') return t('workbench.gitLog.resolve.mergeTitle', { ref: operation.ref });
  return t(
    operation.kind === 'revert'
      ? 'workbench.gitLog.applyCommit.resolveRevertTitle'
      : 'workbench.gitLog.applyCommit.resolvePickTitle',
    { commit: shortSha(operation.sha) },
  );
}

export function usePassAnswers(): PassAnswers {
  const t = useT();
  const { ask, dialog: questionDialog } = useLocalChangesQuestion();
  const { answer, dialog: editorDialog } = useConflictAnswers();
  const { say, holder } = useNamedNotices();

  // Stable across renders — a caller may hold it in a callback's dependencies.
  const run = useCallback(
    async <R extends PassRefusal>(
      operation: LocalChangesOperation,
      verb: (answers: PassAnswerSet) => Promise<R>,
    ): Promise<R | null> => {
      let result = await verb({});
      let word: PassAnswerSet = {};
      if (!result.ok && result.reason === 'local-changes') {
        const message = await ask(operation, result);
        if (message === null) return null;
        word = { commitLocal: { message } };
        result = await verb(word);
      }
      if (!result.ok && result.reason === 'conflicts' && result.resolve !== undefined) {
        return answer(editorTitle(operation, t), result.resolve, (resolution) => verb({ ...word, resolution }));
      }
      return result;
    },
    [ask, answer, t],
  );

  return {
    run,
    say,
    dialogs: (
      <>
        {questionDialog}
        {editorDialog}
        {holder}
      </>
    ),
  };
}
