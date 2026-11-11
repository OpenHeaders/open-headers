/**
 * useLocalChangesQuestion — the ONE question raised when a pass is
 * about to write a file that holds uncommitted work: the host refuses
 * `local-changes` naming the files, and the person gives the word (and
 * the message) for committing that work first. Every surface that can
 * start such a pass asks through `use-pass-answers`, which owns this
 * dialog beside the conflict editor, so the question reads the same
 * wherever it comes up. Cancel sends nothing: the branch and the tree
 * stay as they were.
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
  /** The dialog — mount once in the caller's tree. */
  dialog: ReactNode;
}

interface OpenQuestion extends LocalChangesFirstPrompt {
  settle: (message: string | null) => void;
}

export function useLocalChangesQuestion(): LocalChangesQuestion {
  const [question, setQuestion] = useState<OpenQuestion | null>(null);

  // Stable across renders — a caller may hold it in a callback's dependencies.
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

  const answer = (message: string | null): void => {
    question?.settle(message);
    setQuestion(null);
  };

  return {
    ask,
    dialog: (
      <LocalChangesFirstModal prompt={question} onCommit={answer} onCancel={() => answer(null)} />
    ),
  };
}
