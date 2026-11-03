/**
 * git-log-view-prefs — per-workspace display preferences of the Git
 * tool window's log + details panes (the toolbar eye menus): Tag
 * Names and Commit Timestamp in the commit list, the Merge Commits
 * highlight (the dimmed-subject convention), Group By Directory and
 * Show Details in the changes pane, and what a double-click on a file
 * row opens (the ⋯ menu's Show on Double-Click: the diff or the
 * entity's editor). The shared per-workspace prefs posture.
 */

import { createWorkspacePrefsStore } from './workspace-prefs-store';

export type GitDoubleClickTarget = 'diff' | 'source';

export interface GitLogViewPrefs {
  /** Show > Tag Names — tag chips on commit rows. */
  showTagNames: boolean;
  /** Show > Commit Timestamp — time on dates older than yesterday. */
  showCommitTimestamp: boolean;
  /** Highlight > Merge Commits — dim merge subjects (the reference default). */
  highlightMergeCommits: boolean;
  /** Details eye: Group By > Directory — off renders flat file rows. */
  groupFilesByDirectory: boolean;
  /** Details eye: Layout > Show Details — the commit-details lower half. */
  showDetails: boolean;
  /** ⋯ > Show on Double-Click — a file row's double-click opens the diff or jumps to source. */
  doubleClickOpens: GitDoubleClickTarget;
}

const DEFAULT_PREFS: GitLogViewPrefs = {
  showTagNames: true,
  showCommitTimestamp: false,
  highlightMergeCommits: true,
  groupFilesByDirectory: true,
  showDetails: true,
  doubleClickOpens: 'diff',
};

const store = createWorkspacePrefsStore<GitLogViewPrefs>({
  storagePrefix: 'oh:gitLogView',
  defaults: DEFAULT_PREFS,
  parse: (p) => ({
    showTagNames: p.showTagNames !== false,
    showCommitTimestamp: p.showCommitTimestamp === true,
    highlightMergeCommits: p.highlightMergeCommits !== false,
    groupFilesByDirectory: p.groupFilesByDirectory !== false,
    showDetails: p.showDetails !== false,
    doubleClickOpens: p.doubleClickOpens === 'source' ? 'source' : 'diff',
  }),
});

export const getGitLogViewPrefs = store.get;
export const subscribeGitLogViewPrefs = store.subscribe;
export const patchGitLogViewPrefs = store.patch;
