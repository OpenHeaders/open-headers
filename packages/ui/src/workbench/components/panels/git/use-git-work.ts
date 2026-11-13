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
 *   widget's spinner, the log's line) for exactly as long.
 *
 * A call is counted, never a pass: a pass's questions sit between its
 * calls, and nothing reads as work while one waits on the person.
 */

import { removeBackgroundTask, upsertBackgroundTask } from '@openheaders/ui/shared/background-tasks';
import { useCallback, useState } from 'react';

export interface GitWork {
  /** Run one host call under `title`, the words the processes slot shows while it is out. */
  atHost: <R>(title: string, call: () => Promise<R>) => Promise<R>;
  /** A call of this surface is at the host right now. */
  working: boolean;
}

let lastTask = 0;

export function useGitWork(): GitWork {
  const [calls, setCalls] = useState(0);

  // Stable across renders — a caller may hold it in a callback's dependencies.
  const atHost = useCallback(async <R>(title: string, call: () => Promise<R>): Promise<R> => {
    lastTask += 1;
    const id = `git-work-${lastTask}`;
    setCalls((count) => count + 1);
    upsertBackgroundTask({ id, title, percent: null });
    try {
      return await call();
    } finally {
      removeBackgroundTask(id);
      setCalls((count) => count - 1);
    }
  }, []);

  return { atHost, working: calls > 0 };
}
