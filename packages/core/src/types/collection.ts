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
 *
 * `Collection` is derived from `CollectionSchema`. Tree-node types
 * (`FolderNode`, `RequestNode`, `RuleNode`, `TemplateNode`, `TreeNode`,
 * `CollectionTree`) are runtime UI shapes, not persisted, and stay
 * hand-written.
 */

import type * as v from 'valibot';
import type { CollectionSchema, FolderSchema, SpecLinkSchema } from '../schemas/collection';
import type { HttpMethod } from './request';
import type { RuleType } from './rule';

// ── Collection ─────────────────────────────────────────────────────

export type Collection = v.InferOutput<typeof CollectionSchema>;

/** Generation bookkeeping on a spec-generated collection (per link). */
export type SpecLink = v.InferOutput<typeof SpecLinkSchema>;

/**
 * `_folder.yaml` — the lightweight grouping folder inside a collection.
 * Does not carry variables (the collection is the variable-scoping
 * unit). `path` is populated by the caller at parse time and stripped
 * from the persisted YAML.
 */
export type Folder = v.InferOutput<typeof FolderSchema>;

// ── Tree nodes (sidebar, runtime-only) ─────────────────────────────

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
