/**
 * Materializer — GIT_PLAN.md §3.1 rung 1 mechanics on a real (tmp)
 * filesystem: diff-writes (no-op passes touch nothing), index-scoped
 * deletions that never sweep hand-added files, empty-dir pruning, and
 * the disk round-trip through the tree reader.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Rule, Workspace } from '@openheaders/core/types';
import type { WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import { readWorkspaceTreeFromDisk } from '../../src/workspace-tree/reader';

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
    expect(first.written.sort()).toEqual(['.gitignore', 'rules/block-probes-aaaaaaaa/rule.yaml', 'workspace.yaml']);
    expect(first.deleted).toEqual([]);

    const second = await materializer.flush();
    expect(second.written).toEqual([]);
    expect(second.deleted).toEqual([]);
    expect(second.unchanged).toBe(3);
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
    expect(result.unchanged).toBe(3);
    materializer.dispose();
  });
});
