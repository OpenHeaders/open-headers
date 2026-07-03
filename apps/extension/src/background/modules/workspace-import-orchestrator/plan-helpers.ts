/**
 * Plan-application primitives — the uid-keyed merge of plan entries
 * onto a target array, the best-effort quota estimate, and the
 * path-prefix tree demux.
 */

import type { ImportPlan, PlanEntry } from '@openheaders/core/workspace-export';

/**
 * Conservative chrome.storage quota signal (5 MB on `local`; we apply a
 * 10% headroom). Real chrome.storage.local.QUOTA_BYTES is per-area
 * 5_242_880 absent `unlimitedStorage`. Pre-check is best-effort — see
 * design §5.3 step 2 (UX improvement, not a guarantee).
 */
export const QUOTA_HEADROOM_BYTES = 5 * 1024 * 1024 - 512 * 1024;

// ── Plan application ──────────────────────────────────────────────

export function applyPlanArray<T extends { uid: string }>(target: T[], plan: PlanEntry<T>[]): T[] {
  const byUid = new Map<string, T>(target.map((e) => [e.uid, e] as const));
  for (const entry of plan) {
    if (entry.action === 'skip') continue;
    if (entry.action === 'update' && entry.targetUid) {
      // Replace existing target entry (same uid retained)
      byUid.set(entry.targetUid, entry.entity);
      continue;
    }
    // create
    byUid.set(entry.entity.uid, entry.entity);
  }
  return Array.from(byUid.values());
}

// ── Quota pre-check ──────────────────────────────────────────────

export function estimatePlanBytes(plan: ImportPlan): number {
  // Best-effort — JSON-stringify the entities marked create/update.
  const buckets: unknown[] = [
    plan.collections,
    plan.folders,
    plan.rules,
    plan.requests,
    plan.templates,
    plan.environments,
    plan.liveWorkflows,
    plan.liveVariables,
    plan.workspaceVars.variables,
    plan.vault.secrets,
  ];
  let total = 0;
  for (const b of buckets) {
    try {
      total += JSON.stringify(b).length;
    } catch {
      // Cyclic / non-JSON-safe — skip.
    }
  }
  return total;
}

export function isInTree(path: string, tree: 'rules' | 'requests' | 'templates'): boolean {
  if (tree === 'requests') return path.startsWith('requests/');
  if (tree === 'templates') return path.startsWith('templates/');
  // rules tree is the catch-all (legacy paths without prefix also count).
  return !path.startsWith('requests/') && !path.startsWith('templates/');
}
