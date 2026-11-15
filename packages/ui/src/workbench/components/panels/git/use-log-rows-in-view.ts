/**
 * useLogRowsInView — the commits of the rows the list has mounted, for
 * a reader that asks about them as they come into view (the signature
 * column). The list reports its window on every scroll; the view is
 * told only while something reads it (`enabled`), so a scroll draws the
 * log's panes again for nothing otherwise.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type LogRowPages, type LogRowRange, logRowAt, NO_LOG_ROW_RANGE } from './log-row-pages';

export interface LogRowsInView {
  /** The commits of the mounted rows that are read — none while nothing reads them. */
  shas: readonly string[];
  /** The list's report of the rows it has mounted. */
  onWindow: (mounted: LogRowRange) => void;
}

const NO_SHAS: readonly string[] = [];

export function useLogRowsInView(held: LogRowPages, enabled: boolean): LogRowsInView {
  const [inView, setInView] = useState<LogRowRange>(NO_LOG_ROW_RANGE);
  const live = useRef({ mounted: NO_LOG_ROW_RANGE, enabled });
  live.current.enabled = enabled;

  const onWindow = useCallback((mounted: LogRowRange): void => {
    live.current.mounted = mounted;
    if (live.current.enabled) setInView(mounted);
  }, []);

  // A reader that turns on takes the window as it stands.
  useEffect(() => {
    if (enabled) setInView(live.current.mounted);
  }, [enabled]);

  const shas = useMemo(() => {
    if (!enabled) return NO_SHAS;
    const out: string[] = [];
    for (let row = inView.first; row <= inView.last; row += 1) {
      const sha = logRowAt(held, row)?.entry.sha;
      if (sha !== undefined) out.push(sha);
    }
    return out;
  }, [held, inView, enabled]);

  return { shas, onWindow };
}
