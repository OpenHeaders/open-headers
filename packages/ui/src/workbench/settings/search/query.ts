/**
 * Query parsing — splits the raw search input into filter tokens
 * (`@modified`, `@deprecated`) and the text terms left over.
 */

import { tokenize } from './tokens';

export const FILTER_MODIFIED = '@modified';
export const FILTER_DEPRECATED = '@deprecated';

export interface SettingsSearchQuery {
  /** Text terms. A setting matches only when every term matches it. */
  terms: readonly string[];
  modifiedOnly: boolean;
  deprecatedOnly: boolean;
}

export function parseSearchQuery(raw: string): SettingsSearchQuery {
  let modifiedOnly = false;
  let deprecatedOnly = false;
  const text: string[] = [];
  for (const word of raw.trim().split(/\s+/)) {
    const lower = word.toLowerCase();
    if (lower === FILTER_MODIFIED) modifiedOnly = true;
    else if (lower === FILTER_DEPRECATED) deprecatedOnly = true;
    else text.push(word);
  }
  return { terms: tokenize(text.join(' ')), modifiedOnly, deprecatedOnly };
}
