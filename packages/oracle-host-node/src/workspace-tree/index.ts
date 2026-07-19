/**
 * Workspace-tree host layer — filesystem side of the pure planner /
 * reader in `@openheaders/core/workspace-tree` (GIT_PLAN.md Phase 2).
 * Node hosts only (desktop main, daemon); the extension has no
 * filesystem and consumes tree-borne changes over the wire.
 */

export type { BindWorkspaceTreeOptions, BindWorkspaceTreeResult } from './bind';
export { bindWorkspaceTree, probeWorkspaceTree, unbindWorkspaceTree } from './bind';
export type { MaterializeResult, MaterializeSnapshot, WorkspaceTreeMaterializerOptions } from './materializer';
export { WorkspaceTreeMaterializer } from './materializer';
export type { PullWorkspaceTreeOptions, PullWorkspaceTreeResult } from './pull';
export { pullWorkspaceTree } from './pull';
export { listWorkspaceTreeFiles, readWorkspaceTreeFromDisk } from './reader';
export type {
  BindWorkspaceTreeRpcResult,
  CommitWorkspaceTreeRpcResult,
  PullWorkspaceTreeRpcResult,
  WorkspaceTreeCommitCadence,
  WorkspaceTreeGitStatusRpcResult,
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
export type { WorkspaceTreeWatcherOptions } from './watcher';
export { WorkspaceTreeWatcher } from './watcher';
