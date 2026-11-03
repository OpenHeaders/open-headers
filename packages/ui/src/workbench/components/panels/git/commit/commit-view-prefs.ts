/**
 * commit-view-prefs — per-workspace state of the Commit tool window:
 * the eye toggles (Group By Directory, Show Ignored Files), the gear's
 * per-commit options (Sign-off; Run Git hooks — null until the user
 * touches it, so it keeps following the binding's bypassHooks inverse),
 * and the message draft. The Commit Message History popup reads the
 * bound repo's own log (commit-message-history.ts) — nothing is kept
 * here for it.
 *
 * Same posture as git-log-view-prefs: module store with subscribers
 * plus localStorage persistence; storage failures degrade to
 * session-only silently.
 */

export interface CommitViewPrefs {
  /** Eye: Group By > Directory — OFF by default (the reference reference
   *  view: flat filename + dim-directory-suffix, sorted by filename);
   *  on folds the rows into the compressed directory tree. */
  groupByDirectory: boolean;
  /** Eye: Show > Ignored Files — read-only `!!` rows. */
  showIgnored: boolean;
  /** Gear: Sign-off commit — the per-commit `Signed-off-by` trailer. */
  signOff: boolean;
  /**
   * Gear: Run Git hooks. `null` = untouched — the effective value is
   * the binding's bypassHooks INVERSE; a boolean is the user's own
   * per-window choice (never written back to the binding setting).
   */
  runGitHooks: boolean | null;
  /** The Commit Message box draft — survives dock switches and restarts. */
  draft: string;
}

const DEFAULT_PREFS: CommitViewPrefs = {
  groupByDirectory: false,
  showIgnored: false,
  signOff: false,
  runGitHooks: null,
  draft: '',
};

interface PrefsEntry {
  prefs: CommitViewPrefs;
  listeners: Set<() => void>;
}

const entries = new Map<string, PrefsEntry>();

function storageKey(workspaceId: string): string {
  return `oh:commitTool:${workspaceId}`;
}

function readPersisted(workspaceId: string): CommitViewPrefs {
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (raw === null) return DEFAULT_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PREFS;
    const p = parsed as Partial<CommitViewPrefs>;
    return {
      groupByDirectory: p.groupByDirectory === true,
      showIgnored: p.showIgnored === true,
      signOff: p.signOff === true,
      runGitHooks: typeof p.runGitHooks === 'boolean' ? p.runGitHooks : null,
      draft: typeof p.draft === 'string' ? p.draft : '',
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

export function getCommitViewPrefs(workspaceId: string): CommitViewPrefs {
  return entryFor(workspaceId).prefs;
}

export function subscribeCommitViewPrefs(workspaceId: string, listener: () => void): () => void {
  const entry = entryFor(workspaceId);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
  };
}

export function patchCommitViewPrefs(workspaceId: string, patch: Partial<CommitViewPrefs>): void {
  const entry = entryFor(workspaceId);
  entry.prefs = { ...entry.prefs, ...patch };
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(entry.prefs));
  } catch {
    // Session-only fallback — the in-memory prefs still apply.
  }
  for (const listener of entry.listeners) listener();
}
