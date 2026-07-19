/**
 * Pull pass on real tmp repos + a bare "remote" (GIT_PLAN.md §10
 * Phase 4; §11.4 as ratified S6): foreign commits converge through the
 * mutator seam as virtual batches, the engine-written tree is recorded
 * as a TWO-PARENT merge commit with `Co-Authored-By:` trailers, and
 * `git merge` is never invoked. Also pins the §3.3 in-progress-op
 * refusal, the identity guard, the no-upstream refusal, and the §13.3
 * quarantine posture for schema-invalid foreign documents.
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
import { commitWorkspaceTree, countDirtyFiles, ensureWorkspaceRepo, resolveUpstream } from '../../src/git/repo';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import { type PullWorkspaceTreeResult, pullWorkspaceTree } from '../../src/workspace-tree/pull';

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
let peer: string;
let bare: string;
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

async function peerEdit(rel: string, edit: (content: string) => string): Promise<void> {
  const target = path.join(peer, ...rel.split('/'));
  await fs.mkdir(path.dirname(target), { recursive: true });
  let content = '';
  try {
    content = await fs.readFile(target, 'utf-8');
  } catch {
    // new file
  }
  await fs.writeFile(target, edit(content), 'utf-8');
}

async function peerCommitPush(message: string): Promise<string> {
  const result = await commitWorkspaceTree({ run, rootDir: peer, message, identityEnv: RITA_ENV });
  if (!result.ok || !result.committed) throw new Error('peer commit failed');
  const pushed = await raw(peer, 'push', '--quiet', 'origin', 'main');
  if (pushed.code !== 0) throw new Error(`peer push failed: ${pushed.stderr}`);
  return result.sha;
}

function doPull(
  applied: EmissionBatch[],
  onApply?: () => void,
  lastSyncedRemoteSha?: string,
): Promise<PullWorkspaceTreeResult> {
  return pullWorkspaceTree({
    run,
    rootDir: local,
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
    ...(lastSyncedRemoteSha !== undefined ? { lastSyncedRemoteSha } : {}),
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-pull-'));
  local = path.join(tmpDir, 'local');
  peer = path.join(tmpDir, 'peer');
  bare = path.join(tmpDir, 'remote.git');
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
  await run(['init', '--bare', bare], { cwd: tmpDir });
  await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
  await raw(local, 'remote', 'add', 'origin', bare);
  await raw(local, 'push', '--quiet', '-u', 'origin', 'main');
  await run(['clone', '--quiet', bare, peer], { cwd: tmpDir });
});

afterEach(async () => {
  materializer.dispose();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('pullWorkspaceTree', () => {
  it('an un-diverged pull converges through the mutators and fast-forwards — no merge bubble', async () => {
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });

    expect(applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body))).toContainEqual({
      kind: 'setField',
      type: 'rule',
      id: 'aaaaaaaa',
      path: 'name',
      value: 'Block probes (peer)',
    });

    // Plain-git pull semantics: HEAD IS the foreign head, no new commit.
    const head = await raw(local, 'rev-parse', 'HEAD');
    expect(head.stdout.trim()).toBe(foreignSha);

    const onDisk = await fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8');
    expect(onDisk).toContain('name: Block probes (peer)');
    expect(await countDirtyFiles(run, local)).toBe(0);
    expect((await resolveUpstream(run, local))?.behind).toBe(0);
  });

  it('a diverged pull records a two-parent merge with Co-Authored-By trailers', async () => {
    // Local divergence: a commit here that never reached the remote
    // (the shape the runtime's pre-pull local commit produces).
    await fs.writeFile(path.join(local, 'NOTES.md'), '# local notes\n', 'utf-8');
    const localCommit = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Local notes',
      identityEnv: IDENTITY_ENV,
    });
    if (!localCommit.ok || !localCommit.committed) throw new Error('local divergence commit failed');

    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });

    const p1 = await raw(local, 'rev-parse', 'HEAD^1');
    const p2 = await raw(local, 'rev-parse', 'HEAD^2');
    expect(p1.stdout.trim()).toBe(localCommit.sha);
    expect(p2.stdout.trim()).toBe(foreignSha);
    const body = await raw(local, 'log', '-1', '--format=%B');
    expect(body.stdout).toContain('Merge origin/main');
    expect(body.stdout).toContain('Co-Authored-By: Remote Rita <rita@openheaders.io>');
    expect(await countDirtyFiles(run, local)).toBe(0);
    expect((await resolveUpstream(run, local))?.behind).toBe(0);
  });

  it('a second pull with nothing new is a clean no-op', async () => {
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerCommitPush('Rename rule');
    const applied: EmissionBatch[] = [];
    await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
    });

    const again: EmissionBatch[] = [];
    const result = await doPull(again);
    expect(result).toMatchObject({ ok: true, upToDate: true, issues: [] });
    expect(again).toHaveLength(0);
  });

  it('a foreign deletion tombstones and the merged tree drops the file', async () => {
    await fs.rm(path.join(peer, 'rules'), { recursive: true });
    await peerCommitPush('Delete rule');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.rules = [];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body))).toContainEqual(
      expect.objectContaining({ kind: 'delete', type: 'rule', id: 'aaaaaaaa' }),
    );
    await expect(fs.access(path.join(local, ...RULE_FILE.split('/')))).rejects.toThrow();
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('a schema-invalid foreign document quarantines: engine untouched, foreign bytes on disk, issue reported', async () => {
    await peerEdit(RULE_FILE, () => 'schemaVersion: 5\nuid: [broken\n');
    await peerCommitPush('Break the rule file');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied);
    expect(result).toMatchObject({ ok: true, upToDate: false });
    if (!result.ok || result.upToDate) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].path).toBe(RULE_FILE);
    expect(applied).toHaveLength(0);
    expect(state.rules[0].name).toBe('Block probes');

    const onDisk = await fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8');
    expect(onDisk).toBe('schemaVersion: 5\nuid: [broken\n');

    // Off-baseline: the materializer's rung-2 guard keeps protecting
    // the quarantined bytes on every later flush.
    await materializer.flush();
    await expect(fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8')).resolves.toBe(
      'schemaVersion: 5\nuid: [broken\n',
    );
  });

  it('a rewritten remote head refuses the pull with force-push (§16 — the trichotomy resolves it)', async () => {
    // First sync: the peer's edit integrates and its sha becomes the
    // watermark the runtime would persist.
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const firstSha = await peerCommitPush('Rename rule');
    const applied: EmissionBatch[] = [];
    await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
    });

    // The peer rewrites history: rewind to the initial commit, land a
    // different edit, force-push.
    const baseSha = (await raw(peer, 'rev-parse', 'HEAD~1')).stdout.trim();
    await raw(peer, 'update-ref', 'HEAD', baseSha);
    await raw(peer, 'read-tree', 'HEAD');
    await raw(peer, 'checkout-index', '-a', '-f');
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Rewritten'));
    const rewriteCommit = await commitWorkspaceTree({
      run,
      rootDir: peer,
      message: 'Rewritten history',
      identityEnv: RITA_ENV,
    });
    if (!rewriteCommit.ok || !rewriteCommit.committed) throw new Error('rewrite commit failed');
    await raw(peer, 'push', '--quiet', '--force', 'origin', 'main');

    const again: EmissionBatch[] = [];
    const result = await doPull(again, undefined, firstSha);
    expect(result).toMatchObject({ ok: false, reason: 'force-push' });
    expect(again).toHaveLength(0);
    expect(state.rules[0].name).toBe('Block probes (peer)');
  });

  it('a foreign tree claiming another workspace uid is refused', async () => {
    await peerEdit('workspace.yaml', (content) => content.replace('uid: wsaaaaaa', 'uid: wsother1'));
    await peerCommitPush('Steal the tree');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied);
    expect(result).toMatchObject({ ok: false, reason: 'identity-mismatch' });
    expect(applied).toHaveLength(0);
  });

  it('an in-progress git operation holds the pull (§3.3)', async () => {
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerCommitPush('Rename rule');
    await fs.writeFile(path.join(local, '.git', 'MERGE_HEAD'), 'deadbeef\n', 'utf-8');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied);
    expect(result).toMatchObject({ ok: false, reason: 'op-in-progress', detail: 'MERGE_HEAD' });
    expect(applied).toHaveLength(0);
    await fs.rm(path.join(local, '.git', 'MERGE_HEAD'));
  });

  it('a repo without an upstream refuses without touching the network', async () => {
    const lone = path.join(tmpDir, 'lone');
    await fs.mkdir(lone, { recursive: true });
    await ensureWorkspaceRepo(run, lone);
    const result = await pullWorkspaceTree({
      run,
      rootDir: lone,
      workspaceUid: 'wsaaaaaa',
      readSnapshot: async () => state,
      nextCtx,
      liveSetEntries: () => [],
      apply: async () => undefined,
      flush: async () => undefined,
      identityEnv: IDENTITY_ENV,
      bypassHooks: false,
    });
    expect(result).toEqual({ ok: false, reason: 'no-upstream', issues: [] });
  });
});
