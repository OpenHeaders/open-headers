/**
 * Collection types for the git-based workspace format.
 *
 * Collections organize Requests (or Rules) into a folder hierarchy.
 * On disk, a collection is a directory containing `_collection.yaml`:
 *
 *   requests/auth/
 *     _collection.yaml   — name, vars, sort order
 *     login-x7k2/        — request item folder
 *     tokens/             — grouping folder (has _folder.yaml or children)
 *       refresh-m9p1/     — request item folder
 *
 * Identity is the filesystem path. The 4-char uid suffix on the
 * folder name provides a stable key for in-memory lookups.
 */

import type { HttpMethod } from './request';
import type { RuleType } from './rule';
import type { Variable } from './variable';

// ── Collection ─────────────────────────────────────────────────────

export interface Collection {
  /** 4-char uid from folder name suffix. */
  uid: string;
  /** Relative path within workspace (e.g. "requests/auth"). */
  path: string;
  name: string;
  description?: string;
  /** Collection-scoped variables (synced via Git, non-secret only). */
  variables: Variable[];
  /** Sort order within the sidebar. */
  sort?: number;
}

// ── Tree nodes (sidebar) ───────────────────────────────────────────

export interface FolderNode {
  type: 'folder';
  uid: string;
  name: string;
  path: string;
  children: TreeNode[];
}

export interface RequestNode {
  type: 'request';
  uid: string;
  name: string;
  path: string;
  method: HttpMethod;
}

export interface RuleNode {
  type: 'rule';
  uid: string;
  name: string;
  path: string;
  ruleType: RuleType;
  enabled: boolean;
}

export type TreeNode = FolderNode | RequestNode | RuleNode;

/** Collection with its full sidebar tree loaded. */
export interface CollectionTree extends Collection {
  tree: TreeNode[];
}
