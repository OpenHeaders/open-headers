/**
 * A ref moved outside the app reaches the status feed — on the REAL
 * runtime (`_runtime-harness.ts`). Pins the wiring between the git
 * directory's watch and the feed (`onRefMove` says the status again)
 * and the stamp that moves a frame for a ref that changes no name
 * (`refsStamp`). HEAD's file is never rewritten here, and the working
 * tree is brought to rest first: the watch of refs alone brings each
 * frame after.
 */

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
