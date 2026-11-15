/**
 * useLogEntrance — where the list a tab asks for is entered
 * (`log-entrance.ts`): the row of the tab's commit in it, asked of the
 * host the moment another listing is asked, before any of its rows is
 * read.
 *
 * A listing is entered ONCE: the answer stands while the listing does,
 * whatever the tab's commit becomes after — a fold, a frame of the repo
 * and a history read anew enter nothing. While the row is being found a
 * newer ask of the same listing, or another commit, asks again; a host
 * that does not answer enters the list from its top.
 */

import { useEffect, useMemo, useState } from 'react';
import { type LogEntrance, type LogEntranceState, logEntranceAtTop, logEntranceFound } from './log-entrance';
import { locateLogRow } from './log-row-locate';
import type { LogRowsAsk } from './log-row-pages';
import { logListingName } from './log-rows-ask';
import { useNewestRead } from './use-newest-read';

/** `ask` is null while there is nothing to list; `sha` is the commit to enter on, null to enter from the top. */
export function useLogEntrance(ask: LogRowsAsk | null, sha: string | null): LogEntranceState {
  const beginRead = useNewestRead();
  const [found, setFound] = useState<{ listing: string; entrance: LogEntrance } | null>(null);
  const listing = useMemo(() => (ask === null ? null : logListingName(ask)), [ask]);
  const entered = found !== null && found.listing === listing;

  useEffect(() => {
    const superseded = beginRead();
    if (ask === null || listing === null) {
      setFound(null);
      return;
    }
    if (entered) return;
    if (sha === null) {
      setFound({ listing, entrance: logEntranceAtTop(ask) });
      return;
    }
    void locateLogRow(ask, sha).then((answer) => {
      if (!superseded()) setFound({ listing, entrance: logEntranceFound(ask, sha, answer) });
    });
  }, [beginRead, ask, listing, entered, sha]);

  if (ask === null) return null;
  return found !== null && found.listing === listing ? found.entrance : 'finding';
}
