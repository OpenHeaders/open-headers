/**
 * Workspace types for the git-based workspace format.
 *
 * On disk: workspace.yaml
 *   version: 1
 *   name: My API Project
 *
 * The workspace IS a git repo. The manifest is the only file
 * that carries a format version number.
 */

export interface Workspace {
  version: number;
  name: string;
  description?: string;
  /** Workspace root directory (absolute path, runtime only — not on disk). */
  rootPath: string;
}
