/**
 * A ref moved outside the app reaches the status feed — on the REAL
 * runtime (`_runtime-harness.ts`). Pins the wiring between the git
 * directory's watch and the feed (`onRefMove` says the status again)
 * and the stamp that moves a frame for a ref that changes no name
 * (`refsStamp`). HEAD's file is never rewritten here, and the working
 * tree is brought to rest first: the watch of refs alone brings each
 * frame after.
 *
 * And the working tree's rows changed outside the app with their count
 * where it was: the stamp of the rows (`workingChangesStamp`) on the
 * frame the status sends, which is all an open Commit window reads its
 * list again on.
 *
 * And the index moved alone — a file staged or unstaged from a terminal:
 * the wiring between the git directory's watch and the feed
 * (`onIndexMove` says the status again).
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { WorkspaceTreeGitStatusRpcResult } from '../../src/workspace-tree/runtime';
import { openRuntimeHarness, type RuntimeHarness, until } from './_runtime-harness';

/** The watch's burst, the feed's debounce and one status compute, with room. */
const WITHIN_A_FRAME_MS = 4_000;

/** The tree watch's quiescence (400 ms after the last write), its pass and the feed's frame — several times over. */
const TREE_AT_REST_MS = 2_000;

let harness: RuntimeHarness;

const lastFrame = (): WorkspaceTreeGitStatusRpcResult | undefined => harness.frames.at(-1);

/** The last frame once it holds `what`. */
async function frameWhere(
  what: string,
  holds: (frame: WorkspaceTreeGitStatusRpcResult) => boolean,
): Promise<WorkspaceTreeGitStatusRpcResult> {
  await until(
    what,
    () => {
      const frame = lastFrame();
      return frame !== undefined && holds(frame);
    },
    WITHIN_A_FRAME_MS,
  );
  const frame = lastFrame();
  if (frame === undefined) throw new Error(`no frame: ${what}`);
  return frame;
}

beforeEach(async () => {
  harness = await openRuntimeHarness();
});

afterEach(async () => {
  await harness.dispose();
});

describe('the workspace-tree runtime hears a ref moved outside the app', () => {
  it('a commit, a branch made, moved in place and deleted by a plain git each send a frame', {
    timeout: 30_000,
  }, async () => {
    expect(await harness.runtime.commit(harness.workspaceId, 'one')).toMatchObject({ ok: true, committed: true });
    const one = await harness.git('rev-parse', 'HEAD');
    await frameWhere('the frame of the first commit', (frame) => frame.headSha === one);

    // The bind's own writes are still owed a pass of the tree's watch, and what that pass says of the status
    // would stand in for the frames waited for below. The pass leaves no mark where nothing changed: it is
    // waited out.
    await delay(TREE_AT_REST_MS);

    // The checked-out branch moves under HEAD: git locks HEAD and does not rewrite it.
    await harness.git('commit', '-q', '--allow-empty', '-m', 'two');
    const two = await harness.git('rev-parse', 'HEAD');
    await frameWhere('a terminal commit on the checked-out branch', (frame) => frame.headSha === two);

    await harness.git('branch', 'side', one);
    const made = await frameWhere('a branch made', (frame) => frame.branches.includes('side'));

    // No name and no HEAD moves with this one: the stamp of the refs alone does.
    await harness.git('branch', '-f', 'side', two);
    const moved = await frameWhere('a branch moved in place', (frame) => frame.refsStamp !== made.refsStamp);
    expect({ ...moved, refsStamp: made.refsStamp }).toEqual(made);

    await harness.git('branch', '-D', 'side');
    await frameWhere('a branch deleted', (frame) => !frame.branches.includes('side'));
  });
});

describe('the workspace-tree runtime says the Commit window’s rows changed where their count did not', () => {
  it('one file put back and another edited, and a file added to a folder untracked whole, each send a frame', {
    timeout: 30_000,
  }, async () => {
    const at = (name: string): string => path.join(harness.rootDir, name);
    await fs.writeFile(at('a.txt'), 'a, as committed\n', 'utf-8');
    await fs.writeFile(at('b.txt'), 'b, as committed\n', 'utf-8');
    await delay(TREE_AT_REST_MS);
    await harness.git('add', '-A');
    await harness.git('commit', '-q', '-m', 'seed');
    const seed = await harness.git('rev-parse', 'HEAD');
    await frameWhere('the seed committed', (frame) => frame.headSha === seed && frame.dirtyFiles === 0);
    await delay(TREE_AT_REST_MS);

    await fs.writeFile(at('a.txt'), 'a, edited\n', 'utf-8');
    const edited = await frameWhere('a file edited', (frame) => frame.dirtyFiles === 1);

    // One row before and one after, at another file: the count the frame carries reads the same.
    await fs.writeFile(at('a.txt'), 'a, as committed\n', 'utf-8');
    await fs.writeFile(at('b.txt'), 'b, edited\n', 'utf-8');
    const other = await frameWhere(
      'one file put back and another edited',
      (frame) => frame.dirtyFiles === 1 && frame.changesStamp !== edited.changesStamp,
    );
    expect({ ...other, changesStamp: edited.changesStamp }).toEqual(edited);

    await fs.mkdir(at('notes'));
    await fs.writeFile(at('notes/one.md'), 'one\n', 'utf-8');
    const folder = await frameWhere('a folder made with one file', (frame) => frame.dirtyFiles === 2);

    // The count reads a folder untracked whole as one row; the window lists each file in it.
    await fs.writeFile(at('notes/two.md'), 'two\n', 'utf-8');
    const second = await frameWhere(
      'a second file in that folder',
      (frame) => frame.dirtyFiles === 2 && frame.changesStamp !== folder.changesStamp,
    );
    expect({ ...second, changesStamp: folder.changesStamp }).toEqual(folder);
    const listed = await harness.runtime.changes(harness.workspaceId);
    expect(listed.ok && listed.changes.map((change) => change.path)).toEqual(['b.txt', 'notes/one.md', 'notes/two.md']);
  });
});

describe('the workspace-tree runtime hears the index moved outside the app', () => {
  it('a file staged from a terminal, and unstaged, each send a frame', { timeout: 30_000 }, async () => {
    /** The letter the Commit window shows at the file. */
    const letter = async (): Promise<string[]> => {
      const listed = await harness.runtime.changes(harness.workspaceId);
      if (!listed.ok) return [listed.reason];
      return listed.changes.filter((change) => change.path === 'notes.md').map((change) => change.status);
    };
    await delay(TREE_AT_REST_MS);
    const before = await harness.runtime.gitStatus(harness.workspaceId);
    await fs.writeFile(path.join(harness.rootDir, 'notes.md'), '# mine\n', 'utf-8');
    const made = await frameWhere('a file made', (frame) => frame.changesStamp !== before.changesStamp);
    expect([made.userIndexBusy, await letter()]).toEqual([false, ['?']]);
    await delay(TREE_AT_REST_MS);

    // No file of the tree moves, no ref and no HEAD: the index's entry alone.
    await harness.git('add', 'notes.md');
    const staged = await frameWhere('the file staged', (frame) => frame.userIndexBusy);
    expect(staged.changesStamp).not.toBe(made.changesStamp);
    expect(await letter()).toEqual(['A']);

    await harness.git('reset', '-q', '--', 'notes.md');
    const unstaged = await frameWhere('the file unstaged', (frame) => !frame.userIndexBusy);
    expect(unstaged).toEqual(made);
    expect(await letter()).toEqual(['?']);
  });
});
