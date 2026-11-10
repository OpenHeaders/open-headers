/**
 * kept-local — the lines a finished pull, merge, pick or revert adds
 * about the person's own work: the host kept the local file where both
 * sides changed one of the user's own files (`keptLocal` on the
 * result), committed uncommitted work first because the pass wrote its
 * file (`committedLocal`), or left part of the incoming change out
 * because the branch does not match it (`skipped`). The paths by name,
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

export function committedLocalNotice(committedLocal: readonly string[] | undefined, t: Translate): string | null {
  if (committedLocal === undefined || committedLocal.length === 0) return null;
  return t('workbench.gitLog.applyCommit.localFirst', { files: namePaths(committedLocal) });
}

export function leftOutNotice(skipped: readonly { path: string }[] | undefined, t: Translate): string | null {
  if (skipped === undefined || skipped.length === 0) return null;
  return t('workbench.gitLog.applyCommit.leftOut', { files: namePaths(skipped.map((skip) => skip.path)) });
}

/** A refusal in words: a repository another git process is writing says so, anything else is the host's own detail. */
export function refusalDetail(refusal: { reason: string; detail?: string }, t: Translate): string {
  if (refusal.reason === 'index-locked') return t('workbench.gitLog.indexLocked');
  return refusal.detail ?? refusal.reason;
}

/** Why a pull or a merge was refused, in words: files too large to resolve here say so, anything else its own detail. */
export function integrationRefusalDetail(
  refusal: { reason: string; detail?: string; conflicts?: string[]; tooLarge?: true },
  t: Translate,
): string {
  if (refusal.reason === 'conflicts' && refusal.tooLarge === true) {
    return t('workbench.gitLog.resolve.tooLarge', { files: namePaths(refusal.conflicts ?? []) });
  }
  return refusalDetail(refusal, t);
}
