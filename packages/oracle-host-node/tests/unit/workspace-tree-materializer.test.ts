/**
 * Materializer — the git-sync plan §3.1 rung 1 mechanics on a real (tmp)
 * filesystem: diff-writes (no-op passes touch nothing), index-scoped
 * deletions that never sweep hand-added files, empty-dir pruning, and
 * the disk round-trip through the tree reader. The second describe pins
 * what a pass leaves while git writes the tree; the last pins the
 * hygiene files: authored when absent, a missing ignore entry appended,
 * the user's lines never rewritten, never baselined.
 */

import { promises as fs, readdirSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Rule, Workspace } from '@openheaders/core/types';
import { applyTreeOrder, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import { readWorkspaceTreeFromDisk } from '../../src/workspace-tree/reader';
import { hashTreeContent, readMaterializedIndex, writeMaterializedIndex } from '../../src/workspace-tree/sidecar';

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

function makeMaterializer(): WorkspaceTreeMaterializer {
  return new WorkspaceTreeMaterializer({
    rootDir: tmpDir,
    readSnapshot: async () => ({ state }),
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-mat-'));
  state = emptyState();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('WorkspaceTreeMaterializer', () => {
  it('writes the tree, then a no-op pass writes nothing', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();

    const first = await materializer.flush();
    expect(first.written.sort()).toEqual([
      '.gitattributes',
      '.gitignore',
      'rules/block-probes-aaaaaaaa/rule.yaml',
      'workspace.yaml',
    ]);
    expect(first.deleted).toEqual([]);

    const second = await materializer.flush();
    expect(second.written).toEqual([]);
    expect(second.deleted).toEqual([]);
    expect(second.unchanged).toBe(2);
  });

  it('deletes files it wrote when the entity disappears, pruning empty dirs', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();

    state.rules = [];
    const result = await materializer.flush();
    expect(result.deleted).toEqual(['rules/block-probes-aaaaaaaa/rule.yaml']);
    await expect(fs.access(path.join(tmpDir, 'rules'))).rejects.toThrow();
  });

  it('never deletes files it did not write', async () => {
    const materializer = makeMaterializer();
    await materializer.flush();

    const handAdded = path.join(tmpDir, 'rules', 'hand-made-zzzzzzzz', 'rule.yaml');
    await fs.mkdir(path.dirname(handAdded), { recursive: true });
    await fs.writeFile(handAdded, 'schemaVersion: 5\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# mine\n', 'utf-8');

    const result = await materializer.flush();
    expect(result.deleted).toEqual([]);
    await expect(fs.readFile(handAdded, 'utf-8')).resolves.toContain('schemaVersion');
    await expect(fs.readFile(path.join(tmpDir, 'README.md'), 'utf-8')).resolves.toBe('# mine\n');
  });

  it('a file the baseline lists and the disk no longer holds is left to the sweep, its entry kept', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const rel = 'rules/block-probes-aaaaaaaa/rule.yaml';
    const ruleFile = path.join(tmpDir, ...rel.split('/'));
    const baselined = (await readMaterializedIndex(tmpDir))[rel];
    await fs.rm(ruleFile);

    const pass = await materializer.flush();
    expect(pass.written).toEqual([]);
    await expect(fs.access(ruleFile)).rejects.toThrow();
    expect((await readMaterializedIndex(tmpDir))[rel]).toBe(baselined);

    // An entity the tree never held is still written beside it.
    state.rules.push(makeRule('bbbbbbbb', 'Delay probes'));
    const next = await materializer.flush();
    expect(next.written).toEqual(['rules/delay-probes-bbbbbbbb/rule.yaml']);
    await expect(fs.access(ruleFile)).rejects.toThrow();
  });

  it('order: stamped from the live sets lands on disk and reads back', async () => {
    state.collections = [
      {
        schemaVersion: 5,
        uid: 'col0000a',
        path: 'rules/alpha-col0000a',
        name: 'Alpha',
        variables: [],
        pinnedEnvironmentIds: [],
        defaultEnvironmentId: null,
      },
    ];
    state.rules = [
      { ...makeRule('rul0000a', 'First'), path: 'rules/alpha-col0000a/first-rul0000a' } as Rule,
      { ...makeRule('rul0000b', 'Second'), path: 'rules/alpha-col0000a/second-rul0000b' } as Rule,
    ];
    state = applyTreeOrder(state, (parent, setPath) => {
      if (parent.type === 'workspace-roots' && setPath === 'ruleCollections')
        return [{ uid: 'col0000a', orderKey: 'm' }];
      if (parent.uid === 'col0000a' && setPath === 'items') {
        return [
          { uid: 'rul0000b', orderKey: 'm' },
          { uid: 'rul0000a', orderKey: 's' },
        ];
      }
      return [];
    });
    await makeMaterializer().flush();

    const manifest = await fs.readFile(path.join(tmpDir, 'workspace.yaml'), 'utf-8');
    expect(manifest).toContain('order:\n  rules:\n    - alpha-col0000a\n');
    const read = await readWorkspaceTreeFromDisk(tmpDir);
    expect(read.issues).toEqual([]);
    expect(read.state.workspace?.order).toEqual({ rules: ['alpha-col0000a'] });
    expect(read.state.collections[0].order).toEqual(['second-rul0000b', 'first-rul0000a']);
  });

  it('round-trips through the disk reader', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes'), makeRule('bbbbbbbb', 'Delay probes')];
    await makeMaterializer().flush();

    const result = await readWorkspaceTreeFromDisk(tmpDir);
    expect(result.issues).toEqual([]);
    expect(result.state.workspace?.uid).toBe('wsaaaaaa');
    expect(result.state.rules.map((rule) => rule.uid).sort()).toEqual(['aaaaaaaa', 'bbbbbbbb']);
  });

  it('debounced schedule() collapses bursts into one pass', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: tmpDir,
      readSnapshot: async () => ({ state }),
      debounceMs: 20,
    });
    materializer.schedule();
    materializer.schedule();
    materializer.schedule();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const result = await materializer.flush();
    expect(result.written).toEqual([]);
    expect(result.unchanged).toBe(2);
    materializer.dispose();
  });
});

describe('WorkspaceTreeMaterializer — while git writes the tree', () => {
  const RULE = 'rules/block-probes-aaaaaaaa/rule.yaml';
  const ruleFile = (): string => path.join(tmpDir, ...RULE.split('/'));
  const filesBeside = async (): Promise<string[]> => (await fs.readdir(path.dirname(ruleFile()))).sort();

  /** A materializer whose watch answers what `gitWriting` holds at each look, and the counts its owner was told. */
  function makeWatched(gitWriting: () => boolean): { materializer: WorkspaceTreeMaterializer; told: number[] } {
    const told: number[] = [];
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: tmpDir,
      readSnapshot: async () => ({ state }),
      watchTreeWrites: async () => ({ met: async () => gitWriting() }),
      onHeld: (held) => told.push(held),
    });
    return { materializer, told };
  }

  it('an edit to a file the baseline lists is left, its entry kept, and written once git is done', async () => {
    let writing = false;
    const besideAtLook: string[][] = [];
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const { materializer, told } = makeWatched(() => {
      if (writing) besideAtLook.push(readdirSync(path.dirname(ruleFile())).sort());
      return writing;
    });
    await materializer.flush();
    const before = await fs.readFile(ruleFile(), 'utf-8');
    const baselined = (await readMaterializedIndex(tmpDir))[RULE];

    state.rules = [{ ...state.rules[0], enabled: false }];
    writing = true;
    const held = await materializer.flush();
    expect(held).toMatchObject({ written: [], held: 1 });
    expect(told).toEqual([1]);
    // Met before any temp file: a lock held long leaves nothing in the tree, pass after pass.
    expect(besideAtLook).toEqual([['rule.yaml']]);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(before);
    expect(await filesBeside()).toEqual(['rule.yaml']);
    expect((await readMaterializedIndex(tmpDir))[RULE]).toBe(baselined);

    writing = false;
    const after = await materializer.flush();
    expect(after.written).toEqual([RULE]);
    expect(after.held).toBeUndefined();
    expect(told).toEqual([1]);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toContain('enabled: false');
  });

  it('a command that began while the temp file was written is met before the rename', async () => {
    let looks = 0;
    let seeded = false;
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const { materializer } = makeWatched(() => {
      if (!seeded) return false;
      looks += 1;
      return looks > 1;
    });
    await materializer.flush();
    const before = await fs.readFile(ruleFile(), 'utf-8');

    state.rules = [{ ...state.rules[0], enabled: false }];
    seeded = true;
    const held = await materializer.flush();
    expect(looks).toBe(2);
    expect(held).toMatchObject({ written: [], held: 1 });
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(before);
    expect(await filesBeside()).toEqual(['rule.yaml']);
  });

  it('a removal of a file the baseline lists is left, its entry kept, and made once git is done', async () => {
    let writing = false;
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const { materializer, told } = makeWatched(() => writing);
    await materializer.flush();
    const baselined = (await readMaterializedIndex(tmpDir))[RULE];

    state.rules = [];
    writing = true;
    const held = await materializer.flush();
    expect(held).toMatchObject({ deleted: [], held: 1 });
    expect(told).toEqual([1]);
    await expect(fs.access(ruleFile())).resolves.toBeUndefined();
    expect((await readMaterializedIndex(tmpDir))[RULE]).toBe(baselined);

    writing = false;
    expect((await materializer.flush()).deleted).toEqual([RULE]);
    await expect(fs.access(ruleFile())).rejects.toThrow();
  });

  it('a file the tree never held is left unwritten, with no entry and no folder made, and written once git is done', async () => {
    let writing = true;
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const { materializer, told } = makeWatched(() => writing);

    const held = await materializer.flush();
    expect(held.held).toBe(2);
    expect(held.written.sort()).toEqual(['.gitattributes', '.gitignore']);
    expect(told).toEqual([2]);
    await expect(fs.access(path.join(tmpDir, 'rules'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, 'workspace.yaml'))).rejects.toThrow();
    expect(await readMaterializedIndex(tmpDir)).toEqual({});

    writing = false;
    const after = await materializer.flush();
    expect(after.written.sort()).toEqual([RULE, 'workspace.yaml']);
    expect(after.held).toBeUndefined();
    expect(told).toEqual([2]);
    expect(Object.keys(await readMaterializedIndex(tmpDir)).sort()).toEqual([RULE, 'workspace.yaml']);
  });

  it('a command that began while a new file’s temp file was written is met before the rename, and no entry is made', async () => {
    let looks = 0;
    const { materializer } = makeWatched(() => {
      looks += 1;
      return looks > 1;
    });

    const held = await materializer.flush();
    expect(looks).toBe(2);
    expect(held.held).toBe(1);
    expect((await fs.readdir(tmpDir)).filter((name) => name.startsWith('workspace.yaml'))).toEqual([]);
    expect(await readMaterializedIndex(tmpDir)).toEqual({});
  });

  it('a pass for a caller that records the tree is taken again while git holds it, and writes once git lets go', async () => {
    let seeded = false;
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    // Git holds the first two passes after the seed, then lets go.
    const watched: ReturnType<typeof makeWatched> = makeWatched(() => seeded && watched.told.length < 2);
    await watched.materializer.flush();

    state.rules = [{ ...state.rules[0], enabled: false }];
    seeded = true;
    const current = await watched.materializer.flushCurrent();
    expect(current.written).toEqual([RULE]);
    expect(current.held).toBeUndefined();
    expect(watched.told).toEqual([1, 1]);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toContain('enabled: false');
  });

  it('a pass for a caller that records the tree answers held when git never lets go', async () => {
    let writing = false;
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const { materializer, told } = makeWatched(() => writing);
    await materializer.flush();
    const before = await fs.readFile(ruleFile(), 'utf-8');

    state.rules = [{ ...state.rules[0], enabled: false }];
    writing = true;
    const current = await materializer.flushCurrent();
    expect(current).toMatchObject({ written: [], held: 1 });
    // The first pass and one after each of the lock's five waits.
    expect(told).toEqual([1, 1, 1, 1, 1, 1]);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe(before);
  });

  it('a pass with nothing to write holds nothing', async () => {
    let writing = false;
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const { materializer, told } = makeWatched(() => writing);
    await materializer.flush();

    writing = true;
    const idle = await materializer.flush();
    expect(idle).toMatchObject({ written: [], deleted: [], unchanged: 2 });
    expect(idle.held).toBeUndefined();
    expect(told).toEqual([]);
  });
});

describe('WorkspaceTreeMaterializer — the hygiene files', () => {
  const ignoreFile = (): string => path.join(tmpDir, '.gitignore');
  const attributesFile = (): string => path.join(tmpDir, '.gitattributes');

  it("the user's lines survive every pass, and neither file enters the baseline", async () => {
    const materializer = makeMaterializer();
    await materializer.flush();
    const mine = '.oh/\n*.secret.yaml\n.env\nnode_modules/\n';
    await fs.writeFile(ignoreFile(), mine, 'utf-8');
    await fs.writeFile(attributesFile(), '*.yaml text eol=lf\n*.png binary\n', 'utf-8');

    const result = await materializer.flush();
    expect(result.written).toEqual([]);
    expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe(mine);
    expect(await fs.readFile(attributesFile(), 'utf-8')).toBe('*.yaml text eol=lf\n*.png binary\n');
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toEqual(['workspace.yaml']);
  });

  it('a dropped ignore entry is appended and a deleted file is authored again', async () => {
    const materializer = makeMaterializer();
    await materializer.flush();
    await fs.writeFile(ignoreFile(), '.env\n.oh/\n', 'utf-8');
    await fs.rm(attributesFile());

    const result = await materializer.flush();
    expect(result.written.sort()).toEqual(['.gitattributes', '.gitignore']);
    expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe('.env\n.oh/\n*.secret.yaml\n');
    expect(await fs.readFile(attributesFile(), 'utf-8')).toBe('*.yaml text eol=lf\n');
  });

  it('an index from when the plan still held them drops the entries and leaves the files', async () => {
    const materializer = makeMaterializer();
    await materializer.flush();
    const index = await readMaterializedIndex(tmpDir);
    const canonical = await fs.readFile(ignoreFile(), 'utf-8');
    await writeMaterializedIndex(tmpDir, {
      ...index,
      '.gitignore': hashTreeContent(canonical),
      '.gitattributes': hashTreeContent(await fs.readFile(attributesFile(), 'utf-8')),
    });

    const result = await materializer.flush();
    expect(result.deleted).toEqual([]);
    expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe(canonical);
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toEqual(['workspace.yaml']);
  });
});
