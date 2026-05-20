/**
 * Pure projection of a {@link WorkspaceSnapshot} down to its user-content
 * entity ids. Shared by the mode-switch orchestrators that need an
 * entity tally — the Discard archive's per-workspace count, and any
 * conflict-diff over a wire snapshot.
 */

import type { WorkspaceSnapshot } from '@openheaders/core/protocol';

/**
 * Enumerate every user-content entity carried in a
 * {@link WorkspaceSnapshot}. Pure.
 *
 * The snapshot's per-entity arrays each carry exactly one id field on
 * the inner record (e.g. `rules[i].rule.uid`, `requests[i].request.uid`).
 * Singleton arrays (`workspaceVariables`, `vault`, `pauseMarkers`,
 * `layoutState`, `files`) are skipped — they're not user-content
 * entities and don't participate in the count. `oauthBundles` IS
 * user-content but has no per-entry id (it's a workspace-level
 * singleton wrapping per-provider configs); it folds under the
 * `oauth-bundle` synthetic id `<workspaceId>` so it can still be
 * counted.
 */
export function enumerateSnapshotEntities(snapshot: WorkspaceSnapshot): ReadonlyArray<{ type: string; id: string }> {
  const out: Array<{ type: string; id: string }> = [];
  for (const p of snapshot.rules) out.push({ type: 'rule', id: p.rule.uid });
  for (const p of snapshot.environments) out.push({ type: 'environment', id: p.environment.uid });
  for (const p of snapshot.collections) out.push({ type: 'collection', id: p.collection.uid });
  for (const p of snapshot.folders) out.push({ type: 'folder', id: p.folder.uid });
  for (const p of snapshot.requests) out.push({ type: 'request', id: p.request.uid });
  for (const p of snapshot.requestCollections) out.push({ type: 'request-collection', id: p.collection.uid });
  for (const p of snapshot.requestFolders) out.push({ type: 'request-folder', id: p.folder.uid });
  for (const p of snapshot.templates) out.push({ type: 'template', id: p.template.uid });
  for (const p of snapshot.templateCollections) out.push({ type: 'template-collection', id: p.collection.uid });
  for (const p of snapshot.templateFolders) out.push({ type: 'template-folder', id: p.folder.uid });
  for (const p of snapshot.liveVariables) out.push({ type: 'live-variable', id: p.liveVariable.uid });
  for (const p of snapshot.liveWorkflows) out.push({ type: 'live-workflow', id: p.workflow.uid });
  if (snapshot.oauthBundles.length > 0) {
    out.push({ type: 'oauth-bundle', id: snapshot.workspaceId });
  }
  return out;
}
