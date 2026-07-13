/**
 * Last-imported snapshot persistence — the per-uid YAML ancestor map
 * the merge editor's 3-pane view reads (plan §7).
 */

import {
  type ImportPlan,
  type PlanEntry,
  type SerializableEntityKind,
  serializeEntityYaml,
} from '@openheaders/core/workspace-export';

// Synthetic uids the import-merge adapter uses for the two singletons
// that don't otherwise have an identity (see
// `workspace-export/preview/diff-to-import-bundle.ts`). Inlined here
// rather than imported because the adapter lives in renderer-tier code
// and the orchestrator is SW-tier; the constant is the contract.
const WORKSPACE_VARS_SINGLETON_UID = '__singleton.workspaceVars__';
const VAULT_SINGLETON_UID = '__singleton.vault__';

/**
 * Build the next `Record<uid, yaml>` for `lastImportedSnapshots` from
 * the executed plan, layered on top of the prior snapshot map.
 *
 * Skipped plan entries (`action === 'skip'`) keep whatever the prior
 * import left — the user explicitly didn't bring this version in, so
 * it shouldn't become the new ancestor for the next import. Created /
 * updated entries overwrite their uid's snapshot with the freshly
 * serialized YAML.
 *
 * Singleton handling: a non-skip workspaceVars/vault plan replaces the
 * synthetic-uid entry; a skip preserves the prior snapshot for that
 * singleton.
 */
export function buildLastImportedSnapshots(plan: ImportPlan, prior: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...prior };
  const writeBucket = <T extends { uid: string }>(kind: SerializableEntityKind, entries: PlanEntry<T>[]): void => {
    for (const e of entries) {
      if (e.action === 'skip') continue;
      next[e.entity.uid] = serializeEntityYaml(kind, e.entity);
    }
  };
  writeBucket('collection', plan.collections as PlanEntry<{ uid: string }>[]);
  writeBucket('folder', plan.folders as PlanEntry<{ uid: string }>[]);
  writeBucket('rule', plan.rules as PlanEntry<{ uid: string }>[]);
  writeBucket('request', plan.requests as PlanEntry<{ uid: string }>[]);
  writeBucket('template', plan.templates as PlanEntry<{ uid: string }>[]);
  writeBucket('environment', plan.environments as PlanEntry<{ uid: string }>[]);
  writeBucket('liveWorkflow', plan.liveWorkflows as PlanEntry<{ uid: string }>[]);
  writeBucket('liveVariable', plan.liveVariables as PlanEntry<{ uid: string }>[]);
  if (plan.workspaceVars.action !== 'skip') {
    next[WORKSPACE_VARS_SINGLETON_UID] = serializeEntityYaml('workspaceVars', {
      schemaVersion: 5,
      variables: plan.workspaceVars.variables,
    });
  }
  if (plan.vault.action !== 'skip') {
    next[VAULT_SINGLETON_UID] = serializeEntityYaml('vault', {
      schemaVersion: 5,
      secrets: plan.vault.secrets,
    });
  }
  return next;
}
