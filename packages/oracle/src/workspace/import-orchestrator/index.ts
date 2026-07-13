/**
 * Workspace-export import orchestrator — host-neutral.
 *
 * Drives `hostStorage` writes for an `ImportPlan` produced by
 * `@openheaders/core/workspace-export`. Lifted from the extension SW
 * (Desktop host #2 posture): every host that owns an oracle answers
 * the `importWorkspace` / `previewWorkspaceImport` bridge channels
 * through this module — the extension SW message handler, the desktop
 * daemon spine's `dispatchRpc`.
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
 *   • After all writes, the `scheduleRuleEngineUpdate` host hook fires
 *     so hosts with a request-modifying runtime rebuild their ruleset.
 *   • Persist a `WorkspaceExportImportReport` into the per-workspace
 *     `importReports` ring.
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
