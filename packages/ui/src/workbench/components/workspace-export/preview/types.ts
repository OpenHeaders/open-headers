/**
 * Shared types across the preview/ modules.
 */

import type { DiffResult, MissingDep } from '@openheaders/core/workspace-export';

/**
 * Where the import flow originated. All sources are local-trust — the
 * user has the bytes locally (dropped/picked a file, pasted, or used the
 * "Import from file…" menu) and could read them before importing.
 */
export type ImportPreviewSource = 'file' | 'clipboard' | 'menu';

/** Resolved SW-side preview — diff + missing-deps against the chosen
 *  target, plus the `snapshotHash` used to detect concurrent edits
 *  between preview-open and submit. */
export interface PreviewState {
  diff: DiffResult;
  missingDeps: MissingDep[];
  snapshotHash: string;
  targetWorkspaceId: string | null;
}
