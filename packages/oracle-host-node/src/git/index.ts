/**
 * Git plane (GIT_PLAN.md Phase 3+) — system-binary execution seam,
 * repo init/adopt, temp-index commits, identity resolution, and the
 * porcelain status feeds. Consumed by the workspace-tree runtime;
 * never by surfaces (they reach the git plane via gesture RPCs, §8).
 */

export { type CommitIntent, composeCommitMessage } from './commit-message';
export {
  type CreateGitExecOptions,
  createGitExec,
  GIT_VERSION_FLOOR,
  type GitAuditRow,
  type GitAvailability,
  type GitExecOptions,
  type GitExecResult,
  type GitRunner,
  probeGitAvailability,
} from './git-exec';
export {
  type CommitWorkspaceTreeOptions,
  type CommitWorkspaceTreeResult,
  commitWorkspaceTree,
  countDirtyFiles,
  diffForeignPaths,
  type EnsureWorkspaceRepoResult,
  ensureWorkspaceRepo,
  type FastForwardResult,
  type FetchWorkspaceRemoteResult,
  type ForeignTreeDiff,
  fastForwardWorkspaceBranch,
  fetchWorkspaceRemote,
  gitOperationInProgress,
  isWorkspaceRepo,
  listForeignAuthors,
  mergeBaseOf,
  parsePorcelainCount,
  type ResolvedCommitIdentity,
  readCommitTreeFiles,
  resolveCommitIdentity,
  resolveUpstream,
  type SyntheticCommitIdentity,
  type UpstreamState,
  userIndexHasStagedChanges,
} from './repo';
