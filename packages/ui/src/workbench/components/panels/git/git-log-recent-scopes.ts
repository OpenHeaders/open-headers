/**
 * git-log-recent-scopes — per workspace, the Branch filter's last
 * applied scopes, newest first: what the chip's Recent submenu lists.
 * A durable list, like the rail's favorites — the shared per-workspace
 * prefs posture.
 */

import { type GitLogScope, RECENT_SCOPES_MAX, withRecentScope } from './log-scope';
import { createWorkspacePrefsStore } from './workspace-prefs-store';

interface GitLogRecentScopes {
  scopes: readonly GitLogScope[];
}

function isScope(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every((ref) => typeof ref === 'string' && ref.length > 0);
}

const store = createWorkspacePrefsStore<GitLogRecentScopes>({
  storagePrefix: 'oh:gitLogRecentScopes',
  defaults: { scopes: [] },
  parse: (p) => ({ scopes: Array.isArray(p.scopes) ? p.scopes.filter(isScope).slice(0, RECENT_SCOPES_MAX) : [] }),
});

export function getGitLogRecentScopes(workspaceId: string): readonly GitLogScope[] {
  return store.get(workspaceId).scopes;
}

export const subscribeGitLogRecentScopes = store.subscribe;

/** A scope was applied: it leads the recent ones. The unfiltered log is no scope to remember. */
export function rememberGitLogScope(workspaceId: string, scope: GitLogScope): void {
  if (scope.length === 0) return;
  store.patch(workspaceId, { scopes: withRecentScope(store.get(workspaceId).scopes, scope) });
}
