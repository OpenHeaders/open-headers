/**
 * git-binding-store — which workspaces have a workspace-tree (git)
 * binding, for the Version Control naming law: the tool window's BASE
 * identity is "Version Control"; it renames to "Git" once the active
 * workspace's directory binding exists (the IDE model — the shell is
 * VCS-neutral, per-VCS content plugs in). A thin reader over the
 * shared git status store (`git-status-store`), which hydrates lazily
 * on hosts registering `workspaceGit` and folds the status frames;
 * hosts without the capability stay empty (teaser tabs read as
 * Version Control).
 */

import { useWorkspaceGitSnapshot } from './git-status-store';

/** True when `workspaceId` has a live git binding (false while unknown). */
export function useWorkspaceGitBound(workspaceId: string | null): boolean {
  return useWorkspaceGitSnapshot(workspaceId).bound;
}
