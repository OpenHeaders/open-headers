/**
 * log-neighbors — a commit's parent and child within a list of NAMED
 * commits (`CommitList`: the compare pane) — the
 * reference's Go to Parent / Go to Child Commit: the parent is the
 * commit's first parent when the list holds it, the child the nearest
 * newer commit that names it as a parent. Null at the list's edge. The
 * log's own list walks by row, as the host says (`log-row-menu-target`).
 * Pure over the entries the list shows.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';

export function parentInList(entries: readonly WorkspaceTreeLogEntryWire[], sha: string): string | null {
  const entry = entries.find((row) => row.sha === sha);
  const parent = entry?.parents[0];
  if (parent === undefined) return null;
  return entries.some((row) => row.sha === parent) ? parent : null;
}

export function childInList(entries: readonly WorkspaceTreeLogEntryWire[], sha: string): string | null {
  const index = entries.findIndex((row) => row.sha === sha);
  if (index === -1) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (entries[i].parents.includes(sha)) return entries[i].sha;
  }
  return null;
}
