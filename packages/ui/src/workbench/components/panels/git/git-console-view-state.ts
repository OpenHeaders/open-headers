/**
 * git-console-view-state — the Console tab's view posture, per
 * workspace: the persisted gutter toggles (Soft-Wrap, Fold Options,
 * Shorten Paths — the shared per-workspace prefs posture) and the
 * session-only Clear All mark. The host keeps the audit ring whole —
 * reads never alter the §7 audit — so Clear All hides what the viewer
 * has already seen: every row up to and including the last row on
 * screen at the clear. Rows carry the ring's monotonic id, so the mark
 * is that id and every later refetch hides exactly the rows at or
 * below it and nothing newer.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { createWorkspacePrefsStore } from './workspace-prefs-store';

export interface GitConsolePrefs {
  /** Soft-Wrap — fold long command lines and output at the pane's edge. */
  softWrap: boolean;
  /** Fold Options — the pinned global options collapse to one chip per row. */
  foldOptions: boolean;
  /** Shorten Paths — absolute paths elide their middle components. */
  shortenPaths: boolean;
}

const DEFAULT_PREFS: GitConsolePrefs = { softWrap: true, foldOptions: true, shortenPaths: true };

const prefs = createWorkspacePrefsStore<GitConsolePrefs>({
  storagePrefix: 'oh:gitConsole',
  defaults: DEFAULT_PREFS,
  parse: (p) => ({
    softWrap: p.softWrap !== false,
    foldOptions: p.foldOptions !== false,
    shortenPaths: p.shortenPaths !== false,
  }),
});

export const getGitConsolePrefs = prefs.get;
export const subscribeGitConsolePrefs = prefs.subscribe;
export const patchGitConsolePrefs = prefs.patch;

/** Where the viewer cleared — the id of the last row on screen; null when there was nothing to hide. */
export type GitConsoleClearMark = number | null;

/** The mark Clear All leaves over a row list. */
export function consoleClearMarkFor(rows: readonly WorkspaceTreeGitConsoleRowWire[]): GitConsoleClearMark {
  return rows.length === 0 ? null : rows[rows.length - 1].seq;
}

/** The rows still visible after a mark: everything the ring appended after it. */
export function visibleConsoleRows(
  rows: readonly WorkspaceTreeGitConsoleRowWire[],
  mark: GitConsoleClearMark,
): WorkspaceTreeGitConsoleRowWire[] {
  return mark === null ? [...rows] : rows.filter((row) => row.seq > mark);
}

const clearMarks = new Map<string, number>();

export function getGitConsoleClearMark(workspaceId: string): GitConsoleClearMark {
  return clearMarks.get(workspaceId) ?? null;
}

export function setGitConsoleClearMark(workspaceId: string, mark: GitConsoleClearMark): void {
  if (mark === null) clearMarks.delete(workspaceId);
  else clearMarks.set(workspaceId, mark);
}
