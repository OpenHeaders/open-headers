/**
 * Workspace manifest (workspace.yaml).
 *
 *   schemaVersion: 1
 *   uid: a1b2c3d4                  # workspace identity, stable across renames
 *   name: My API Project
 *   description: …
 *   defaultEnvironmentId: …        # optional; resolver falls back here when active env lacks a var
 *
 * The workspace IS a git repo (when synced via desktop/team). The manifest
 * is one of several versioned entities — every persisted YAML file carries
 * its own `schemaVersion`, so migrations can target a single entity kind
 * without rewriting the whole tree. See docs/V5_FOUNDATION_PLAN.md §Phase 0.
 */

/**
 * Top-level sections that organize collections within a workspace.
 * Each section corresponds to a directory on disk and a sidebar panel.
 */
export type WorkspaceSection = 'requests' | 'rules' | 'environments' | 'recordings' | 'proxy-rules';

export interface Workspace {
  /** Persisted format version for `workspace.yaml`. Starts at 1. */
  schemaVersion: number;
  /** Stable workspace identity. 8-char lowercase-alphanumeric. */
  uid: string;
  name: string;
  description?: string;
  /** Environment uid to fall back to when the active env is unset or missing a variable. */
  defaultEnvironmentId?: string;
  /** Workspace root directory (absolute path, runtime only — not on disk). */
  rootPath: string;
}
