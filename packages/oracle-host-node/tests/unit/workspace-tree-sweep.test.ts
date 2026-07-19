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
import type { Rule, Workspace } from '@openheaders/core/types';
import type { WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
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

function emptyState(): WorkspaceTreeState {
  return {
    workspace: makeWorkspace(),
    rules: [],
    collections: [],
    folders: [],
    requests: [],
    grpcRequests: [],
    websocketRequests: [],
    requestCollections: [],
    requestFolders: [],
    templates: [],
    templateCollections: [],
    templateFolders: [],
    environments: [],
    workspaceVariables: null,
    vault: null,
    specs: [],
    liveWorkflows: [],
    liveVariables: [],
  };
}

let tmpDir: string;
let state: WorkspaceTreeState;
let hlcMs: number;

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

async function runSweep(applied: EmissionBatch[]): Promise<Awaited<ReturnType<typeof sweepWorkspaceTree>>> {
  return sweepWorkspaceTree({
    rootDir: tmpDir,
    workspaceUid: 'wsaaaaaa',
    snapshot: state,
    nextCtx,
    liveSetEntries: () => [],
    apply: async (batches) => {
      applied.push(...batches);
    },
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-sweep-'));
  state = emptyState();
  hlcMs = 1_000;
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
});
