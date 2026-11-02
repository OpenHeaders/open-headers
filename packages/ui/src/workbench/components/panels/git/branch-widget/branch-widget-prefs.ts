/**
 * branch-widget-prefs — per-workspace state of the top bar's branch
 * widget: the popup's view options (Show Tags, Group By Directory —
 * the gear) and the Recent ring: branch names in the order they were
 * last checked out, newest first, fed by every observed HEAD change
 * (an in-app switch or a terminal checkout alike — the status frame
 * carries the branch either way). The shared per-workspace prefs
 * posture; storage failures degrade to session-only silently.
 */

import { createWorkspacePrefsStore } from '../workspace-prefs-store';

export interface BranchWidgetPrefs {
  showTags: boolean;
  groupByDirectory: boolean;
  /** Recently checked-out branch names, newest first. */
  recent: readonly string[];
}

export const RECENT_BRANCHES_CAP = 8;

const DEFAULT_PREFS: BranchWidgetPrefs = {
  showTags: true,
  groupByDirectory: true,
  recent: [],
};

const store = createWorkspacePrefsStore<BranchWidgetPrefs>({
  storagePrefix: 'oh:gitBranchWidget',
  defaults: DEFAULT_PREFS,
  parse: (p) => ({
    showTags: p.showTags !== false,
    groupByDirectory: p.groupByDirectory !== false,
    recent: Array.isArray(p.recent)
      ? p.recent.filter((name): name is string => typeof name === 'string').slice(0, RECENT_BRANCHES_CAP)
      : [],
  }),
});

export const getBranchWidgetPrefs = store.get;
export const subscribeBranchWidgetPrefs = store.subscribe;
export const patchBranchWidgetPrefs = store.patch;

/** The ring after `branch` became HEAD: moved to the front, capped. */
export function withRecentBranch(recent: readonly string[], branch: string): readonly string[] {
  if (recent[0] === branch) return recent;
  return [branch, ...recent.filter((name) => name !== branch)].slice(0, RECENT_BRANCHES_CAP);
}

/** Record an observed checkout; a no-op when the branch already leads. */
export function recordRecentBranch(workspaceId: string, branch: string): void {
  const { recent } = getBranchWidgetPrefs(workspaceId);
  const next = withRecentBranch(recent, branch);
  if (next !== recent) patchBranchWidgetPrefs(workspaceId, { recent: next });
}
