/**
 * Git console view state: the Clear All mark over the host's audit ring —
 * the mark hides exactly the rows on screen at the clear (the tail
 * timestamp plus how many rows shared it) and nothing appended after,
 * across refetches and the ring rolling past the mark; the Soft-Wrap
 * pref parses with its default.
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

const row = (at: string, arg: string): WorkspaceTreeGitConsoleRowWire => ({
  at,
  args: [arg],
  cwd: '/ws',
  code: 0,
  durationMs: 1,
  output: '',
});

describe('git console clear mark', () => {
  it('an empty feed leaves no mark', () => {
    expect(consoleClearMarkFor([])).toBeNull();
    expect(visibleConsoleRows([], null)).toEqual([]);
  });

  it('hides every row on screen at the clear and keeps what lands afterwards', () => {
    const seen = [row('2026-11-03T10:00:00.000Z', 'status'), row('2026-11-03T10:00:01.000Z', 'commit')];
    const mark = consoleClearMarkFor(seen);
    expect(mark).toEqual({ at: '2026-11-03T10:00:01.000Z', count: 1 });
    expect(visibleConsoleRows(seen, mark)).toEqual([]);
    const later = [...seen, row('2026-11-03T10:00:02.000Z', 'push')];
    expect(visibleConsoleRows(later, mark).map((r) => r.args[0])).toEqual(['push']);
  });

  it('a tail timestamp shared by several rows hides only the rows that carried it at the clear', () => {
    const at = '2026-11-03T10:00:01.000Z';
    const seen = [row('2026-11-03T10:00:00.000Z', 'status'), row(at, 'add'), row(at, 'commit')];
    const mark = consoleClearMarkFor(seen);
    expect(mark).toEqual({ at, count: 2 });
    const later = [...seen, row(at, 'push'), row('2026-11-03T10:00:03.000Z', 'fetch')];
    expect(visibleConsoleRows(later, mark).map((r) => r.args[0])).toEqual(['push', 'fetch']);
  });

  it('the ring rolling past the mark still shows only newer rows', () => {
    const mark = { at: '2026-11-03T10:00:01.000Z', count: 1 };
    const rolled = [row('2026-11-03T10:00:05.000Z', 'pull'), row('2026-11-03T10:00:06.000Z', 'push')];
    expect(visibleConsoleRows(rolled, mark).map((r) => r.args[0])).toEqual(['pull', 'push']);
  });

  it('the mark is held per workspace for the session and clears to null', () => {
    setGitConsoleClearMark('ws-a', { at: '2026-11-03T10:00:01.000Z', count: 1 });
    expect(getGitConsoleClearMark('ws-a')).toEqual({ at: '2026-11-03T10:00:01.000Z', count: 1 });
    expect(getGitConsoleClearMark('ws-b')).toBeNull();
    setGitConsoleClearMark('ws-a', null);
    expect(getGitConsoleClearMark('ws-a')).toBeNull();
  });
});

describe('git console prefs', () => {
  it('soft-wrap defaults on and toggles per workspace', () => {
    expect(getGitConsolePrefs('ws-prefs').softWrap).toBe(true);
    patchGitConsolePrefs('ws-prefs', { softWrap: false });
    expect(getGitConsolePrefs('ws-prefs').softWrap).toBe(false);
    expect(getGitConsolePrefs('ws-other').softWrap).toBe(true);
  });
});
