/**
 * git-rail-prefs — per-workspace preferences of the Git tool window's
 * branches rail (the IDE-log activity bar's stateful options):
 * favorite refs (★), the single-click behavior (Update Branch Filter /
 * Navigate Log to Branch Head), Show Tags, and Group By Directory.
 *
 * Module store with subscribers (the panel's module-state posture —
 * the dock unmounts inactive tool windows) plus localStorage
 * persistence: favorites and view options are durable preferences,
 * unlike the session-scoped tabs. Storage failures degrade to
 * session-only silently (private windows, test DOMs).
 */

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

interface PrefsEntry {
  prefs: GitRailPrefs;
  listeners: Set<() => void>;
}

const entries = new Map<string, PrefsEntry>();

function storageKey(workspaceId: string): string {
  return `oh:gitRail:${workspaceId}`;
}

function readPersisted(workspaceId: string): GitRailPrefs {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (raw === null) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const p = parsed as Partial<GitRailPrefs>;
    return {
      favorites: Array.isArray(p.favorites) ? p.favorites.filter((key) => typeof key === 'string') : [],
      singleClick: p.singleClick === 'navigate' ? 'navigate' : 'filter',
      showTags: p.showTags !== false,
      groupByDirectory: p.groupByDirectory !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function entryFor(workspaceId: string): PrefsEntry {
  let entry = entries.get(workspaceId);
  if (entry === undefined) {
    entry = { prefs: readPersisted(workspaceId), listeners: new Set() };
    entries.set(workspaceId, entry);
  }
  return entry;
}

export function getGitRailPrefs(workspaceId: string): GitRailPrefs {
  return entryFor(workspaceId).prefs;
}

export function subscribeGitRailPrefs(workspaceId: string, listener: () => void): () => void {
  const entry = entryFor(workspaceId);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function patchGitRailPrefs(workspaceId: string, patch: Partial<GitRailPrefs>): void {
  const entry = entryFor(workspaceId);
  entry.prefs = { ...entry.prefs, ...patch };
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(entry.prefs));
  } catch {
    // Session-only fallback — the in-memory prefs still apply.
  }
  for (const listener of entry.listeners) listener();
}

/** Toggle one ref's favorite star. */
export function toggleGitRailFavorite(workspaceId: string, kind: string, name: string): void {
  const key = gitRailFavoriteKey(kind, name);
  const { favorites } = getGitRailPrefs(workspaceId);
  patchGitRailPrefs(workspaceId, {
    favorites: favorites.includes(key) ? favorites.filter((entry) => entry !== key) : [...favorites, key],
  });
}
