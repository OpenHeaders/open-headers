/**
 * useLogRows — one log tab's read of the rows it shows
 * (`oh.workspaceTree.logRows`): the host keeps the whole list an ask
 * names, and the view reads the pages its mounted rows sit on.
 *
 * One read is out at a time. While it is, the rows the view moved to
 * wait: they are asked when it lands, so a scroll never ends the read
 * that is about to answer it. What does end a read is a newer one that
 * asks something ELSE — another ask, or the same one asked again
 * because the repo moved (`workspaceTreeGitStatus`), the host read its
 * history anew (`workspaceTreeLogHistory`) or the person pressed
 * Refresh. An answer that names another list than the held rows' drops
 * them (`log-row-pages.ts`).
 *
 * The rows of the ask before stay until the new ask's first answer:
 * `pending` says the list shown is not yet the one asked for.
 */

import { hostBridge, type WorkspaceTreeLogRowsWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type LogRowPages,
  type LogRowRange,
  type LogRowStretch,
  type LogRowsAsk,
  logReadOver,
  NO_LOG_ROW_RANGE,
  NO_LOG_ROWS,
  nextLogRead,
  takeLogRows,
} from './log-row-pages';
import { useNewestRead } from './use-newest-read';

export type LogRowsRefusal = Extract<WorkspaceTreeLogRowsWire, { ok: false }>;

export interface LogRows {
  /** The rows held — the ask's own once it is answered, the ask before's until then. */
  held: LogRowPages;
  /** The ask has no answer yet: what is held is not its list. */
  pending: boolean;
  /** A read the person pressed for is out. */
  asked: boolean;
  /** What the host refused the ask with; null while it answers. */
  refusal: LogRowsRefusal | null;
  /** The rows the view has mounted — what is read, and what is kept. */
  want: (mounted: LogRowRange) => void;
  /** The press of Refresh: the host looks at the repo again before it answers. */
  refresh: () => void;
}

interface Live {
  ask: LogRowsAsk | null;
  held: LogRowPages;
  mounted: LogRowRange;
  /** The ask of the read that is out. */
  out: LogRowsAsk | null;
  /** The ask the host refused — not asked again by a scroll. */
  refused: LogRowsAsk | null;
}

async function readLogRows(
  ask: LogRowsAsk,
  stretch: LogRowStretch,
  refresh: boolean,
): Promise<WorkspaceTreeLogRowsWire> {
  try {
    return await hostBridge.call('oh.workspaceTree.logRows', {
      ...ask,
      ...stretch,
      ...(refresh ? { refresh: true } : {}),
    });
  } catch (fault) {
    return { ok: false, reason: 'log-failed', detail: fault instanceof Error ? fault.message : String(fault) };
  }
}

/** `ask` is null while there is nothing to list; it is compared as it stands, so the caller holds it still. */
export function useLogRows(ask: LogRowsAsk | null): LogRows {
  const beginRead = useNewestRead();
  const [held, setHeld] = useState<LogRowPages>(NO_LOG_ROWS);
  const [refused, setRefused] = useState<{ ask: LogRowsAsk; refusal: LogRowsRefusal } | null>(null);
  const [pressed, setPressed] = useState(0);
  const live = useRef<Live>({ ask, held: NO_LOG_ROWS, mounted: NO_LOG_ROW_RANGE, out: null, refused: null });
  live.current.ask = ask;

  const send = useCallback(
    (asking: LogRowsAsk, stretch: LogRowStretch, press: 'refresh' | null): void => {
      const superseded = beginRead();
      const state = live.current;
      state.out = asking;
      state.refused = null;
      if (press !== null) setPressed((count) => count + 1);
      void readLogRows(asking, stretch, press === 'refresh').then((answer) => {
        if (press !== null) setPressed((count) => count - 1);
        if (superseded()) return;
        state.out = null;
        if (answer.ok) {
          state.held = takeLogRows(state.held, asking, stretch.from, answer, state.mounted);
          setHeld(state.held);
          setRefused(null);
        } else if (answer.reason !== 'superseded') {
          state.refused = asking;
          setRefused({ ask: asking, refusal: answer });
        }
      });
    },
    [beginRead],
  );

  const pump = useCallback((): void => {
    const state = live.current;
    if (state.ask === null || state.out === state.ask || state.refused === state.ask) return;
    const stretch = nextLogRead(state.held, state.ask, state.mounted);
    if (stretch !== null) send(state.ask, stretch, null);
  }, [send]);

  // The same ask read again where the view stands — it ends the read that is out.
  const again = useCallback(
    (press: 'refresh' | null): void => {
      const state = live.current;
      if (state.ask !== null) send(state.ask, logReadOver(state.mounted), press);
    },
    [send],
  );

  // A new ask is read at once; an answer taken is followed by the rows the view moved to meanwhile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `held` is the answer landing
  useEffect(() => {
    if (ask !== null) pump();
  }, [ask, held, pump]);

  // Nothing to list: a read that is out answers no one.
  useEffect(() => {
    if (ask !== null) return;
    const state = live.current;
    beginRead();
    state.out = null;
    state.held = NO_LOG_ROWS;
    setHeld(NO_LOG_ROWS);
    setRefused(null);
  }, [ask, beginRead]);

  const workspaceId = ask?.workspaceId ?? null;
  useEffect(() => {
    if (workspaceId === null) return;
    const moved = (payload: { workspaceId: string }): void => {
      if (payload.workspaceId === workspaceId) again(null);
    };
    const offStatus = hostBridge.subscribe('workspaceTreeGitStatus', moved);
    const offHistory = hostBridge.subscribe('workspaceTreeLogHistory', moved);
    return () => {
      offStatus();
      offHistory();
    };
  }, [workspaceId, again]);

  const want = useCallback(
    (mounted: LogRowRange): void => {
      live.current.mounted = mounted;
      pump();
    },
    [pump],
  );

  const refresh = useCallback((): void => again('refresh'), [again]);

  return {
    held,
    pending: ask !== null && held.ask !== ask && refused?.ask !== ask,
    asked: pressed > 0,
    refusal: refused !== null && refused.ask === ask ? refused.refusal : null,
    want,
    refresh,
  };
}
