/**
 * git-console-view-state — the Console tab's view posture, per
 * workspace: the persisted Soft-Wrap preference (the gutter's toggle,
 * the shared per-workspace prefs posture) and the session-only Clear
 * All mark. The host keeps the audit ring whole — reads never alter
 * the §7 audit — so Clear All hides what the viewer has already seen:
 * every row up to and including the last row on screen at the clear.
 * Rows carry no id, so the mark is the tail row's timestamp plus how
 * many rows shared it; the ring appends in order, so the mark hides
 * exactly those rows on every later refetch and nothing newer.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import { createWorkspacePrefsStore } from './workspace-prefs-store';

export interface GitConsolePrefs {
  /** Soft-Wrap — fold long command lines and output at the pane's edge. */
  softWrap: boolean;
}

const DEFAULT_PREFS: GitConsolePrefs = { softWrap: true };

const prefs = createWorkspacePrefsStore<GitConsolePrefs>({
  storagePrefix: 'oh:gitConsole',
  defaults: DEFAULT_PREFS,
  parse: (p) => ({ softWrap: p.softWrap !== false }),
});

export const getGitConsolePrefs = prefs.get;
export const subscribeGitConsolePrefs = prefs.subscribe;
export const patchGitConsolePrefs = prefs.patch;

/** Where the viewer cleared — the tail row's `at` and how many rows carried it. */
export interface GitConsoleClearMark {
  at: string;
  count: number;
}

/** The mark Clear All leaves over a row list; null when there is nothing to hide. */
export function consoleClearMarkFor(rows: readonly WorkspaceTreeGitConsoleRowWire[]): GitConsoleClearMark | null {
  if (rows.length === 0) return null;
  const at = rows[rows.length - 1].at;
  let count = 0;
  for (const row of rows) if (row.at === at) count += 1;
  return { at, count };
}

/** The rows still visible after a mark: everything the mark does not cover. */
export function visibleConsoleRows(
  rows: readonly WorkspaceTreeGitConsoleRowWire[],
  mark: GitConsoleClearMark | null,
): WorkspaceTreeGitConsoleRowWire[] {
  if (mark === null) return [...rows];
  let seenAtMark = 0;
  const out: WorkspaceTreeGitConsoleRowWire[] = [];
  for (const row of rows) {
    if (row.at < mark.at) continue;
    if (row.at === mark.at && seenAtMark < mark.count) {
      seenAtMark += 1;
      continue;
    }
    out.push(row);
  }
  return out;
}

const clearMarks = new Map<string, GitConsoleClearMark>();

export function getGitConsoleClearMark(workspaceId: string): GitConsoleClearMark | null {
  return clearMarks.get(workspaceId) ?? null;
}

export function setGitConsoleClearMark(workspaceId: string, mark: GitConsoleClearMark | null): void {
  if (mark === null) clearMarks.delete(workspaceId);
  else clearMarks.set(workspaceId, mark);
}
