/**
 * A deleted entity back in the tree — on the REAL runtime
 * (`_runtime-harness.ts`). Pins the wiring no pass module's own test
 * reaches: the engine asked what it holds deleted by the sweep, by a
 * pull, by a merge, by a Revert and by a rewritten history taken whole. In each the entity lives again as its file has
 * it, the file stays on disk as git has it, and nothing reads as
 * changed.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { COLLECTION_ENTITY_TYPE, FOLDER_ITEMS_PATH } from '@openheaders/core/sync';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  snapshotCollectionPostStates,
  snapshotRulePostStates,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openRuntimeHarness, type RuntimeHarness, until } from './_runtime-harness';

const RULE_UID = 'aaaaaaaa';
const RULE_FILE = `rules/block-probes-${RULE_UID}/rule.yaml`;
const RULE_TEXT = `schemaVersion: 5\nuid: ${RULE_UID}\nname: Block probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n`;

const COLLECTION_UID = 'col0000a';
const COLLECTION_DIR = `rules/api-${COLLECTION_UID}`;
const COLLECTION_TEXT = `schemaVersion: 5\nuid: ${COLLECTION_UID}\nname: API\nvariables: []\n`;
const NESTED_RULE_UID = 'bbbbbbbb';
const NESTED_RULE_DIR = `${COLLECTION_DIR}/delay-probes-${NESTED_RULE_UID}`;
const NESTED_RULE_TEXT = `schemaVersion: 5\nuid: ${NESTED_RULE_UID}\nname: Delay probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n`;

/** The tree watch's quiescence (400 ms after the last write) and its pass, several times over. */
const TREE_AT_REST_MS = 2_000;

let harness: RuntimeHarness;

const inTree = (relative: string): string => path.join(harness.rootDir, ...relative.split('/'));
const ruleFile = (): string => inTree(RULE_FILE);
const ruleOf = (uid: string) => snapshotRulePostStates(harness.workspaceId).find(({ rule }) => rule.uid === uid)?.rule;
const engineHoldsTheRule = (): boolean => ruleOf(RULE_UID) !== undefined;
const engineHoldsTheCollection = (): boolean =>
  snapshotCollectionPostStates(harness.workspaceId).some((state) => state.collection.uid === COLLECTION_UID);
/** The uids the collection's own set of items holds — the engine's containment, not a path that reads alike. */
function rulesInTheCollection(): string[] {
  const service = getOrCreateWorkspaceService(harness.workspaceId);
  try {
    return service.oracle
      .liveSetItems(COLLECTION_ENTITY_TYPE, COLLECTION_UID, FOLDER_ITEMS_PATH)
      .map((entry) => entry.itemId);
  } finally {
    releaseWorkspaceService(harness.workspaceId);
  }
}
const isThere = (relative: string): Promise<boolean> =>
  fs.access(inTree(relative)).then(
    () => true,
    () => false,
  );

async function writeByHand(relative: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(inTree(relative)), { recursive: true });
  await fs.writeFile(inTree(relative), text, 'utf-8');
}

/** The rule written by hand and taken in — uncommitted. */
async function writeRuleByHand(): Promise<void> {
  await writeByHand(RULE_FILE, RULE_TEXT);
  await until('the engine takes the hand-written rule in', engineHoldsTheRule, 5_000);
}

/** The rule's file removed by hand, read as a deletion, and the deletion committed. */
async function deleteAndCommit(): Promise<void> {
  await fs.rm(ruleFile());
  await until('the engine reads the deletion', () => !engineHoldsTheRule(), 8_000);
  expect(await harness.runtime.commit(harness.workspaceId, 'delete')).toMatchObject({ ok: true, committed: true });
}

/** The rule in the engine again, its file as git has it, nothing changed and no row raised. */
async function expectTheRuleBack(): Promise<void> {
  await until('the engine holds the rule again', engineHoldsTheRule, 8_000);
  await delay(TREE_AT_REST_MS);
  expect(await isThere(RULE_FILE)).toBe(true);
  expect(await harness.git('status', '--porcelain')).toBe('');
  expect(engineHoldsTheRule()).toBe(true);
  expect(harness.runtime.issues(harness.workspaceId)).toEqual([]);
}

beforeEach(async () => {
  harness = await openRuntimeHarness();
});

afterEach(async () => {
  await harness.dispose();
});

describe('the workspace-tree runtime: a deleted entity back in the tree', () => {
  it('a rule one branch holds and the other does not is back after a switch away and back', {
    timeout: 30_000,
  }, async () => {
    expect(await harness.runtime.commit(harness.workspaceId, 'base')).toMatchObject({ ok: true });
    const base = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
    await writeRuleByHand();
    expect(await harness.runtime.createBranch(harness.workspaceId, 'feature')).toMatchObject({ ok: true });
    expect(await harness.runtime.commit(harness.workspaceId, 'add rule')).toMatchObject({ ok: true, committed: true });

    expect(await harness.runtime.switchBranch(harness.workspaceId, base)).toMatchObject({ ok: true, switched: true });
    expect(await isThere(RULE_FILE)).toBe(false);
    expect(engineHoldsTheRule()).toBe(false);

    expect(await harness.runtime.switchBranch(harness.workspaceId, 'feature')).toMatchObject({
      ok: true,
      switched: true,
    });
    await expectTheRuleBack();

    // And away again: the restored rule leaves like any other.
    expect(await harness.runtime.switchBranch(harness.workspaceId, base)).toMatchObject({ ok: true, switched: true });
    await until('the engine reads the rule gone again', () => !engineHoldsTheRule(), 8_000);
    expect(await harness.git('status', '--porcelain')).toBe('');
  });

  it('a collection and its rule that one branch holds are back together, the rule in the collection', {
    timeout: 30_000,
  }, async () => {
    expect(await harness.runtime.commit(harness.workspaceId, 'base')).toMatchObject({ ok: true });
    const base = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
    await writeByHand(`${COLLECTION_DIR}/_collection.yaml`, COLLECTION_TEXT);
    await writeByHand(`${NESTED_RULE_DIR}/rule.yaml`, NESTED_RULE_TEXT);
    await until('the engine takes both in', () => rulesInTheCollection().includes(NESTED_RULE_UID), 8_000);
    expect(await harness.runtime.createBranch(harness.workspaceId, 'feature')).toMatchObject({ ok: true });
    expect(await harness.runtime.commit(harness.workspaceId, 'add both')).toMatchObject({ ok: true, committed: true });

    expect(await harness.runtime.switchBranch(harness.workspaceId, base)).toMatchObject({ ok: true, switched: true });
    await until(
      'the engine reads both gone',
      () => !engineHoldsTheCollection() && ruleOf(NESTED_RULE_UID) === undefined,
      8_000,
    );

    expect(await harness.runtime.switchBranch(harness.workspaceId, 'feature')).toMatchObject({
      ok: true,
      switched: true,
    });
    await until(
      'the engine holds both again',
      () => engineHoldsTheCollection() && ruleOf(NESTED_RULE_UID) !== undefined,
      8_000,
    );
    await delay(TREE_AT_REST_MS);
    expect(rulesInTheCollection()).toEqual([NESTED_RULE_UID]);
    expect(ruleOf(NESTED_RULE_UID)?.path).toBe(NESTED_RULE_DIR);
    expect(await isThere(`${NESTED_RULE_DIR}/rule.yaml`)).toBe(true);
    expect(await harness.git('status', '--porcelain')).toBe('');
    expect(harness.runtime.issues(harness.workspaceId)).toEqual([]);
  });

  it('the app’s Revert of the commit that deleted a rule brings the rule back and records the revert', {
    timeout: 30_000,
  }, async () => {
    await writeRuleByHand();
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true });
    await deleteAndCommit();
    const deletion = await harness.git('rev-parse', 'HEAD');

    expect(await harness.runtime.applyCommit(harness.workspaceId, deletion, 'revert')).toMatchObject({ ok: true });
    expect(await harness.git('rev-parse', 'HEAD~1')).toBe(deletion);
    expect(await harness.git('show', '--format=', '--name-status', 'HEAD')).toBe(`A\t${RULE_FILE}`);
    await expectTheRuleBack();
  });

  it('a pull of a commit that restores a deleted rule fast-forwards to it and the rule is back', {
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
      await expectTheRuleBack();
    } finally {
      await fs.rm(remote, { recursive: true, force: true });
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('a remote history rewritten to hold a deleted rule, taken whole, brings the rule back', {
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
      // The last head both sides knew, then the deletion on this side alone.
      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true });
      await deleteAndCommit();
      // The other clone rewrites the pushed history; its head still holds the rule.
      await harness.git('-C', other, 'commit', '-q', '--amend', '-m', 'seed, rewritten');
      await harness.git('-C', other, 'push', '-q', '--force');
      const rewritten = await harness.git('-C', other, 'rev-parse', 'HEAD');

      expect(await harness.runtime.resolveForcePush(harness.workspaceId, 'abandon')).toMatchObject({ ok: true });
      // The branch sits on the rewritten history (`merge-base` rejects otherwise).
      await harness.git('merge-base', '--is-ancestor', rewritten, 'HEAD');
      await expectTheRuleBack();
    } finally {
      await fs.rm(remote, { recursive: true, force: true });
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('a merge of a branch that restores a deleted rule fast-forwards to it and the rule is back', {
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
      await expectTheRuleBack();
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });
});
