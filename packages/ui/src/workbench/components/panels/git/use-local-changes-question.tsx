/**
 * useLocalChangesQuestion — the ONE question every surface raises when
 * a pass is about to write a file that holds uncommitted work: the
 * host refuses `local-changes` naming the files, the person gives the
 * word (and the message) for committing that work first, and the same
 * verb goes again with it. Every surface that can start such a pass —
 * the log's Cherry-Pick and Revert, the branch verbs' Pull and Merge,
 * the Commit window's Pull, the settings card — mounts this hook's
 * dialog and asks through it, so the question reads the same wherever
 * it comes up. Cancel sends nothing: the branch and the tree stay as
 * they were.
 */

import { type ReactNode, useCallback, useState } from 'react';
import LocalChangesFirstModal, {
  type LocalChangesFirstPrompt,
  type LocalChangesOperation,
} from './LocalChangesFirstModal';

/** The person's word that uncommitted work in the files the pass writes is committed first, under this message. */
export interface CommitLocalWord {
  message: string;
}

/** What a verb's answer carries when it is the question. */
export interface LocalChangesRefusal {
  ok: boolean;
  reason?: string;
  localChanges?: string[];
  suggestedMessage?: string;
}

export interface LocalChangesQuestion {
  /** Raise the question over a `local-changes` refusal; the message for the commit, or null on Cancel. */
  ask: (operation: LocalChangesOperation, refusal: LocalChangesRefusal) => Promise<string | null>;
  /**
   * Run `verb`; when it answers `local-changes`, ask, and on the word run
   * it again with the message. Null when the person cancelled — nothing
   * was written and nothing is said.
   */
  withWord: <R extends LocalChangesRefusal>(
    operation: LocalChangesOperation,
    verb: (commitLocal?: CommitLocalWord) => Promise<R>,
  ) => Promise<R | null>;
  /** The dialog — mount once in the caller's tree. */
  dialog: ReactNode;
}

interface OpenQuestion extends LocalChangesFirstPrompt {
  settle: (message: string | null) => void;
}

export function useLocalChangesQuestion(container: HTMLElement | null): LocalChangesQuestion {
  const [question, setQuestion] = useState<OpenQuestion | null>(null);

  // Both are stable across renders — a caller may hold them in a callback's dependencies.
  const ask = useCallback(
    (operation: LocalChangesOperation, refusal: LocalChangesRefusal): Promise<string | null> =>
      new Promise((settle) => {
        setQuestion({
          operation,
          files: refusal.localChanges ?? [],
          suggestedMessage: refusal.suggestedMessage ?? '',
          settle,
        });
      }),
    [],
  );

  const withWord = useCallback(
    async <R extends LocalChangesRefusal>(
      operation: LocalChangesOperation,
      verb: (commitLocal?: CommitLocalWord) => Promise<R>,
    ): Promise<R | null> => {
      const first = await verb();
      if (first.ok || first.reason !== 'local-changes') return first;
      const message = await ask(operation, first);
      return message === null ? null : verb({ message });
    },
    [ask],
  );

  const answer = (message: string | null): void => {
    question?.settle(message);
    setQuestion(null);
  };

  return {
    ask,
    withWord,
    dialog: (
      <LocalChangesFirstModal
        prompt={question}
        container={container}
        onCommit={answer}
        onCancel={() => answer(null)}
      />
    ),
  };
}
