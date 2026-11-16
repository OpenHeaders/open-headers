/**
 * The runtime's hold while git writes the tree — on the REAL runtime
 * (`_runtime-harness.ts`). Pins the wiring no pass module's own test
 * reaches: the watch of git's writes handed to the sweep and to the
 * flush, and the pass taken again once the hold's wait is over, with
 * nothing else to bring one; and the passes that record the tree — a
 * commit, the Commit window's, a pull, a rollback — behind a flush git
 * holds: taken again on the lock's waits, refused like a busy index when
 * git never lets go.
 *
 * Another git process is stood in for by its lock: `index.lock`, made
 * by hand. Each of the first two legs waits the hold's five seconds once.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Rule } from '@openheaders/core/types';
import { planWorkspaceTree } from '@openheaders/core/workspace-tree';
import { snapshotRulePostStates } from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TREE_HELD_DETAIL } from '../../src/workspace-tree/materializer';
import { openRuntimeHarness, type RuntimeHarness, until } from './_runtime-harness';

const RULE_UID = 'aaaaaaaa';
const RULE_FILE = `rules/block-probes-${RULE_UID}/rule.yaml`;

/** Longer than the hold's wait (`OP_HOLD_RETRY_MS`), with the watcher's quiescence and a pass on top. */
const WITHIN_THE_HOLD_MS = 9_000;

let harness: RuntimeHarness;

const ruleFile = (): string => path.join(harness.rootDir, ...RULE_FILE.split('/'));
const lockFile = (): string => path.join(harness.rootDir, '.git', 'index.lock');
const engineHoldsTheRule = (): boolean =>
  snapshotRulePostStates(harness.workspaceId).some(({ rule }) => rule.uid === RULE_UID);

/** The lock as another git process takes it: created exclusively, never over one of the runtime's own passes. */
async function takeTheLockAsAnotherGit(): Promise<void> {
  await until(
    'the index lock free to take',
    async () => {
      try {
        await (await fs.open(lockFile(), 'wx')).close();
        return true;
      } catch {
        return false;
      }
    },
    5_000,
  );
}

/** A rule's file as the tree holds it, written by hand; answers once the engine has taken it in and the tree is at rest. */
async function seedRuleByHand(): Promise<string> {
  const rule = {
    schemaVersion: 5,
    uid: RULE_UID,
    path: `rules/block-probes-${RULE_UID}`,
    name: 'Block probes',
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
  } as Rule;
  const planned = planWorkspaceTree(
    {
      workspace: { schemaVersion: 5, uid: harness.workspaceId, name: 'Probe Workspace' },
      rules: [rule],
      collections: [],
      folders: [],
      requests: [],
      grpcRequests: [],
      websocketRequests: [],
      mqttRequests: [],
      graphqlRequests: [],
      requestCollections: [],
      requestFolders: [],
      templates: [],
      templateCollections: [],
      templateFolders: [],
      environments: [],
      workspaceVariables: null,
      vault: null,
      trustedRoots: null,
      specs: [],
      liveWorkflows: [],
      liveVariables: [],
    },
    {},
  ).find((file) => file.path === RULE_FILE);
  if (planned === undefined) throw new Error('the plan holds no file for the rule');
  await fs.mkdir(path.dirname(ruleFile()), { recursive: true });
  await fs.writeFile(ruleFile(), planned.content, 'utf-8');
  await until('the engine takes the hand-written rule in', engineHoldsTheRule, 5_000);
  // A commit runs on the chain behind the pass that took it in, and flushes first: the tree is at rest after.
  expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true });
  return fs.readFile(ruleFile(), 'utf-8');
}

const heldFlushes = (): number => harness.logged.filter((line) => line.includes('flush held for')).length;

/**
 * The rule renamed by hand under another git's lock, written as the
 * engine would not write it: the engine takes the name in, and the flush
 * after owes the file its own bytes — held. Answers both texts.
 */
async function renameByHandUnderTheLock(atRest: string): Promise<{ byHand: string; engines: string }> {
  const engines = atRest.replace('name: Block probes', 'name: Block all probes');
  const byHand = `${engines}# by hand\n`;
  await takeTheLockAsAnotherGit();
  await fs.writeFile(ruleFile(), byHand, 'utf-8');
  await until('the flush is held', () => heldFlushes() >= 1, 5_000);
  return { byHand, engines };
}

/** The lock given up once the pass asked for after `heldBefore` has had its own flush held. */
async function giveTheLockUpOnceHeld(heldBefore: number): Promise<void> {
  await until('the pass’s own flush is held', () => heldFlushes() > heldBefore, 5_000);
  await fs.rm(lockFile());
}

beforeEach(async () => {
  harness = await openRuntimeHarness();
});

afterEach(async () => {
  await harness.dispose();
});

describe('the workspace-tree runtime while git writes the tree', () => {
  it('a file gone under another git’s lock is no deletion, and the sweep is taken again once the lock is given up', {
    timeout: 30_000,
  }, async () => {
    await seedRuleByHand();
    await takeTheLockAsAnotherGit();
    await fs.rm(ruleFile());

    await until('the sweep is held', () => harness.logged.some((line) => line.includes('sweep held for')), 5_000);
    expect(engineHoldsTheRule()).toBe(true);

    // Nothing of the tree moves from here on: the hold's own wait alone brings the pass.
    await fs.rm(lockFile());
    await until('the sweep taken again reads the deletion', () => !engineHoldsTheRule(), WITHIN_THE_HOLD_MS);
  });

  it('a flush leaves a file to another git’s lock, and writes it once the lock is given up', {
    timeout: 30_000,
  }, async () => {
    const atRest = await seedRuleByHand();
    await takeTheLockAsAnotherGit();
    // A hand edit the engine reads the same: its sweep changes nothing and the flush after it owes the file its own bytes.
    await fs.writeFile(ruleFile(), `${atRest}# by hand\n`, 'utf-8');

    await until('the flush is held', () => harness.logged.some((line) => line.includes('flush held for')), 5_000);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(`${atRest}# by hand\n`);

    await fs.rm(lockFile());
    await until(
      'the flush taken again writes the file',
      async () => (await fs.readFile(ruleFile(), 'utf-8')) === atRest,
      WITHIN_THE_HOLD_MS,
    );
  });
});

describe('the workspace-tree runtime: a pass that records the tree behind a held flush', () => {
  it('a commit waits for git and records the engine’s bytes', { timeout: 30_000 }, async () => {
    const { engines } = await renameByHandUnderTheLock(await seedRuleByHand());
    const held = heldFlushes();
    const committing = harness.runtime.commit(harness.workspaceId, 'renamed');
    await giveTheLockUpOnceHeld(held);

    expect(await committing).toMatchObject({ ok: true, committed: true });
    expect(await harness.git('show', `HEAD:${RULE_FILE}`)).toBe(engines.trim());
    expect(await harness.git('status', '--porcelain')).toBe('');
  });

  it('the Commit window’s commit waits for git and records the engine’s bytes', { timeout: 30_000 }, async () => {
    const { engines } = await renameByHandUnderTheLock(await seedRuleByHand());
    const held = heldFlushes();
    const committing = harness.runtime.userCommit(harness.workspaceId, { message: 'renamed', paths: [RULE_FILE] });
    await giveTheLockUpOnceHeld(held);

    expect(await committing).toMatchObject({ ok: true, committed: true });
    expect(await harness.git('show', `HEAD:${RULE_FILE}`)).toBe(engines.trim());
    expect(await harness.git('status', '--porcelain')).toBe('');
  });

  it('a pull waits for git, and what the engine had pending stays uncommitted beside it', {
    timeout: 30_000,
  }, async () => {
    const atRest = await seedRuleByHand();
    const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-remote-'));
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    try {
      const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
      await harness.git('init', '-q', '--bare', remote);
      await harness.git('remote', 'add', 'origin', remote);
      await harness.git('push', '-q', '-u', 'origin', branch);
      await harness.git('clone', '-q', '-b', branch, remote, other);
      await fs.writeFile(path.join(other, 'notes.md'), 'a note from the other clone\n', 'utf-8');
      await harness.git('-C', other, 'add', 'notes.md');
      await harness.git('-C', other, 'commit', '-q', '-m', 'foreign');
      await harness.git('-C', other, 'push', '-q');
      const foreign = await harness.git('-C', other, 'rev-parse', 'HEAD');

      const { engines } = await renameByHandUnderTheLock(atRest);
      const held = heldFlushes();
      const pulling = harness.runtime.pull(harness.workspaceId);
      await giveTheLockUpOnceHeld(held);

      expect(await pulling).toMatchObject({ ok: true, upToDate: false });
      // The foreign commit alone: the rename was on disk before the pass read the tree, and is not the pull's to record.
      expect(await harness.git('rev-parse', 'HEAD')).toBe(foreign);
      expect(await harness.git('status', '--porcelain')).toBe(`M ${RULE_FILE}`);
      expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(engines);
    } finally {
      await fs.rm(remote, { recursive: true, force: true });
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('a rollback behind a flush git never lets go of is refused like a busy index', { timeout: 30_000 }, async () => {
    const { byHand } = await renameByHandUnderTheLock(await seedRuleByHand());

    expect(await harness.runtime.rollbackPaths(harness.workspaceId, [RULE_FILE], false)).toEqual({
      ok: false,
      reason: 'index-locked',
      detail: TREE_HELD_DETAIL,
    });
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(byHand);
  });
});
