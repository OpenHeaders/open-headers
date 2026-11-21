/**
 * Scoring — ranks one setting's searchable fields against the query
 * terms. Pure: tokens in, number out.
 *
 * A term's score is its token overlap, weighted by field:
 *
 *   label         3   (word prefix)
 *   tags          2   (word prefix)
 *   category/sub  2   (word prefix)
 *   description   1   (anywhere in a word)
 *   key           1   (anywhere in a word)
 *
 * EVERY term must match somewhere, so each word typed narrows the
 * result set — a term that matches nothing rules the setting out
 * instead of leaving it in on the strength of the other terms.
 */

import type { SearchableFields } from './fields';

function termScore(fields: SearchableFields, term: string): number {
  let score = 0;
  for (const token of fields.label) if (token.startsWith(term)) score += 3;
  for (const token of fields.tags) if (token.startsWith(term)) score += 2;
  for (const token of fields.category) if (token.startsWith(term)) score += 2;
  for (const token of fields.description) if (token.includes(term)) score += 1;
  for (const token of fields.key) if (token.includes(term)) score += 1;
  return score;
}

/** Total score across `terms`; 0 when any term fails to match. */
export function scoreFields(fields: SearchableFields, terms: readonly string[]): number {
  let total = 0;
  for (const term of terms) {
    const score = termScore(fields, term);
    if (score === 0) return 0;
    total += score;
  }
  return total;
}
