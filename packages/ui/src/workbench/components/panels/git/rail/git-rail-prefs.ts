/**
 * git-rail-prefs — per-workspace preferences of the Git tool window's
 * branches rail (the log-window activity bar's stateful options):
 * favorite refs (★), the single-click behavior (Update Branch Filter /
 * Navigate Log to Branch Head), Show Tags, and Group By Directory.
 * Favorites and view options are durable preferences, unlike the
 * session-scoped tabs — the shared per-workspace prefs posture.
 */

import { createWorkspacePrefsStore } from '../workspace-prefs-store';

export type GitRailSingleClick = 'filter' | 'navigate';

export interface GitRailPrefs {
  /** Favorite refs as `<kind>:<name>` keys (`local:main`). */
  favorites: readonly string[];
  singleClick: GitRailSingleClick;
  showTags: boolean;
  groupByDirectory: boolean;
}

const DEFAULT_PREFS: GitRailPrefs = {
  favorites: [],
  singleClick: 'filter',
  showTags: true,
  groupByDirectory: true,
};

export function gitRailFavoriteKey(kind: string, name: string): string {
  return `${kind}:${name}`;
}

const store = createWorkspacePrefsStore<GitRailPrefs>({
  storagePrefix: 'oh:gitRail',
  defaults: DEFAULT_PREFS,
  parse: (p) => ({
    favorites: Array.isArray(p.favorites) ? p.favorites.filter((key) => typeof key === 'string') : [],
    singleClick: p.singleClick === 'navigate' ? 'navigate' : 'filter',
    showTags: p.showTags !== false,
    groupByDirectory: p.groupByDirectory !== false,
  }),
});

export const getGitRailPrefs = store.get;
export const subscribeGitRailPrefs = store.subscribe;
export const patchGitRailPrefs = store.patch;

/** Toggle one ref's favorite star. */
export function toggleGitRailFavorite(workspaceId: string, kind: string, name: string): void {
  const key = gitRailFavoriteKey(kind, name);
  const { favorites } = getGitRailPrefs(workspaceId);
  patchGitRailPrefs(workspaceId, {
    favorites: favorites.includes(key) ? favorites.filter((entry) => entry !== key) : [...favorites, key],
  });
}
