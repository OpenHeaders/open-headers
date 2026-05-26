/**
 * `useSearch` — React state machine for the panel's search feature.
 *
 * Explicit states:
 *
 *   - `idle`     no search has been launched (or panel just opened)
 *   - `running`  a scan is in progress; results stream in per chunk
 *   - `done`     scan completed; results are final
 *
 * The actual scan runs off-thread in a Web Worker (see `search-client`).
 * This hook owns only UI-visible state: the current status, the
 * committed query/config the results correspond to, the streaming
 * results, and progress. It does no searching itself.
 *
 * Submitting a new query preempts the previous run. A per-run
 * `disposed` flag in closure (installed into a ref so the next
 * `run()` call can flip it) ensures that late microtask flushes from
 * a superseded run never leak into the new state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_FILTER_CONFIG, type FilterConfig } from './filter-engine';
import type { InspectorRow } from './inspector-facet';
import { getDefaultSearchClient, type SearchHandle } from './search-client';
import type { SearchGroup, SearchProgress } from './search-engine';

export type SearchStatus = 'idle' | 'running' | 'done';

export interface SearchState {
  status: SearchStatus;
  /** The query the current results correspond to. Empty while idle. */
  committedQuery: string;
  /** The config the current results were computed with. */
  committedConfig: FilterConfig;
  /** Partial (while running) or final (when done) groups. */
  results: readonly SearchGroup[];
  /** Progress of the current or most recent run. */
  progress: SearchProgress;
}

const ZERO_PROGRESS: SearchProgress = { done: 0, total: 0, elapsedMs: 0 };

export interface UseSearchResult {
  state: SearchState;
  /** Commit a query — aborts any in-flight search and starts a new one. */
  run: (query: string, config: FilterConfig) => void;
  /** Abort the in-flight search. No-op when idle/done. */
  cancel: () => void;
}

const INITIAL_STATE: SearchState = {
  status: 'idle',
  committedQuery: '',
  committedConfig: DEFAULT_FILTER_CONFIG,
  results: [],
  progress: ZERO_PROGRESS,
};

export function useSearch(rows: readonly InspectorRow[]): UseSearchResult {
  const [state, setState] = useState<SearchState>(INITIAL_STATE);
  const handleRef = useRef<SearchHandle | null>(null);
  const disposeCurrentRef = useRef<(() => void) | null>(null);

  const endCurrentRun = useCallback(() => {
    disposeCurrentRef.current?.();
    disposeCurrentRef.current = null;
    handleRef.current?.abort();
    handleRef.current = null;
  }, []);

  // Abort on unmount so a heavy scan doesn't keep running after the
  // panel closes. The worker itself stays alive — it's shared across
  // panel mounts — but this session's subscription is torn down.
  useEffect(() => {
    return () => {
      endCurrentRun();
    };
  }, [endCurrentRun]);

  const cancel = useCallback(() => {
    endCurrentRun();
    setState(INITIAL_STATE);
  }, [endCurrentRun]);

  // Auto-cancel if the inspector is cleared mid-search (navigation,
  // Clear button). The worker has its own structured-cloned snapshot
  // so it would happily keep scanning and return results for row
  // ids the UI no longer knows about — click-to-navigate would then
  // silently no-op. Cleaner to drop the search and let the user re-run.
  const statusRef = useRef(state.status);
  statusRef.current = state.status;
  useEffect(() => {
    if (rows.length === 0 && statusRef.current === 'running') {
      cancel();
    }
  }, [rows.length, cancel]);

  const run = useCallback(
    (query: string, config: FilterConfig) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        endCurrentRun();
        setState({ ...INITIAL_STATE, committedQuery: trimmed, committedConfig: config });
        return;
      }

      endCurrentRun();

      setState({
        status: 'running',
        committedQuery: trimmed,
        committedConfig: config,
        results: [],
        progress: { done: 0, total: rows.length, elapsedMs: 0 },
      });

      const batch: SearchGroup[] = [];
      let latestProgress: SearchProgress = { done: 0, total: rows.length, elapsedMs: 0 };
      let flushScheduled = false;
      let disposed = false;

      disposeCurrentRef.current = () => {
        disposed = true;
      };

      const flush = (finalStatus?: SearchStatus) => {
        flushScheduled = false;
        if (disposed) return;
        setState((prev) => {
          const merged = batch.length ? prev.results.concat(batch) : prev.results;
          batch.length = 0;
          return {
            ...prev,
            status: finalStatus ?? prev.status,
            results: merged,
            progress: latestProgress,
          };
        });
      };

      const scheduleFlush = (finalStatus?: SearchStatus) => {
        if (finalStatus) {
          flush(finalStatus);
          return;
        }
        if (flushScheduled) return;
        flushScheduled = true;
        queueMicrotask(() => flush());
      };

      const handle = getDefaultSearchClient().submit(rows, trimmed, config, {
        onGroup: (g) => {
          if (disposed) return;
          batch.push(g);
          scheduleFlush();
        },
        onProgress: (p) => {
          if (disposed) return;
          latestProgress = p;
          scheduleFlush();
        },
        onDone: (p) => {
          if (disposed) return;
          latestProgress = p;
          scheduleFlush('done');
          disposed = true;
          if (handleRef.current === handle) {
            handleRef.current = null;
            disposeCurrentRef.current = null;
          }
        },
      });
      handleRef.current = handle;
    },
    [rows, endCurrentRun],
  );

  return { state, run, cancel };
}
