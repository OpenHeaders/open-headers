/**
 * Pure-model suite for the Commit window's Commit Message History
 * popup: the list is the repo's own subjects (deduped, log order), the
 * arrow walk wraps, and the chord is Control alone.
 */

import type { WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import {
  commitMessageHistory,
  isCommitMessageHistoryChord,
  stepHistoryIndex,
} from '@openheaders/ui/workbench/components/panels/git/commit/commit-message-history';
import { describe, expect, it } from 'vitest';

function entry(subject: string, sha = subject): WorkspaceTreeLogEntryWire {
  return {
    sha,
    parents: [],
    authorName: 'John Doe',
    authorEmail: 'john@openheaders.io',
    authoredAt: '2026-11-03T08:00:00.000Z',
    subject,
    coAuthors: [],
    files: [],
  };
}

describe('commitMessageHistory', () => {
  it('keeps the log order, drops blanks and repeats', () => {
    const list = commitMessageHistory([
      entry('4th commit', 'd'),
      entry('3rd commit', 'c'),
      entry('  ', 'blank'),
      entry('3rd commit', 'c2'),
      entry('first commit', 'a'),
    ]);
    expect(list).toEqual(['4th commit', '3rd commit', 'first commit']);
  });

  it('answers an empty list for an unborn repo', () => {
    expect(commitMessageHistory([])).toEqual([]);
  });
});

describe('stepHistoryIndex', () => {
  it('enters at the top going down and the bottom going up, then wraps', () => {
    expect(stepHistoryIndex(-1, 3, 1)).toBe(0);
    expect(stepHistoryIndex(-1, 3, -1)).toBe(2);
    expect(stepHistoryIndex(2, 3, 1)).toBe(0);
    expect(stepHistoryIndex(0, 3, -1)).toBe(2);
    expect(stepHistoryIndex(1, 3, 1)).toBe(2);
  });

  it('stays out of an empty list', () => {
    expect(stepHistoryIndex(-1, 0, 1)).toBe(-1);
  });
});

describe('isCommitMessageHistoryChord', () => {
  it('is Control+M alone — never the command key, never with Option', () => {
    expect(isCommitMessageHistoryChord({ key: 'm', ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(isCommitMessageHistoryChord({ key: 'M', ctrlKey: true, metaKey: false, altKey: false })).toBe(true);
    expect(isCommitMessageHistoryChord({ key: 'm', ctrlKey: false, metaKey: true, altKey: false })).toBe(false);
    expect(isCommitMessageHistoryChord({ key: 'm', ctrlKey: true, metaKey: true, altKey: false })).toBe(false);
    expect(isCommitMessageHistoryChord({ key: 'm', ctrlKey: true, metaKey: false, altKey: true })).toBe(false);
    expect(isCommitMessageHistoryChord({ key: 'n', ctrlKey: true, metaKey: false, altKey: false })).toBe(false);
  });
});
