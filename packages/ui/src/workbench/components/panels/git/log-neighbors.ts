/**
 * log-neighbors — a commit's parent and child within the loaded log
 * window (the reference's Go to Parent / Go to Child Commit): the
 * parent is the commit's first parent when its row is in the window,
 * the child the nearest newer commit that names it as a parent. Null
 * at the window's edge. Pure over the entries the list shows.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';

export function parentInWindow(entries: readonly WorkspaceTreeLogEntryWire[], sha: string): string | null {
  const entry = entries.find((row) => row.sha === sha);
  const parent = entry?.parents[0];
  if (parent === undefined) return null;
  return entries.some((row) => row.sha === parent) ? parent : null;
}

export function childInWindow(entries: readonly WorkspaceTreeLogEntryWire[], sha: string): string | null {
  const index = entries.findIndex((row) => row.sha === sha);
  if (index === -1) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (entries[i].parents.includes(sha)) return entries[i].sha;
  }
  return null;
}

/** A full 40-hex commit id — what the host verbs take as a start point beside a ref name. */
export function isFullCommitSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value);
}
