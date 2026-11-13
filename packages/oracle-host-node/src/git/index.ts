/**
 * Git plane (the git-sync plan Phase 3+) — system-binary execution seam,
 * repo init/adopt, temp-index commits, identity resolution, and the
 * porcelain status feeds. Consumed by the workspace-tree runtime;
 * never by surfaces (they reach the git plane via gesture RPCs, §8).
 */

export { isStateChanging, subcommandOf } from './audit-classify';
export {
  type BranchCreateResult,
  type BranchDeleteResult,
  type BranchUpdateResult,
  type CreateLocalBranchOptions,
  createLocalBranch,
  deleteLocalBranch,
  type FetchAllRemotesResult,
  fetchAllRemotes,
  listCommitRangeLog,
  updateBranchFromUpstream,
} from './branch-ops';
export { type CommitIntent, composeCommitMessage } from './commit-message';
export { type CommitMeta, type CommitPerson, readCommitAuthorIdentity, readCommitMeta } from './commit-meta';
export { type GitDirs, parseGitfile, resolveGitDirs } from './git-dir';
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
  type AddIgnoreEntryResult,
  addIgnoreEntry,
  checkIgnoreProvenance,
  type IgnoreProvenance,
  type IgnoreTarget,
  type RemoveIgnoreEntryResult,
  removeIgnoreEntry,
} from './ignore-ops';
export { type HeldIndexLock, type IndexLockRefusal, lockRefusalReason, withIndexLock } from './index-lock';
export { type AbortGitOperationResult, abortGitOperation, type GitOperation, gitOperationKind } from './operation';
export { type CommitParentChange, type CommitParentChanges, readCommitParentChanges } from './parent-changes';
export {
  COMMIT_PATCH_MAX_BYTES,
  COMMIT_PATCH_MAX_COMMITS,
  type CommitPatchResult,
  readCommitPatch,
} from './patch-ops';
export { composePickMessage, composeRevertMessage } from './pick-message';
export {
  addRemote,
  isSafeRemoteName,
  isSafeRemoteUrl,
  listRemotes,
  type RemoteOpResult,
  type RepoRemote,
  removeRemote,
  renameRemote,
  setRemoteUrl,
} from './remote-ops';
export {
  type BranchOpResult,
  COMMIT_FILE_DIFF_MAX_BYTES,
  type CommitFileDiff,
  type CommitFileDiffResult,
  type CommitLogEntry,
  type CommitLogFileChange,
  type CommitLogFilters,
  type CommitUserAttribution,
  type CommitWorkspaceTreeOptions,
  type CommitWorkspaceTreeResult,
  type CreateRescueBranchResult,
  checkoutWorkspaceBranch,
  cleanUntracked,
  commitParents,
  commitWorkspaceTree,
  countDirtyFiles,
  countLeftRight,
  createAndSwitchBranch,
  createRescueBranch,
  currentBranch,
  diffForeignPaths,
  type EnsureWorkspaceRepoResult,
  ensureWorkspaceRepo,
  type FastForwardResult,
  type FetchWorkspaceRemoteResult,
  type ForeignTreeDiff,
  fastForwardWorkspaceBranch,
  fetchWorkspaceRemote,
  gitOperationInProgress,
  hasLocalBranch,
  type IntentToAddResult,
  intentToAddPaths,
  isAncestorOf,
  isCommitSha,
  isSafeRefName,
  isSafeTreePath,
  isShallowRepository,
  isWorkspaceRepo,
  type LeftRightCounts,
  listCommitLog,
  listFileLog,
  listForeignAuthors,
  listLocalBranches,
  listRepoRefs,
  listTags,
  listTreeYamlPaths,
  listWorkingChanges,
  localHeadSha,
  mergeBaseOf,
  type PushWorkspaceBranchResult,
  parsePorcelainCount,
  parseWorkingChanges,
  pushHeadToNewBranch,
  pushWorkspaceBranch,
  type RepoRef,
  type ResolvedCommitIdentity,
  readCommitFileDiff,
  readCommitTreeFiles,
  readWorkingFileDiff,
  resolveAuthorFilterValue,
  resolveCommitIdentity,
  resolveRefSha,
  resolveUpstream,
  type SyntheticCommitIdentity,
  stashWorkspaceTree,
  type UnaddResult,
  type UpstreamState,
  unaddPaths,
  unlistedScopeRefs,
  userIndexHasStagedChanges,
  type WorkingChange,
  withCommitAttribution,
} from './repo';
export {
  COMMIT_SIGNATURES_MAX_COMMITS,
  type CommitSignature,
  type CommitSignatureState,
  readCommitSignatures,
} from './signature-ops';
export { createLightweightTag, type TagCreateResult } from './tag-ops';
export {
  asFileText,
  checkoutPathsFromCommit,
  type FileText,
  listTreeEntries,
  readTreeEntryText,
  snapshotWorkingTree,
  treeWithFiles,
} from './tree-ops';
