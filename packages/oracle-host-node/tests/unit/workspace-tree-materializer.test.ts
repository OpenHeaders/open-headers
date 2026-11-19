/**
 * Materializer — the git-sync plan §3.1 rung 1 mechanics on a real (tmp)
 * filesystem: diff-writes (no-op passes touch nothing), index-scoped
 * deletions that never sweep hand-added files, empty-dir pruning, and
 * the disk round-trip through the tree reader. One describe pins what a
 * pass leaves where a file stands and will not open — denied, or held
 * by another program, stood in for by the system's code at the open;
 * another what it leaves while git writes the tree; the last pins the
 * hygiene files: authored when absent, a missing ignore entry appended,
 * the user's lines never rewritten, never baselined — and each a regular
 * file or nothing: a link at its name replaced and never read or written
 * through, a directory there left with its row. And one pins the
 * folder's boundary under a pass: what is planned or baselined at a path
 * no tree can hold, or through a link, is not read, written or removed,
 * and the pass says its rows. And a link at the sidecar's own name: the
 * baseline where it points is never the pass's.
 */

import { promises as fs, readdirSync, symlinkSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Collection, Rule, Workspace } from '@openheaders/core/types';
import { applyTreeOrder, type WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const ALPHA: Collection = {
  schemaVersion: 5,
  uid: 'col0000a',
  path: 'rules/alpha-col0000a',
  name: 'Alpha',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};

function ruleInAlpha(uid: string, name: string): Rule {
  return { ...makeRule(uid, name), path: `${ALPHA.path}/${name.toLowerCase().replace(/\s+/g, '-')}-${uid}` } as Rule;
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
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('WorkspaceTreeMaterializer — a file that stands unread', () => {
  const RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';
  const ruleFile = (): string => path.join(tmpDir, ...RULE_FILE.split('/'));

  /** `fs.open` answering the system's `code` for the rule's file — denied (`EPERM` on Windows), or held by another program (`EBUSY`). */
  function refuseTheRuleFile(code: string) {
    const open = fs.open.bind(fs);
    return vi
      .spyOn(fs, 'open')
      .mockImplementation((...args: Parameters<typeof fs.open>) =>
        String(args[0]) === ruleFile() ? Promise.reject(Object.assign(new Error(code), { code })) : open(...args),
      );
  }

  it('a path the tree never held, where a file that will not open stands, is not written over', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await fs.mkdir(path.dirname(ruleFile()), { recursive: true });
    await fs.writeFile(ruleFile(), 'mine, not a rule\n', 'utf-8');
    refuseTheRuleFile('EPERM');

    const pass = await makeMaterializer().flush();
    expect(pass.written).not.toContain(RULE_FILE);
    expect(pass.held).toBeUndefined();
    vi.restoreAllMocks();
    expect(await fs.readFile(ruleFile(), 'utf-8')).toBe('mine, not a rule\n');
    expect(Object.keys(await readMaterializedIndex(tmpDir))).not.toContain(RULE_FILE);
  });

  it('an edit to a file that will not open is left, its entry kept — and not held: nothing says a denial ends', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const entry = (await readMaterializedIndex(tmpDir))[RULE_FILE];
    state.rules = [{ ...state.rules[0], name: 'Block all probes' }];
    refuseTheRuleFile('EPERM');

    const pass = await materializer.flush();
    expect([pass.written, pass.held]).toEqual([[], undefined]);
    expect((await readMaterializedIndex(tmpDir))[RULE_FILE]).toBe(entry);
  });

  it('an edit to a file another program holds is left and counted held, and written once it lets go', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const held: number[] = [];
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: tmpDir,
      readSnapshot: async () => ({ state }),
      onHeld: (count) => held.push(count),
    });
    await materializer.flush();
    const entry = (await readMaterializedIndex(tmpDir))[RULE_FILE];
    state.rules = [{ ...state.rules[0], name: 'Block all probes' }];
    refuseTheRuleFile('EBUSY');

    const pass = await materializer.flush();
    expect([pass.written, pass.held, held]).toEqual([[], 1, [1]]);
    expect((await readMaterializedIndex(tmpDir))[RULE_FILE]).toBe(entry);

    vi.restoreAllMocks();
    expect((await materializer.flush()).written).toEqual([RULE_FILE]);
    expect(await fs.readFile(ruleFile(), 'utf-8')).toContain('name: Block all probes');
  });

  it('a file the plan no longer holds that will not open is not removed, its entry kept — held where another program holds it', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    state.rules = [];

    refuseTheRuleFile('EPERM');
    const denied = await materializer.flush();
    expect([denied.deleted, denied.held]).toEqual([[], undefined]);
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toContain(RULE_FILE);

    vi.restoreAllMocks();
    refuseTheRuleFile('EBUSY');
    const busy = await materializer.flush();
    expect([busy.deleted, busy.held]).toEqual([[], 1]);
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toContain(RULE_FILE);

    vi.restoreAllMocks();
    expect((await materializer.flush()).deleted).toEqual([RULE_FILE]);
  });
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
    state.collections = [ALPHA];
    state.rules = [ruleInAlpha('rul0000a', 'First'), ruleInAlpha('rul0000b', 'Second')];
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
    state.collections = [ALPHA];
    state.rules = [ruleInAlpha('aaaaaaaa', 'Block probes'), ruleInAlpha('bbbbbbbb', 'Delay probes')];
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
    // The two hygiene files with it: nothing at all is written.
    expect(held).toMatchObject({ written: [], held: 4 });
    expect(told).toEqual([4]);
    expect(await fs.readdir(tmpDir)).toEqual(['.oh']);
    expect(await readMaterializedIndex(tmpDir)).toEqual({});

    writing = false;
    const after = await materializer.flush();
    expect(after.written.sort()).toEqual(['.gitattributes', '.gitignore', RULE, 'workspace.yaml']);
    expect(after.held).toBeUndefined();
    expect(told).toEqual([4]);
    expect(Object.keys(await readMaterializedIndex(tmpDir)).sort()).toEqual([RULE, 'workspace.yaml']);
  });

  it('a hygiene file gone while git writes is left to git, and authored once git is done', async () => {
    let writing = false;
    const ignoreFile = path.join(tmpDir, '.gitignore');
    const attributesFile = path.join(tmpDir, '.gitattributes');
    const { materializer, told } = makeWatched(() => writing);
    await materializer.flush();

    // Git between removing each file and writing the branch's own anew.
    await fs.rm(ignoreFile);
    await fs.rm(attributesFile);
    writing = true;
    const held = await materializer.flush();
    expect(held).toMatchObject({ written: [], held: 2 });
    expect(told).toEqual([2]);
    await expect(fs.access(ignoreFile)).rejects.toThrow();
    await expect(fs.access(attributesFile)).rejects.toThrow();

    writing = false;
    const after = await materializer.flush();
    expect(after.written.sort()).toEqual(['.gitattributes', '.gitignore']);
    expect(after.held).toBeUndefined();
  });

  it('an ignore file read without an entry while git writes is not appended to', async () => {
    let writing = false;
    const ignoreFile = path.join(tmpDir, '.gitignore');
    const { materializer } = makeWatched(() => writing);
    await materializer.flush();

    await fs.writeFile(ignoreFile, '.env\n', 'utf-8');
    writing = true;
    expect(await materializer.flush()).toMatchObject({ written: [], held: 1 });
    expect(await fs.readFile(ignoreFile, 'utf-8')).toBe('.env\n');
  });

  it('a command that began while a new file’s temp file was written is met before the rename, and no entry is made', async () => {
    let looks = 0;
    // The hygiene files stand, so the pass's first look is the manifest's.
    await fs.writeFile(path.join(tmpDir, '.gitignore'), '.oh/\n*.secret.yaml\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, '.gitattributes'), '*.yaml text eol=lf\n', 'utf-8');
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

  it('a pass taken again answers what every attempt wrote, not the last one’s alone', async () => {
    let armed = false;
    let looks = 0;
    state.rules = [makeRule('aaaaaaaa', 'Block probes'), makeRule('bbbbbbbb', 'Delay probes')];
    // Git lets the first file through — a look before its temp file, one before its rename — and holds the second.
    const { materializer, told } = makeWatched(() => {
      if (armed) looks += 1;
      return looks === 3;
    });
    await materializer.flush();

    state.rules = state.rules.map((rule) => ({ ...rule, enabled: false }));
    armed = true;
    const current = await materializer.flushCurrent();
    expect(told).toEqual([1]);
    expect([...current.written].sort()).toEqual([RULE, 'rules/delay-probes-bbbbbbbb/rule.yaml']);
    expect(current.held).toBeUndefined();
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

  describe('a hygiene file is a regular file or nothing', () => {
    const AUTHORED_IGNORE = '.oh/\n*.secret.yaml\n';
    const AUTHORED_ATTRIBUTES = '*.yaml text eol=lf\n';
    let outside: string;
    const standsAsAFile = async (file: string): Promise<boolean> => (await fs.lstat(file)).isFile();

    beforeEach(async () => {
      outside = `${tmpDir}-outside`;
      await fs.mkdir(outside);
    });

    afterEach(async () => {
      await fs.rm(outside, { recursive: true, force: true });
    });

    it('a link to a file that holds every entry is not read through: the authored file takes its place, and the file it pointed to stands', async () => {
      const mine = `${AUTHORED_IGNORE}.env\n`;
      await fs.writeFile(path.join(outside, 'ignore'), mine, 'utf-8');
      await fs.symlink(path.join(outside, 'ignore'), ignoreFile());

      const pass = await makeMaterializer().flush();
      expect(pass.written).toContain('.gitignore');
      expect(await standsAsAFile(ignoreFile())).toBe(true);
      expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe(AUTHORED_IGNORE);
      expect(await fs.readFile(path.join(outside, 'ignore'), 'utf-8')).toBe(mine);
    });

    it('a link to a file that lacks the entries is not appended through, and links to nothing author nothing where they point', async () => {
      await fs.writeFile(path.join(outside, 'README.md'), 'A workspace.\n', 'utf-8');
      await fs.symlink(path.join(outside, 'README.md'), ignoreFile());
      await fs.symlink(path.join(outside, 'attributes'), attributesFile());

      const pass = await makeMaterializer().flush();
      expect(pass.written.sort()).toEqual(['.gitattributes', '.gitignore', 'workspace.yaml']);
      expect(pass.unwritten).toEqual([]);
      expect(await standsAsAFile(ignoreFile())).toBe(true);
      expect(await standsAsAFile(attributesFile())).toBe(true);
      expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe(AUTHORED_IGNORE);
      expect(await fs.readFile(attributesFile(), 'utf-8')).toBe(AUTHORED_ATTRIBUTES);
      expect(await fs.readFile(path.join(outside, 'README.md'), 'utf-8')).toBe('A workspace.\n');
      expect((await fs.readdir(outside)).sort()).toEqual(['README.md']);
    });

    it('a directory at the name stands with what it holds: the pass says its row and writes the rest', async () => {
      await fs.mkdir(ignoreFile());
      await fs.writeFile(path.join(ignoreFile(), 'kept.txt'), 'somebody’s\n', 'utf-8');
      const told: unknown[] = [];
      const materializer = new WorkspaceTreeMaterializer({
        rootDir: tmpDir,
        readSnapshot: async () => ({ state }),
        onUnwritten: (rows) => told.push(rows),
      });

      const pass = await materializer.flush();
      const row = { path: '.gitignore', message: 'is not a file — not written' };
      expect(pass.unwritten).toEqual([row]);
      expect(told).toEqual([[row]]);
      expect(pass.written.sort()).toEqual(['.gitattributes', 'workspace.yaml']);
      expect(await fs.readdir(ignoreFile())).toEqual(['kept.txt']);

      await fs.rm(ignoreFile(), { recursive: true });
      const healed = await materializer.flush();
      expect(healed.written).toEqual(['.gitignore']);
      expect(healed.unwritten).toEqual([]);
    });

    /** `fs.readFile` answering the system's `code` for the ignore file — denied, or held by another program. */
    function refuseTheIgnoreFile(code: string) {
      const readFile = fs.readFile.bind(fs);
      return vi
        .spyOn(fs, 'readFile')
        .mockImplementation((...args: Parameters<typeof fs.readFile>) =>
          String(args[0]) === ignoreFile()
            ? Promise.reject(Object.assign(new Error(code), { code }))
            : readFile(...args),
        );
    }

    it('a file that stands and will not read is not written over — and is counted held only where another program holds it', async () => {
      const mine = '.env\n';
      await fs.writeFile(ignoreFile(), mine, 'utf-8');
      const materializer = makeMaterializer();

      refuseTheIgnoreFile('EPERM');
      const denied = await materializer.flush();
      expect([denied.written.includes('.gitignore'), denied.held]).toEqual([false, undefined]);

      vi.restoreAllMocks();
      refuseTheIgnoreFile('EBUSY');
      const busy = await materializer.flush();
      expect([busy.written.includes('.gitignore'), busy.held]).toEqual([false, 1]);

      vi.restoreAllMocks();
      expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe(mine);
      expect((await materializer.flush()).written).toEqual(['.gitignore']);
      expect(await fs.readFile(ignoreFile(), 'utf-8')).toBe(`${mine}${AUTHORED_IGNORE}`);
    });
  });
});

describe('WorkspaceTreeMaterializer — the folder’s boundary', () => {
  const RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';
  const LINK_ROW = { path: 'rules/', message: 'is a link — not written' };
  let outside: string;
  const inTree = (relative: string): string => path.join(tmpDir, ...relative.split('/'));
  const namesIn = async (dir: string): Promise<string[]> => (await fs.readdir(dir)).sort();

  beforeEach(async () => {
    outside = `${tmpDir}-outside`;
    await fs.mkdir(outside);
  });

  afterEach(async () => {
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('a document planned at a path that climbs out, or into git’s directory, is not written: the rest is, and the pass says its rows', async () => {
    const climbing = `../${path.basename(outside)}/block-probes-aaaaaaaa`;
    state.rules = [
      { ...makeRule('aaaaaaaa', 'Block probes'), path: climbing },
      { ...makeRule('bbbbbbbb', 'Delay probes'), path: '.git/hooks' },
      makeRule('cccccccc', 'Allow probes'),
    ];
    await fs.mkdir(inTree('.git/hooks'), { recursive: true });

    const pass = await makeMaterializer().flush();
    expect(pass.written.sort()).toEqual([
      '.gitattributes',
      '.gitignore',
      'rules/allow-probes-cccccccc/rule.yaml',
      'workspace.yaml',
    ]);
    expect(await namesIn(outside)).toEqual([]);
    expect(await namesIn(inTree('.git/hooks'))).toEqual([]);
    expect(pass.unwritten).toEqual([
      { path: `${climbing}/rule.yaml`, message: '".." cannot be part of a path — not written' },
      { path: '.git/hooks/rule.yaml', message: '".git" cannot be part of a path — not written' },
    ]);
    // A path no tree can hold is no place of the folder: the pass stopped nowhere in it.
    expect(pass.refusedAt).toEqual([]);
  });

  it('a link at a directory of the tree is not written through: one row at the link however much lies beneath it, and the files written once it is gone', async () => {
    state.collections = [{ ...ALPHA }];
    state.rules = [ruleInAlpha('aaaaaaaa', 'Block probes')];
    await fs.symlink(outside, inTree('rules'));
    const told: unknown[] = [];
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: tmpDir,
      readSnapshot: async () => ({ state }),
      onUnwritten: (rows) => told.push(rows),
    });

    const refused = await materializer.flush();
    expect(refused.written.sort()).toEqual(['.gitattributes', '.gitignore', 'workspace.yaml']);
    expect(refused.unwritten).toEqual([LINK_ROW]);
    expect(await namesIn(outside)).toEqual([]);
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toEqual(['workspace.yaml']);

    await fs.rm(inTree('rules'));
    const written = await materializer.flush();
    expect(written.written).toEqual([
      'rules/alpha-col0000a/_collection.yaml',
      'rules/alpha-col0000a/block-probes-aaaaaaaa/rule.yaml',
    ]);
    expect(written.unwritten).toEqual([]);
    // Every pass tells its rows: the owner's rows of the pass before are those no longer.
    expect(told).toEqual([[LINK_ROW], []]);
  });

  it('answers the planned text of each file the boundary refused, and the place it stopped at once — the bytes it writes once the link is gone, and none then', async () => {
    state.collections = [{ ...ALPHA }];
    state.rules = [ruleInAlpha('aaaaaaaa', 'Block probes')];
    await fs.symlink(outside, inTree('rules'));
    const materializer = makeMaterializer();

    const { refused, refusedAt } = await materializer.flushCurrent();
    expect([...refused.keys()]).toEqual([
      'rules/alpha-col0000a/_collection.yaml',
      'rules/alpha-col0000a/block-probes-aaaaaaaa/rule.yaml',
    ]);
    expect(refusedAt).toEqual(['rules']);

    await fs.rm(inTree('rules'));
    const free = await materializer.flush();
    expect([free.refused.size, free.refusedAt]).toEqual([0, []]);
    for (const [filePath, text] of refused) expect(await fs.readFile(inTree(filePath), 'utf-8')).toBe(text);
  });

  it('a file whose entry stands, with a link since on its way, is neither read nor written through — its entry kept', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    const materializer = makeMaterializer();
    await materializer.flush();
    const entry = (await readMaterializedIndex(tmpDir))[RULE_FILE];
    const before = await fs.readFile(inTree(RULE_FILE), 'utf-8');
    await fs.rename(inTree('rules'), path.join(outside, 'rules'));
    await fs.symlink(path.join(outside, 'rules'), inTree('rules'));

    state.rules = [{ ...state.rules[0], enabled: false }];
    const pass = await materializer.flush();
    expect([pass.written, pass.unchanged, pass.unwritten]).toEqual([[], 1, [LINK_ROW]]);
    expect(await fs.readFile(path.join(outside, 'rules', 'block-probes-aaaaaaaa', 'rule.yaml'), 'utf-8')).toBe(before);
    expect((await readMaterializedIndex(tmpDir))[RULE_FILE]).toBe(entry);
  });

  describe('a link at a document’s own name', () => {
    const FILE_LINK_ROW = { path: RULE_FILE, message: 'is a link — not written' };
    const isLink = async (relative: string): Promise<boolean> => (await fs.lstat(inTree(relative))).isSymbolicLink();

    /** The rule written, then its file moved out of the folder and a link to it put at its name; where it went. */
    async function swapTheRuleFileForALink(materializer: WorkspaceTreeMaterializer): Promise<string> {
      state.rules = [makeRule('aaaaaaaa', 'Block probes')];
      await materializer.flush();
      const moved = path.join(outside, 'rule.yaml');
      await fs.rename(inTree(RULE_FILE), moved);
      await fs.symlink(moved, inTree(RULE_FILE));
      return moved;
    }

    it('is the user’s: an engine edit is not written over it nor through it — a row at the file, its entry kept, the planned text answered', async () => {
      const materializer = makeMaterializer();
      const moved = await swapTheRuleFileForALink(materializer);
      const entry = (await readMaterializedIndex(tmpDir))[RULE_FILE];
      const before = await fs.readFile(moved, 'utf-8');

      // Nothing changed in the engine: what the link points at reads as the engine's own write, and is not taken for it.
      const atRest = await materializer.flush();
      expect([atRest.written, atRest.unwritten]).toEqual([[], [FILE_LINK_ROW]]);

      state.rules = [{ ...state.rules[0], enabled: false }];
      const pass = await materializer.flushCurrent();
      expect([pass.written, pass.deleted, pass.unwritten]).toEqual([[], [], [FILE_LINK_ROW]]);
      expect([...pass.refused.keys()]).toEqual([RULE_FILE]);
      expect(pass.refusedAt).toEqual([RULE_FILE]);
      expect(pass.refused.get(RULE_FILE)).toContain('enabled: false');
      expect(await isLink(RULE_FILE)).toBe(true);
      expect(await fs.readFile(moved, 'utf-8')).toBe(before);
      expect((await readMaterializedIndex(tmpDir))[RULE_FILE]).toBe(entry);

      // The link taken away and the file moved back, it is the engine's to write again.
      await fs.rm(inTree(RULE_FILE));
      await fs.rename(moved, inTree(RULE_FILE));
      const written = await materializer.flush();
      expect([written.written, written.unwritten]).toEqual([[RULE_FILE], []]);
      expect(await fs.readFile(inTree(RULE_FILE), 'utf-8')).toBe(pass.refused.get(RULE_FILE));
    });

    it('is not removed when the engine no longer holds the document: the link stands, its entry goes, no row', async () => {
      const materializer = makeMaterializer();
      const moved = await swapTheRuleFileForALink(materializer);

      state.rules = [];
      const pass = await materializer.flush();
      expect([pass.deleted, pass.unwritten]).toEqual([[], []]);
      expect(await isLink(RULE_FILE)).toBe(true);
      expect(await fs.readFile(moved, 'utf-8')).toContain('name: Block probes');
      expect(Object.keys(await readMaterializedIndex(tmpDir))).not.toContain(RULE_FILE);
    });
  });

  it('a baseline path that climbs out, or lies through a link, is not the pass’s to remove: the file stands, its entry goes, no row', async () => {
    const victim = path.join(outside, 'victim.yaml');
    await fs.writeFile(victim, 'as its owner left it\n', 'utf-8');
    await fs.symlink(outside, inTree('linked'));
    const entry = hashTreeContent('as its owner left it\n');
    await writeMaterializedIndex(tmpDir, {
      [`../${path.basename(outside)}/victim.yaml`]: entry,
      'linked/victim.yaml': entry,
    });

    const pass = await makeMaterializer().flush();
    expect([pass.deleted, pass.unwritten]).toEqual([[], []]);
    expect(await fs.readFile(victim, 'utf-8')).toBe('as its owner left it\n');
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toEqual(['workspace.yaml']);
  });

  it('a link that comes to stand on the way while the pass runs is met where the directory would be made', async () => {
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    // The hygiene files stand, so the pass's first look for git's writes is the rule's — after its place was looked at.
    await fs.writeFile(inTree('.gitignore'), '.oh/\n*.secret.yaml\n', 'utf-8');
    await fs.writeFile(inTree('.gitattributes'), '*.yaml text eol=lf\n', 'utf-8');
    let linked = false;
    const materializer = new WorkspaceTreeMaterializer({
      rootDir: tmpDir,
      readSnapshot: async () => ({ state }),
      watchTreeWrites: async () => ({
        met: async () => {
          if (!linked) symlinkSync(outside, inTree('rules'));
          linked = true;
          return false;
        },
      }),
    });

    const pass = await materializer.flush();
    expect([pass.written, pass.unwritten]).toEqual([['workspace.yaml'], [LINK_ROW]]);
    expect(await namesIn(outside)).toEqual([]);
  });
});

describe('WorkspaceTreeMaterializer — a link at the sidecar’s name', () => {
  let outside: string;

  beforeEach(async () => {
    outside = `${tmpDir}-outside`;
    await fs.mkdir(outside);
  });

  afterEach(async () => {
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('a baseline where the link points is not the pass’s: a file of the user’s it names by its hash stands, and the sidecar is a directory again', async () => {
    const mine = 'A workspace of mine.\n';
    await fs.writeFile(path.join(tmpDir, 'README.md'), mine, 'utf-8');
    await fs.writeFile(
      path.join(outside, 'materialized-index.json'),
      JSON.stringify({ 'README.md': hashTreeContent(mine) }),
      'utf-8',
    );
    await fs.symlink(outside, path.join(tmpDir, '.oh'));

    const pass = await makeMaterializer().flush();
    expect(pass.deleted).toEqual([]);
    expect(await fs.readFile(path.join(tmpDir, 'README.md'), 'utf-8')).toBe(mine);
    expect((await fs.lstat(path.join(tmpDir, '.oh'))).isDirectory()).toBe(true);
    expect(Object.keys(await readMaterializedIndex(tmpDir))).toEqual(['workspace.yaml']);
    expect(await fs.readdir(outside)).toEqual(['materialized-index.json']);
  });
});
