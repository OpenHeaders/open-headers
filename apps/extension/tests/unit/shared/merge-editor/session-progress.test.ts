/**
 * A session with several files shares one pane: what a file held when
 * the person selected another must still count. Pins the per-file
 * count the sidebar and the Complete Merge gate read, and the texts
 * Apply sends.
 */

import {
  type LeftFile,
  remainingByFile,
  seedHunkCount,
  sessionResults,
} from '@openheaders/ui/shared/merge-editor/session-progress';
import type { MergeFile } from '@openheaders/ui/shared/merge-editor/types';
import { describe, expect, it } from 'vitest';

function modify(id: string, theirs: string, mine: string): MergeFile {
  return { id, label: id, kind: 'modify', base: 'name: base\n', theirs, mine, initialResult: mine };
}

const A = modify('a.yaml', 'name: theirs a\n', 'name: mine a\n');
const B = modify('b.yaml', 'name: theirs b\n', 'name: mine b\n');
const NONE: ReadonlyMap<string, string> = new Map();

/** A file answered hunk by hunk: the result took the incoming line, nothing pending. */
const answered = (file: MergeFile): LeftFile => ({
  text: file.theirs,
  picks: new Map([['h', { theirs: 'accepted', mine: 'dismissed' }]]),
  remaining: 0,
});

describe('remainingByFile', () => {
  it('a file never opened counts the hunks of its seed; the file in the pane reports live', () => {
    const counts = remainingByFile({
      files: [A, B],
      seeds: NONE,
      left: new Map(),
      activeFileId: 'a.yaml',
      activeRemaining: 2,
    });
    expect([...counts]).toEqual([
      ['a.yaml', 2],
      ['b.yaml', 1],
    ]);
  });

  it('a file answered and left stays answered while another is in the pane — its text differs from one side by design', () => {
    const left = new Map([['a.yaml', answered(A)]]);
    // The text the file was left with still differs from `mine`: a count read back from the text would never reach zero.
    expect(seedHunkCount(A, answered(A).text)).toBeGreaterThan(0);
    const counts = remainingByFile({ files: [A, B], seeds: NONE, left, activeFileId: 'b.yaml', activeRemaining: 0 });
    expect([...counts.values()]).toEqual([0, 0]);
  });

  it('a file left half answered keeps what was pending', () => {
    const left = new Map([['a.yaml', { ...answered(A), remaining: 1 }]]);
    const counts = remainingByFile({ files: [A, B], seeds: NONE, left, activeFileId: 'b.yaml', activeRemaining: 0 });
    expect(counts.get('a.yaml')).toBe(1);
  });

  it('a session-wide seed is what an unopened file is counted against', () => {
    const add: MergeFile = { ...A, id: 'new.yaml', kind: 'add', mine: '', initialResult: '' };
    const seeds = new Map([['new.yaml', add.theirs]]);
    expect(seedHunkCount(add, add.initialResult)).toBe(1);
    const counts = remainingByFile({ files: [add], seeds, left: new Map(), activeFileId: null, activeRemaining: 0 });
    expect(counts.get('new.yaml')).toBe(0);
  });
});

describe('sessionResults', () => {
  it("sends the pane's text for the active file, a visited file as it was left, any other its seed", () => {
    const C = modify('c.yaml', 'name: theirs c\n', 'name: mine c\n');
    const D = modify('d.yaml', 'name: theirs d\n', 'name: mine d\n');
    const results = sessionResults({
      files: [A, B, C, D],
      seeds: new Map([['d.yaml', D.theirs]]),
      left: new Map([['a.yaml', answered(A)]]),
      activeFileId: 'b.yaml',
      activeText: 'name: agreed b\n',
    });
    expect([...results]).toEqual([
      ['a.yaml', 'name: theirs a\n'],
      ['b.yaml', 'name: agreed b\n'],
      ['c.yaml', 'name: mine c\n'],
      ['d.yaml', 'name: theirs d\n'],
    ]);
  });
});
