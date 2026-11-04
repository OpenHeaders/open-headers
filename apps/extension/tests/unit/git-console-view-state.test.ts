/**
 * Git console view state: the Clear All mark over the host's audit ring —
 * the mark is the id of the last row on screen at the clear, so it
 * hides exactly those rows and nothing appended after, across refetches
 * and the ring rolling past the mark; the gutter prefs parse with
 * their defaults and toggle per workspace.
 */

import type { WorkspaceTreeGitConsoleRowWire } from '@openheaders/core/bridge';
import {
  consoleClearMarkFor,
  getGitConsoleClearMark,
  getGitConsolePrefs,
  patchGitConsolePrefs,
  setGitConsoleClearMark,
  visibleConsoleRows,
} from '@openheaders/ui/workbench/components/panels/git/git-console-view-state';
import { describe, expect, it } from 'vitest';

const row = (seq: number, verb: string): WorkspaceTreeGitConsoleRowWire => ({
  seq,
  at: `2026-11-03T10:00:0${seq}.000Z`,
  options: ['--git-dir', '/ws/.git', '--work-tree', '/ws'],
  command: [verb],
  cwd: '/ws',
  code: 0,
  durationMs: 1,
  output: '',
});

const verbs = (rows: readonly WorkspaceTreeGitConsoleRowWire[]): string[] => rows.map((r) => r.command[0]);

describe('git console clear mark', () => {
  it('an empty feed leaves no mark', () => {
    expect(consoleClearMarkFor([])).toBeNull();
    expect(visibleConsoleRows([], null)).toEqual([]);
  });

  it('hides every row on screen at the clear and keeps what lands afterwards', () => {
    const seen = [row(1, 'init'), row(2, 'commit')];
    const mark = consoleClearMarkFor(seen);
    expect(mark).toBe(2);
    expect(visibleConsoleRows(seen, mark)).toEqual([]);
    const later = [...seen, row(3, 'push')];
    expect(verbs(visibleConsoleRows(later, mark))).toEqual(['push']);
  });

  it('the ring rolling past the mark still shows only newer rows', () => {
    const rolled = [row(5, 'pull'), row(6, 'push')];
    expect(verbs(visibleConsoleRows(rolled, 2))).toEqual(['pull', 'push']);
  });

  it('the mark is held per workspace for the session and clears to null', () => {
    setGitConsoleClearMark('ws-a', 7);
    expect(getGitConsoleClearMark('ws-a')).toBe(7);
    expect(getGitConsoleClearMark('ws-b')).toBeNull();
    setGitConsoleClearMark('ws-a', null);
    expect(getGitConsoleClearMark('ws-a')).toBeNull();
  });
});

describe('git console prefs', () => {
  it('every gutter toggle defaults on and toggles per workspace', () => {
    expect(getGitConsolePrefs('ws-prefs')).toEqual({ softWrap: true, foldOptions: true, shortenPaths: true });
    patchGitConsolePrefs('ws-prefs', { softWrap: false });
    patchGitConsolePrefs('ws-prefs', { shortenPaths: false });
    expect(getGitConsolePrefs('ws-prefs')).toEqual({ softWrap: false, foldOptions: true, shortenPaths: false });
    expect(getGitConsolePrefs('ws-other')).toEqual({ softWrap: true, foldOptions: true, shortenPaths: true });
  });
});
