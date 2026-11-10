/**
 * kept-local — the line a finished pull, merge, pick or revert adds
 * when the host kept the local file where both sides changed one of
 * the user's own files (`keptLocal` on the result): the paths by name,
 * the first few and an ellipsis past that. Null when the result names
 * none — the caller raises nothing.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';

/** Paths the line spells out before it trails off. */
const NAMED_PATHS = 3;

/** Paths by name for a notice: the first few, and an ellipsis past that. */
export function namePaths(paths: readonly string[]): string {
  const named = paths.slice(0, NAMED_PATHS).join(', ');
  return paths.length > NAMED_PATHS ? `${named}, …` : named;
}

export function keptLocalNotice(keptLocal: readonly string[] | undefined, t: Translate): string | null {
  if (keptLocal === undefined || keptLocal.length === 0) return null;
  return t('workbench.gitLog.keptLocal', { files: namePaths(keptLocal) });
}
