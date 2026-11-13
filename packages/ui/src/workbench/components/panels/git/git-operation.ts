/**
 * git-operation — the git operation a working tree is mid-way through
 * (a rebase, a merge, a cherry-pick, a revert, a bisect started outside
 * the app, read off the status frame), and the words for it: what the
 * branch widget reads while it stands, and what its one verb — git's
 * own abort — is called. Pure.
 */

import type { WorkspaceTreeGitOperationWire, WorkspaceTreeGitStatusWire } from '@openheaders/core/bridge';

/** The operation in progress; null at rest, and from a host that does not say. */
export function gitOperationOf(status: WorkspaceTreeGitStatusWire | null): WorkspaceTreeGitOperationWire | null {
  return status?.bound === true ? (status.operation ?? null) : null;
}

/** What the widget reads while an operation stands — each takes the `branch` it stands in. */
export const GIT_OPERATION_READINGS = {
  rebase: 'workbench.gitBranch.widget.operation.rebase',
  merge: 'workbench.gitBranch.widget.operation.merge',
  'cherry-pick': 'workbench.gitBranch.widget.operation.cherryPick',
  revert: 'workbench.gitBranch.widget.operation.revert',
  bisect: 'workbench.gitBranch.widget.operation.bisect',
} as const satisfies Record<WorkspaceTreeGitOperationWire, string>;

/** The way out of each, as its row and its confirm name it. */
export const GIT_OPERATION_ABORTS = {
  rebase: 'workbench.gitBranch.abort.rebase',
  merge: 'workbench.gitBranch.abort.merge',
  'cherry-pick': 'workbench.gitBranch.abort.cherryPick',
  revert: 'workbench.gitBranch.abort.revert',
  bisect: 'workbench.gitBranch.abort.bisect',
} as const satisfies Record<WorkspaceTreeGitOperationWire, string>;
