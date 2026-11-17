/**
 * The runtime's hold while git writes the tree — on the REAL runtime
 * (`_runtime-harness.ts`). Pins the wiring no pass module's own test
 * reaches: the watch of git's writes handed to the sweep and to the
 * flush, and the pass taken again once the hold's wait is over, with
 * nothing else to bring one; and the passes that record the tree — a
 * commit, the Commit window's, a pull, a merge, a rollback — behind a flush git
 * holds: taken again on the lock's waits, refused like a busy index when
 * git never lets go.
 *
 * Another git process is stood in for by its lock: `index.lock`, made
 * by hand. An edit the engine has pending is a real one, applied to the
 * engine with no flush asked. The legs of the first describe wait the
 * hold's five seconds once each.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { synthesizeWorkspaceTreeDelta } from '@openheaders/core/sync-builders/mutations/workspace-tree-delta';
import type { Collection, Rule } from '@openheaders/core/types';
import { planWorkspaceTree } from '@openheaders/core/workspace-tree';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  snapshotRulePostStates,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TREE_HELD_DETAIL } from '../../src/workspace-tree/materializer';
import { TREE_SURFACE_ID } from '../../src/workspace-tree/runtime/core';
import { applyAll, buildSnapshot } from '../../src/workspace-tree/runtime/snapshot';
import { openRuntimeHarness, type RuntimeHarness, until } from './_runtime-harness';

const RULE_UID = 'aaaaaaaa';
const COLLECTION_DIR = 'rules/api-col0000a';
const COLLECTION_FILE = `${COLLECTION_DIR}/_collection.yaml`;
const RULE_FILE = `${COLLECTION_DIR}/block-probes-${RULE_UID}/rule.yaml`;

/** Longer than the hold's wait (`OP_HOLD_RETRY_MS`), with the watcher's quiescence and a pass on top. */
const WITHIN_THE_HOLD_MS = 9_000;

/** The tree watch's quiescence (400 ms after the last write) and its pass, several times over. */
const TREE_AT_REST_MS = 2_000;

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

/** A rule in a collection, their files as the tree holds them, written by hand; answers once the engine has taken them in and the tree is at rest. */
async function seedRuleByHand(): Promise<string> {
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'col0000a',
    path: COLLECTION_DIR,
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const rule = {
    schemaVersion: 5,
    uid: RULE_UID,
    path: `${COLLECTION_DIR}/block-probes-${RULE_UID}`,
    name: 'Block probes',
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
  } as Rule;
  const plan = planWorkspaceTree(
    {
      workspace: { schemaVersion: 5, uid: harness.workspaceId, name: 'Probe Workspace' },
      rules: [rule],
      collections: [collection],
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
  );
  const manifest = plan.find((file) => file.path === COLLECTION_FILE);
  const planned = plan.find((file) => file.path === RULE_FILE);
  if (manifest === undefined || planned === undefined) throw new Error('the plan holds no file for the rule');
  await fs.mkdir(path.dirname(ruleFile()), { recursive: true });
  await fs.writeFile(path.join(harness.rootDir, ...COLLECTION_FILE.split('/')), manifest.content, 'utf-8');
  await fs.writeFile(ruleFile(), planned.content, 'utf-8');
  await until('the engine takes the hand-written rule in', engineHoldsTheRule, 5_000);
  // A commit runs on the chain behind the pass that took it in, and flushes first: the tree is at rest after.
  expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true });
  return fs.readFile(ruleFile(), 'utf-8');
}

const heldFlushes = (): number => harness.logged.filter((line) => line.includes('flush held for')).length;
const sweepsHeld = (): number => harness.logged.filter((line) => line.includes('sweep held for')).length;

/**
 * The rule renamed IN THE ENGINE under another git's lock, with no flush
 * asked: the edit is pending, and the next flush owes the file its
 * bytes — held while the lock stands. Answers the file as the engine
 * will write it.
 */
async function renameInTheEngineUnderTheLock(atRest: string): Promise<string> {
  await takeTheLockAsAnotherGit();
  const service = getOrCreateWorkspaceService(harness.workspaceId);
  try {
    const prev = await buildSnapshot(harness.workspaceId, service);
    const next = {
      ...prev,
      rules: prev.rules.map((rule) => (rule.uid === RULE_UID ? { ...rule, name: 'Block all probes' } : rule)),
    };
    await applyAll(
      service,
      synthesizeWorkspaceTreeDelta({
        prev,
        next,
        changedPaths: new Set([RULE_FILE]),
        removedPaths: new Set(),
        deps: {
          nextCtx: () => service.context.next({ surfaceId: TREE_SURFACE_ID }),
          liveSetEntries: (entityType, id, setPath) =>
            service.oracle
              .liveOrderedSetItems(entityType, id, setPath)
              .map((entry) => ({ itemId: entry.itemId, orderKey: entry.key, item: entry.item })),
        },
      }),
    );
  } finally {
    releaseWorkspaceService(harness.workspaceId);
  }
  expect(snapshotRulePostStates(harness.workspaceId).map(({ rule }) => rule.name)).toEqual(['Block all probes']);
  return atRest.replace('name: Block probes', 'name: Block all probes');
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

    await until('the sweep is held', () => sweepsHeld() >= 1, 5_000);
    expect(engineHoldsTheRule()).toBe(true);

    // Nothing of the tree moves from here on: the hold's own wait alone brings the pass.
    await fs.rm(lockFile());
    await until('the sweep taken again reads the deletion', () => !engineHoldsTheRule(), WITHIN_THE_HOLD_MS);
  });

  it('under a lock nobody gives up, a file gone is a deletion once a reading agrees with one of a while before', {
    timeout: 30_000,
  }, async () => {
    await seedRuleByHand();
    // A file of the user's own, there from the start: written again as it is, it wakes the tree's watch and changes no reading.
    const notes = path.join(harness.rootDir, 'notes.md');
    await fs.writeFile(notes, 'mine\n', 'utf-8');
    await delay(TREE_AT_REST_MS);
    await takeTheLockAsAnotherGit();
    await fs.rm(ruleFile());
    await until('the sweep is held', () => sweepsHeld() >= 1, 5_000);

    // Read the same a moment later: too soon to be the tree at rest under a lock — and the time of the first
    // reading stands, so the hold's own pass still finds it old enough.
    await delay(1_500);
    await fs.writeFile(notes, 'mine\n', 'utf-8');
    await until('the reading of a moment later is held too', () => sweepsHeld() >= 2, 3_000);
    expect(engineHoldsTheRule()).toBe(true);

    // The lock stands: the hold's own pass — the one armed by the FIRST reading, under five seconds from it —
    // reads the tree the same once more and concludes it.
    await until('the reading that agrees reads the deletion', () => !engineHoldsTheRule(), 5_000);
  });

  it('a reading the tree at rest did not bear out is forgotten: the same reading under a later lock is held anew', {
    timeout: 30_000,
  }, async () => {
    const atRest = await seedRuleByHand();
    await takeTheLockAsAnotherGit();
    await fs.rm(ruleFile());
    await until('the sweep is held', () => sweepsHeld() >= 1, 5_000);

    // Git writes the file anew and gives the lock up: read at rest the tree holds it, and nothing was gone.
    await fs.writeFile(ruleFile(), atRest, 'utf-8');
    await fs.rm(lockFile());
    // The watch's pass and the hold's own leave no mark where nothing changed: both are waited out.
    await delay(WITHIN_THE_HOLD_MS - 3_000);
    expect(engineHoldsTheRule()).toBe(true);

    // The same file gone again under a lock, long after the first reading: that reading settles nothing.
    await takeTheLockAsAnotherGit();
    await fs.rm(ruleFile());
    await until('the sweep is held anew', () => sweepsHeld() >= 2, 5_000);
    expect(engineHoldsTheRule()).toBe(true);
  });

  it('a flush leaves a file to another git’s lock, and writes it once the lock is given up', {
    timeout: 30_000,
  }, async () => {
    const atRest = await seedRuleByHand();
    const engines = await renameInTheEngineUnderTheLock(atRest);
    // A file of the user's own wakes the tree's watch: its pass reads nothing new and its flush owes the rule's file.
    await fs.writeFile(path.join(harness.rootDir, 'notes.md'), 'mine\n', 'utf-8');

    await until('the flush is held', () => heldFlushes() >= 1, 5_000);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(atRest);

    await fs.rm(lockFile());
    await until(
      'the flush taken again writes the file',
      async () => (await fs.readFile(ruleFile(), 'utf-8')) === engines,
      WITHIN_THE_HOLD_MS,
    );
  });
});

describe('the workspace-tree runtime: a pass that records the tree behind a held flush', () => {
  it('a commit waits for git and records the engine’s bytes', { timeout: 30_000 }, async () => {
    const engines = await renameInTheEngineUnderTheLock(await seedRuleByHand());
    const held = heldFlushes();
    const committing = harness.runtime.commit(harness.workspaceId, 'renamed');
    await giveTheLockUpOnceHeld(held);

    expect(await committing).toMatchObject({ ok: true, committed: true });
    expect(await harness.git('show', `HEAD:${RULE_FILE}`)).toBe(engines.trim());
    expect(await harness.git('status', '--porcelain')).toBe('');
  });

  it('the Commit window’s commit waits for git and records the engine’s bytes', { timeout: 30_000 }, async () => {
    const engines = await renameInTheEngineUnderTheLock(await seedRuleByHand());
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

      const engines = await renameInTheEngineUnderTheLock(atRest);
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

  it('a merge waits for git, and what the engine had pending stays uncommitted beside it', {
    timeout: 30_000,
  }, async () => {
    const atRest = await seedRuleByHand();
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    try {
      // The branch to merge gets its commit in another clone and comes back by a fetch: no checkout moves this tree.
      await harness.git('clone', '-q', harness.rootDir, other);
      await harness.git('-C', other, 'checkout', '-q', '-b', 'side');
      await fs.writeFile(path.join(other, 'notes.md'), 'a note from the side branch\n', 'utf-8');
      await harness.git('-C', other, 'add', 'notes.md');
      await harness.git('-C', other, 'commit', '-q', '-m', 'side');
      await harness.git('fetch', '-q', other, 'side:side');
      const side = await harness.git('rev-parse', 'side');

      const engines = await renameInTheEngineUnderTheLock(atRest);
      const held = heldFlushes();
      const merging = harness.runtime.mergeBranch(harness.workspaceId, 'side');
      await giveTheLockUpOnceHeld(held);

      expect(await merging).toMatchObject({ ok: true, upToDate: false });
      // The side's commit alone, fast-forwarded: the rename is not the merge's to record.
      expect(await harness.git('rev-parse', 'HEAD')).toBe(side);
      expect(await harness.git('status', '--porcelain')).toBe(`M ${RULE_FILE}`);
      expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(engines);
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });

  it('a rollback behind a flush git never lets go of is refused like a busy index', { timeout: 30_000 }, async () => {
    const atRest = await seedRuleByHand();
    await renameInTheEngineUnderTheLock(atRest);

    expect(await harness.runtime.rollbackPaths(harness.workspaceId, [RULE_FILE], false)).toEqual({
      ok: false,
      reason: 'index-locked',
      detail: TREE_HELD_DETAIL,
    });
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(atRest);
  });
});
