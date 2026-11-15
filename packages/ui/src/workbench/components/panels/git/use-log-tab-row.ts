/**
 * useLogTabRow — the tab's ONE commit as a row of the list drawn
 * (`log-tab-row.ts`), and the navigations that move it.
 *
 * A gesture on the list knows its row. Anything else is asked of the
 * host (`oh.workspaceTree.locateLogRow`), one ask at a time: a commit
 * gone to by its hash, a ref or the start of a hash (`goTo`) first,
 * else the tab's commit whenever its row in the held list is not known
 * — a list read anew, another ask, a tab that mounts with a commit. An
 * answer for another list than the held one is no answer; the held
 * list's change asks again.
 *
 * A listing — what is asked before its folds — is looked at from its
 * top: a new one brings the list there at once, and once its rows are
 * held, to the tab's commit where it lists it. A fold, a frame of the
 * repo and a history read anew move nothing.
 */

import { hostBridge, type WorkspaceTreeLocateLogRowWire } from '@openheaders/core/bridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogRowPages, LogRowsAsk } from './log-row-pages';
import {
  type LogTabRow,
  tabRowAt,
  tabRowFound,
  tabRowIn,
  tabRowLeftOut,
  tabRowRead,
  tabRowToLocate,
  tabRowUnlisted,
} from './log-tab-row';
import { isFullCommitSha } from './short-sha';
import { useNewestRead } from './use-newest-read';

/** What became of a navigation: the commit is on a row, the history holds none such, or this list leaves it out. */
export type LogGoToOutcome = 'found' | 'not-found' | 'not-listed';

export interface LogTabRowApi {
  /** The row the list selects as the tab's; null for none, or one not known. */
  row: number | null;
  /** The tab has a commit whose row in the held list is being asked. */
  finding: boolean;
  /** The list's own report — the details row after a gesture, null when nothing stays selected. */
  select: (row: number | null) => void;
  /** Go to a row of the list drawn: it becomes the tab's and comes into view. */
  walkTo: (row: number) => void;
  /**
   * Go to a commit by its hash, the start of one, or a ref's name. With
   * `take`, a commit named by its full hash becomes the tab's even where
   * the list leaves it out.
   */
  goTo: (target: string, take: boolean) => Promise<LogGoToOutcome>;
  /** The row to bring into view; the nonce tells one navigation from the next. */
  scrollTo: { row: number; nonce: number } | null;
}

interface Wanted {
  target: string;
  take: boolean;
  settle: (outcome: LogGoToOutcome) => void;
}

async function locate(ask: LogRowsAsk, target: string): Promise<WorkspaceTreeLocateLogRowWire> {
  try {
    return await hostBridge.call('oh.workspaceTree.locateLogRow', { ...ask, target });
  } catch (fault) {
    return { ok: false, reason: 'log-failed', detail: fault instanceof Error ? fault.message : String(fault) };
  }
}

/**
 * `held` is the list drawn; `listing` names what the person is looking
 * at (null while nothing is asked) and `landed` says the held rows are
 * its own; `sha` is the tab's commit and `setSha` gives the tab another.
 */
export function useLogTabRow(
  held: LogRowPages,
  listing: string | null,
  landed: boolean,
  sha: string | null,
  setSha: (sha: string | null) => void,
): LogTabRowApi {
  const beginRead = useNewestRead();
  const [known, setKnown] = useState<LogTabRow | null>(null);
  const [wanted, setWanted] = useState<Wanted | null>(null);
  const [scrollTo, setScrollTo] = useState<{ row: number; nonce: number } | null>(null);
  const live = useRef({ held, sha, setSha });
  live.current = { held, sha, setSha };

  const reveal = useCallback(
    (row: number): void => setScrollTo((prev) => ({ row, nonce: (prev?.nonce ?? 0) + 1 })),
    [],
  );

  const select = useCallback((row: number | null): void => {
    const now = live.current;
    const next = row === null ? null : tabRowAt(now.held, row);
    setKnown(next);
    const commit = row === null ? null : (next?.sha ?? now.sha);
    if (commit !== now.sha) now.setSha(commit);
  }, []);

  const walkTo = useCallback(
    (row: number): void => {
      select(row);
      reveal(row);
    },
    [select, reveal],
  );

  const going = useRef<Wanted | null>(null);
  const goTo = useCallback(
    (target: string, take: boolean): Promise<LogGoToOutcome> =>
      new Promise((settle) => {
        // A navigation a newer one replaces found nothing.
        going.current?.settle('not-found');
        going.current = { target, take, settle };
        setWanted(going.current);
      }),
    [],
  );
  const arrived = useCallback((navigation: Wanted, outcome: LogGoToOutcome): void => {
    navigation.settle(outcome);
    if (going.current === navigation) going.current = null;
    setWanted((prev) => (prev === navigation ? null : prev));
  }, []);

  // A row walked to gives the tab its commit when its page lands.
  useEffect(() => {
    const read = tabRowRead(known, held);
    if (read === null) return;
    setKnown(read);
    if (read.sha !== live.current.sha) live.current.setSha(read.sha);
  }, [known, held]);

  const { ask, list } = held;
  const target = wanted?.target ?? tabRowToLocate(known, held, sha);
  // One ask at a time, under the held list's two names: a change of either asks again.
  useEffect(() => {
    const superseded = beginRead();
    if (ask === null || list === null) {
      // No list is held: there is nowhere to go.
      if (wanted !== null) arrived(wanted, 'not-found');
      return;
    }
    if (target === null) return;
    void locate(ask, target).then((answer) => {
      if (superseded() || (!answer.ok && answer.reason === 'superseded')) return;
      const now = live.current;
      const named = isFullCommitSha(target) ? target : null;
      if (answer.ok) {
        const found = tabRowFound(now.held, ask, answer.list, answer.row, named);
        if (found === null) return;
        setKnown(found);
        if (wanted === null) return;
        if (found.sha !== null && found.sha !== now.sha) now.setSha(found.sha);
        if (found.row !== null) reveal(found.row);
        arrived(wanted, 'found');
      } else if (wanted === null) {
        // The list leaves the tab's commit out — or the host cannot say: it stays the tab's and selects no row.
        setKnown(tabRowLeftOut(now.held, target));
      } else {
        if (wanted.take && named !== null) {
          setKnown(tabRowLeftOut(now.held, named));
          if (named !== now.sha) now.setSha(named);
        }
        arrived(wanted, answer.reason === 'not-listed' ? 'not-listed' : 'not-found');
      }
    });
  }, [beginRead, target, ask, list, wanted, reveal, arrived]);

  // Another listing is looked at from its top — at once, over whatever rows are still drawn.
  const looked = useRef(listing);
  useEffect(() => {
    if (listing === looked.current) return;
    looked.current = listing;
    if (listing !== null) reveal(0);
  }, [listing, reveal]);

  // Once its rows are held: on the tab's commit, where the list has it.
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (listing === null || listing === shown.current || !landed) return;
    if (tabRowToLocate(known, held, sha) !== null) return;
    shown.current = listing;
    const row = tabRowIn(known, held, sha);
    if (row !== null) reveal(row);
  }, [listing, landed, known, held, sha, reveal]);

  return {
    row: tabRowIn(known, held, sha),
    finding: sha !== null && !tabRowUnlisted(known, held, sha) && tabRowIn(known, held, sha) === null,
    select,
    walkTo,
    goTo,
    scrollTo,
  };
}
