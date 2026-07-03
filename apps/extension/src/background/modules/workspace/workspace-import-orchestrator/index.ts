/**
 * Workspace-export import orchestrator.
 *
 * Drives `chrome.storage` writes for an `ImportPlan` produced by
 * `@openheaders/core/workspace-export`. Sibling to
 * `workspace-orchestrator.ts` (kept separate for SoC — duplicate / switch
 * / delete are workspace-lifecycle concerns; import is data-merge).
 *
 * Contract (design §5.3):
 *   • Top-level `withLock(workspace-import singleton)` per target id —
 *     concurrent imports into different workspaces run in parallel,
 *     same-target imports serialize.
 *   • Read target storage; merge plan entries (create / update / skip);
 *     write back via `setMany`.
 *   • Tree-aware demux for the flattened collection / folder arrays —
 *     the export envelope flattens `rules/*` + `requests/*` +
 *     `templates/*` trees into single arrays; we split by `path`
 *     prefix back into the three storage keys.
 *   • Workspace metadata behavior (§2.4): target=new uses export's
 *     metadata + " (imported)" suffix on collision; target=existing
 *     ignores export's metadata, doesn't copy `defaultEnvironmentId`
 *     (the post-import toast offers it).
 *   • After all writes, fire `scheduleUpdate('import', { immediate:
 *     true })` so the DNR ruleset rebuilds.
 *   • Persist a `WorkspaceExportImportReport` into the per-workspace
 *     `importReports` ring.
 *
 * Out of scope (lands in PR 5):
 *   • OAuth `configs` import (sidecar omit-toggle)
 *   • Strip-scripts toggle
 *   • Capability-gate prompts
 */

export { importWorkspace } from './import';
export {
  type PreviewWorkspaceImportArgs,
  type PreviewWorkspaceImportResult,
  previewWorkspaceImport,
} from './preview';
export { buildLastImportedSnapshots } from './snapshots';
export { readTargetWorkspaceState } from './target';
export type { ImportTargetSelector, ImportWorkspaceArgs, ImportWorkspaceResult } from './types';
