/**
 * Workspace-tree contracts — the pure interchange between an engine
 * snapshot and the on-disk YAML working tree (the git-sync plan §10 Phase 2).
 *
 * Core stays host-free: a tree is modeled as a flat list of
 * `{ path, content }` files. Node hosts walk the filesystem into that
 * shape for {@link readWorkspaceTree} and write {@link planWorkspaceTree}'s
 * output back out; nothing in this module touches I/O.
 */

import type { UnknownField } from '../codec/yaml/unknown-fields';
import type { Collection, Folder } from '../types/collection';
import type { GrpcRequest } from '../types/grpc-request';
import type { LiveVariable, LiveWorkflow } from '../types/live';
import type { Request } from '../types/request';
import type { Rule } from '../types/rule';
import type { Spec } from '../types/spec';
import type { Template } from '../types/template';
import type { Environment, Vault, WorkspaceVariables } from '../types/variable';
import type { WebSocketRequest } from '../types/websocket-request';
import type { WorkspaceManifest } from '../types/workspace';

/** One file of the materialized tree, path workspace-relative with `/` separators. */
export interface TreeFile {
  readonly path: string;
  readonly content: string;
}

/**
 * The persisted entity catalogue of one workspace — the input to
 * {@link planWorkspaceTree} and the output of {@link readWorkspaceTree}.
 * Mirrors the `wsKeys` persisted slots that have a YAML codec; runtime
 * / UI-only slots (tab session, caches, examples) never materialize.
 */
export interface WorkspaceTreeState {
  /**
   * The manifest shape — no `orgId` (host-local tenancy never enters
   * committed YAML, the git-sync plan §5). A full runtime {@link Workspace}
   * is assignable; the planner simply never emits the org binding.
   */
  workspace: WorkspaceManifest;
  rules: Rule[];
  collections: Collection[];
  folders: Folder[];
  requests: Request[];
  grpcRequests: GrpcRequest[];
  websocketRequests: WebSocketRequest[];
  requestCollections: Collection[];
  requestFolders: Folder[];
  templates: Template[];
  templateCollections: Collection[];
  templateFolders: Folder[];
  environments: Environment[];
  workspaceVariables: WorkspaceVariables | null;
  vault: Vault | null;
  specs: Spec[];
  liveWorkflows: LiveWorkflow[];
  liveVariables: LiveVariable[];
}

/**
 * Captured unknown-field rows per document — entity uid (or a
 * `layout.ts` singleton doc key) → RFC 6901 rows. The serializable
 * carrier that lets hand-added / newer-client fields survive the
 * engine round-trip between a tree read and the next materialize
 * (S2 decision: unknowns are data, not an AST handle).
 */
export type TreeUnknownFields = Record<string, readonly UnknownField[]>;

/** One document the reader could not ingest — the quarantine seam (§13.3, later phases). */
export interface TreeIssue {
  /** Path of the offending file (the manifest path for multi-file entities). */
  readonly path: string;
  readonly message: string;
}

export interface TreeReadResult {
  /**
   * `workspace` is null when `workspace.yaml` is missing or invalid
   * (reported in `issues`). The parsed manifest carries no `orgId` —
   * committed YAML never does (the git-sync plan §5); the binding host
   * injects its own tenancy when it consumes the read.
   */
  state: Omit<WorkspaceTreeState, 'workspace'> & { workspace: WorkspaceManifest | null };
  unknowns: TreeUnknownFields;
  issues: TreeIssue[];
}
