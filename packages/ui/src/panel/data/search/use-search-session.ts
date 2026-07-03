/**
 * Persistent search-session state.
 *
 * `SearchPanel` mounts and unmounts as the user toggles the Search
 * tool window. If session state lived there, closing the panel would
 * discard the user's query, draft config, and streamed results.
 *
 * This hook bundles everything the panel treats as "my session" and
 * is meant to be called at a stable ancestor (App-level) so state
 * survives panel teardown. SearchPanel receives the session as a
 * single prop and becomes presentational.
 */

import { useState } from 'react';
import { DEFAULT_FILTER_CONFIG, type FilterConfig } from '../filter-engine';
import type { InspectorRow } from '../inspector-facet';
import { type UseSearchResult, useSearch } from './use-search';

export interface SearchSession {
  /** Committed search state machine — state, run, cancel. */
  search: UseSearchResult;
  /** User's in-progress query text (before Enter / Search). */
  draftQuery: string;
  setDraftQuery: (q: string) => void;
  /** User's in-progress filter config (match-case, whole-word, regex). */
  draftConfig: FilterConfig;
  setDraftConfig: (c: FilterConfig) => void;
}

export function useSearchSession(rows: readonly InspectorRow[]): SearchSession {
  const search = useSearch(rows);
  const [draftQuery, setDraftQuery] = useState('');
  const [draftConfig, setDraftConfig] = useState<FilterConfig>(DEFAULT_FILTER_CONFIG);
  return { search, draftQuery, setDraftQuery, draftConfig, setDraftConfig };
}
