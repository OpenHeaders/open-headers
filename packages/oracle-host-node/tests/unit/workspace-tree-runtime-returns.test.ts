/**
 * A deleted entity back in the tree — on the REAL runtime
 * (`_runtime-harness.ts`). Pins the wiring no pass module's own test
 * reaches: the engine asked what it holds deleted by the sweep, by a
 * pull and by a merge. In each the file that returns stays on disk as
 * git has it, nothing reads as changed, and a row names it.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { snapshotRulePostStates } from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DELETED_RETURN_MESSAGE } from '../../src/workspace-tree/deleted-returns';
import { openRuntimeHarness, type RuntimeHarness, until } from './_runtime-harness';

const RULE_UID = 'aaaaaaaa';
const RULE_FILE = `rules/block-probes-${RULE_UID}/rule.yaml`;
const RULE_TEXT = `schemaVersion: 5\nuid: ${RULE_UID}\nname: Block probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n`;

/** The tree watch's quiescence (400 ms after the last write) and its pass, several times over. */
const TREE_AT_REST_MS = 2_000;

let harness: RuntimeHarness;

const ruleFile = (): string => path.join(harness.rootDir, ...RULE_FILE.split('/'));
const engineHoldsTheRule = (): boolean =>
  snapshotRulePostStates(harness.workspaceId).some(({ rule }) => rule.uid === RULE_UID);
const ruleFileIsThere = (): Promise<boolean> =>
  fs.access(ruleFile()).then(
    () => true,
    () => false,
  );

/** The rule written by hand and taken in — uncommitted. */
async function writeRuleByHand(): Promise<void> {
  await fs.mkdir(path.dirname(ruleFile()), { recursive: true });
  await fs.writeFile(ruleFile(), RULE_TEXT, 'utf-8');
  await until('the engine takes the hand-written rule in', engineHoldsTheRule, 5_000);
}

/** The rule's file removed by hand, read as a deletion, and the deletion committed. */
async function deleteAndCommit(): Promise<void> {
  await fs.rm(ruleFile());
  await until('the engine reads the deletion', () => !engineHoldsTheRule(), 8_000);
  expect(await harness.runtime.commit(harness.workspaceId, 'delete')).toMatchObject({ ok: true, committed: true });
}

/** The file as git has it, nothing changed, the engine without the rule, and the row that says why. */
async function expectTheFileKept(): Promise<void> {
  await delay(TREE_AT_REST_MS);
  expect(await ruleFileIsThere()).toBe(true);
  expect(await harness.git('status', '--porcelain')).toBe('');
  expect(engineHoldsTheRule()).toBe(false);
  expect(harness.runtime.issues(harness.workspaceId)).toEqual([{ path: RULE_FILE, message: DELETED_RETURN_MESSAGE }]);
}

beforeEach(async () => {
  harness = await openRuntimeHarness();
});

afterEach(async () => {
  await harness.dispose();
});

describe('the workspace-tree runtime: a deleted entity back in the tree', () => {
  it('a rule one branch holds and the other does not survives a switch away and back', {
    timeout: 30_000,
  }, async () => {
    expect(await harness.runtime.commit(harness.workspaceId, 'base')).toMatchObject({ ok: true });
    const base = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
    await writeRuleByHand();
    expect(await harness.runtime.createBranch(harness.workspaceId, 'feature')).toMatchObject({ ok: true });
    expect(await harness.runtime.commit(harness.workspaceId, 'add rule')).toMatchObject({ ok: true, committed: true });

    expect(await harness.runtime.switchBranch(harness.workspaceId, base)).toMatchObject({ ok: true, switched: true });
    expect(await ruleFileIsThere()).toBe(false);
    expect(engineHoldsTheRule()).toBe(false);

    expect(await harness.runtime.switchBranch(harness.workspaceId, 'feature')).toMatchObject({
      ok: true,
      switched: true,
    });
    await expectTheFileKept();
  });

  it('a pull of a commit that restores a deleted rule fast-forwards to it and records nothing over it', {
    timeout: 30_000,
  }, async () => {
    await writeRuleByHand();
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true });
    const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-remote-'));
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    try {
      const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
      await harness.git('init', '-q', '--bare', remote);
      await harness.git('remote', 'add', 'origin', remote);
      await harness.git('push', '-q', '-u', 'origin', branch);
      await harness.git('clone', '-q', '-b', branch, remote, other);
      await deleteAndCommit();
      expect(await harness.runtime.push(harness.workspaceId)).toMatchObject({ ok: true });
      await harness.git('-C', other, 'pull', '-q');
      await harness.git('-C', other, 'revert', '--no-edit', 'HEAD');
      await harness.git('-C', other, 'push', '-q');
      const restored = await harness.git('-C', other, 'rev-parse', 'HEAD');

      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
      expect(await harness.git('rev-parse', 'HEAD')).toBe(restored);
      await expectTheFileKept();
    } finally {
      await fs.rm(remote, { recursive: true, force: true });
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('a merge of a branch that restores a deleted rule fast-forwards to it and records nothing over it', {
    timeout: 30_000,
  }, async () => {
    await writeRuleByHand();
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true });
    await deleteAndCommit();
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    try {
      // The branch to merge restores the rule in another clone and comes back by a fetch: no checkout moves this tree.
      await harness.git('clone', '-q', harness.rootDir, other);
      await harness.git('-C', other, 'checkout', '-q', '-b', 'side');
      await harness.git('-C', other, 'revert', '--no-edit', 'HEAD');
      await harness.git('fetch', '-q', other, 'side:side');
      const side = await harness.git('rev-parse', 'side');

      expect(await harness.runtime.mergeBranch(harness.workspaceId, 'side')).toMatchObject({
        ok: true,
        upToDate: false,
      });
      expect(await harness.git('rev-parse', 'HEAD')).toBe(side);
      await expectTheFileKept();
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });
});
