/**
 * Scoring — ranks one setting's searchable fields against the query
 * terms. Pure: tokens in, number out.
 *
 * A term's score is the number of words it starts, weighted by field:
 *
 *   label         3
 *   tags          2
 *   category/sub  2
 *   description   1
 *   key           1
 *
 * EVERY term must match somewhere, so each word typed narrows the
 * result set — a term that matches nothing rules the setting out
 * instead of leaving it in on the strength of the other terms.
 */

import type { SearchableFields } from './fields';
import { termMatchesToken } from './tokens';

const FIELD_WEIGHTS: ReadonlyArray<readonly [keyof SearchableFields, number]> = [
  ['label', 3],
  ['tags', 2],
  ['category', 2],
  ['description', 1],
  ['key', 1],
];

function termScore(fields: SearchableFields, term: string): number {
  let score = 0;
  for (const [field, weight] of FIELD_WEIGHTS) {
    for (const token of fields[field]) if (termMatchesToken(token, term)) score += weight;
  }
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
