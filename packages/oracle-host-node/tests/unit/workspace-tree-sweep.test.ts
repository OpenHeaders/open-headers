/**
 * Tree-wins sweep on a real (tmp) filesystem — the §11.2 cold-boot
 * contract: close-app → vim-edit → reopen, and the edit wins.
 *
 * Also pins the three-way discipline the hashed baseline buys:
 *   - a stale materialization (engine ahead, file untouched) never
 *     synthesizes reverting batches;
 *   - the materializer's rung-2 write guard never stomps a hand edit
 *     the sweep hasn't ingested;
 *   - deletions only fire for files the materializer wrote;
 *   - after ingest + re-baseline, the next flush normalizes the
 *     hand-edited formatting to canonical bytes.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MutatorContext } from '@openheaders/core/sync';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Collection, Folder, Rule, Workspace } from '@openheaders/core/types';
import { applyTreeOrder, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import { listWorkspaceTreeFiles } from '../../src/workspace-tree/reader';
import { readMaterializedIndex } from '../../src/workspace-tree/sidecar';
import { sweepWorkspaceTree } from '../../src/workspace-tree/sweep';

const ORG_ID = '019637a2-7b9a-7b9a-8b9a-1234567890ab';

function makeWorkspace(): Workspace {
  return { schemaVersion: 5, uid: 'wsaaaaaa', name: 'Probe Workspace', orgId: ORG_ID };
}

function makeRule(uid: string, name: string): Rule {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/${name.toLowerCase().replace(/\s+/g, '-')}-${uid}`,
    name,
    type: 'block',
    enabled: true,
    conditions: [],
    action: {},
  } as Rule;
}

function makeCollection(uid: string, name: string): Collection {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/${name.toLowerCase()}-${uid}`,
    name,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
}

function makeFolder(uid: string, name: string, parentPath: string): Folder {
  return { schemaVersion: 5, uid, path: `${parentPath}/${name.toLowerCase()}-${uid}`, name };
}

function ruleUnder(uid: string, name: string, parentPath: string): Rule {
  return { ...makeRule(uid, name), path: `${parentPath}/${name.toLowerCase().replace(/\s+/g, '-')}-${uid}` } as Rule;
}

function emptyState(): WorkspaceTreeState {
  return {
    workspace: makeWorkspace(),
    rules: [],
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
  };
}

let tmpDir: string;
let state: WorkspaceTreeState;
let hlcMs: number;
/** The uids the engine holds deleted. */
let deleted: Set<string>;

const nextCtx = (): MutatorContext => {
  hlcMs += 1_000;
  return {
    workspaceId: 'wsaaaaaa',
    orgId: ORG_ID,
    hlc: { physicalMs: hlcMs, logical: 0, nodeId: 'node-tree' },
    surfaceId: 'tree',
    deviceId: 'device-a',
  };
};

function makeMaterializer(): WorkspaceTreeMaterializer {
  return new WorkspaceTreeMaterializer({ rootDir: tmpDir, readSnapshot: async () => ({ state }) });
}

/** `gitWriting` answers, as each watch is opened, whether the stretch it watches meets git's writing. */
async function runSweep(
  applied: EmissionBatch[],
  gitWriting?: boolean | (() => boolean),
  settledReading?: string,
): Promise<Awaited<ReturnType<typeof sweepWorkspaceTree>>> {
  const meets = typeof gitWriting === 'function' ? gitWriting : () => gitWriting === true;
  return sweepWorkspaceTree({
    rootDir: tmpDir,
    workspaceUid: 'wsaaaaaa',
    snapshot: state,
    nextCtx,
    liveSetEntries: () => [],
    apply: async (batches) => {
      applied.push(...batches);
    },
    isDeleted: (_type, id) => deleted.has(id),
    ...(gitWriting !== undefined
      ? {
          watchTreeWrites: async () => {
            const met = meets();
            return { met: async () => met };
          },
        }
      : {}),
    ...(settledReading !== undefined ? { settledReading } : {}),
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-sweep-'));
  state = emptyState();
  hlcMs = 1_000;
  deleted = new Set();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';

describe('sweepWorkspaceTree', () => {
  it('close-app → vim-edit → reopen: the hand edit wins', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();

    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const yaml = await fs.readFile(ruleFile, 'utf-8');
    await fs.writeFile(ruleFile, yaml.replace('name: Block probes', 'name: Block probes (vim)'), 'utf-8');

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(1);
    expect(applied).toHaveLength(1);
    expect(applied[0].batch.mutations.map((m) => m.body)).toContainEqual({
      kind: 'setField',
      type: 'rule',
      id: 'aaaaaaaa',
      path: 'name',
      value: 'Block probes (vim)',
    });
  });

  it('after ingest, the next flush normalizes the hand-edited file to canonical bytes', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const canonical = await fs.readFile(ruleFile, 'utf-8');
    // Hand edit with non-canonical spacing.
    await fs.writeFile(
      ruleFile,
      `${canonical.replace('name: Block probes', "name: 'Block probes (vim)'")}\n\n`,
      'utf-8',
    );

    const applied: EmissionBatch[] = [];
    await runSweep(applied);
    // Simulate the engine having applied the sweep's batches (a name
    // setField — the mutator-maintained path is untouched).
    state.rules = [{ ...state.rules[0], name: 'Block probes (vim)' } as Rule];

    const pass = await materializer.flush();
    expect(pass.written).toContain(RULE_FILE);
    const normalized = await fs.readFile(ruleFile, 'utf-8');
    expect(normalized).toContain('name: Block probes (vim)');
    expect(normalized.endsWith('\n\n')).toBe(false);

    // Converged: a second sweep sees no external input.
    const applied2: EmissionBatch[] = [];
    const second = await runSweep(applied2);
    expect(second.ok && second.changed === 0 && applied2.length === 0).toBe(true);
  });

  it('a stale materialization (engine ahead, file untouched) synthesizes nothing', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();
    // Engine moves ahead; the tree still holds the old bytes.
    state.rules = [makeRule('aaaaaaaa', 'Block probes (engine edit)')];

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);
    expect(applied).toHaveLength(0);
  });

  it('the materializer never stomps a hand edit the sweep has not ingested', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();

    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const yaml = await fs.readFile(ruleFile, 'utf-8');
    const edited = yaml.replace('name: Block probes', 'name: Block probes (vim)');
    await fs.writeFile(ruleFile, edited, 'utf-8');

    // Engine also moved — without the guard this pass would overwrite
    // the pending hand edit with the engine value.
    state.rules = [makeRule('aaaaaaaa', 'Block probes (engine edit)')];
    await materializer.flush();
    await expect(fs.readFile(ruleFile, 'utf-8')).resolves.toBe(edited);
  });

  it('an externally deleted materialized file tombstones; an unmaterialized entity does not', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();
    await fs.rm(path.join(tmpDir, 'rules'), { recursive: true });
    // A second engine entity the tree never held.
    state.rules.push(makeRule('bbbbbbbb', 'Delay probes'));

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);
    expect(applied).toHaveLength(1);
    expect(applied[0].batch.mutations[0].body).toMatchObject({ kind: 'delete', type: 'rule', id: 'aaaaaaaa' });
  });

  it('a hand delete met by a flush before its sweep is still a tombstone', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    await fs.rm(ruleFile);

    await materializer.flush();
    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok && result.removed === 1).toBe(true);
    expect(applied).toHaveLength(1);
    expect(applied[0].batch.mutations[0].body).toMatchObject({ kind: 'delete', type: 'rule', id: 'aaaaaaaa' });
    await expect(fs.access(ruleFile)).rejects.toThrow();
  });

  it('a file back under a uid the engine deleted restores it: its create marked, the file on the baseline, left by the flush', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes'), makeRule('bbbbbbbb', 'Delay probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const yaml = await fs.readFile(ruleFile, 'utf-8');

    // Deleted in the engine, its file removed by the flush — then the file returns, as a checkout brings it.
    state.rules = [state.rules[1]];
    expect((await materializer.flush()).deleted).toEqual([RULE_FILE]);
    deleted.add('aaaaaaaa');
    await fs.mkdir(path.dirname(ruleFile), { recursive: true });
    await fs.writeFile(ruleFile, yaml, 'utf-8');

    const applied: EmissionBatch[] = [];
    expect(await runSweep(applied)).toMatchObject({ ok: true, applied: 1, changed: 1, issues: [] });
    expect(applied.map((entry) => entry.label)).toEqual(['rule:aaaaaaaa (create)']);
    expect(applied[0].batch.mutations[0].body).toMatchObject({ kind: 'create', id: 'aaaaaaaa', restore: true });
    expect((await readMaterializedIndex(tmpDir))[RULE_FILE]).toBeDefined();

    // The engine holds it again, and the flush leaves the file as it returned.
    deleted.delete('aaaaaaaa');
    state.rules = [makeRule('aaaaaaaa', 'Block probes'), ...state.rules];
    expect((await materializer.flush()).deleted).toEqual([]);
    await expect(fs.readFile(ruleFile, 'utf-8')).resolves.toBe(yaml);

    const again: EmissionBatch[] = [];
    expect(await runSweep(again)).toMatchObject({ ok: true, applied: 0, issues: [] });
    expect(again).toEqual([]);
  });

  it('a hand-deleted manifest refuses the sweep and is authored again by the flush after it', async () => {
    const materializer = makeMaterializer();
    await materializer.flush();
    const manifest = path.join(tmpDir, 'workspace.yaml');
    const canonical = await fs.readFile(manifest, 'utf-8');
    await fs.rm(manifest);

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('unreadable-manifest');
    expect(applied).toHaveLength(0);

    const pass = await materializer.flush();
    expect(pass.written).toEqual(['workspace.yaml']);
    await expect(fs.readFile(manifest, 'utf-8')).resolves.toBe(canonical);
  });

  it('a file gone while git wrote the tree concludes nothing; read at rest it is a tombstone', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes'), makeRule('bbbbbbbb', 'Delay probes')];
    await makeMaterializer().flush();
    const baseline = await readMaterializedIndex(tmpDir);
    await fs.rm(path.join(tmpDir, ...RULE_FILE.split('/')));
    const other = path.join(tmpDir, 'rules', 'delay-probes-bbbbbbbb', 'rule.yaml');
    const yaml = await fs.readFile(other, 'utf-8');
    await fs.writeFile(other, yaml.replace('name: Delay probes', 'name: Delay probes (vim)'), 'utf-8');

    const applied: EmissionBatch[] = [];
    const held = await runSweep(applied, true);
    expect(held).toEqual({
      ok: true,
      applied: 0,
      changed: 0,
      removed: 0,
      issues: [],
      held: { files: 2, reading: expect.any(String) },
    });
    expect(applied).toHaveLength(0);
    expect(await readMaterializedIndex(tmpDir)).toEqual(baseline);

    const atRest = await runSweep(applied, false);
    expect(atRest).toMatchObject({ ok: true, changed: 1, removed: 1 });
    expect(atRest.ok && atRest.held).toBeUndefined();
    expect(applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body.kind))).toContain('delete');
  });

  it('a change read while git wrote the tree concludes nothing, until a reading that agrees with one before it', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();
    const baseline = await readMaterializedIndex(tmpDir);
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const yaml = await fs.readFile(ruleFile, 'utf-8');
    await fs.writeFile(ruleFile, yaml.replace('name: Block probes', 'name: Block probes (vim)'), 'utf-8');

    const applied: EmissionBatch[] = [];
    const first = await runSweep(applied, true);
    expect(first).toEqual({
      ok: true,
      applied: 0,
      changed: 0,
      removed: 0,
      issues: [],
      held: { files: 1, reading: expect.any(String) },
    });
    const firstReading = first.ok ? first.held?.reading : undefined;

    // The file moved on — git wrote more of it: the reading before it does not settle this one.
    await fs.writeFile(ruleFile, yaml.replace('name: Block probes', 'name: Block probes (vim, whole)'), 'utf-8');
    const second = await runSweep(applied, true, firstReading);
    const secondReading = second.ok ? second.held?.reading : undefined;
    expect(secondReading).toBeTypeOf('string');
    expect(secondReading).not.toBe(firstReading);
    expect(applied).toHaveLength(0);
    expect(await readMaterializedIndex(tmpDir)).toEqual(baseline);

    // Read the same again: a lock nobody gives up writes no file, and the tree is concluded under it.
    const settled = await runSweep(applied, true, secondReading);
    expect(settled).toMatchObject({ ok: true, changed: 1, removed: 0 });
    expect(settled.ok && settled.held).toBeUndefined();
    expect(applied).toHaveLength(1);
  });

  it('a file of the user’s own alone concludes nothing and holds nothing while git writes the tree', async () => {
    await makeMaterializer().flush();
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# mine\n', 'utf-8');

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied, true);
    expect(result).toMatchObject({ ok: true, applied: 0, changed: 1, removed: 0 });
    expect(result.ok && result.held).toBeUndefined();
  });

  it('a reading that met a command since ended is taken again at once', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const yaml = await fs.readFile(ruleFile, 'utf-8');
    await fs.writeFile(ruleFile, yaml.replace('name: Block probes', 'name: Block probes (vim)'), 'utf-8');

    // The first reading's watch meets git; the look after it and the reading after that do not.
    let watches = 0;
    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied, () => {
      watches += 1;
      return watches === 1;
    });
    expect(watches).toBe(3);
    expect(result).toMatchObject({ ok: true, changed: 1, removed: 0 });
    expect(result.ok && result.held).toBeUndefined();
    expect(applied).toHaveLength(1);
  });

  it('the third reading in a row that met a command since ended goes back to the owner', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    const yaml = await fs.readFile(ruleFile, 'utf-8');
    await fs.writeFile(ruleFile, yaml.replace('name: Block probes', 'name: Block probes (vim)'), 'utf-8');

    // Every reading's watch meets git, every look after one does not: three readings, two looks.
    let watches = 0;
    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied, () => {
      watches += 1;
      return watches % 2 === 1;
    });
    expect(watches).toBe(5);
    expect(result).toMatchObject({ ok: true, held: { files: 1 } });
    expect(applied).toHaveLength(0);
  });

  it('a manifest gone while git wrote the tree is held, its baseline entry kept', async () => {
    await makeMaterializer().flush();
    const baseline = await readMaterializedIndex(tmpDir);
    await fs.rm(path.join(tmpDir, 'workspace.yaml'));

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied, true);
    expect(result).toMatchObject({ ok: true, held: { files: 1 } });
    expect(await readMaterializedIndex(tmpDir)).toEqual(baseline);
  });

  it('a manifest that does not read while git wrote the tree is held; read at rest the sweep is refused', async () => {
    await makeMaterializer().flush();
    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'schemaVersion: 5\n', 'utf-8');

    const applied: EmissionBatch[] = [];
    expect(await runSweep(applied, true)).toMatchObject({ ok: true, held: { files: 1 } });
    expect(await runSweep(applied, false)).toMatchObject({ ok: false, reason: 'unreadable-manifest' });
  });

  it('a listed file gone at its read is not of the tree', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await makeMaterializer().flush();
    const readFile = fs.readFile.bind(fs);
    const spy = vi
      .spyOn(fs, 'readFile')
      .mockImplementation((...args: Parameters<typeof fs.readFile>) =>
        String(args[0]).endsWith('rule.yaml')
          ? Promise.reject(Object.assign(new Error('gone'), { code: 'ENOENT' }))
          : readFile(...args),
      );
    try {
      const files = await listWorkspaceTreeFiles(tmpDir);
      expect(files.map((file) => file.path)).not.toContain(RULE_FILE);
      expect(files.map((file) => file.path)).toContain('workspace.yaml');
    } finally {
      spy.mockRestore();
    }
  });

  it('a hand-added entity file seeds through the pipeline', async () => {
    await makeMaterializer().flush();
    const handRule = makeRule('cccccccc', 'Hand made');
    const dir = path.join(tmpDir, 'rules', 'hand-made-cccccccc');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'rule.yaml'),
      [
        'schemaVersion: 5',
        'uid: cccccccc',
        'name: Hand made',
        'type: block',
        'enabled: true',
        'conditions: []',
        'action: {}',
        '',
      ].join('\n'),
      'utf-8',
    );
    void handRule;

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);
    expect(applied).toHaveLength(1);
    expect(applied[0].batch.mutations[0].body.kind).toBe('create');
  });

  it("a user's own stray file is never adopted into the baseline and never deleted", async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();

    // A stray the read ignores (no entity convention) — at the root
    // and inside an entity directory. Both are the user's bytes.
    const rootStray = path.join(tmpDir, 'notes.txt');
    const nestedStray = path.join(tmpDir, 'rules', 'block-probes-aaaaaaaa', 'notes.txt');
    await fs.writeFile(rootStray, 'user notes\n', 'utf-8');
    await fs.writeFile(nestedStray, 'more notes\n', 'utf-8');

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);

    // The next flush must not sweep the strays away as "stale
    // materializations" — they were never the materializer's to delete.
    const pass = await materializer.flush();
    expect(pass.deleted).toHaveLength(0);
    await expect(fs.readFile(rootStray, 'utf-8')).resolves.toBe('user notes\n');
    await expect(fs.readFile(nestedStray, 'utf-8')).resolves.toBe('more notes\n');
  });

  it('a tree claiming another workspace uid is refused', async () => {
    await makeMaterializer().flush();
    const manifest = path.join(tmpDir, 'workspace.yaml');
    const yaml = await fs.readFile(manifest, 'utf-8');
    await fs.writeFile(manifest, yaml.replace('uid: wsaaaaaa', 'uid: wsother1'), 'utf-8');

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('identity-mismatch');
    expect(applied).toHaveLength(0);
  });

  it('a quarantined (unparseable) entity file is skipped, reported, and left unnormalized', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const ruleFile = path.join(tmpDir, ...RULE_FILE.split('/'));
    await fs.writeFile(ruleFile, 'schemaVersion: 5\nuid: [broken\n', 'utf-8');

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(applied).toHaveLength(0);

    // Still off-baseline → the write guard keeps protecting the bytes.
    await materializer.flush();
    await expect(fs.readFile(ruleFile, 'utf-8')).resolves.toBe('schemaVersion: 5\nuid: [broken\n');
  });

  it('a folder directory moved across collections is one slot transfer; its leaves keep their slot', async () => {
    const colA = makeCollection('col0000a', 'Alpha');
    const colB = makeCollection('col0000b', 'Beta');
    const folder = makeFolder('fol00001', 'Sub', colA.path);
    const rule = ruleUnder('rul00001', 'Block probes', folder.path);
    state.collections = [colA, colB];
    state.folders = [folder];
    state.rules = [rule];
    await makeMaterializer().flush();

    await fs.rename(path.join(tmpDir, ...folder.path.split('/')), path.join(tmpDir, colB.path, 'sub-fol00001'));

    const applied: EmissionBatch[] = [];
    const result = await runSweep(applied);
    expect(result.ok).toBe(true);
    const folderMove = applied.find((batch) => batch.label === 'folder:fol00001 (move)');
    expect(folderMove?.batch.mutations.map((m) => m.body)).toMatchObject([
      { kind: 'removeFromSet', type: 'collection', id: 'col0000a', path: 'folders', itemId: 'fol00001' },
      { kind: 'addToSet', type: 'collection', id: 'col0000b', path: 'folders', itemId: 'fol00001' },
    ]);
    const ruleMove = applied.find((batch) => batch.label === 'rule:rul00001 (move)');
    expect(ruleMove?.batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'setField',
        type: 'rule',
        id: 'rul00001',
        path: 'path',
        value: `${colB.path}/sub-fol00001/block-probes-rul00001`,
      },
    ]);
    expect(applied.some((batch) => batch.label.endsWith('(delete)'))).toBe(false);
  });

  it('a hand-edited order: on _collection.yaml becomes the minimum moveBefore set', async () => {
    const col = makeCollection('col0000a', 'Alpha');
    const first = ruleUnder('rul0000a', 'First', col.path);
    const second = ruleUnder('rul0000b', 'Second', col.path);
    state.collections = [col];
    state.rules = [first, second];
    const liveItems = [
      { itemId: 'rul0000a', orderKey: 'm', item: { uid: 'rul0000a', type: 'rule' } },
      { itemId: 'rul0000b', orderKey: 'n', item: { uid: 'rul0000b', type: 'rule' } },
    ];
    const snapshot = applyTreeOrder(state, (parent, setPath) =>
      parent.uid === 'col0000a' && setPath === 'items'
        ? liveItems.map((entry) => ({ uid: entry.itemId, orderKey: entry.orderKey }))
        : [],
    );
    await new WorkspaceTreeMaterializer({ rootDir: tmpDir, readSnapshot: async () => ({ state: snapshot }) }).flush();

    const manifest = path.join(tmpDir, col.path, '_collection.yaml');
    const yaml = await fs.readFile(manifest, 'utf-8');
    expect(yaml).toContain('order:\n  - first-rul0000a\n  - second-rul0000b\n');
    await fs.writeFile(
      manifest,
      yaml.replace('  - first-rul0000a\n  - second-rul0000b', '  - second-rul0000b\n  - first-rul0000a'),
      'utf-8',
    );

    const applied: EmissionBatch[] = [];
    const result = await sweepWorkspaceTree({
      rootDir: tmpDir,
      workspaceUid: 'wsaaaaaa',
      snapshot,
      nextCtx,
      liveSetEntries: (type, id, setPath) =>
        type === 'collection' && id === 'col0000a' && setPath === 'items' ? liveItems : [],
      apply: async (batches) => {
        applied.push(...batches);
      },
    });
    expect(result.ok).toBe(true);
    expect(applied.map((batch) => batch.label)).toEqual(['collection:col0000a (reorder)']);
    const bodies = applied[0].batch.mutations.map((m) => m.body);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      kind: 'moveBefore',
      type: 'collection',
      id: 'col0000a',
      path: 'items',
      itemId: 'rul0000b',
    });
    if (bodies[0].kind === 'moveBefore') expect(bodies[0].orderKey < 'm').toBe(true);
  });
});

describe('sweepWorkspaceTree — the hygiene files', () => {
  it('a hand-edited .gitignore and .gitattributes survive a sweep and the pass after it', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const ignore = '.oh/\n*.secret.yaml\n.env\nnode_modules/\n';
    const attributes = '*.yaml text eol=lf\n*.png binary\n';
    await fs.writeFile(path.join(tmpDir, '.gitignore'), ignore, 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.gitattributes'), attributes, 'utf-8');

    const applied: EmissionBatch[] = [];
    expect(await runSweep(applied)).toMatchObject({ ok: true, applied: 0 });
    const result = await materializer.flush();
    materializer.dispose();

    expect(result.written).toEqual([]);
    expect(await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe(ignore);
    expect(await fs.readFile(path.join(tmpDir, '.gitattributes'), 'utf-8')).toBe(attributes);
  });
});
