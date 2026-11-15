/**
 * useLogSearch — the read of a text search over the whole history
 * (`oh.workspaceTree.searchLog`), for one log tab.
 *
 * The read is keyed on what it asks — the request — and on what its
 * answer stands on besides: where the refs point (`basis`). A new
 * request drops the answer it replaces at once, so the view is back on
 * its own sift until the host answers; a moved basis asks again while
 * the answer it has stands. Reads overlap and the newest one's answer
 * is the tab's.
 *
 * A host that cannot search — it predates the verb, or it refuses —
 * answers nothing here and says nothing: the log's own read reports a
 * host that is gone, and the window's sift is still true of the window.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogSearchAnswer, LogSearchRequest } from './log-search';
import { useNewestRead } from './use-newest-read';

export interface LogSearch {
  /** What the host said of the request the view holds now; null while it has said nothing. */
  answer: LogSearchAnswer | null;
  /** A search the person pressed for is out. */
  asked: boolean;
}

async function readLogSearch(request: LogSearchRequest): Promise<LogSearchAnswer | null> {
  try {
    const result = await hostBridge.call('oh.workspaceTree.searchLog', request);
    if (result.ok) return { kind: 'page', entries: result.entries, more: result.more };
    return result.reason === 'search-timeout' ? { kind: 'timeout' } : null;
  } catch {
    return null;
  }
}

/**
 * `request` is null while there is nothing to ask the host; it and
 * `basis` are compared as they stand, so the caller holds each still
 * while what it says has not changed. `press` changes when the person
 * pressed for the search (the text applied, Refresh) — a read begun by
 * it counts as asked; one begun by anything else is the tab following
 * along.
 */
export function useLogSearch(request: LogSearchRequest | null, basis: string, press: string): LogSearch {
  const beginRead = useNewestRead();
  const [held, setHeld] = useState<{ request: LogSearchRequest; answer: LogSearchAnswer } | null>(null);
  const [out, setOut] = useState(0);
  const pressed = useRef(press);
  // One read: what it asks, under what its answer stands on.
  const read = useMemo(() => ({ request, basis }), [request, basis]);

  useEffect(() => {
    const superseded = beginRead();
    const byPress = pressed.current !== press;
    pressed.current = press;
    const asking = read.request;
    if (asking === null) {
      setHeld(null);
      return;
    }
    if (byPress) setOut((count) => count + 1);
    void readLogSearch(asking).then((answer) => {
      if (byPress) setOut((count) => count - 1);
      if (!superseded()) setHeld(answer === null ? null : { request: asking, answer });
    });
  }, [beginRead, read, press]);

  return { answer: held !== null && held.request === request ? held.answer : null, asked: out > 0 };
}
