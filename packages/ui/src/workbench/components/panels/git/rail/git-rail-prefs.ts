/**
 * git-rail-prefs — per-workspace preferences of the Git tool window's
 * branches rail (the log-window activity bar's stateful options):
 * favorite refs (★ — `ref-favorites.ts` says which refs are), the single-click behavior (Update Branch Filter /
 * Navigate Log to Branch Head), Show Tags, and Group By Directory.
 * Favorites and view options are durable preferences, unlike the
 * session-scoped tabs — the shared per-workspace prefs posture.
 */

import { createWorkspacePrefsStore } from '../workspace-prefs-store';
import { refFavoriteKey, toggledFavorite } from './ref-favorites';

export type GitRailSingleClick = 'filter' | 'navigate';

export interface GitRailPrefs {
  /** Refs starred by hand, as `<kind>:<name>` keys (`local:main`). */
  favorites: readonly string[];
  /** Refs that are favorites by default (the checked-out branch, its remote), un-starred by hand. */
  unfavorites: readonly string[];
  singleClick: GitRailSingleClick;
  showTags: boolean;
  groupByDirectory: boolean;
}

const DEFAULT_PREFS: GitRailPrefs = {
  favorites: [],
  unfavorites: [],
  singleClick: 'filter',
  showTags: true,
  groupByDirectory: true,
};

export const gitRailFavoriteKey = refFavoriteKey;

const store = createWorkspacePrefsStore<GitRailPrefs>({
  storagePrefix: 'oh:gitRail',
  defaults: DEFAULT_PREFS,
  parse: (p) => ({
    favorites: Array.isArray(p.favorites) ? p.favorites.filter((key) => typeof key === 'string') : [],
    unfavorites: Array.isArray(p.unfavorites) ? p.unfavorites.filter((key) => typeof key === 'string') : [],
    singleClick: p.singleClick === 'navigate' ? 'navigate' : 'filter',
    showTags: p.showTags !== false,
    groupByDirectory: p.groupByDirectory !== false,
  }),
});

export const getGitRailPrefs = store.get;
export const subscribeGitRailPrefs = store.subscribe;
export const patchGitRailPrefs = store.patch;

/** Toggle one ref's favorite star; `defaults` are the refs that are favorites until un-starred. */
export function toggleGitRailFavorite(
  workspaceId: string,
  kind: string,
  name: string,
  defaults: ReadonlySet<string>,
): void {
  patchGitRailPrefs(workspaceId, toggledFavorite(getGitRailPrefs(workspaceId), refFavoriteKey(kind, name), defaults));
}
