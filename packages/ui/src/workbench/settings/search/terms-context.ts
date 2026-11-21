/**
 * The active search's terms, for the rows under a results list: a row
 * paints its label's hits and explains a match its label doesn't show.
 * Outside a results list there are no terms and rows render plain.
 */

import { createContext, useContext } from 'react';

const NO_TERMS: readonly string[] = [];

export const SearchTermsContext = createContext<readonly string[]>(NO_TERMS);

export function useSearchTerms(): readonly string[] {
  return useContext(SearchTermsContext);
}
