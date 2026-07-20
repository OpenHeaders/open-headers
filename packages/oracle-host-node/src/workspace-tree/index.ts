/**
 * Workspace-tree host layer — filesystem side of the pure planner /
 * reader in `@openheaders/core/workspace-tree` (GIT_PLAN.md Phase 2).
 * Node hosts only (desktop main, daemon); the extension has no
 * filesystem and consumes tree-borne changes over the wire.
 */

export type { BindWorkspaceTreeOptions, BindWorkspaceTreeResult } from './bind';
export { bindWorkspaceTree, probeWorkspaceTree, unbindWorkspaceTree } from './bind';
export type { ForcePushChoice, ResolveForcePushOptions, ResolveForcePushResult } from './force-push';
export { resolveForcePushWorkspaceTree } from './force-push';
export type { GitHeadWatcherOptions } from './head-watcher';
export { GitHeadWatcher } from './head-watcher';
export type { MaterializeResult, MaterializeSnapshot, WorkspaceTreeMaterializerOptions } from './materializer';
export { WorkspaceTreeMaterializer } from './materializer';
export type { MergeWorkspaceBranchOptions, MergeWorkspaceBranchResult } from './merge';
export { mergeWorkspaceBranch } from './merge';
export type {
  IntegrateForeignDeps,
  IntegrateForeignHeadResult,
  PullWorkspaceTreeOptions,
  PullWorkspaceTreeResult,
} from './pull';
export { integrateForeignHead, pullWorkspaceTree, writeForeignQuarantine } from './pull';
export { listWorkspaceTreeFiles, readWorkspaceTreeFromDisk } from './reader';
export { dispatchWorkspaceTreeRpc, ownsWorkspaceTreeRpc, parseCommitCadence } from './rpc-dispatch';
export type {
  BindWorkspaceTreeRpcResult,
  CommitWorkspaceTreeRpcResult,
  CreateBranchRpcResult,
  MergeBranchRpcResult,
  PullWorkspaceTreeRpcResult,
  PushWorkspaceTreeRpcResult,
  ResolveForcePushRpcResult,
  SwitchBranchRpcResult,
  WorkspaceTreeCommitCadence,
  WorkspaceTreeFileDiffRpcResult,
  WorkspaceTreeGitStatusRpcResult,
  WorkspaceTreeLogRpcResult,
  WorkspaceTreeRefsRpcResult,
  WorkspaceTreeRuntime,
  WorkspaceTreeRuntimeOptions,
} from './runtime';
export { createWorkspaceTreeRuntime } from './runtime';
export type { MaterializedIndex, TreeLockHolder, TreeLockResult } from './sidecar';
export {
  acquireTreeLock,
  hashTreeContent,
  readMaterializedIndex,
  readTreeUnknownFields,
  releaseTreeLock,
  sidecarDir,
  writeMaterializedIndex,
  writeTreeUnknownFields,
} from './sidecar';
export type { SweepWorkspaceTreeOptions, SweepWorkspaceTreeResult } from './sweep';
export { sweepWorkspaceTree } from './sweep';
export type { SwitchDirtyAction, SwitchWorkspaceBranchOptions, SwitchWorkspaceBranchResult } from './switch';
export { switchWorkspaceBranch } from './switch';
export type { WorkspaceTreeWatcherOptions } from './watcher';
export { WorkspaceTreeWatcher } from './watcher';
