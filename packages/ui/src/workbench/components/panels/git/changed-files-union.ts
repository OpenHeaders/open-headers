/**
 * changed-files-union — two or more commits read as ONE change set (the
 * reference reading, shared by the log's details pane and the Push
 * window's target row): every commit's paths folded newest-last so a
 * path's status reads net, and the range a selection diffs as when it
 * is exactly the commits between its newest and its base (its oldest
 * commit's first parent) — a merge's side commits included or the range
 * refused. Pure; no bridge, no React.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';

/** One changed path of a log entry — the bridge re-exports the entry, not its file row. */
export type ChangedFile = WorkspaceTreeLogEntryWire['files'][number];

/** A path of the set, with the newest of the commits that changed it. */
export type UnionFile = ChangedFile & { sha: string };

/**
 * The commits' files as one set: every commit's paths folded newest-last
 * so a path's status reads net (added then modified stays added; added
 * then deleted leaves), each with the newest commit that changed it.
 * `entries` arrive newest first, as `log` and `compareRefs` answer.
 */
export function unionFiles(entries: readonly WorkspaceTreeLogEntryWire[]): UnionFile[] {
  const byPath = new Map<string, { status: string; sha: string }>();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const { sha } = entries[index];
    for (const file of entries[index].files) {
      const prior = byPath.get(file.path)?.status;
      if (prior === 'A' && file.status === 'D') {
        byPath.delete(file.path);
      } else {
        byPath.set(file.path, { status: prior === 'A' && file.status === 'M' ? 'A' : file.status, sha });
      }
    }
  }
  return [...byPath.entries()].map(([path, { status, sha }]) => ({ path, status, sha }));
}

export interface ParentedEntry {
  sha: string;
  parents: readonly string[];
}

/**
 * The old side of a selection's range diff: the oldest selected commit's
 * first parent, when the commits reachable from the newest selected
 * commit down to (not including) that parent are EXACTLY the selected
 * ones — then the diff from the base to the newest commit is the
 * selection's change and nothing else. Null for a set with a gap (a
 * skipped commit, a merge whose side commits are not selected), a walk
 * that leaves the loaded window, a selection that starts at the root
 * (no honest old side), or fewer than two commits. `shas` arrive in
 * list order, newest first.
 */
export function contiguousRangeBase(shas: readonly string[], entries: readonly ParentedEntry[]): string | null {
  if (shas.length < 2) return null;
  const bySha = new Map(entries.map((entry) => [entry.sha, entry]));
  const base = bySha.get(shas[shas.length - 1])?.parents[0];
  if (base === undefined) return null;
  const selected = new Set(shas);
  const seen = new Set<string>();
  const queue = [shas[0]];
  while (queue.length > 0) {
    const sha = queue.pop() as string;
    if (sha === base || seen.has(sha)) continue;
    if (!selected.has(sha)) return null;
    const entry = bySha.get(sha);
    if (entry === undefined) return null;
    seen.add(sha);
    queue.push(...entry.parents);
  }
  return seen.size === selected.size ? base : null;
}
