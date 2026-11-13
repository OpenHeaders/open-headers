/**
 * log-scope — a log tab's SCOPE: the refs whose histories the log walks
 * together. Empty = every ref (the unfiltered log); a member is a ref's
 * name or the HEAD sentinel (the checked-out commit). What a scope asks
 * of the host, what is left of it when refs go, and how the chip and
 * the tab read it. Pure.
 */

import type { WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { GIT_LOG_SCOPE_HEAD } from './git-panel-view-store';
import { refFavoriteKey } from './rail/ref-favorites';

export type GitLogScope = readonly string[];

/** The `log` verb's scope fields, wire shape. */
export interface GitLogScopeWire {
  ref?: string;
  refs?: string[];
  allRefs?: true;
}

/**
 * The verb's scope fields: every ref, the default walk (HEAD alone
 * sends nothing), one ref by the field every host reads, or several
 * walked together.
 */
export function logScopeWire(scope: GitLogScope): GitLogScopeWire {
  if (scope.length === 0) return { allRefs: true };
  if (scope.length > 1) return { refs: [...scope] };
  return scope[0] === GIT_LOG_SCOPE_HEAD ? {} : { ref: scope[0] };
}

/** The scope without the refs that went — its order kept. */
export function scopeWithout(scope: GitLogScope, gone: Iterable<string>): string[] {
  const dropped = new Set(gone);
  return scope.filter((ref) => !dropped.has(ref));
}

/** What the Branch menu's Favorites row scopes the log to: HEAD, then every favorite ref — a name once. */
export function favoritesScope(
  refs: readonly Pick<WorkspaceTreeRefWire, 'name' | 'kind'>[],
  favorites: ReadonlySet<string>,
): string[] {
  const starred = refs.filter((ref) => favorites.has(refFavoriteKey(ref.kind, ref.name))).map((ref) => ref.name);
  return [...new Set([GIT_LOG_SCOPE_HEAD, ...starred])];
}

const CHIP_TEXT_MAX = 28;
const TAB_TEXT_MAX = 30;

function shortened(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** One member reads whole; several read joined, cut to a length. */
function scopeText(scope: GitLogScope, separator: string, max: number): string | null {
  if (scope.length === 0) return null;
  return scope.length === 1 ? scope[0] : shortened(scope.join(separator), max);
}

/** The Branch chip's value — `HEAD|main`; null on the unfiltered log. */
export function scopeChipText(scope: GitLogScope): string | null {
  return scopeText(scope, '|', CHIP_TEXT_MAX);
}

/** The tab's name for its scope — `a, b, origin/c…`; null on the unfiltered log. */
export function scopeTabText(scope: GitLogScope): string | null {
  return scopeText(scope, ', ', TAB_TEXT_MAX);
}

/** Every member on a line of its own — the chip's hover while it holds several; null otherwise. */
export function scopeHoverText(scope: GitLogScope): string | null {
  return scope.length > 1 ? scope.join('\n') : null;
}
