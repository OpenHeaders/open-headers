/**
 * Collection types for the git-based workspace format.
 *
 * Collections organize Requests (or Rules) into a folder hierarchy.
 * On disk, a collection is a directory containing `_collection.yaml`:
 *
 *   requests/auth-a1b2c3d4/
 *     _collection.yaml           — schemaVersion, uid, name, variables, order
 *     login-x7k2abcd/            — request item folder
 *     tokens/                    — grouping folder (has _folder.yaml)
 *       _folder.yaml             — schemaVersion, uid, name, order
 *       refresh-m9p1qwer/        — request item folder
 *
 * Identity is the 8-char uid embedded inside each YAML (`_collection.yaml`,
 * `_folder.yaml`, `request.yaml`, `rule.yaml`). The folder-name suffix
 * mirrors the uid for grep/git-diff readability but is not authoritative.
 * Child ordering is explicit via `order: string[]` (list of child folder
 * names) — absent = alphabetical.
 */

import type { HttpMethod } from './request';
import type { RuleType } from './rule';
import type { Variable } from './variable';

// ── Collection ─────────────────────────────────────────────────────

export interface Collection {
  /** Persisted format version for `_collection.yaml`. */
  schemaVersion: number;
  /** 8-char lowercase-alphanumeric identity. Embedded in _collection.yaml. */
  uid: string;
  /** Relative path within workspace (e.g. "requests/auth-a1b2c3d4"). Forward slashes. */
  path: string;
  name: string;
  description?: string;
  /** Collection-scoped variables (synced via Git, non-secret only). */
  variables: Variable[];
  /** Explicit child ordering — list of child folder names ("<slug>-<uid>"). Absent = alphabetical. */
  order?: string[];
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

export interface TemplateNode {
  type: 'template';
  uid: string;
  name: string;
  path: string;
  ruleType: RuleType;
  icon: string;
}

export type TreeNode = FolderNode | RequestNode | RuleNode | TemplateNode;

/** Collection with its full sidebar tree loaded. */
export interface CollectionTree extends Collection {
  tree: TreeNode[];
}
