/**
 * In-app branch merge on real tmp repos (the git-sync plan §6 / §10
 * Phase 6): the Phase 4 pull machinery pointed at a LOCAL ref — raw
 * `git merge` is never invoked, an un-diverged current branch
 * fast-forwards, genuine divergence records a two-parent commit with
 * `Co-Authored-By:` trailers, and zero conflict markers ever land.
 * Ends with the §6 teammate-isolation acceptance end-to-end.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MutatorContext } from '@openheaders/core/sync';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Rule, Workspace } from '@openheaders/core/types';
import type { WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { commitWorkspaceTree, countDirtyFiles, ensureWorkspaceRepo } from '../../src/git/repo';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import { type MergeWorkspaceBranchResult, mergeWorkspaceBranch } from '../../src/workspace-tree/merge';
import { listWorkspaceTreeFiles } from '../../src/workspace-tree/reader';
import { hashTreeContent, type MaterializedIndex, writeMaterializedIndex } from '../../src/workspace-tree/sidecar';

const ORG_ID = '019637a2-7b9a-7b9a-8b9a-1234567890ab';
const RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Probe Operator',
  GIT_AUTHOR_EMAIL: 'probe-operator@users.noreply.openheaders.io',
  GIT_COMMITTER_NAME: 'Probe Operator',
  GIT_COMMITTER_EMAIL: 'probe-operator@users.noreply.openheaders.io',
};
const RITA_ENV = {
  GIT_AUTHOR_NAME: 'Remote Rita',
  GIT_AUTHOR_EMAIL: 'rita@openheaders.io',
  GIT_COMMITTER_NAME: 'Remote Rita',
  GIT_COMMITTER_EMAIL: 'rita@openheaders.io',
};

function isolated(base: GitRunner): GitRunner {
  return (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env },
    });
}

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
let local: string;
let state: WorkspaceTreeState;
let hlcMs: number;
let run: GitRunner;
let materializer: WorkspaceTreeMaterializer;

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

const raw = (dir: string, ...args: string[]) =>
  run(['--git-dir', path.join(dir, '.git'), '--work-tree', dir, ...args], { cwd: dir });

async function localEdit(dir: string, rel: string, edit: (content: string) => string): Promise<void> {
  const target = path.join(dir, ...rel.split('/'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  let content = '';
  try {
    content = await fs.readFile(target, 'utf-8');
  } catch {
    // new file
  }
  await fs.writeFile(target, edit(content), 'utf-8');
}

function doMerge(ref: string, applied: EmissionBatch[], onApply?: () => void): Promise<MergeWorkspaceBranchResult> {
  return mergeWorkspaceBranch({
    run,
    rootDir: local,
    ref,
    workspaceUid: 'wsaaaaaa',
    readSnapshot: async () => state,
    nextCtx,
    liveSetEntries: () => [],
    apply: async (batches) => {
      applied.push(...batches);
      onApply?.();
    },
    flush: () => materializer.flush(),
    identityEnv: IDENTITY_ENV,
    bypassHooks: false,
  });
}

/**
 * Emulate the checkout-reconcile the runtime performs after a branch
 * switch (rung-2 sweep): the tree is truth, so the baseline follows
 * the checked-out bytes. Without this, the materializer's off-baseline
 * guard rightly refuses to touch a tree it did not write.
 */
async function rebaseline(dir: string): Promise<void> {
  const index: MaterializedIndex = {};
  for (const file of await listWorkspaceTreeFiles(dir)) {
    index[file.path] = hashTreeContent(file.content);
  }
  await writeMaterializedIndex(dir, index);
}

async function assertNoConflictMarkers(dir: string): Promise<void> {
  const files = await fs.readdir(path.join(dir, 'rules'), { recursive: true });
  for (const entry of files) {
    const target = path.join(dir, 'rules', String(entry));
    const stat = await fs.stat(target);
    if (!stat.isFile()) continue;
    expect(await fs.readFile(target, 'utf-8')).not.toContain('<<<<<<<');
  }
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-merge-'));
  local = path.join(tmpDir, 'local');
  state = emptyState();
  state.rules = [makeRule('aaaaaaaa', 'Block probes')];
  hlcMs = 1_000;
  run = isolated(createGitExec());

  await fs.mkdir(local, { recursive: true });
  materializer = new WorkspaceTreeMaterializer({ rootDir: local, readSnapshot: async () => ({ state }) });
  await fs.writeFile(path.join(local, '.gitignore'), '.oh/\n*.secret.yaml\n', 'utf-8');
  await materializer.flush();
  await ensureWorkspaceRepo(run, local);
  await raw(local, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const initial = await commitWorkspaceTree({
    run,
    rootDir: local,
    message: 'Initial tree',
    identityEnv: IDENTITY_ENV,
  });
  if (!initial.ok || !initial.committed) throw new Error('initial commit failed');
});

afterEach(async () => {
  materializer.dispose();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

/** Commit an edit on a branch under Rita's identity and return to main. */
async function branchEdit(branch: string, message: string): Promise<string> {
  await raw(local, 'checkout', '-q', '-b', branch);
  await localEdit(local, RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (branch)'));
  const committed = await commitWorkspaceTree({ run, rootDir: local, message, identityEnv: RITA_ENV });
  if (!committed.ok || !committed.committed) throw new Error('branch commit failed');
  await raw(local, 'checkout', '-q', 'main');
  return committed.sha;
}

describe('mergeWorkspaceBranch', () => {
  it('an un-diverged current branch fast-forwards to the merged ref — no merge bubble', async () => {
    const branchSha = await branchEdit('local-test', 'Rename on branch');

    const applied: EmissionBatch[] = [];
    const result = await doMerge('local-test', applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (branch)' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: branchSha });

    expect(applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body))).toContainEqual({
      kind: 'setField',
      type: 'rule',
      id: 'aaaaaaaa',
      path: 'name',
      value: 'Block probes (branch)',
    });
    const head = await raw(local, 'rev-parse', 'HEAD');
    expect(head.stdout.trim()).toBe(branchSha);
    expect(await countDirtyFiles(run, local)).toBe(0);
    await assertNoConflictMarkers(local);
  });

  it('a diverged merge records a two-parent commit with Co-Authored-By trailers', async () => {
    const branchSha = await branchEdit('local-test', 'Rename on branch');

    // Diverge main: a second rule lands here only.
    state.rules = [...state.rules, makeRule('bbbbbbbb', 'Allow health')];
    await materializer.flush();
    const mainCommit = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Add health rule',
      identityEnv: IDENTITY_ENV,
    });
    if (!mainCommit.ok || !mainCommit.committed) throw new Error('main divergence commit failed');

    const applied: EmissionBatch[] = [];
    const result = await doMerge('local-test', applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (branch)' } as Rule, state.rules[1]];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });

    const p1 = await raw(local, 'rev-parse', 'HEAD^1');
    const p2 = await raw(local, 'rev-parse', 'HEAD^2');
    expect(p1.stdout.trim()).toBe(mainCommit.sha);
    expect(p2.stdout.trim()).toBe(branchSha);
    const body = await raw(local, 'log', '-1', '--format=%B');
    expect(body.stdout).toContain("Merge branch 'local-test'");
    expect(body.stdout).toContain('Co-Authored-By: Remote Rita <rita@openheaders.io>');
    // Both sides present in the merged tree.
    const ruleBytes = await fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8');
    expect(ruleBytes).toContain('name: Block probes (branch)');
    const listing = await raw(local, 'ls-tree', '-r', '--name-only', 'HEAD');
    expect(listing.stdout).toContain('allow-health-bbbbbbbb');
    expect(await countDirtyFiles(run, local)).toBe(0);
    await assertNoConflictMarkers(local);
  });

  it('merging an already-contained ref is a clean up-to-date no-op', async () => {
    await raw(local, 'branch', 'stale', 'HEAD');
    const applied: EmissionBatch[] = [];
    const result = await doMerge('stale', applied);
    expect(result).toEqual({ ok: true, upToDate: true });
    expect(applied).toHaveLength(0);
  });

  it('refuses an unknown ref and a self-merge', async () => {
    expect(await doMerge('no-such-branch', [])).toMatchObject({ ok: false, reason: 'unknown-ref' });
    expect(await doMerge('main', [])).toMatchObject({ ok: false, reason: 'self-merge' });
  });

  it('refuses a ref whose tree claims another workspace identity', async () => {
    await raw(local, 'checkout', '-q', '-b', 'impostor');
    await localEdit(local, 'workspace.yaml', (content) => content.replace('wsaaaaaa', 'wszzzzzz'));
    const committed = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Claim another identity',
      identityEnv: RITA_ENV,
    });
    if (!committed.ok || !committed.committed) throw new Error('impostor commit failed');
    await raw(local, 'checkout', '-q', 'main');

    expect(await doMerge('impostor', [])).toMatchObject({ ok: false, reason: 'identity-mismatch', detail: 'wszzzzzz' });
  });

  it('the §6 teammate scenario end-to-end: isolated branch, pull main in on demand, merge back clean', async () => {
    // A shared remote + a teammate clone.
    const bare = path.join(tmpDir, 'remote.git');
    const peer = path.join(tmpDir, 'peer');
    await run(['init', '--bare', bare], { cwd: tmpDir });
    await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
    await raw(local, 'remote', 'add', 'origin', bare);
    await raw(local, 'push', '--quiet', '-u', 'origin', 'main');
    await run(['clone', '--quiet', bare, peer], { cwd: tmpDir });

    // Branch off main and edit in isolation (engine commit on the branch).
    await raw(local, 'checkout', '-q', '-b', 'local-test');
    state.rules = [{ ...state.rules[0], name: 'Block probes (mine)' } as Rule];
    await materializer.flush();
    const branchCommit = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'My branch edit',
      identityEnv: IDENTITY_ENV,
    });
    if (!branchCommit.ok || !branchCommit.committed) throw new Error('branch commit failed');

    // The teammate pushes to main — the branch must not see it yet.
    const peerState = emptyState();
    peerState.rules = [makeRule('aaaaaaaa', 'Block probes'), makeRule('bbbbbbbb', 'Allow health')];
    const peerMaterializer = new WorkspaceTreeMaterializer({
      rootDir: peer,
      readSnapshot: async () => ({ state: peerState }),
    });
    await peerMaterializer.flush();
    peerMaterializer.dispose();
    const peerCommit = await commitWorkspaceTree({
      run,
      rootDir: peer,
      message: 'Teammate adds health rule',
      identityEnv: RITA_ENV,
    });
    if (!peerCommit.ok || !peerCommit.committed) throw new Error('peer commit failed');
    const pushed = await raw(peer, 'push', '--quiet', 'origin', 'main');
    if (pushed.code !== 0) throw new Error(`peer push failed: ${pushed.stderr}`);

    await raw(local, 'fetch', '--quiet', 'origin');
    const branchTip = await raw(local, 'rev-parse', 'refs/heads/local-test');
    expect(branchTip.stdout.trim()).toBe(branchCommit.sha);

    // Pull main into the branch on demand = merge origin/main here.
    const applied: EmissionBatch[] = [];
    const pulledIn = await doMerge('origin/main', applied, () => {
      state.rules = [state.rules[0], makeRule('bbbbbbbb', 'Allow health')];
    });
    expect(pulledIn).toMatchObject({ ok: true, upToDate: false });
    const mergeParents = await raw(local, 'log', '-1', '--format=%P');
    expect(mergeParents.stdout.trim().split(/\s+/)).toEqual([branchCommit.sha, peerCommit.sha]);
    await assertNoConflictMarkers(local);

    // Merge back: switch to main and reconcile tree-wins (the switch
    // pass's sweep — tree is truth, engine and baseline follow), then
    // merge the branch — main has no commits of its own, so this is a
    // clean fast-forward.
    await raw(local, 'checkout', '-q', 'main');
    state = emptyState();
    state.rules = [makeRule('aaaaaaaa', 'Block probes')];
    await rebaseline(local);
    const mergedBack = await doMerge('local-test', [], () => {
      state.rules = [
        { ...makeRule('aaaaaaaa', 'Block probes'), name: 'Block probes (mine)' } as Rule,
        makeRule('bbbbbbbb', 'Allow health'),
      ];
    });
    expect(mergedBack).toMatchObject({ ok: true, upToDate: false });
    const mainTip = await raw(local, 'rev-parse', 'HEAD');
    const branchTipAfter = await raw(local, 'rev-parse', 'refs/heads/local-test');
    expect(mainTip.stdout.trim()).toBe(branchTipAfter.stdout.trim());

    // The merged history is a clean two-parent story: exactly one
    // merge commit, both line edits present.
    const merges = await raw(local, 'log', '--merges', '--format=%H');
    expect(merges.stdout.trim().split('\n').filter(Boolean)).toHaveLength(1);
    const ruleBytes = await fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8');
    expect(ruleBytes).toContain('name: Block probes (mine)');
    const listing = await raw(local, 'ls-tree', '-r', '--name-only', 'HEAD');
    expect(listing.stdout).toContain('allow-health-bbbbbbbb');
    expect(await countDirtyFiles(run, local)).toBe(0);
    await assertNoConflictMarkers(local);
  });
});
