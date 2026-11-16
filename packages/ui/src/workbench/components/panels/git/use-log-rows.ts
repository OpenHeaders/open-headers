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
 *
 * A list that is ENTERED (`log-entrance.ts`) — another listing than the
 * one drawn — is first read around the row the view will stand on, and
 * not before that row is found: no read goes to where the list before
 * was looked at. Any other first read (a fold, the same listing asked
 * again) is where the view stands. A list the host refused where it
 * was to be entered is refused as if a read had been: no row of it is
 * read until it is asked again — a press of Refresh, a frame — and then
 * from its top.
 *
 * A list refused as OUT OF TIME (`logRefusalOutOfTime`) is asked again
 * on the press alone: a frame would have the host run its whole wait
 * again, for an answer the frame did not change.
 */

import { hostBridge, type WorkspaceTreeLogRowsWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type LogEntranceState, logEntranceRefusal } from './log-entrance';
import {
  type LogRowPages,
  type LogRowRange,
  type LogRowStretch,
  type LogRowsAsk,
  type LogRowsRefusal,
  logReadOver,
  logRefusalOutOfTime,
  logRowsAround,
  NO_LOG_ROW_RANGE,
  NO_LOG_ROWS,
  nextLogRead,
  takeLogRows,
} from './log-row-pages';
import { useNewestRead } from './use-newest-read';

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
  entrance: LogEntranceState;
  held: LogRowPages;
  mounted: LogRowRange;
  /** The ask of the read that is out. */
  out: LogRowsAsk | null;
  /** The ask the host refused — not asked again by a scroll. */
  refused: LogRowsAsk | null;
  /** What `refused` was refused as: out of time — not asked again by a frame either. */
  spent: boolean;
  /** A press of Refresh made while the list's entrance was being found: the ask's next read carries it. */
  owed: 'refresh' | null;
}

/** A list's first read where it is entered: the stretch, and the rows the view will stand on. */
interface EntranceRead {
  stretch: LogRowStretch;
  enters: LogRowRange;
  /** What the host refused the list with when asked where it is entered; null for a list that is entered. */
  refusal: LogRowsRefusal | null;
}

/**
 * The first read of the ask's list where that list is ENTERED: null
 * while the row it is entered at is being found, `undefined` where
 * nothing is entered — the ask's rows are held, or its list is the
 * listing drawn (a fold): that read is where the view stands.
 */
function entranceRead(state: Live): EntranceRead | null | undefined {
  const { ask, entrance, held, mounted } = state;
  if (ask === null || held.ask === ask || entrance === null) return undefined;
  if (entrance === 'finding') return null;
  if (entrance.ask !== ask) return undefined;
  const enters = logRowsAround(entrance.row ?? 0, mounted);
  return { stretch: logReadOver(enters), enters, refusal: logEntranceRefusal(entrance) };
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

/**
 * `ask` is null while there is nothing to list; it is compared as it
 * stands, so the caller holds it still. `entrance` is where the ask's
 * list is entered (`use-log-entrance.ts`).
 */
export function useLogRows(ask: LogRowsAsk | null, entrance: LogEntranceState): LogRows {
  const beginRead = useNewestRead();
  const [held, setHeld] = useState<LogRowPages>(NO_LOG_ROWS);
  const [refused, setRefused] = useState<{ ask: LogRowsAsk; refusal: LogRowsRefusal } | null>(null);
  const [pressed, setPressed] = useState(0);
  const live = useRef<Live>({
    ask,
    entrance,
    held: NO_LOG_ROWS,
    mounted: NO_LOG_ROW_RANGE,
    out: null,
    refused: null,
    spent: false,
    owed: null,
  });
  live.current.ask = ask;
  live.current.entrance = entrance;

  const refuse = useCallback((asking: LogRowsAsk, refusal: LogRowsRefusal): void => {
    live.current.refused = asking;
    live.current.spent = logRefusalOutOfTime(refusal);
    setRefused({ ask: asking, refusal });
  }, []);

  const send = useCallback(
    (asking: LogRowsAsk, stretch: LogRowStretch, press: 'refresh' | null, enters: LogRowRange | null): void => {
      const superseded = beginRead();
      const state = live.current;
      state.out = asking;
      state.refused = null;
      state.owed = null;
      if (press !== null) setPressed((count) => count + 1);
      void readLogRows(asking, stretch, press === 'refresh').then((answer) => {
        if (press !== null) setPressed((count) => count - 1);
        if (superseded()) return;
        state.out = null;
        if (answer.ok) {
          // A list entered is looked at where its first rows were read: the view stands there from its first draw.
          if (enters !== null) state.mounted = enters;
          state.held = takeLogRows(state.held, asking, stretch.from, answer, state.mounted);
          setHeld(state.held);
          setRefused(null);
        } else if (answer.reason !== 'superseded') {
          refuse(asking, answer);
        }
      });
    },
    [beginRead, refuse],
  );

  const pump = useCallback((): void => {
    const state = live.current;
    if (state.ask === null || state.out === state.ask || state.refused === state.ask) return;
    const entering = entranceRead(state);
    if (entering === null) return;
    if (entering !== undefined) {
      // A list refused where it was to be entered is read only on the person's word: a press made meanwhile is one.
      if (entering.refusal !== null && state.owed === null) refuse(state.ask, entering.refusal);
      else send(state.ask, entering.stretch, state.owed, entering.enters);
      return;
    }
    const stretch = nextLogRead(state.held, state.ask, state.mounted);
    if (stretch !== null) send(state.ask, stretch, state.owed, null);
  }, [send, refuse]);

  // The same ask read again where the view stands — it ends the read that is out. A list whose entrance is
  // being found has no read to end: a press waits for the entrance's. A list that ran out of time is asked
  // again on the press alone.
  const again = useCallback(
    (press: 'refresh' | null): void => {
      const state = live.current;
      if (state.ask === null) return;
      if (press === null && state.spent && state.refused === state.ask) return;
      const entering = entranceRead(state);
      if (entering === null) {
        state.owed = press ?? state.owed;
        return;
      }
      if (entering !== undefined) send(state.ask, entering.stretch, press ?? state.owed, entering.enters);
      else send(state.ask, logReadOver(state.mounted), press ?? state.owed, null);
    },
    [send],
  );

  // A new ask is read at once — a list entered, once its entrance is found; an answer taken is followed by
  // the rows the view moved to meanwhile.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `held` is the answer landing, `entrance` the row found
  useEffect(() => {
    if (ask !== null) pump();
  }, [ask, entrance, held, pump]);

  // Nothing to list: a read that is out answers no one.
  useEffect(() => {
    if (ask !== null) return;
    const state = live.current;
    beginRead();
    state.out = null;
    state.owed = null;
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
