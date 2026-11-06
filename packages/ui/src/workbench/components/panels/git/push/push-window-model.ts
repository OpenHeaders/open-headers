/**
 * push-window-model — the Push window's pure facts off the status
 * frame: the target line (`main → origin : main`), whether the window
 * lists the commits the upstream lacks or the whole branch (the first
 * push sets the upstream on a lone remote, the host's rule), and the
 * title's folder name. No bridge, no React.
 */

import type {
  WorkspaceTreeGitStatusWire,
  WorkspaceTreeLogEntryWire,
  WorkspaceTreeRefWire,
} from '@openheaders/core/bridge';

/** One changed path of a log entry — the bridge re-exports the entry, not its file row. */
type PushFile = WorkspaceTreeLogEntryWire['files'][number];

export type PushTarget =
  /** A tracked branch — the list is what the upstream lacks. */
  | { kind: 'upstream'; branch: string; remote: string; remoteBranch: string; upstream: string }
  /** A branch with no upstream — the first push publishes it; the list is the branch's log. */
  | { kind: 'new-upstream'; branch: string }
  /** A detached HEAD — nothing to push until a branch is checked out. */
  | { kind: 'detached' }
  /** Unbound, no repo, or an unborn branch — the window has nothing to show. */
  | { kind: 'none' };

export function pushTarget(status: WorkspaceTreeGitStatusWire | null): PushTarget {
  if (status === null || !status.bound || !status.repo || status.headSha === null) return { kind: 'none' };
  if (status.branch === null) return { kind: 'detached' };
  if (status.upstream === null) return { kind: 'new-upstream', branch: status.branch };
  const cut = status.upstream.indexOf('/');
  const remote = cut === -1 ? status.upstream : status.upstream.slice(0, cut);
  const remoteBranch = cut === -1 ? status.branch : status.upstream.slice(cut + 1);
  return { kind: 'upstream', branch: status.branch, remote, remoteBranch, upstream: status.upstream };
}

/** The binding root's last path segment — the folder the title names. */
export function folderNameOf(rootDir: string | null): string {
  if (rootDir === null) return '';
  return (
    rootDir
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? ''
  );
}

/** Push is a live verb only when there is a branch and something to send. */
export function canPush(target: PushTarget, entryCount: number): boolean {
  return (target.kind === 'upstream' || target.kind === 'new-upstream') && entryCount > 0;
}

/**
 * The left pane's selection: the target row stands for every commit;
 * otherwise the selected commits (the shared selection model — a
 * range or a toggled set) with `sha` the one the details follow,
 * always a member of `shas`. Two or more show their files as one set
 * and no commit's details.
 */
export type PushSelection = 'all' | { sha: string; shas: readonly string[] };

/**
 * The files the push carries as one set — the target row's pane: every
 * commit's paths folded newest-last so a path's status reads net
 * (added then modified stays added; added then deleted leaves).
 * `entries` arrive newest first, as `log` and `compareRefs` answer.
 */
export function unionFiles(entries: readonly WorkspaceTreeLogEntryWire[]): PushFile[] {
  const byPath = new Map<string, string>();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    for (const file of entries[index].files) {
      const prior = byPath.get(file.path);
      if (prior === 'A' && file.status === 'D') {
        byPath.delete(file.path);
      } else if (prior === 'A' && file.status === 'M') {
        byPath.set(file.path, 'A');
      } else {
        byPath.set(file.path, file.status);
      }
    }
  }
  return [...byPath.entries()].map(([path, status]) => ({ path, status }));
}

/**
 * The old side of the target row's range diff: the upstream's commit
 * (its ref row's sha) when the branch tracks one, else the oldest
 * outgoing commit's first parent; null when the range starts at the
 * root (the diff then reads the head's own change, old side empty).
 */
export function rangeDiffBase(
  target: PushTarget,
  entries: readonly WorkspaceTreeLogEntryWire[],
  refs: readonly WorkspaceTreeRefWire[],
): string | null {
  if (target.kind === 'upstream') {
    return refs.find((ref) => ref.kind === 'remote' && ref.name === target.upstream)?.sha ?? null;
  }
  if (target.kind !== 'new-upstream' || entries.length === 0) return null;
  return entries[entries.length - 1].parents[0] ?? null;
}
