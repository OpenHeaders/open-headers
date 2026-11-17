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
 * set of folders), which a hand-built snapshot never shows.
 *
 * And the Git card's rows a pass leaves, on the same wiring: derived as
 * a sweep derives them — the read contained against the engine's
 * snapshot, and no row at a file whose bytes are the baseline's. They
 * are here, not in a file of their own: each file of this harness is
 * one more real runtime in a parallel run.
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
  snapshotFolderPostStates,
  snapshotRulePostStates,
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

describe('the workspace-tree runtime: a deletion a pull brings', () => {
  /** The peer removes `directory` on the pushed branch and pushes; `run` then pulls. */
  async function withThePeerDeleting(directory: string, run: () => Promise<void>): Promise<void> {
    const remote = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-remote-'));
    const other = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-runtime-other-'));
    try {
      const branch = await harness.git('rev-parse', '--abbrev-ref', 'HEAD');
      await harness.git('init', '-q', '--bare', remote);
      await harness.git('remote', 'add', 'origin', remote);
      await harness.git('push', '-q', '-u', 'origin', branch);
      await harness.git('clone', '-q', '-b', branch, remote, other);
      await harness.git('-C', other, 'rm', '-q', '-r', directory);
      await harness.git('-C', other, 'commit', '-q', '-m', 'delete');
      await harness.git('-C', other, 'push', '-q');
      await run();
    } finally {
      await fs.rm(remote, { recursive: true, force: true });
      await fs.rm(other, { recursive: true, force: true });
    }
  }

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

describe("the workspace-tree runtime: the Git card's rows after a pass", () => {
  const BROKEN_FILE = 'rules/broken-colbbbbb/_collection.yaml';
  const REFUSED_FILE = 'rules/broken-colbbbbb/inside-bbbbbbbb/rule.yaml';
  const rows = () => harness.runtime.issues(harness.workspaceId);

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
      { path: `${COPY_DIR}/_collection.yaml`, message: `duplicate uid "${COLLECTION_UID}" — entity skipped` },
      {
        path: `${COPY_DIR}/block-probes-${RULE_UID}/rule.yaml`,
        message: `duplicate uid "${RULE_UID}" — entity skipped`,
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
