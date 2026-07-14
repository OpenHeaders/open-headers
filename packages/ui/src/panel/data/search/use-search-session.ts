/**
 * Persistent search-session state.
 *
 * `SearchPanel` mounts and unmounts as the user toggles the Search
 * tool window. If session state lived there, closing the panel would
 * discard the user's query, draft config, source chips, and streamed
 * results.
 *
 * This hook bundles everything the panel treats as "my session" and
 * is meant to be called at a stable ancestor (App-level) so state
 * survives panel teardown. SearchPanel receives the session as a
 * single prop and becomes presentational.
 */

import { useCallback, useMemo, useState } from 'react';
import type { InspectorRow } from '../inspector-facet';
import { DEFAULT_TEXT_MATCH_CONFIG, type TextMatchConfig } from '../text-match';
import { ALL_SEARCH_SOURCES, type SearchSourceKind } from './search-doc';
import { type SearchDocProviders, type UseSearchResult, useSearch } from './use-search';

export interface SearchSession {
  /** Committed search state machine — state, run, cancel. */
  search: UseSearchResult;
  /** User's in-progress query text (before Enter / Search). */
  draftQuery: string;
  setDraftQuery: (q: string) => void;
  /** User's in-progress filter config (match-case, whole-word, regex). */
  draftConfig: TextMatchConfig;
  setDraftConfig: (c: TextMatchConfig) => void;
  /** Source chips (Network / Storage / Console). Never empty. */
  draftSources: ReadonlyArray<SearchSourceKind>;
  /** Toggle one source chip — a no-op when it is the last one active
   *  (at least one source stays selected, browser-filter-strip rule). */
  toggleDraftSource: (kind: SearchSourceKind) => void;
}

export function useSearchSession(rows: readonly InspectorRow[], providers?: SearchDocProviders): SearchSession {
  const search = useSearch(rows, providers);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftConfig, setDraftConfig] = useState<TextMatchConfig>(DEFAULT_TEXT_MATCH_CONFIG);
  const [draftSources, setDraftSources] = useState<ReadonlyArray<SearchSourceKind>>(ALL_SEARCH_SOURCES);
  const toggleDraftSource = useCallback((kind: SearchSourceKind) => {
    setDraftSources((prev) => {
      if (prev.includes(kind)) {
        return prev.length > 1 ? prev.filter((s) => s !== kind) : prev;
      }
      // Keep the canonical order regardless of click order.
      return ALL_SEARCH_SOURCES.filter((s) => s === kind || prev.includes(s));
    });
  }, []);
  // Identity-stable API object — consumers key render callbacks and effects
  // on it, so a fresh literal per render would cascade re-renders.
  return useMemo(
    () => ({ search, draftQuery, setDraftQuery, draftConfig, setDraftConfig, draftSources, toggleDraftSource }),
    [search, draftQuery, draftConfig, draftSources, toggleDraftSource],
  );
}
