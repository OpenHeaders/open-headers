/**
 * useSelectedCommits — the commits of the rows a log has selected
 * (`log-selected-commits.ts`), read for whatever stands beside the
 * list: the details, the files, the pick's rule, the patch.
 *
 * A selected row's commit comes off its page while the list holds it —
 * what acts on the set has it with the press. Its changed paths, and
 * the commits the pages do not hold, are read from the host
 * (`oh.workspaceTree.logRows`, with `files`) under a key of the
 * selection's OWN: the tab's key is the list's window's, and a read
 * under it would end the read the scroll waits for. One read is out at a time; a
 * selection that changes meanwhile is answered when it lands. A list
 * the host will not read from is not asked again for the same rows.
 */

import { hostBridge, type WorkspaceTreeLogRowsWire } from '@openheaders/core/bridge';
import type { RowRange } from '@openheaders/ui/shared/selection';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogRowPages, LogRowStretch, LogRowsAsk } from './log-row-pages';
import {
  keepSelectedCommits,
  NO_SELECTED_COMMITS,
  nextSelectedRead,
  type SelectedCommits,
  type SelectedSet,
  selectedCommitRows,
  selectedSet,
  takeSelectedRows,
} from './log-selected-commits';

/** The key the selection's reads go under, beside the tab's own. */
const selectionKey = (ask: LogRowsAsk): string => `${ask.key ?? ''}:selection`;

async function readRows(ask: LogRowsAsk, stretch: LogRowStretch): Promise<WorkspaceTreeLogRowsWire> {
  try {
    return await hostBridge.call('oh.workspaceTree.logRows', {
      ...ask,
      key: selectionKey(ask),
      ...stretch,
      files: true,
    });
  } catch (fault) {
    return { ok: false, reason: 'log-failed', detail: fault instanceof Error ? fault.message : String(fault) };
  }
}

/** `held` is the list drawn, `ranges` its selected rows. */
export function useSelectedCommits(held: LogRowPages, ranges: readonly RowRange[]): SelectedSet {
  const [read, setRead] = useState<SelectedCommits>(NO_SELECTED_COMMITS);
  // Answers landed: each is followed by a look at what is still missing, whether or not it brought any.
  const [landed, setLanded] = useState(0);
  const rows = useMemo(() => selectedCommitRows(ranges), [ranges]);
  // What is kept for the rows selected NOW — a press on a held row is in it within the same render.
  const kept = useMemo(() => keepSelectedCommits(read, held, rows), [read, held, rows]);
  const live = useRef({ rows, out: false, refused: null as readonly number[] | null, gone: false });
  live.current.rows = rows;

  useEffect(() => {
    live.current.gone = false;
    return () => {
      live.current.gone = true;
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `landed` is an answer in — the next stretch is looked for
  useEffect(() => {
    // A commit taken off a page stays once the page is let go.
    if (kept !== read) setRead(kept);
    const state = live.current;
    const { ask } = kept;
    const stretch = nextSelectedRead(kept, rows);
    if (ask === null || stretch === null || state.out || state.refused === rows) return;
    state.out = true;
    void readRows(ask, stretch).then((answer) => {
      state.out = false;
      if (state.gone) return;
      if (answer.ok) {
        // Taken into what is kept THEN, for the rows selected then; another list's answer changes nothing.
        setRead((prev) => takeSelectedRows(prev, ask, stretch.from, answer, state.rows));
      } else {
        state.refused = state.rows;
      }
      setLanded((count) => count + 1);
    });
  }, [kept, read, rows, landed]);

  return useMemo(() => selectedSet(kept, ranges), [kept, ranges]);
}
