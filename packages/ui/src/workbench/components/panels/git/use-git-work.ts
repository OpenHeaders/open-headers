/**
 * useGitWork — a git verb at the host, said while it is out. A verb
 * the person presses answers in a moment or in a second, and until it
 * does nothing on the surface has changed: the menu has closed, no
 * dialog and no toast is up yet. Every surface that sends such a verb
 * runs the call through `atHost`, which
 *
 *   names it in the status bar's processes slot ("Cherry-picking
 *   1a2b3c4…") until the host answers, and
 *
 *   counts it, so the surface can show work of its own (the branch
 *   widget's spinner, a tool window's pulse) for exactly as long.
 *
 * A call is counted, never a pass: a pass's questions sit between its
 * calls, and nothing reads as work while one waits on the person.
 *
 * A call sent from a dialog is signed by the dialog — the button that
 * sent it shows it is out, over a mask that covers the window — so it
 * is named and NOT counted (`nameGitWork`, or `atHost` with the
 * `dialog` sign): one sign for one press.
 */

import { removeBackgroundTask, upsertBackgroundTask } from '@openheaders/ui/shared/background-tasks';
import { useCallback, useState } from 'react';

/** What shows a call is out: the surface it was pressed on, or the dialog whose own button sent it. */
export type GitWorkSign = 'surface' | 'dialog';

export interface GitWork {
  /**
   * Run one host call under `title`, the words the processes slot shows while it is out. Signed by the
   * surface unless a dialog's button sent it.
   */
  atHost: <R>(title: string, call: () => Promise<R>, sign?: GitWorkSign) => Promise<R>;
  /** A call this surface signs is at the host right now. */
  working: boolean;
}

let lastTask = 0;

/** Name one host call in the processes slot until it answers — all a call needs when a dialog's own button signs it. */
export async function nameGitWork<R>(title: string, call: () => Promise<R>): Promise<R> {
  lastTask += 1;
  const id = `git-work-${lastTask}`;
  upsertBackgroundTask({ id, title, percent: null });
  try {
    return await call();
  } finally {
    removeBackgroundTask(id);
  }
}

export function useGitWork(): GitWork {
  const [calls, setCalls] = useState(0);

  // Stable across renders — a caller may hold it in a callback's dependencies.
  const atHost = useCallback(
    async <R>(title: string, call: () => Promise<R>, sign: GitWorkSign = 'surface'): Promise<R> => {
      if (sign === 'dialog') return nameGitWork(title, call);
      setCalls((count) => count + 1);
      try {
        return await nameGitWork(title, call);
      } finally {
        setCalls((count) => count - 1);
      }
    },
    [],
  );

  return { atHost, working: calls > 0 };
}
