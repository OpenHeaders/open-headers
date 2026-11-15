/**
 * Where a commit sits in a list — asked by what a person has of it: its
 * full hash, a ref's name (`HEAD` for the checked-out commit), or the
 * start of a hash. A tab finds its selected commit again this way after
 * the history moved, and Go To finds what was typed.
 */

import { historyRowOf, historyRowOfPrefix, LOG_SCOPE_HEAD } from '../../git';
import type { LogList } from './derive-list';

/** The shortest start of a hash that names a commit — git's own floor. */
const MIN_PREFIX = 4;

export type LocatedLogRow =
  | { found: true; row: number }
  /** `not-found`: the history holds no such commit. `not-listed`: it does, and the list leaves it out. */
  | { found: false; reason: 'not-found' | 'not-listed' };

export function locateLogRow(list: LogList, target: string): LocatedLogRow {
  const { generation } = list;
  const hex = target.toLowerCase();
  let row = historyRowOf(generation.history, hex);
  if (row === -1) row = target === LOG_SCOPE_HEAD ? generation.headRow : (generation.refRows.get(target) ?? -1);
  if (row === -1 && hex.length >= MIN_PREFIX) row = historyRowOfPrefix(generation.history, hex);
  if (row === -1) return { found: false, reason: 'not-found' };
  const at = list.historyRows.indexOf(row);
  return at === -1 ? { found: false, reason: 'not-listed' } : { found: true, row: at };
}
