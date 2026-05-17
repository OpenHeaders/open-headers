import type { DataPresenceSummary, WorkspaceContentSnapshot } from './types';

/**
 * Roll workspace snapshots up into a host-level presence summary. Pure;
 * each host collects its own snapshots however it likes (oracle caches,
 * a bridged RPC, a synthetic fixture in tests) and feeds them in.
 */
export function summarizeWorkspaces(
  workspaces: readonly WorkspaceContentSnapshot[],
): DataPresenceSummary {
  let totalEntityCount = 0;
  for (const ws of workspaces) {
    for (const count of Object.values(ws.entityCounts)) {
      totalEntityCount += count;
    }
  }
  return {
    workspaceCount: workspaces.length,
    hasUserContent: totalEntityCount > 0,
    totalEntityCount,
    workspaces: [...workspaces],
  };
}

/**
 * "Empty" for the mode-switch gate: no user-authored entities AND at
 * most one workspace. A second workspace — even one with zero entities —
 * is itself a deliberate user act, so we don't treat it as discardable.
 */
export function isPresenceEmpty(summary: DataPresenceSummary): boolean {
  if (summary.hasUserContent) return false;
  return summary.workspaceCount <= 1;
}
