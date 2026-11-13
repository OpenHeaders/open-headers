/**
 * git-log-view-prefs — per-workspace display preferences of the Git
 * tool window's log + details panes (the toolbar eye menus): Tag
 * Names and Commit Timestamp in the commit list, the Compact
 * References View, References on the Left, the Author / Hash / Date /
 * Signature columns, the Merge Commits highlight (the dimmed-subject
 * convention), the Current Branch band, Group By Workspace and
 * Directory and Show Details in the changes pane, and what a double-click on a file
 * row opens (the ⋯ menu's Show on Double-Click: the diff or the
 * entity's editor). The shared per-workspace prefs posture.
 */

import { createWorkspacePrefsStore } from './workspace-prefs-store';

export type GitDoubleClickTarget = 'diff' | 'source';

export interface GitLogViewPrefs {
  /** Show > Compact References View — one ref label per row with the hover list; off lists every label inline. */
  compactReferences: boolean;
  /** Show > References on the Left — the ref labels before the subject instead of right-aligned. */
  referencesOnLeft: boolean;
  /** Show > Tag Names — a tag's name beside its glyph on commit rows (the glyph always shows). */
  showTagNames: boolean;
  /** Show > Commit Timestamp — time on dates older than yesterday. */
  showCommitTimestamp: boolean;
  /** Show > Columns > Author — the author column on commit rows. */
  showAuthorColumn: boolean;
  /** Show > Columns > Hash — the short-sha column on commit rows (the reference default: off). */
  showHashColumn: boolean;
  /** Show > Columns > Date — the date column on commit rows. */
  showDateColumn: boolean;
  /** Show > Columns > GPG Signature — a mark on signed commits, at the far end (the reference default: off). */
  showSignatureColumn: boolean;
  /** Highlight > Merge Commits — dim merge subjects (the reference default). */
  highlightMergeCommits: boolean;
  /** Highlight > Current Branch — the faint band under the commits reachable from HEAD. */
  highlightCurrentBranch: boolean;
  /** Details eye: Group By > Workspace — the files by what they belong to in the workbench. */
  groupFilesByWorkspace: boolean;
  /** Details eye: Group By > Directory — off renders flat file rows. */
  groupFilesByDirectory: boolean;
  /** Details eye: Layout > Show Details — the commit-details lower half. */
  showDetails: boolean;
  /** ⋯ > Show on Double-Click — a file row's double-click opens the diff or jumps to source. */
  doubleClickOpens: GitDoubleClickTarget;
}

export const DEFAULT_GIT_LOG_VIEW_PREFS: GitLogViewPrefs = {
  compactReferences: true,
  referencesOnLeft: false,
  showTagNames: true,
  showCommitTimestamp: false,
  showAuthorColumn: true,
  showHashColumn: false,
  showDateColumn: true,
  showSignatureColumn: false,
  highlightMergeCommits: true,
  highlightCurrentBranch: true,
  groupFilesByWorkspace: true,
  groupFilesByDirectory: true,
  showDetails: true,
  doubleClickOpens: 'diff',
};

const store = createWorkspacePrefsStore<GitLogViewPrefs>({
  storagePrefix: 'oh:gitLogView',
  defaults: DEFAULT_GIT_LOG_VIEW_PREFS,
  parse: (p) => ({
    compactReferences: p.compactReferences !== false,
    referencesOnLeft: p.referencesOnLeft === true,
    showTagNames: p.showTagNames !== false,
    showCommitTimestamp: p.showCommitTimestamp === true,
    showAuthorColumn: p.showAuthorColumn !== false,
    showHashColumn: p.showHashColumn === true,
    showDateColumn: p.showDateColumn !== false,
    showSignatureColumn: p.showSignatureColumn === true,
    highlightMergeCommits: p.highlightMergeCommits !== false,
    highlightCurrentBranch: p.highlightCurrentBranch !== false,
    groupFilesByWorkspace: p.groupFilesByWorkspace !== false,
    groupFilesByDirectory: p.groupFilesByDirectory !== false,
    showDetails: p.showDetails !== false,
    doubleClickOpens: p.doubleClickOpens === 'source' ? 'source' : 'diff',
  }),
});

export const getGitLogViewPrefs = store.get;
export const subscribeGitLogViewPrefs = store.subscribe;
export const patchGitLogViewPrefs = store.patch;
