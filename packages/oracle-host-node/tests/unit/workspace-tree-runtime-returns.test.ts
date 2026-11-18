/**
 * A deleted entity back in the tree — on the REAL runtime
 * (`_runtime-harness.ts`). Pins the wiring no pass module's own test
 * reaches: the engine asked what it holds deleted by the sweep, by a
 * pull, by a merge, by a Revert and by a rewritten history taken whole. In each the entity lives again as its file has
 * it, in the collection that held it, the file stays on disk as git has
 * it, and nothing reads as changed.
 *
 * The rule sits in a collection, as every rule made in the app does: a
 * rule file outside any collection is held by no container's set, so a
 * pin on one says nothing of the slot a return has to bring back.
 *
 * And a deletion a pull brings, against the engine's own entities —
 * they carry what no file does (a leaf's frozen segment, a collection's
 * set of folders), which a hand-built snapshot never shows. And a
 * collection's order where the peer or the branch holds no rule in it:
 * the engine's collection with nothing in it is the empty order.
 *
 * And the Git card's rows a pass leaves, on the same wiring: derived as
 * a sweep derives them — the read contained against the engine's
 * snapshot, and no row at a file whose bytes are the baseline's. They
 * are here, not in a file of their own: each file of this harness is
 * one more real runtime in a parallel run. And the rows of what a
 * flush did not write, beside a reading's: kept apart, so the reading a
 * pass takes after it wrote does not drop them.
 *
 * And a spec file a pull brings too large to read: the engine's spec
 * beside the peer's file on disk, and the peer's taken once it reads.
 *
 * And Delete… asked for a file that lies through a link: the verb's own
 * wiring to the folder's boundary.
 *
 * And a `.gitignore` a pull brings that takes the engine's entries back:
 * the pull's own commit, the commit after it, the Commit window's rows
 * and the count hold no secret and nothing of the sidecar.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { COLLECTION_ENTITY_TYPE, FOLDER_ITEMS_PATH } from '@openheaders/core/sync';
import { isNeverCommittedPath, TREE_FILE_MAX_BYTES } from '@openheaders/core/workspace-tree';
import {
  getOrCreateWorkspaceService,
  releaseWorkspaceService,
  snapshotCollectionPostStates,
  snapshotFolderPostStates,
  snapshotRulePostStates,
  snapshotSpecPostStates,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openRuntimeHarness, type RuntimeHarness, until } from './_runtime-harness';

const COLLECTION_UID = 'col0000a';
const COLLECTION_DIR = `rules/api-${COLLECTION_UID}`;
const COLLECTION_FILE = `${COLLECTION_DIR}/_collection.yaml`;
const COLLECTION_TEXT = `schemaVersion: 5\nuid: ${COLLECTION_UID}\nname: API\nvariables: []\n`;

const RULE_UID = 'aaaaaaaa';
const RULE_DIR = `${COLLECTION_DIR}/block-probes-${RULE_UID}`;
const RULE_FILE = `${RULE_DIR}/rule.yaml`;
const RULE_TEXT = `schemaVersion: 5\nuid: ${RULE_UID}\nname: Block probes\ntype: block\nenabled: true\nconditions: []\naction: {}\n`;

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

/** The collection's manifest written by hand and taken in — uncommitted. */
async function writeCollectionByHand(): Promise<void> {
  await writeByHand(COLLECTION_FILE, COLLECTION_TEXT);
  await until('the engine takes the hand-written collection in', engineHoldsTheCollection, 5_000);
}

/** The rule written by hand inside the collection and taken into it — uncommitted. */
async function writeRuleByHand(): Promise<void> {
  await writeByHand(RULE_FILE, RULE_TEXT);
  await until(
    'the engine takes the hand-written rule into the collection',
    () => rulesInTheCollection().includes(RULE_UID),
    5_000,
  );
}

/** The collection and its rule, written by hand, taken in and committed. */
async function commitTheCollectionAndItsRule(): Promise<void> {
  await writeCollectionByHand();
  await writeRuleByHand();
  expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
}

/** The rule's file removed by hand, read as a deletion, and the deletion committed. */
async function deleteAndCommit(): Promise<void> {
  await fs.rm(ruleFile());
  await until('the engine reads the deletion', () => !engineHoldsTheRule(), 8_000);
  expect(await harness.runtime.commit(harness.workspaceId, 'delete')).toMatchObject({ ok: true, committed: true });
}

/** The rule in the engine again and in its collection, its file as git has it, nothing changed and no row raised. */
async function expectTheRuleBack(): Promise<void> {
  await until('the engine holds the rule again', engineHoldsTheRule, 8_000);
  await delay(TREE_AT_REST_MS);
  expect(await isThere(RULE_FILE)).toBe(true);
  expect(await harness.git('status', '--porcelain')).toBe('');
  expect(rulesInTheCollection()).toEqual([RULE_UID]);
  expect(ruleOf(RULE_UID)?.path).toBe(RULE_DIR);
  expect(harness.runtime.issues(harness.workspaceId)).toEqual([]);
}

/** `run` with the branch pushed to a remote it tracks: a Pull is then up to date. */
async function withTheBranchPushed(run: () => Promise<void>): Promise<void> {
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-remote-'));
  try {
    const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
    await harness.git('init', '-q', '--bare', remote);
    await harness.git('remote', 'add', 'origin', remote);
    await harness.git('push', '-q', '-u', 'origin', branch);
    await run();
  } finally {
    await fs.rm(remote, { recursive: true, force: true });
  }
}

beforeEach(async () => {
  harness = await openRuntimeHarness();
});

afterEach(async () => {
  await harness.dispose();
});

describe('the workspace-tree runtime: a deleted entity back in the tree', () => {
  it('a rule one branch holds and the other does not is back in its collection after a switch away and back', {
    timeout: 30_000,
  }, async () => {
    await writeCollectionByHand();
    expect(await harness.runtime.commit(harness.workspaceId, 'base')).toMatchObject({ ok: true });
    const base = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
    await writeRuleByHand();
    expect(await harness.runtime.createBranch(harness.workspaceId, 'feature')).toMatchObject({ ok: true });
    expect(await harness.runtime.commit(harness.workspaceId, 'add rule')).toMatchObject({ ok: true, committed: true });

    expect(await harness.runtime.switchBranch(harness.workspaceId, base)).toMatchObject({ ok: true, switched: true });
    expect(await isThere(RULE_FILE)).toBe(false);
    expect(engineHoldsTheRule()).toBe(false);
    expect(rulesInTheCollection()).toEqual([]);

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
    await writeByHand(COLLECTION_FILE, COLLECTION_TEXT);
    await writeByHand(RULE_FILE, RULE_TEXT);
    await until('the engine takes both in', () => rulesInTheCollection().includes(RULE_UID), 8_000);
    expect(await harness.runtime.createBranch(harness.workspaceId, 'feature')).toMatchObject({ ok: true });
    expect(await harness.runtime.commit(harness.workspaceId, 'add both')).toMatchObject({ ok: true, committed: true });

    expect(await harness.runtime.switchBranch(harness.workspaceId, base)).toMatchObject({ ok: true, switched: true });
    await until('the engine reads both gone', () => !engineHoldsTheCollection() && !engineHoldsTheRule(), 8_000);

    expect(await harness.runtime.switchBranch(harness.workspaceId, 'feature')).toMatchObject({
      ok: true,
      switched: true,
    });
    await until('the engine holds both again', () => engineHoldsTheCollection() && engineHoldsTheRule(), 8_000);
    await expectTheRuleBack();
  });

  it('the app’s Revert of the commit that deleted a rule brings the rule back and records the revert', {
    timeout: 30_000,
  }, async () => {
    await commitTheCollectionAndItsRule();
    await deleteAndCommit();
    const deletion = await harness.git('rev-parse', 'HEAD');

    expect(await harness.runtime.applyCommit(harness.workspaceId, deletion, 'revert')).toMatchObject({ ok: true });
    expect(await harness.git('rev-parse', 'HEAD~1')).toBe(deletion);
    // The deletion took the rule out of the collection's manifest; its revert puts it back there too.
    expect(await harness.git('show', '--format=', '--name-status', 'HEAD')).toBe(
      `M\t${COLLECTION_FILE}\nA\t${RULE_FILE}`,
    );
    await expectTheRuleBack();
  });

  it('a pull of a commit that restores a deleted rule fast-forwards to it and the rule is back', {
    timeout: 30_000,
  }, async () => {
    await commitTheCollectionAndItsRule();
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
    await commitTheCollectionAndItsRule();
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
    await commitTheCollectionAndItsRule();
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

/** The branch pushed and cloned by a peer, who makes `change` in the clone, commits it and pushes; `run` then pulls. */
async function withThePeerPushing(change: (other: string) => Promise<void>, run: () => Promise<void>): Promise<void> {
  const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-remote-'));
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
  try {
    const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
    await harness.git('init', '-q', '--bare', remote);
    await harness.git('remote', 'add', 'origin', remote);
    await harness.git('push', '-q', '-u', 'origin', branch);
    await harness.git('clone', '-q', '-b', branch, remote, other);
    await change(other);
    await harness.git('-C', other, 'add', '-A');
    await harness.git('-C', other, 'commit', '-q', '-m', 'the peer’s change');
    await harness.git('-C', other, 'push', '-q');
    await run();
  } finally {
    await fs.rm(remote, { recursive: true, force: true });
    await fs.rm(other, { recursive: true, force: true });
  }
}

describe('the workspace-tree runtime: a deletion a pull brings', () => {
  /** The peer removes `directory` on the pushed branch and pushes; `run` then pulls. */
  const withThePeerDeleting = (directory: string, run: () => Promise<void>): Promise<void> =>
    withThePeerPushing((other) => fs.rm(path.join(other, ...directory.split('/')), { recursive: true }), run);

  it('a rule the peer deleted and the branch did not edit leaves with the pull — nothing is asked', {
    timeout: 30_000,
  }, async () => {
    await commitTheCollectionAndItsRule();
    await withThePeerDeleting(RULE_DIR, async () => {
      // The engine's rule carries its frozen segment, which no file does: that alone is not an edit.
      expect(ruleOf(RULE_UID)).toHaveProperty('pathSegment');
      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
      await until('the engine reads the rule gone', () => !engineHoldsTheRule(), 8_000);
      expect(rulesInTheCollection()).toEqual([]);
      expect(await isThere(RULE_FILE)).toBe(false);
    });
  });

  it('a collection the peer deleted with the folder in it leaves with the pull — nothing is asked', {
    timeout: 30_000,
  }, async () => {
    const FOLDER_FILE = `${COLLECTION_DIR}/auth-fol0000f/_folder.yaml`;
    const engineHoldsTheFolder = (): boolean =>
      snapshotFolderPostStates(harness.workspaceId).some((state) => state.folder.uid === 'fol0000f');
    await writeCollectionByHand();
    await writeByHand(FOLDER_FILE, 'schemaVersion: 5\nuid: fol0000f\nname: Auth\n');
    await until('the engine takes the hand-written folder in', engineHoldsTheFolder, 5_000);
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
    await withThePeerDeleting(COLLECTION_DIR, async () => {
      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
      await until('the engine reads the collection gone', () => !engineHoldsTheCollection(), 8_000);
      expect(engineHoldsTheFolder()).toBe(false);
      expect(await isThere(COLLECTION_FILE)).toBe(false);
    });
  });
});

describe('the workspace-tree runtime: a collection’s order where one side of a pull holds no rule', () => {
  const OTHER_UID = 'bbbbbbbb';
  const OTHER_SEGMENT = `other-${OTHER_UID}`;
  const OTHER_FILE = `${COLLECTION_DIR}/${OTHER_SEGMENT}/rule.yaml`;
  const OTHER_TEXT = RULE_TEXT.replace(RULE_UID, OTHER_UID);
  const ORDER_OF_THE_RULE = `order:\n  - block-probes-${RULE_UID}\n`;
  const ORDER_OF_THE_OTHER = `order:\n  - ${OTHER_SEGMENT}\n`;
  const manifestOnDisk = (): Promise<string> => fs.readFile(inTree(COLLECTION_FILE), 'utf-8');

  /** The collection's manifest in the peer's clone, its listed order replaced. */
  async function relistInThePeer(other: string, order: string): Promise<void> {
    const file = path.join(other, ...COLLECTION_FILE.split('/'));
    const text = await fs.readFile(file, 'utf-8');
    expect(text).toContain(ORDER_OF_THE_RULE);
    await fs.writeFile(file, text.replace(ORDER_OF_THE_RULE, order), 'utf-8');
  }

  it('the peer deleted the collection’s last rule and the branch added one there: its own stays, alone in the order — nothing is asked', {
    timeout: 30_000,
  }, async () => {
    await commitTheCollectionAndItsRule();
    await withThePeerPushing(
      async (other) => {
        // As the app writes it: a collection that holds nothing carries no `order`.
        await fs.rm(path.join(other, ...RULE_DIR.split('/')), { recursive: true });
        await relistInThePeer(other, '');
      },
      async () => {
        await writeByHand(OTHER_FILE, OTHER_TEXT);
        await until('the engine takes the second rule in', () => rulesInTheCollection().includes(OTHER_UID), 5_000);
        expect(await harness.runtime.commit(harness.workspaceId, 'second rule')).toMatchObject({
          ok: true,
          committed: true,
        });

        expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
        await until('the engine reads the rule gone', () => !engineHoldsTheRule(), 8_000);
        await delay(TREE_AT_REST_MS);
        expect(rulesInTheCollection()).toEqual([OTHER_UID]);
        expect(await manifestOnDisk()).toContain(ORDER_OF_THE_OTHER);
        expect(await harness.git('status', '--porcelain')).toBe('');
      },
    );
  });

  it('the peer added a rule beside one and the branch deleted that one, its last: the added rule lands alone — nothing is asked', {
    timeout: 30_000,
  }, async () => {
    await commitTheCollectionAndItsRule();
    await withThePeerPushing(
      async (other) => {
        await fs.mkdir(path.dirname(path.join(other, ...OTHER_FILE.split('/'))), { recursive: true });
        await fs.writeFile(path.join(other, ...OTHER_FILE.split('/')), OTHER_TEXT, 'utf-8');
        await relistInThePeer(other, `${ORDER_OF_THE_RULE}  - ${OTHER_SEGMENT}\n`);
      },
      async () => {
        await deleteAndCommit();
        expect(await manifestOnDisk()).not.toContain('order:');

        expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
        await until('the engine takes the peer’s rule in', () => rulesInTheCollection().includes(OTHER_UID), 8_000);
        await delay(TREE_AT_REST_MS);
        expect(engineHoldsTheRule()).toBe(false);
        expect(rulesInTheCollection()).toEqual([OTHER_UID]);
        expect(await manifestOnDisk()).toContain(ORDER_OF_THE_OTHER);
        expect(await harness.git('status', '--porcelain')).toBe('');
      },
    );
  });
});

describe("the workspace-tree runtime: the Git card's rows after a pass", () => {
  const BROKEN_FILE = 'rules/broken-colbbbbb/_collection.yaml';
  const REFUSED_FILE = 'rules/broken-colbbbbb/inside-bbbbbbbb/rule.yaml';
  const rows = () => harness.runtime.issues(harness.workspaceId);

  it('the row of a rule the workspace has no container for stands after a Pull', { timeout: 30_000 }, async () => {
    await writeCollectionByHand();
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
    await withTheBranchPushed(async () => {
      await writeByHand(BROKEN_FILE, 'schemaVersion: 5\nuid: [not a string\n');
      await writeByHand(REFUSED_FILE, RULE_TEXT.replace(RULE_UID, 'bbbbbbbb'));
      await until('the sweep raises both rows', () => rows().length === 2, 8_000);
      const raised = rows();
      expect(raised).toEqual([
        expect.objectContaining({ path: BROKEN_FILE }),
        {
          path: REFUSED_FILE,
          message: 'rule inside no collection or folder of the workspace — skipped',
          uncontainedIn: 'rules/broken-colbbbbb',
        },
      ]);

      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: true });
      expect(rows()).toEqual(raised);
    });
  });

  it('a rule a Pull brings whose directory is a link here is not written through it: the engine holds the rule, and the flush’s row stands after the Pull', {
    timeout: 30_000,
  }, async () => {
    const PEER_DIR = `${COLLECTION_DIR}/delay-probes-bbbbbbbb`;
    await commitTheCollectionAndItsRule();
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-outside-'));
    try {
      await withTheBranchPushed(async () => {
        const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
        await harness.git('clone', '-q', '-b', branch, await harness.git('remote', 'get-url', 'origin'), other);
        await fs.mkdir(path.join(other, ...PEER_DIR.split('/')));
        await fs.writeFile(
          path.join(other, ...PEER_DIR.split('/'), 'rule.yaml'),
          RULE_TEXT.replace(RULE_UID, 'bbbbbbbb').replace('Block probes', 'Delay probes'),
          'utf-8',
        );
        await harness.git('-C', other, 'add', '-A');
        await harness.git('-C', other, 'commit', '-q', '-m', 'a rule');
        await harness.git('-C', other, 'push', '-q');
        await fs.symlink(outside, inTree(PEER_DIR));
        await delay(TREE_AT_REST_MS);
        expect(rows()).toEqual([]);

        expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
        await delay(TREE_AT_REST_MS);
        expect(await fs.readdir(outside)).toEqual([]);
        expect(ruleOf('bbbbbbbb')?.path).toBe(PEER_DIR);
        // The pull read the disk for its rows after it wrote: the flush's row is not the reading's to drop.
        expect(rows()).toEqual([{ path: `${PEER_DIR}/`, message: 'is a link — not written' }]);
      });
    } finally {
      await fs.rm(other, { recursive: true, force: true });
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it("a held collection's manifest removed by hand while its rule is left is written again — nothing deleted, no row, by the sweep or after a Pull", {
    timeout: 30_000,
  }, async () => {
    await commitTheCollectionAndItsRule();
    await withTheBranchPushed(async () => {
      await delay(TREE_AT_REST_MS);
      await fs.rm(inTree(COLLECTION_FILE));
      await until('the manifest is written again', () => isThere(COLLECTION_FILE), 8_000);
      await delay(TREE_AT_REST_MS);
      // Not empty: the collection stays, its rule in it, and the pass says what it left out.
      expect(engineHoldsTheCollection()).toBe(true);
      expect(rulesInTheCollection()).toEqual([RULE_UID]);
      expect(await isThere(RULE_FILE)).toBe(true);
      expect(rows()).toEqual([]);
      expect(harness.logged.filter((line) => line.includes('left out'))).toEqual([
        expect.stringContaining(`${COLLECTION_FILE} (not-empty)`),
      ]);

      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: true });
      expect(engineHoldsTheCollection()).toBe(true);
      expect(rows()).toEqual([]);
    });
  });

  it("a held folder's directory renamed above it and its manifest removed there keeps the folder and its rule — nothing deleted, no row", {
    timeout: 30_000,
  }, async () => {
    const AUTH = `${COLLECTION_DIR}/auth-fol0000f`;
    const RENAMED = `${COLLECTION_DIR}/authz-fol0000f`;
    const DEEP_FILE = `${AUTH}/deep-fol0000d/_folder.yaml`;
    const INNER_DIR = `${AUTH}/deep-fol0000d/inner-${RULE_UID}`;
    const engineHoldsTheInnerFolder = (): boolean =>
      snapshotFolderPostStates(harness.workspaceId).some((state) => state.folder.uid === 'fol0000d');
    await writeCollectionByHand();
    await writeByHand(`${AUTH}/_folder.yaml`, 'schemaVersion: 5\nuid: fol0000f\nname: Auth\n');
    await writeByHand(DEEP_FILE, 'schemaVersion: 5\nuid: fol0000d\nname: Deep\n');
    await writeByHand(`${INNER_DIR}/rule.yaml`, RULE_TEXT);
    await until('the engine takes the rule in', engineHoldsTheRule, 8_000);
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
    await delay(TREE_AT_REST_MS);

    await fs.rename(inTree(AUTH), inTree(RENAMED));
    await fs.rm(inTree(`${RENAMED}/deep-fol0000d/_folder.yaml`));
    await until(
      'the inner manifest is written again where the engine holds the folder',
      () => isThere(DEEP_FILE),
      8_000,
    );
    await delay(TREE_AT_REST_MS);

    expect(engineHoldsTheInnerFolder()).toBe(true);
    expect(ruleOf(RULE_UID)?.path).toBe(INNER_DIR);
    expect(await isThere(`${INNER_DIR}/rule.yaml`)).toBe(true);
    expect(await isThere(RENAMED)).toBe(false);
    expect(rows()).toEqual([]);
    expect(await harness.git('status', '--porcelain')).toBe('');
  });

  describe("a copy of a held container's directory, sorted before it", () => {
    const COPY_DIR = `rules/aaa-${COLLECTION_UID}`;
    const COPY_ROWS = [
      {
        path: `${COPY_DIR}/_collection.yaml`,
        message: `duplicate uid "${COLLECTION_UID}" — entity skipped`,
        duplicateOf: COLLECTION_UID,
      },
      {
        path: `${COPY_DIR}/block-probes-${RULE_UID}/rule.yaml`,
        message: `duplicate uid "${RULE_UID}" — entity skipped`,
        duplicateOf: RULE_UID,
      },
    ];
    const collectionDir = (): string | undefined =>
      snapshotCollectionPostStates(harness.workspaceId).find((state) => state.collection.uid === COLLECTION_UID)
        ?.collection.path;

    /** The collection where the engine held it, its rule in it, both files on disk. */
    async function expectTheCollectionWhereItWas(): Promise<void> {
      expect(collectionDir()).toBe(COLLECTION_DIR);
      expect(ruleOf(RULE_UID)?.path).toBe(RULE_DIR);
      expect(rulesInTheCollection()).toEqual([RULE_UID]);
      expect(await isThere(COLLECTION_FILE)).toBe(true);
      expect(await isThere(RULE_FILE)).toBe(true);
    }

    it('a hand copy of a collection is a duplicate with its two rows — the collection stays where it is, and removing the copy deletes nothing', {
      timeout: 30_000,
    }, async () => {
      await commitTheCollectionAndItsRule();
      await delay(TREE_AT_REST_MS);

      await fs.cp(inTree(COLLECTION_DIR), inTree(COPY_DIR), { recursive: true });
      await until('the sweep raises the two rows of the copy', () => rows().length === 2, 8_000);
      await delay(TREE_AT_REST_MS);
      expect(rows()).toEqual(COPY_ROWS);
      await expectTheCollectionWhereItWas();

      await fs.rm(inTree(COPY_DIR), { recursive: true });
      await until('the rows leave with the copy', () => rows().length === 0, 8_000);
      await delay(TREE_AT_REST_MS);
      await expectTheCollectionWhereItWas();
      expect(await harness.git('status', '--porcelain')).toBe('');
    });

    it('a pull that brings such a copy of a collection applies nothing — the collection stays where it is, the two rows', {
      timeout: 30_000,
    }, async () => {
      await commitTheCollectionAndItsRule();
      const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
      try {
        await withTheBranchPushed(async () => {
          const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
          await harness.git('clone', '-q', '-b', branch, await harness.git('remote', 'get-url', 'origin'), other);
          await fs.cp(path.join(other, ...COLLECTION_DIR.split('/')), path.join(other, ...COPY_DIR.split('/')), {
            recursive: true,
          });
          await harness.git('-C', other, 'add', '-A');
          await harness.git('-C', other, 'commit', '-q', '-m', 'copy');
          await harness.git('-C', other, 'push', '-q');

          expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({
            ok: true,
            upToDate: false,
            applied: 0,
          });
          await delay(TREE_AT_REST_MS);
          expect(rows()).toEqual(COPY_ROWS);
          await expectTheCollectionWhereItWas();
          expect(await isThere(`${COPY_DIR}/_collection.yaml`)).toBe(true);
          expect(await harness.git('status', '--porcelain')).toBe('');
        });
      } finally {
        await fs.rm(other, { recursive: true, force: true });
      }
    });

    it('a hand edit of a held folder is read though such a copy of it sits under a collection that does not read', {
      timeout: 30_000,
    }, async () => {
      const FOLDER_FILE = `${COLLECTION_DIR}/auth-fol0000f/_folder.yaml`;
      const UNREAD_FILE = 'rules/aaa-broken-colbbbbb/_collection.yaml';
      const FOLDER_COPY = 'rules/aaa-broken-colbbbbb/auth-fol0000f';
      const folderText = (name: string): string => `schemaVersion: 5\nuid: fol0000f\nname: ${name}\n`;
      const folderName = (): string | undefined =>
        snapshotFolderPostStates(harness.workspaceId).find((state) => state.folder.uid === 'fol0000f')?.folder.name;
      await writeCollectionByHand();
      await writeByHand(FOLDER_FILE, folderText('Auth'));
      await until('the engine takes the hand-written folder in', () => folderName() === 'Auth', 5_000);
      expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
      await delay(TREE_AT_REST_MS);

      await writeByHand(UNREAD_FILE, 'schemaVersion: 5\nuid: [not a string\n');
      await writeByHand(`${FOLDER_COPY}/_folder.yaml`, folderText('Auth'));
      await until('the sweep raises the two rows of the copy', () => rows().length === 2, 8_000);

      await writeByHand(FOLDER_FILE, folderText('Gate'));
      await until('the engine reads the hand edit of the held folder', () => folderName() === 'Gate', 8_000);
      await delay(TREE_AT_REST_MS);
      expect(rows()).toEqual([
        expect.objectContaining({ path: UNREAD_FILE }),
        {
          path: `${FOLDER_COPY}/_folder.yaml`,
          message: 'folder inside no collection or folder of the workspace — skipped',
          uncontainedIn: 'rules/aaa-broken-colbbbbb',
        },
      ]);
    });
  });
});

describe('the workspace-tree runtime: a spec file a pull brings too large to read', () => {
  const SPEC_FILE = 'specs/pets-ssssssss/spec.yaml';
  const SPEC_INDEX = 'specs/pets-ssssssss/index.yaml';
  const SMALL = 'openapi: 3.1.0\n';
  const THIRD = 'openapi: 3.1.0\ninfo:\n  title: third\n';
  const specText = (name: string): string =>
    `schemaVersion: 5\nuid: ssssssss\nname: ${name}\nformat: openapi-3.1\nrootFileUid: ffffffff\nfiles:\n  - uid: ffffffff\n    fileName: index.yaml\n`;
  const specOf = () => snapshotSpecPostStates(harness.workspaceId).find(({ spec }) => spec.uid === 'ssssssss')?.spec;

  it('the engine keeps its own spec beside the peer’s file on disk, and takes the peer’s once the file is small again', {
    timeout: 60_000,
  }, async () => {
    await writeByHand(SPEC_FILE, specText('Pets'));
    await writeByHand(SPEC_INDEX, SMALL);
    await until('the engine takes the hand-written spec in', () => specOf()?.files[0]?.content === SMALL, 5_000);
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
    const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-remote-'));
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    const inPeer = (relative: string): string => path.join(other, ...relative.split('/'));
    const peerPushes = async (message: string): Promise<string> => {
      await harness.git('-C', other, 'add', '-A');
      await harness.git('-C', other, 'commit', '-q', '-m', message);
      await harness.git('-C', other, 'push', '-q');
      return harness.git('-C', other, 'rev-parse', 'HEAD');
    };
    try {
      const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
      await harness.git('init', '-q', '--bare', remote);
      await harness.git('remote', 'add', 'origin', remote);
      await harness.git('push', '-q', '-u', 'origin', branch);
      await harness.git('clone', '-q', '-b', branch, remote, other);

      await fs.writeFile(inPeer(SPEC_FILE), specText('Pets (peer)'), 'utf-8');
      await fs.writeFile(inPeer(SPEC_INDEX), '#'.repeat(TREE_FILE_MAX_BYTES + 1), 'utf-8');
      const grown = await peerPushes('the spec file grown past the limit, the spec renamed');

      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
      await delay(TREE_AT_REST_MS);
      // The pull recorded nothing over the peer's file, and the engine's spec is as it was.
      expect(await harness.git('rev-parse', 'HEAD')).toBe(grown);
      expect(await harness.git('status', '--porcelain')).toBe('');
      expect((await fs.stat(inTree(SPEC_INDEX))).size).toBe(TREE_FILE_MAX_BYTES + 1);
      expect(specOf()).toMatchObject({ name: 'Pets', files: [{ content: SMALL }] });
      expect(harness.runtime.issues(harness.workspaceId)).toEqual([
        { path: SPEC_INDEX, message: 'larger than 16 MB — skipped' },
        { path: SPEC_FILE, message: '"index.yaml" was not read — skipped' },
      ]);

      await fs.writeFile(inPeer(SPEC_INDEX), THIRD, 'utf-8');
      const shrunk = await peerPushes('the spec file small again');

      expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
      await until('the engine takes the peer’s spec', () => specOf()?.name === 'Pets (peer)', 8_000);
      await delay(TREE_AT_REST_MS);
      expect(specOf()?.files[0]?.content).toBe(THIRD);
      expect(await fs.readFile(inTree(SPEC_INDEX), 'utf-8')).toBe(THIRD);
      expect(await harness.git('rev-parse', 'HEAD')).toBe(shrunk);
      expect(await harness.git('status', '--porcelain')).toBe('');
      expect(harness.runtime.issues(harness.workspaceId)).toEqual([]);
    } finally {
      await fs.rm(remote, { recursive: true, force: true });
      await fs.rm(other, { recursive: true, force: true });
    }
  });
});

describe('the workspace-tree runtime: Delete… and the folder’s boundary', () => {
  it('a file that lies through a link is not deleted: the pass stops at it, and the file deleted before it is gone', {
    timeout: 30_000,
  }, async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'victim.txt'), 'as its owner left it\n', 'utf-8');
      await writeByHand('loose.md', 'mine\n');
      await fs.symlink(outside, inTree('linked'));

      expect(await harness.runtime.deletePaths(harness.workspaceId, ['loose.md', 'linked/victim.txt'])).toEqual({
        ok: false,
        reason: 'delete-failed',
        deleted: 1,
        detail: '"linked/" is a link, on the way to "linked/victim.txt"',
      });
      expect(await isThere('loose.md')).toBe(false);
      expect(await fs.readFile(path.join(outside, 'victim.txt'), 'utf-8')).toBe('as its owner left it\n');
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});

describe('the workspace-tree runtime: a .gitignore a Pull brings that takes the entries back', () => {
  const VAULT_FILE = 'workspace-vars.secret.yaml';
  const VAULT_TEXT =
    'schemaVersion: 5\nsecrets:\n  - uid: scapitkn\n    kind: string\n    name: API_TOKEN\n    value: super-secret-token\n';
  const headPaths = async (): Promise<string[]> =>
    (await harness.git('ls-tree', '-r', '--name-only', 'HEAD')).split('\n');

  it('no commit of the Pull or after it holds the vault or the sidecar, and neither is a change to commit', {
    timeout: 30_000,
  }, async () => {
    await writeByHand(VAULT_FILE, VAULT_TEXT);
    await delay(TREE_AT_REST_MS);
    expect(await harness.runtime.commit(harness.workspaceId, 'seed')).toMatchObject({ ok: true, committed: true });
    // While the entries hold, the vault is a row of the ignored files — that row is git's and stays.
    expect(await harness.runtime.changes(harness.workspaceId, true)).toMatchObject({
      ok: true,
      changes: expect.arrayContaining([expect.objectContaining({ path: VAULT_FILE, ignored: true })]),
    });
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    try {
      await withTheBranchPushed(async () => {
        const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
        await harness.git('clone', '-q', '-b', branch, await harness.git('remote', 'get-url', 'origin'), other);
        await fs.appendFile(path.join(other, '.gitignore'), '!*.secret.yaml\n!.oh/\n', 'utf-8');
        await harness.git('-C', other, 'add', '-A');
        await harness.git('-C', other, 'commit', '-q', '-m', 'ignore less');
        await harness.git('-C', other, 'push', '-q');

        expect(await harness.runtime.pull(harness.workspaceId)).toMatchObject({ ok: true, upToDate: false });
        expect(await fs.readFile(inTree('.gitignore'), 'utf-8')).toContain('!*.secret.yaml');
        // Git itself lists both as work to commit from here on.
        const listed = await harness.git('status', '--porcelain', '--untracked-files=all');
        expect(listed).toContain(`?? ${VAULT_FILE}`);
        expect(listed).toContain('?? .oh/lock');
        expect((await headPaths()).filter(isNeverCommittedPath)).toEqual([]);

        expect(await harness.runtime.changes(harness.workspaceId)).toEqual({ ok: true, changes: [] });
        expect((await harness.runtime.gitStatus(harness.workspaceId)).dirtyFiles).toBe(0);

        await writeByHand('notes.md', '# mine\n');
        expect(await harness.runtime.commit(harness.workspaceId, 'after')).toMatchObject({ ok: true, committed: true });
        const held = await headPaths();
        expect(held).toContain('notes.md');
        expect(held.filter(isNeverCommittedPath)).toEqual([]);
      });
    } finally {
      await fs.rm(other, { recursive: true, force: true });
    }
  });
});
