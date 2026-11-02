/**
 * push-window-model — the Push window's pure facts off the status
 * frame: the target line (`main → origin : main`), whether the window
 * lists the commits the upstream lacks or the whole branch (the first
 * push sets the upstream on a lone remote, the host's rule), and the
 * title's folder name. No bridge, no React.
 */

import type { WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';

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
