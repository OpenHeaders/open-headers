/**
 * git-log-view-prefs — per-workspace display preferences of the Git
 * tool window's log + details panes (the toolbar eye menus): Tag
 * Names and Commit Timestamp in the commit list, the Merge Commits
 * highlight (the dimmed-subject convention), Group By Directory and
 * Show Details in the changes pane.
 *
 * Same posture as the rail prefs: module store with subscribers (the
 * dock unmounts inactive tool windows) plus localStorage persistence;
 * storage failures degrade to session-only silently.
 */

export interface GitLogViewPrefs {
  /** Show > Tag Names — tag chips on commit rows. */
  showTagNames: boolean;
  /** Show > Commit Timestamp — time on dates older than yesterday. */
  showCommitTimestamp: boolean;
  /** Highlight > Merge Commits — dim merge subjects (the IDE default). */
  highlightMergeCommits: boolean;
  /** Details eye: Group By > Directory — off renders flat file rows. */
  groupFilesByDirectory: boolean;
  /** Details eye: Layout > Show Details — the commit-details lower half. */
  showDetails: boolean;
}

const DEFAULT_PREFS: GitLogViewPrefs = {
  showTagNames: true,
  showCommitTimestamp: false,
  highlightMergeCommits: true,
  groupFilesByDirectory: true,
  showDetails: true,
};

interface PrefsEntry {
  prefs: GitLogViewPrefs;
  listeners: Set<() => void>;
}

const entries = new Map<string, PrefsEntry>();

function storageKey(workspaceId: string): string {
  return `oh:gitLogView:${workspaceId}`;
}

function readPersisted(workspaceId: string): GitLogViewPrefs {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (raw === null) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const p = parsed as Partial<GitLogViewPrefs>;
    return {
      showTagNames: p.showTagNames !== false,
      showCommitTimestamp: p.showCommitTimestamp === true,
      highlightMergeCommits: p.highlightMergeCommits !== false,
      groupFilesByDirectory: p.groupFilesByDirectory !== false,
      showDetails: p.showDetails !== false,
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

export function getGitLogViewPrefs(workspaceId: string): GitLogViewPrefs {
  return entryFor(workspaceId).prefs;
}

export function subscribeGitLogViewPrefs(workspaceId: string, listener: () => void): () => void {
  const entry = entryFor(workspaceId);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function patchGitLogViewPrefs(workspaceId: string, patch: Partial<GitLogViewPrefs>): void {
  const entry = entryFor(workspaceId);
  entry.prefs = { ...entry.prefs, ...patch };
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(entry.prefs));
  } catch {
    // Session-only fallback — the in-memory prefs still apply.
  }
  for (const listener of entry.listeners) listener();
}
