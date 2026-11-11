/**
 * Pull pass on real tmp repos + a bare "remote" (the git-sync plan §10
 * Phase 4; §11.4 as ratified S6): foreign commits converge through the
 * mutator seam as virtual batches, the engine-written tree is recorded
 * as a TWO-PARENT merge commit with `Co-Authored-By:` trailers, and
 * `git merge` is never invoked. Also pins the §3.3 in-progress-op
 * refusal, the identity guard, the no-upstream refusal, and the §13.3
 * quarantine posture for schema-invalid foreign documents. The last
 * describe pins the files no entity stands behind: the peer's change
 * to one lands on disk before the pull is recorded, a file both sides
 * changed keeps its local bytes and is named, and a request's body and
 * script ride the foreign read with their manifest. The secret-rows
 * describe pins the gitignored half of an environment: a peer's edit
 * to another variable leaves the local secret rows alone, and a secret
 * row the peer added, renamed or removed follows the committed
 * template with the local value kept. The uncommitted-work describe
 * pins what the pull records: its own files and no other — work
 * elsewhere stays uncommitted across a fast-forward and a merge, work
 * in a document the pull writes stays uncommitted too (the commit holds
 * the document without it), and work the commit cannot be read without
 * — an own file, a document the branch's commits and the peer both
 * changed in one value — is asked about and committed first, alone.
 * The change-over-the-branch describe pins the merge itself: the
 * foreign history's change is laid over the branch value by value — an
 * edit of each side to one document keeps both, a value both changed is
 * asked about with nothing written and recorded as answered.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MutatorContext } from '@openheaders/core/sync';
import type { EmissionBatch } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import type { Collection, Request, Rule, Variable, Workspace } from '@openheaders/core/types';
import type { WorkspaceTreeState } from '@openheaders/core/workspace-tree';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { commitWorkspaceTree, countDirtyFiles, ensureWorkspaceRepo, resolveUpstream } from '../../src/git/repo';
import type { ApplyCommitResolution, ApplyCommitResolve } from '../../src/workspace-tree/change-answers';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import type { LocalWorkDeps } from '../../src/workspace-tree/pass-writes';
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

let mayCommitLocalWork: boolean;
/** The path sets the pass asked to have committed first, in order. */
let localWorkCommits: string[][];

/** The pass's way to commit local work first — one commit of exactly the paths it names. */
function localWork(rootDir: string): LocalWorkDeps {
  return {
    mayCommitLocalWork,
    commitLocalWork: async ({ tree, paths, indexLock }) => {
      localWorkCommits.push(paths);
      const result = await commitWorkspaceTree({
        run,
        rootDir,
        message: 'Local work',
        identityEnv: IDENTITY_ENV,
        fromTree: tree,
        paths,
        indexLock,
      });
      return result.ok ? { ok: true } : { ok: false, detail: result.detail };
    },
  };
}

function doPull(
  applied: EmissionBatch[],
  onApply?: () => void,
  lastSyncedRemoteSha?: string,
  resolution?: ApplyCommitResolution,
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
    ...localWork(local),
    identityEnv: IDENTITY_ENV,
    bypassHooks: false,
    ...(lastSyncedRemoteSha !== undefined ? { lastSyncedRemoteSha } : {}),
    ...(resolution !== undefined ? { resolution } : {}),
  });
}

/** The files a pull refused `conflicts` with, and the token to answer them under. */
function filesToAnswer(result: PullWorkspaceTreeResult): ApplyCommitResolve {
  if (result.ok || result.reason !== 'conflicts' || result.resolve === undefined) {
    throw new Error(`expected files to answer, got ${JSON.stringify(result)}`);
  }
  return result.resolve;
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
  mayCommitLocalWork = true;
  localWorkCommits = [];

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

  it('an index another git process is writing refuses the pull before anything is written — it goes through once free', async () => {
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');
    const headBefore = (await raw(local, 'rev-parse', 'HEAD')).stdout.trim();
    const lock = path.join(local, '.git', 'index.lock');
    await fs.writeFile(lock, '', { flag: 'wx' });

    const applied: EmissionBatch[] = [];
    const refused = await doPull(applied);
    expect(refused).toMatchObject({ ok: false, reason: 'index-locked' });
    expect(applied).toHaveLength(0);
    expect((await raw(local, 'rev-parse', 'HEAD')).stdout.trim()).toBe(headBefore);
    expect(await fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8')).not.toContain('(peer)');
    await fs.rm(lock);

    const result = await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(await countDirtyFiles(run, local)).toBe(0);
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

  it('a foreign fix heals the quarantine: bytes land on disk, issue clears, tree ends clean', async () => {
    await peerEdit(RULE_FILE, () => 'schemaVersion: 5\nuid: [broken\n');
    await peerCommitPush('Break the rule file');
    const broken = await doPull([]);
    expect(broken).toMatchObject({ ok: true, upToDate: false });

    // The peer restores a valid document (with a fresh edit riding it).
    await raw(peer, 'checkout', 'HEAD~1', '--', RULE_FILE);
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (fixed)'));
    await peerCommitPush('Fix the rule file');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Block probes (fixed)' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, issues: [] });
    expect(applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body))).toContainEqual(
      expect.objectContaining({ kind: 'setField', type: 'rule', id: 'aaaaaaaa', path: 'name' }),
    );

    // The healed foreign truth supersedes the engine's own quarantine
    // write — the fixed bytes reach the disk (without the quarantine
    // record the rung-2 guard would protect the broken bytes forever).
    const onDisk = await fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8');
    expect(onDisk).toContain('name: Block probes (fixed)');
    expect(onDisk).not.toContain('[broken');
    expect(await countDirtyFiles(run, local)).toBe(0);

    // Re-adopted into the baseline: later flushes treat the file as
    // engine-owned again (no stale write-guard residue).
    await materializer.flush();
    await expect(fs.readFile(path.join(local, ...RULE_FILE.split('/')), 'utf-8')).resolves.toContain(
      'name: Block probes (fixed)',
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
      ...localWork(lone),
      identityEnv: IDENTITY_ENV,
      bypassHooks: false,
    });
    expect(result).toEqual({ ok: false, reason: 'no-upstream', issues: [] });
  });
});

describe("pullWorkspaceTree — the user's own files and a document's siblings", () => {
  const onLocal = (rel: string): string => path.join(local, ...rel.split('/'));

  async function commitLocal(message: string): Promise<string> {
    const result = await commitWorkspaceTree({ run, rootDir: local, message, identityEnv: IDENTITY_ENV });
    if (!result.ok || !result.committed) throw new Error(`local commit failed: ${message}`);
    return result.sha;
  }

  /** Files both clones hold before the peer moves on. */
  async function shareOwnFiles(files: Record<string, string>): Promise<void> {
    for (const [rel, content] of Object.entries(files)) {
      await fs.mkdir(path.dirname(onLocal(rel)), { recursive: true });
      await fs.writeFile(onLocal(rel), content, 'utf-8');
    }
    await commitLocal('Own files');
    await raw(local, 'push', '--quiet', 'origin', 'main');
    const pulled = await raw(peer, 'pull', '--quiet', 'origin', 'main');
    if (pulled.code !== 0) throw new Error(`peer pull failed: ${pulled.stderr}`);
  }

  it("a fast-forward pull lands the peer's added, edited and deleted own files — nothing is committed on top", async () => {
    await shareOwnFiles({ 'docs/guide.md': '# guide\n', 'scripts/run.sh': 'echo run\n' });
    await peerEdit('README.md', () => '# peer readme\n');
    await peerEdit('docs/guide.md', () => '# guide (peer)\n');
    await fs.rm(path.join(peer, 'scripts'), { recursive: true });
    const foreignSha = await peerCommitPush('Docs');

    const result = await doPull([]);
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(result).not.toHaveProperty('keptLocal');

    expect((await raw(local, 'rev-parse', 'HEAD')).stdout.trim()).toBe(foreignSha);
    expect(await fs.readFile(onLocal('README.md'), 'utf-8')).toBe('# peer readme\n');
    expect(await fs.readFile(onLocal('docs/guide.md'), 'utf-8')).toBe('# guide (peer)\n');
    await expect(fs.access(onLocal('scripts'))).rejects.toThrow();
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it("a diverged pull records the peer's own file in the merge beside the local one", async () => {
    await fs.writeFile(onLocal('NOTES.md'), '# local notes\n', 'utf-8');
    await commitLocal('Local notes');
    await peerEdit('README.md', () => '# peer readme\n');
    const foreignSha = await peerCommitPush('Add readme');

    const result = await doPull([]);
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect((await raw(local, 'rev-parse', 'HEAD^2')).stdout.trim()).toBe(foreignSha);
    expect((await raw(local, 'show', 'HEAD:README.md')).stdout).toBe('# peer readme\n');
    expect((await raw(local, 'show', 'HEAD:NOTES.md')).stdout).toBe('# local notes\n');
    expect(await fs.readFile(onLocal('README.md'), 'utf-8')).toBe('# peer readme\n');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('an own text file both sides changed is asked about with nothing written; the answer is recorded and the rest lands', async () => {
    await shareOwnFiles({ 'docs/guide.md': '# guide\n' });
    await fs.writeFile(onLocal('docs/guide.md'), '# guide (local)\n', 'utf-8');
    const localSha = await commitLocal('Local guide');
    await peerEdit('docs/guide.md', () => '# guide (peer)\n');
    await peerEdit('README.md', () => '# peer readme\n');
    await peerCommitPush('Peer guide + readme');

    const first = await doPull([]);
    expect(first).toMatchObject({ ok: false, reason: 'conflicts', conflicts: ['docs/guide.md'] });
    const resolve = filesToAnswer(first);
    expect(resolve.files).toEqual([
      { path: 'docs/guide.md', base: '# guide\n', theirs: '# guide (peer)\n', mine: '# guide (local)\n' },
    ]);
    expect((await raw(local, 'rev-parse', 'HEAD')).stdout.trim()).toBe(localSha);
    await expect(fs.access(onLocal('README.md'))).rejects.toThrow();

    const result = await doPull([], undefined, undefined, {
      token: resolve.token,
      files: [{ path: 'docs/guide.md', content: '# guide (both)\n' }],
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(result).not.toHaveProperty('keptLocal');
    expect(await fs.readFile(onLocal('docs/guide.md'), 'utf-8')).toBe('# guide (both)\n');
    expect((await raw(local, 'show', 'HEAD:docs/guide.md')).stdout).toBe('# guide (both)\n');
    expect((await raw(local, 'show', 'HEAD:README.md')).stdout).toBe('# peer readme\n');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('one side for all takes an own text file whole from that side', async () => {
    await shareOwnFiles({ 'docs/guide.md': '# guide\n' });
    await fs.writeFile(onLocal('docs/guide.md'), '# guide (local)\n', 'utf-8');
    await commitLocal('Local guide');
    await peerEdit('docs/guide.md', () => '# guide (peer)\n');
    await peerCommitPush('Peer guide');

    const resolve = filesToAnswer(await doPull([]));
    const result = await doPull([], undefined, undefined, { token: resolve.token, side: 'theirs' });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(result).not.toHaveProperty('keptLocal');
    expect(await fs.readFile(onLocal('docs/guide.md'), 'utf-8')).toBe('# guide (peer)\n');
    expect((await raw(local, 'show', 'HEAD:docs/guide.md')).stdout).toBe('# guide (peer)\n');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('an own file both sides changed that is not text keeps the local bytes and is named', async () => {
    const bytes = (tail: number): Buffer => Buffer.from([0x89, 0x50, 0x00, 0x01, tail]);
    await fs.writeFile(onLocal('logo.bin'), bytes(1));
    await commitLocal('Logo');
    await raw(local, 'push', '--quiet', 'origin', 'main');
    await raw(peer, 'pull', '--quiet', 'origin', 'main');
    await fs.writeFile(onLocal('logo.bin'), bytes(2));
    await commitLocal('Local logo');
    await fs.writeFile(path.join(peer, 'logo.bin'), bytes(3));
    await peerCommitPush('Peer logo');

    const result = await doPull([]);
    expect(result).toMatchObject({ ok: true, upToDate: false, keptLocal: ['logo.bin'] });
    expect(await fs.readFile(onLocal('logo.bin'))).toEqual(bytes(2));
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('an uncommitted local file where the peer adds one is asked about — the answer stands on disk', async () => {
    await fs.writeFile(onLocal('README.md'), '# mine\n', 'utf-8');
    await peerEdit('README.md', () => '# peer readme\n');
    await peerCommitPush('Add readme');

    const resolve = filesToAnswer(await doPull([]));
    expect(resolve.files).toEqual([{ path: 'README.md', theirs: '# peer readme\n', mine: '# mine\n' }]);
    expect(await fs.readFile(onLocal('README.md'), 'utf-8')).toBe('# mine\n');

    const result = await doPull([], undefined, undefined, {
      token: resolve.token,
      files: [{ path: 'README.md', content: '# mine\n' }],
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(result).not.toHaveProperty('keptLocal');
    expect(await fs.readFile(onLocal('README.md'), 'utf-8')).toBe('# mine\n');
  });

  it("a peer's edit to a request leaves the body and the script beside it alone", async () => {
    const collection: Collection = {
      schemaVersion: 5,
      uid: 'rco0000a',
      path: 'requests/api-rco0000a',
      name: 'API',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    };
    const request = {
      schemaVersion: 5,
      uid: 'req00001',
      path: 'requests/api-rco0000a/ping-req00001',
      name: 'Ping',
      method: 'POST',
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'json', content: '{"probe":true}\n' },
      preRequestScript: 'console.log(1);\n',
    } as unknown as Request;
    const requestDir = 'requests/api-rco0000a/ping-req00001';
    state.requestCollections = [collection];
    state.requests = [request];
    await materializer.flush();
    await shareOwnFiles({});
    expect(await fs.readFile(onLocal(`${requestDir}/body.json`), 'utf-8')).toBe('{"probe":true}\n');

    await peerEdit(`${requestDir}/request.yaml`, (content) => content.replace('name: Ping', 'name: Ping (peer)'));
    const foreignSha = await peerCommitPush('Rename request');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.requests = [{ ...request, name: 'Ping (peer)' }];
    });
    // The rename alone — a read without the siblings would also clear the body and the script.
    expect(applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body))).toEqual([
      { kind: 'setField', type: 'request', id: 'req00001', path: 'name', value: 'Ping (peer)' },
    ]);
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(await fs.readFile(onLocal(`${requestDir}/body.json`), 'utf-8')).toBe('{"probe":true}\n');
    expect(await fs.readFile(onLocal(`${requestDir}/pre-request.js`), 'utf-8')).toBe('console.log(1);\n');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });
});

describe('pullWorkspaceTree — uncommitted work', () => {
  const onLocal = (rel: string): string => path.join(local, ...rel.split('/'));
  const out = async (...args: string[]): Promise<string> => (await raw(local, ...args)).stdout;
  const porcelain = (): Promise<string> => out('status', '--porcelain', '--untracked-files=all');
  const filesOf = async (commit: string): Promise<string[]> =>
    (await out('diff-tree', '--no-commit-id', '--name-only', '-r', `${commit}^1`, commit)).split('\n').filter(Boolean);
  const renameOnApply = (): void => {
    state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
  };

  /** Own files both clones hold, then local work no commit has: an edit to one, an unversioned file. */
  beforeEach(async () => {
    await fs.writeFile(onLocal('NOTES.md'), '# notes\n', 'utf-8');
    await fs.writeFile(onLocal('SHARED.md'), '# shared\nbase line\n', 'utf-8');
    const seeded = await commitWorkspaceTree({ run, rootDir: local, message: 'Own files', identityEnv: IDENTITY_ENV });
    if (!seeded.ok || !seeded.committed) throw new Error('own files commit failed');
    await raw(local, 'push', '--quiet', 'origin', 'main');
    const pulled = await raw(peer, 'pull', '--quiet', 'origin', 'main');
    if (pulled.code !== 0) throw new Error(`peer pull failed: ${pulled.stderr}`);
    await fs.writeFile(onLocal('NOTES.md'), '# notes\nnot committed\n', 'utf-8');
    await fs.writeFile(onLocal('scratch.txt'), 'unversioned\n', 'utf-8');
  });

  it('work the pull does not touch stays uncommitted and the branch fast-forwards under it', async () => {
    const before = await porcelain();
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    mayCommitLocalWork = false;
    const result = await doPull([], renameOnApply);
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(result).not.toHaveProperty('committedLocal');
    expect(localWorkCommits).toEqual([]);

    expect((await out('rev-parse', 'HEAD')).trim()).toBe(foreignSha);
    expect(await porcelain()).toBe(before);
    expect(await fs.readFile(onLocal('NOTES.md'), 'utf-8')).toBe('# notes\nnot committed\n');
    expect(await fs.readFile(onLocal(RULE_FILE), 'utf-8')).toContain('name: Block probes (peer)');
  });

  it("a diverged pull's merge commit carries the pull's files and no other", async () => {
    await fs.writeFile(onLocal('LOCAL.md'), '# committed here\n', 'utf-8');
    const localCommit = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Local file',
      identityEnv: IDENTITY_ENV,
      paths: ['LOCAL.md'],
    });
    if (!localCommit.ok || !localCommit.committed) throw new Error('local commit failed');
    const before = await porcelain();
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerEdit('PEER.md', () => '# peer\n');
    const foreignSha = await peerCommitPush('Rename rule, add a file');

    mayCommitLocalWork = false;
    const result = await doPull([], renameOnApply);
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(localWorkCommits).toEqual([]);

    expect((await out('rev-parse', 'HEAD^1')).trim()).toBe(localCommit.sha);
    expect((await out('rev-parse', 'HEAD^2')).trim()).toBe(foreignSha);
    expect(await filesOf('HEAD')).toEqual(['PEER.md', RULE_FILE]);
    expect(await porcelain()).toBe(before);
  });

  it("work in a document beside the peer's edit to another value stays uncommitted across a fast-forward", async () => {
    state.rules = [{ ...state.rules[0], name: 'Local name' } as Rule];
    await materializer.flush();
    const before = await porcelain();
    await peerEdit(RULE_FILE, (content) => content.replace('enabled: true', 'enabled: false'));
    const foreignSha = await peerCommitPush('Disable rule');

    mayCommitLocalWork = false;
    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], enabled: false } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(result).not.toHaveProperty('committedLocal');
    expect(localWorkCommits).toEqual([]);

    // The branch is the peer's head; the working file holds both edits, the person's still uncommitted.
    expect((await out('rev-parse', 'HEAD')).trim()).toBe(foreignSha);
    const onDisk = await fs.readFile(onLocal(RULE_FILE), 'utf-8');
    expect(onDisk).toContain('name: Local name');
    expect(onDisk).toContain('enabled: false');
    expect(await porcelain()).toBe(before);
    expect(await out('diff', '--unified=0', 'HEAD', '--', RULE_FILE)).toContain('+name: Local name');
    expect(await out('diff', '--unified=0', 'HEAD', '--', RULE_FILE)).not.toContain('enabled');
  });

  it('a diverged pull records the document without the uncommitted work it holds, which stays', async () => {
    await fs.writeFile(onLocal('LOCAL.md'), '# committed here\n', 'utf-8');
    const localCommit = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Local file',
      identityEnv: IDENTITY_ENV,
      paths: ['LOCAL.md'],
    });
    if (!localCommit.ok || !localCommit.committed) throw new Error('local commit failed');
    state.rules = [{ ...state.rules[0], name: 'Local name' } as Rule];
    await materializer.flush();
    const before = await porcelain();
    await peerEdit(RULE_FILE, (content) => content.replace('enabled: true', 'enabled: false'));
    const foreignSha = await peerCommitPush('Disable rule');

    mayCommitLocalWork = false;
    const result = await doPull([], () => {
      state.rules = [{ ...state.rules[0], enabled: false } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(result).not.toHaveProperty('committedLocal');
    expect(localWorkCommits).toEqual([]);

    // The merge holds the peer's edit over what the branch had committed — not the uncommitted name.
    expect((await out('rev-parse', 'HEAD^1')).trim()).toBe(localCommit.sha);
    expect((await out('rev-parse', 'HEAD^2')).trim()).toBe(foreignSha);
    expect(await filesOf('HEAD')).toEqual([RULE_FILE]);
    const merged = await out('show', `HEAD:${RULE_FILE}`);
    expect(merged).toContain('name: Block probes\n');
    expect(merged).toContain('enabled: false');
    const onDisk = await fs.readFile(onLocal(RULE_FILE), 'utf-8');
    expect(onDisk).toContain('name: Local name');
    expect(onDisk).toContain('enabled: false');
    expect(await porcelain()).toBe(before);
  });

  it('work in a document that changed the value the peer changed is answered, not committed: the branch takes the peer’s', async () => {
    state.rules = [{ ...state.rules[0], name: 'Local name' } as Rule];
    await materializer.flush();
    const before = await porcelain();
    const headBefore = (await out('rev-parse', 'HEAD')).trim();
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    // No question about committing it first — the two names are what is asked, with nothing written.
    mayCommitLocalWork = false;
    const applied: EmissionBatch[] = [];
    const resolve = filesToAnswer(await doPull(applied, renameOnApply));
    expect(resolve.files.map((file) => file.path)).toEqual([RULE_FILE]);
    expect(resolve.files[0].mine).toContain('name: Local name');
    expect(applied).toHaveLength(0);
    expect((await out('rev-parse', 'HEAD')).trim()).toBe(headBefore);
    expect(await porcelain()).toBe(before);

    // Answered with the branch's side: the work is kept and is still uncommitted.
    const kept = await doPull(applied, undefined, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: resolve.files[0].mine ?? '' }],
    });
    expect(kept).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(kept).not.toHaveProperty('committedLocal');
    expect(localWorkCommits).toEqual([]);
    expect(applied).toHaveLength(0);
    expect((await out('rev-parse', 'HEAD')).trim()).toBe(foreignSha);
    expect(await out('show', `HEAD:${RULE_FILE}`)).toContain('name: Block probes (peer)');
    expect(await fs.readFile(onLocal(RULE_FILE), 'utf-8')).toContain('name: Local name');
    expect(await porcelain()).toBe(before);
  });

  it('answered with the peer’s side, the uncommitted value gives way and the row leaves', async () => {
    state.rules = [{ ...state.rules[0], name: 'Local name' } as Rule];
    await materializer.flush();
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    mayCommitLocalWork = false;
    const resolve = filesToAnswer(await doPull([]));
    const result = await doPull([], renameOnApply, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: resolve.files[0].theirs ?? '' }],
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(localWorkCommits).toEqual([]);
    expect(await fs.readFile(onLocal(RULE_FILE), 'utf-8')).toContain('name: Block probes (peer)');
    expect(await porcelain()).toBe(' M NOTES.md\n?? scratch.txt\n');
  });

  it('work in a document where the branch’s own commit and the peer changed one value is committed first, on the word', async () => {
    state.rules = [{ ...state.rules[0], name: 'Committed name' } as Rule];
    await materializer.flush();
    const renamed = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Rename',
      identityEnv: IDENTITY_ENV,
      paths: [RULE_FILE],
    });
    if (!renamed.ok || !renamed.committed) throw new Error('local rename commit failed');
    state.rules = [{ ...state.rules[0], enabled: false } as Rule];
    await materializer.flush();
    const before = await porcelain();
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    // The merge has to record the person's answer to the two names — the work beside it goes in first.
    mayCommitLocalWork = false;
    const applied: EmissionBatch[] = [];
    expect(await doPull(applied, renameOnApply)).toEqual({
      ok: false,
      reason: 'local-changes',
      localChanges: [RULE_FILE],
      issues: [],
    });
    expect(applied).toHaveLength(0);
    expect(await porcelain()).toBe(before);

    mayCommitLocalWork = true;
    const resolve = filesToAnswer(await doPull(applied, renameOnApply));
    expect(localWorkCommits).toEqual([]);
    const result = await doPull(applied, renameOnApply, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: resolve.files[0].theirs ?? '' }],
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, committedLocal: [RULE_FILE] });
    expect(localWorkCommits).toEqual([[RULE_FILE]]);

    // The person's work is one commit of that file; the merge stands on it.
    expect((await out('log', '-1', '--format=%s', 'HEAD^1')).trim()).toBe('Local work');
    expect(await filesOf('HEAD^1')).toEqual([RULE_FILE]);
    expect(await out('show', `HEAD^1:${RULE_FILE}`)).toContain('enabled: false');
    expect((await out('rev-parse', 'HEAD^2')).trim()).toBe(foreignSha);
    expect(await fs.readFile(onLocal(RULE_FILE), 'utf-8')).toContain('name: Block probes (peer)');
    // The rows that were uncommitted elsewhere still are.
    expect(await porcelain()).toBe(' M NOTES.md\n?? scratch.txt\n');
  });

  it('work in an own file the peer also changed is named, committed first on the word, and merged as answered', async () => {
    await fs.writeFile(onLocal('SHARED.md'), '# shared\nbase line\nlocal line\n', 'utf-8');
    await peerEdit('SHARED.md', () => '# shared\nbase line\npeer line\n');
    await peerCommitPush('Peer line');

    mayCommitLocalWork = false;
    expect(await doPull([])).toMatchObject({ ok: false, reason: 'local-changes', localChanges: ['SHARED.md'] });

    mayCommitLocalWork = true;
    const resolve = filesToAnswer(await doPull([]));
    expect(resolve.files).toEqual([
      {
        path: 'SHARED.md',
        base: '# shared\nbase line\n',
        theirs: '# shared\nbase line\npeer line\n',
        mine: '# shared\nbase line\nlocal line\n',
      },
    ]);
    expect(localWorkCommits).toEqual([]);

    const both = '# shared\nbase line\nlocal line\npeer line\n';
    const result = await doPull([], undefined, undefined, {
      token: resolve.token,
      files: [{ path: 'SHARED.md', content: both }],
    });
    expect(result).toMatchObject({ ok: true, committedLocal: ['SHARED.md'] });
    expect(result).not.toHaveProperty('keptLocal');
    // The person's work is its own commit, as the file stood; the merge holds the answer.
    expect(await filesOf('HEAD^1')).toEqual(['SHARED.md']);
    expect(await out('show', 'HEAD^1:SHARED.md')).toBe('# shared\nbase line\nlocal line\n');
    expect(await out('show', 'HEAD:SHARED.md')).toBe(both);
    expect(await fs.readFile(onLocal('SHARED.md'), 'utf-8')).toBe(both);
    expect(await porcelain()).toBe(' M NOTES.md\n?? scratch.txt\n');
  });

  it('an ignored local file where the peer adds one stays the local file — the pull records no deletion of the peer’s', async () => {
    await fs.appendFile(path.join(local, '.git', 'info', 'exclude'), 'local.cfg\n', 'utf-8');
    await fs.writeFile(onLocal('local.cfg'), 'mine\n', 'utf-8');
    await peerEdit('local.cfg', () => 'theirs\n');
    const foreignSha = await peerCommitPush('Add a config file');

    // An ignored file is no uncommitted work to ask about; the two texts are.
    mayCommitLocalWork = false;
    const resolve = filesToAnswer(await doPull([]));
    expect(resolve.files).toEqual([{ path: 'local.cfg', theirs: 'theirs\n', mine: 'mine\n' }]);
    const result = await doPull([], undefined, undefined, {
      token: resolve.token,
      files: [{ path: 'local.cfg', content: 'mine\n' }],
    });
    expect(result).toMatchObject({ ok: true, upToDate: false, sha: foreignSha });
    expect(localWorkCommits).toEqual([]);

    // No follow-up: the branch holds the peer's file, the disk the local one.
    expect((await out('rev-parse', 'HEAD')).trim()).toBe(foreignSha);
    expect(await out('show', 'HEAD:local.cfg')).toBe('theirs\n');
    expect(await fs.readFile(onLocal('local.cfg'), 'utf-8')).toBe('mine\n');
    expect(await porcelain()).toBe(' M NOTES.md\n M local.cfg\n?? scratch.txt\n');
  });

  it('a document the peer rewrote without changing it is normalized in the follow-up — that file alone', async () => {
    const before = await porcelain();
    await peerEdit(RULE_FILE, (content) => `${content}# a note from the peer\n`);
    const foreignSha = await peerCommitPush('Annotate the rule file');

    mayCommitLocalWork = false;
    const result = await doPull([]);
    expect(result).toMatchObject({ ok: true, upToDate: false });

    expect((await out('rev-parse', 'HEAD^1')).trim()).toBe(foreignSha);
    expect((await out('log', '-1', '--format=%s')).trim()).toBe('Normalize pulled changes');
    expect(await filesOf('HEAD')).toEqual([RULE_FILE]);
    expect(await porcelain()).toBe(before);
  });
});

describe('pullWorkspaceTree — the foreign change over the branch', () => {
  const out = async (...args: string[]): Promise<string> => (await raw(local, ...args)).stdout;
  const bodies = (applied: EmissionBatch[]) => applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body));

  /** The branch commits a rename the remote never saw. */
  async function commitLocalRename(name: string): Promise<string> {
    state.rules = [{ ...state.rules[0], name } as Rule];
    await materializer.flush();
    const result = await commitWorkspaceTree({ run, rootDir: local, message: 'Rename', identityEnv: IDENTITY_ENV });
    if (!result.ok || !result.committed) throw new Error('local rename commit failed');
    return result.sha;
  }

  it('an edit of the branch beside an edit of the peer in one document keeps both', async () => {
    const localSha = await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) => content.replace('enabled: true', 'enabled: false'));
    const foreignSha = await peerCommitPush('Disable rule');

    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, () => {
      state.rules = [{ ...state.rules[0], enabled: false } as Rule];
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    // The peer's edit alone converges — the branch's rename is not written back.
    expect(bodies(applied)).toEqual([
      { kind: 'setField', type: 'rule', id: 'aaaaaaaa', path: 'enabled', value: false },
    ]);

    expect((await out('rev-parse', 'HEAD^1')).trim()).toBe(localSha);
    expect((await out('rev-parse', 'HEAD^2')).trim()).toBe(foreignSha);
    const merged = await out('show', `HEAD:${RULE_FILE}`);
    expect(merged).toContain('name: Local name');
    expect(merged).toContain('enabled: false');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('a value both sides changed is asked about with nothing written; the answer is what the merge records', async () => {
    const localSha = await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    const applied: EmissionBatch[] = [];
    const first = await doPull(applied);
    expect(first).toMatchObject({ ok: false, reason: 'conflicts', conflicts: [RULE_FILE] });
    const resolve = filesToAnswer(first);
    expect(resolve.files).toHaveLength(1);
    expect(resolve.files[0].path).toBe(RULE_FILE);
    expect(resolve.files[0].base).toContain('name: Block probes\n');
    expect(resolve.files[0].theirs).toContain('name: Block probes (peer)');
    expect(resolve.files[0].mine).toContain('name: Local name');
    expect(applied).toHaveLength(0);
    expect((await out('rev-parse', 'HEAD')).trim()).toBe(localSha);
    expect(await countDirtyFiles(run, local)).toBe(0);

    const answer = (resolve.files[0].mine ?? '').replace('name: Local name', 'name: Both names');
    const result = await doPull(
      applied,
      () => {
        state.rules = [{ ...state.rules[0], name: 'Both names' } as Rule];
      },
      undefined,
      { token: resolve.token, files: [{ path: RULE_FILE, content: answer }] },
    );
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(bodies(applied)).toEqual([
      { kind: 'setField', type: 'rule', id: 'aaaaaaaa', path: 'name', value: 'Both names' },
    ]);
    expect((await out('rev-parse', 'HEAD^1')).trim()).toBe(localSha);
    expect((await out('rev-parse', 'HEAD^2')).trim()).toBe(foreignSha);
    expect(await out('show', `HEAD:${RULE_FILE}`)).toContain('name: Both names');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it("answered with the branch's side, the merge records the branch's document and applies nothing", async () => {
    await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    const foreignSha = await peerCommitPush('Rename rule');

    const resolve = filesToAnswer(await doPull([]));
    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, undefined, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: resolve.files[0].mine ?? '' }],
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(applied).toHaveLength(0);
    expect((await out('rev-parse', 'HEAD^2')).trim()).toBe(foreignSha);
    expect(await out('show', `HEAD:${RULE_FILE}`)).toContain('name: Local name');
    expect((await resolveUpstream(run, local))?.behind).toBe(0);
  });

  it("one side for all, the peer's: the value both changed takes the peer's and the branch's own edit beside it stays", async () => {
    state.rules = [{ ...state.rules[0], name: 'Local name', enabled: false } as Rule];
    await materializer.flush();
    const committed = await commitWorkspaceTree({
      run,
      rootDir: local,
      message: 'Rename, disable',
      identityEnv: IDENTITY_ENV,
    });
    expect(committed).toMatchObject({ ok: true, committed: true });
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerCommitPush('Rename rule');

    const resolve = filesToAnswer(await doPull([]));
    const applied: EmissionBatch[] = [];
    const result = await doPull(
      applied,
      () => {
        state.rules = [{ ...state.rules[0], name: 'Block probes (peer)' } as Rule];
      },
      undefined,
      { token: resolve.token, side: 'theirs' },
    );
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(bodies(applied)).toEqual([
      { kind: 'setField', type: 'rule', id: 'aaaaaaaa', path: 'name', value: 'Block probes (peer)' },
    ]);
    const merged = await out('show', `HEAD:${RULE_FILE}`);
    expect(merged).toContain('name: Block probes (peer)');
    expect(merged).toContain('enabled: false');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it("one side for all, the branch's: the value both changed stays and the peer's edit beside it lands", async () => {
    await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) =>
      content.replace('name: Block probes', 'name: Block probes (peer)').replace('enabled: true', 'enabled: false'),
    );
    await peerCommitPush('Rename, disable');

    const resolve = filesToAnswer(await doPull([]));
    const applied: EmissionBatch[] = [];
    const result = await doPull(
      applied,
      () => {
        state.rules = [{ ...state.rules[0], enabled: false } as Rule];
      },
      undefined,
      { token: resolve.token, side: 'mine' },
    );
    expect(result).toMatchObject({ ok: true, upToDate: false });
    expect(bodies(applied)).toEqual([
      { kind: 'setField', type: 'rule', id: 'aaaaaaaa', path: 'enabled', value: false },
    ]);
    const merged = await out('show', `HEAD:${RULE_FILE}`);
    expect(merged).toContain('name: Local name');
    expect(merged).toContain('enabled: false');
  });

  it('one side given against another reading of the files is asked again, as they stand', async () => {
    await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerCommitPush('Rename rule');

    const first = filesToAnswer(await doPull([]));
    state.rules = [{ ...state.rules[0], name: 'Local name, again' } as Rule];
    const applied: EmissionBatch[] = [];
    const again = filesToAnswer(await doPull(applied, undefined, undefined, { token: first.token, side: 'theirs' }));
    expect(again.token).not.toBe(first.token);
    expect(applied).toHaveLength(0);
  });

  it('an answer made against another reading of the files is asked again, as they stand', async () => {
    await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerCommitPush('Rename rule');

    const first = filesToAnswer(await doPull([]));
    // The branch moves on while the answer is being made.
    state.rules = [{ ...state.rules[0], name: 'Local name, again' } as Rule];
    const applied: EmissionBatch[] = [];
    const again = await doPull(applied, undefined, undefined, {
      token: first.token,
      files: [{ path: RULE_FILE, content: first.files[0].theirs ?? '' }],
    });
    const resolve = filesToAnswer(again);
    expect(resolve.token).not.toBe(first.token);
    expect(resolve.files[0].mine).toContain('name: Local name, again');
    expect(applied).toHaveLength(0);
  });

  it('an answer that does not read as the document is refused, naming the file', async () => {
    await commitLocalRename('Local name');
    await peerEdit(RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
    await peerCommitPush('Rename rule');

    const resolve = filesToAnswer(await doPull([]));
    const applied: EmissionBatch[] = [];
    const result = await doPull(applied, undefined, undefined, {
      token: resolve.token,
      files: [{ path: RULE_FILE, content: 'schemaVersion: 5\nuid: [broken\n' }],
    });
    expect(result).toMatchObject({ ok: false, reason: 'resolution-invalid', file: RULE_FILE });
    expect(applied).toHaveLength(0);
  });
});

describe("pullWorkspaceTree — an environment's secret rows", () => {
  const DEFAULT_FILE = 'environments/staging-envaaaaa.yaml';
  const TEMPLATE_FILE = 'environments/staging-envaaaaa.secret.yaml.template';
  const host: Variable = { uid: 'varaaaa1', name: 'host', value: 'staging.openheaders.io', type: 'default' };
  const token: Variable = { uid: 'varaaaa2', name: 'token', value: 's3cret', type: 'secret' };

  /** Both clones hold the environment; the secret file exists on the local side alone (it is gitignored). */
  beforeEach(async () => {
    state.environments = [{ schemaVersion: 5, uid: 'envaaaaa', name: 'Staging', variables: [host, token] }];
    await materializer.flush();
    const seeded = await commitWorkspaceTree({ run, rootDir: local, message: 'Add env', identityEnv: IDENTITY_ENV });
    if (!seeded.ok || !seeded.committed) throw new Error('environment commit failed');
    await raw(local, 'push', '--quiet', 'origin', 'main');
    const pulled = await raw(peer, 'pull', '--quiet', 'origin', 'main');
    if (pulled.code !== 0) throw new Error(`peer pull failed: ${pulled.stderr}`);
  });

  /** A pull whose set reader answers the environment's rows as the engine holds them. */
  async function pullBodies(): Promise<unknown[]> {
    const applied: EmissionBatch[] = [];
    const live = state.environments[0].variables.map((variable, index) => ({
      itemId: variable.uid,
      orderKey: `a${index}`,
      item: variable,
    }));
    const result = await pullWorkspaceTree({
      run,
      rootDir: local,
      workspaceUid: 'wsaaaaaa',
      readSnapshot: async () => state,
      nextCtx,
      liveSetEntries: (_type, id) => (id === 'envaaaaa' ? live : []),
      apply: async (batches) => {
        applied.push(...batches);
      },
      flush: () => materializer.flush(),
      ...localWork(local),
      identityEnv: IDENTITY_ENV,
      bypassHooks: false,
    });
    expect(result).toMatchObject({ ok: true, upToDate: false });
    return applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body));
  }

  it('the secret file never reaches the peer — only its template does', async () => {
    const files = (await fs.readdir(path.join(peer, 'environments'))).sort();
    expect(files).toEqual(['staging-envaaaaa.secret.yaml.template', 'staging-envaaaaa.yaml']);
  });

  it("a peer's edit to another variable leaves the local secret row alone", async () => {
    await peerEdit(DEFAULT_FILE, (content) => content.replace('staging.openheaders.io', 'staging-eu.openheaders.io'));
    await peerCommitPush('Move staging host');

    expect(await pullBodies()).toEqual([
      {
        kind: 'addToSet',
        type: 'environment',
        id: 'envaaaaa',
        path: 'variables',
        itemId: 'varaaaa1',
        item: { ...host, value: 'staging-eu.openheaders.io' },
        orderKey: 'a0',
      },
    ]);
  });

  it('a secret row the peer added lands blank beside the local one, whose value stands', async () => {
    await peerEdit(TEMPLATE_FILE, (content) =>
      content.replace(/\n$/, '\n  - uid: varaaaa9\n    name: webhookSecret\n    value: ""\n    type: secret\n'),
    );
    await peerCommitPush('Add webhook secret');

    const bodies = await pullBodies();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      kind: 'addToSet',
      itemId: 'varaaaa9',
      item: { uid: 'varaaaa9', name: 'webhookSecret', value: '', type: 'secret' },
    });
  });

  it('a secret row the peer renamed keeps the local value under the new name', async () => {
    await peerEdit(TEMPLATE_FILE, (content) => content.replace('name: token', 'name: accessToken'));
    await peerCommitPush('Rename secret');

    const bodies = await pullBodies();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      kind: 'addToSet',
      itemId: 'varaaaa2',
      item: { ...token, name: 'accessToken' },
    });
  });

  it('a secret row the peer removed leaves', async () => {
    await fs.rm(path.join(peer, ...TEMPLATE_FILE.split('/')));
    await peerCommitPush('Drop secret');

    expect(await pullBodies()).toEqual([
      { kind: 'removeFromSet', type: 'environment', id: 'envaaaaa', path: 'variables', itemId: 'varaaaa2' },
    ]);
  });
});
