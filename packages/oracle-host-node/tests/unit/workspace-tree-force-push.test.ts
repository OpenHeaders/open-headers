/**
 * Force-push trichotomy on real tmp repos + a bare "remote"
 * (the git-sync plan §10 Phase 5; the sync-engine design §16;
 * the data-plane topologies design §6.4): the bare remote is force-pushed
 * between syncs — the peer rewinds the synced head and lands a
 * divergent commit — so the last-synced watermark is no longer an
 * ancestor of the remote head, and each of the three resolutions must
 * land its exact contract: abandon converges to the rewritten head,
 * rescue first preserves the local history on a NEW `oh-rescue-<ts>`
 * ref, re-apply re-lands local changes as a fresh commit on top of
 * the new history. The engine seam is the same state-object mock the
 * pull suite uses.
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
import {
  commitWorkspaceTree,
  countDirtyFiles,
  fastForwardWorkspaceBranch,
  isAncestorOf,
  localHeadSha,
  resolveUpstream,
} from '../../src/git/repo';
import { type ForcePushChoice, resolveForcePushWorkspaceTree } from '../../src/workspace-tree/force-push';
import { WorkspaceTreeMaterializer } from '../../src/workspace-tree/materializer';
import type { LocalWorkDeps } from '../../src/workspace-tree/pass-writes';

const ORG_ID = '019637a2-7b9a-7b9a-8b9a-1234567890ab';
const PEER_RULE_FILE = 'rules/block-probes-aaaaaaaa/rule.yaml';
const LOCAL_RULE_FILE = 'rules/allow-health-bbbbbbbb/rule.yaml';

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

function makeRule(uid: string, name: string, type: 'block' | 'allow'): Rule {
  return {
    schemaVersion: 5,
    uid,
    path: `rules/${name.toLowerCase().replace(/\s+/g, '-')}-${uid}`,
    name,
    type,
    enabled: true,
    conditions: [],
    action: {},
  } as Rule;
}

function baseState(): WorkspaceTreeState {
  const workspace: Workspace = { schemaVersion: 5, uid: 'wsaaaaaa', name: 'Probe Workspace', orgId: ORG_ID };
  return {
    workspace,
    rules: [makeRule('aaaaaaaa', 'Block probes', 'block')],
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
/** The remote sha the local engine last integrated — the §16 watermark. */
let watermark: string;
/** The rewritten remote head the resolutions must land on. */
let rewrittenSha: string;
/** Local HEAD after the local divergence commit — the rescue material. */
let localHead: string;

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
  const content = await fs.readFile(target, 'utf-8');
  await fs.writeFile(target, edit(content), 'utf-8');
}

/** The path sets the pass asked to have committed first, in order. */
let localWorkCommits: string[][];

/** The pass's way to commit local work first — one commit of exactly the paths it names. */
const commitLocalWork: LocalWorkDeps['commitLocalWork'] = async ({ tree, paths }) => {
  localWorkCommits.push(paths);
  const result = await commitWorkspaceTree({
    run,
    rootDir: local,
    message: 'Local work',
    identityEnv: IDENTITY_ENV,
    fromTree: tree,
    paths,
  });
  return result.ok ? { ok: true } : { ok: false, detail: result.detail };
};

function doResolve(
  choice: ForcePushChoice,
  applied: EmissionBatch[],
  onApply?: () => void,
): ReturnType<typeof resolveForcePushWorkspaceTree> {
  return resolveForcePushWorkspaceTree({
    run,
    rootDir: local,
    choice,
    workspaceUid: 'wsaaaaaa',
    lastSyncedRemoteSha: watermark,
    now: () => new Date(2026, 6, 19, 14, 15, 3),
    readSnapshot: async () => state,
    nextCtx,
    liveSetEntries: () => [],
    apply: async (batches) => {
      applied.push(...batches);
      onApply?.();
    },
    flush: () => materializer.flush(),
    commitLocalWork,
    identityEnv: IDENTITY_ENV,
    bypassHooks: false,
  });
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-fp-'));
  local = path.join(tmpDir, 'local');
  peer = path.join(tmpDir, 'peer');
  bare = path.join(tmpDir, 'remote.git');
  state = baseState();
  hlcMs = 1_000;
  run = isolated(createGitExec());
  localWorkCommits = [];

  // Shared base: the local engine tree, committed and pushed.
  await fs.mkdir(local, { recursive: true });
  materializer = new WorkspaceTreeMaterializer({ rootDir: local, readSnapshot: async () => ({ state }) });
  await fs.writeFile(path.join(local, '.gitignore'), '.oh/\n*.secret.yaml\n', 'utf-8');
  await materializer.flush();
  await run(['init', local], { cwd: tmpDir });
  await raw(local, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const initial = await commitWorkspaceTree({
    run,
    rootDir: local,
    message: 'Initial tree',
    identityEnv: IDENTITY_ENV,
  });
  if (!initial.ok || !initial.committed) throw new Error('initial commit failed');
  const baseSha = initial.sha;
  await run(['init', '--bare', bare], { cwd: tmpDir });
  await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
  await raw(local, 'remote', 'add', 'origin', bare);
  await raw(local, 'push', '--quiet', '-u', 'origin', 'main');

  // First sync cycle: the peer lands an edit, the local engine
  // integrates it (fast-forward) — its sha becomes the watermark.
  await run(['clone', '--quiet', bare, peer], { cwd: tmpDir });
  await peerEdit(PEER_RULE_FILE, (content) => content.replace('name: Block probes', 'name: Block probes (peer)'));
  const synced = await commitWorkspaceTree({ run, rootDir: peer, message: 'Peer edit', identityEnv: RITA_ENV });
  if (!synced.ok || !synced.committed) throw new Error('peer sync commit failed');
  await raw(peer, 'push', '--quiet', 'origin', 'main');
  await raw(local, 'fetch', '--quiet');
  const ff = await fastForwardWorkspaceBranch(run, local, synced.sha);
  if (!ff.ok) throw new Error('local fast-forward failed');
  state.rules = state.rules.map((rule) => ({ ...rule, name: 'Block probes (peer)' }));
  await materializer.flush();
  watermark = synced.sha;

  // The rewrite: the peer rewinds to the base, lands a DIVERGENT edit,
  // and force-pushes — the watermark is no longer an ancestor.
  await raw(peer, 'update-ref', 'HEAD', baseSha);
  await raw(peer, 'read-tree', 'HEAD');
  await raw(peer, 'checkout-index', '-a', '-f');
  await peerEdit(PEER_RULE_FILE, (content) => content.replace('name: Block probes', 'name: Rewritten probes'));
  const rewrite = await commitWorkspaceTree({ run, rootDir: peer, message: 'Rewritten', identityEnv: RITA_ENV });
  if (!rewrite.ok || !rewrite.committed) throw new Error('peer rewrite commit failed');
  await raw(peer, 'push', '--quiet', '--force', 'origin', 'main');

  // Local divergence since the watermark: a new local-only rule,
  // committed — the shape the runtime's pre-resolution commit leaves.
  state.rules = [...state.rules, makeRule('bbbbbbbb', 'Allow health', 'allow')];
  await materializer.flush();
  const localCommit = await commitWorkspaceTree({
    run,
    rootDir: local,
    message: 'Local divergence',
    identityEnv: IDENTITY_ENV,
  });
  if (!localCommit.ok || !localCommit.committed) throw new Error('local divergence commit failed');
  localHead = localCommit.sha;

  await raw(local, 'fetch', '--quiet');
  const upstream = await resolveUpstream(run, local);
  if (upstream === null) throw new Error('no upstream after fetch');
  rewrittenSha = upstream.sha;
});

afterEach(async () => {
  materializer.dispose();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('force-push detection ground truth', () => {
  it('the watermark is no longer an ancestor of the rewritten head', async () => {
    expect(rewrittenSha).not.toBe(watermark);
    expect(await isAncestorOf(run, local, watermark, rewrittenSha)).toBe(false);
  });
});

describe('resolveForcePushWorkspaceTree', () => {
  it('abandon: the rewritten head becomes the workspace state wholesale', async () => {
    const applied: EmissionBatch[] = [];
    const result = await doResolve('abandon', applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Rewritten probes' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, rescueBranch: null, remoteSha: rewrittenSha });

    const bodies = applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body));
    expect(bodies).toContainEqual({
      kind: 'setField',
      type: 'rule',
      id: 'aaaaaaaa',
      path: 'name',
      value: 'Rewritten probes',
    });
    expect(bodies).toContainEqual(expect.objectContaining({ kind: 'delete', type: 'rule', id: 'bbbbbbbb' }));

    // The branch sits on the rewritten history; the local-only rule is
    // gone from the tree; the repo is clean and in sync; no rescue ref.
    expect(await isAncestorOf(run, local, rewrittenSha, (await localHeadSha(run, local)) ?? '')).toBe(true);
    await expect(fs.access(path.join(local, ...LOCAL_RULE_FILE.split('/')))).rejects.toThrow();
    const onDisk = await fs.readFile(path.join(local, ...PEER_RULE_FILE.split('/')), 'utf-8');
    expect(onDisk).toContain('name: Rewritten probes');
    expect(await countDirtyFiles(run, local)).toBe(0);
    expect((await resolveUpstream(run, local))?.behind).toBe(0);
    const branches = await raw(local, 'branch', '--list', 'oh-rescue-*');
    expect(branches.stdout.trim()).toBe('');
  });

  it('rescue: identical convergence, but the pre-rewrite history survives on a new oh-rescue ref', async () => {
    const applied: EmissionBatch[] = [];
    const result = await doResolve('rescue', applied, () => {
      state.rules = [{ ...state.rules[0], name: 'Rewritten probes' } as Rule];
    });
    expect(result).toMatchObject({ ok: true, rescueBranch: 'oh-rescue-20260719-141503', remoteSha: rewrittenSha });

    const rescueTip = await raw(local, 'rev-parse', 'refs/heads/oh-rescue-20260719-141503');
    expect(rescueTip.stdout.trim()).toBe(localHead);
    // The rescue ref keeps the local material reachable — the
    // local-only rule lives in its tree.
    const rescued = await raw(local, 'show', `refs/heads/oh-rescue-20260719-141503:${LOCAL_RULE_FILE}`);
    expect(rescued.stdout).toContain('uid: bbbbbbbb');
    expect(await countDirtyFiles(run, local)).toBe(0);
  });

  it('re-apply: local changes land as a fresh commit on top of the rewritten history', async () => {
    const applied: EmissionBatch[] = [];
    const result = await doResolve('reapply', applied, () => {
      // Only what the REMOTE changed since the watermark enters: the
      // shared rule's rewritten name. Local work stays local truth.
      state.rules = state.rules.map((rule) =>
        rule.uid === 'aaaaaaaa' ? ({ ...rule, name: 'Rewritten probes' } as Rule) : rule,
      );
    });
    if (!result.ok) throw new Error(`reapply failed: ${result.reason} ${result.detail ?? ''}`);
    expect(result.rescueBranch).toBeNull();
    expect(result.remoteSha).toBe(rewrittenSha);

    // No delete for the local-only rule — it was never foreign-touched.
    const bodies = applied.flatMap((entry) => entry.batch.mutations.map((m) => m.body));
    expect(bodies.some((body) => body.kind === 'delete' && body.id === 'bbbbbbbb')).toBe(false);

    // History: a single fresh commit on top of the rewritten head.
    const head = (await localHeadSha(run, local)) ?? '';
    expect(head).toBe(result.sha);
    const parent = await raw(local, 'rev-parse', 'HEAD^1');
    expect(parent.stdout.trim()).toBe(rewrittenSha);
    const message = await raw(local, 'log', '-1', '--format=%s');
    expect(message.stdout.trim()).toBe('Re-apply local changes');

    // The tree carries BOTH the foreign rename and the local rule.
    const onDisk = await fs.readFile(path.join(local, ...PEER_RULE_FILE.split('/')), 'utf-8');
    expect(onDisk).toContain('name: Rewritten probes');
    const localRule = await fs.readFile(path.join(local, ...LOCAL_RULE_FILE.split('/')), 'utf-8');
    expect(localRule).toContain('uid: bbbbbbbb');
    expect(await countDirtyFiles(run, local)).toBe(0);
    expect((await resolveUpstream(run, local))?.behind).toBe(0);
  });

  describe("the user's own files follow the choice", () => {
    /** A peer README on the rewritten history and a local-only notes file, both committed. */
    async function divergeOwnFiles(): Promise<void> {
      await fs.writeFile(path.join(peer, 'README.md'), '# peer readme\n', 'utf-8');
      const peerCommit = await commitWorkspaceTree({ run, rootDir: peer, message: 'Readme', identityEnv: RITA_ENV });
      if (!peerCommit.ok || !peerCommit.committed) throw new Error('peer readme commit failed');
      await raw(peer, 'push', '--quiet', 'origin', 'main');
      await fs.writeFile(path.join(local, 'NOTES.md'), '# local notes\n', 'utf-8');
      const localCommit = await commitWorkspaceTree({
        run,
        rootDir: local,
        message: 'Local notes',
        identityEnv: IDENTITY_ENV,
      });
      if (!localCommit.ok || !localCommit.committed) throw new Error('local notes commit failed');
    }

    it("abandon: the tree holds the rewritten head's own files and nothing local-only", async () => {
      await divergeOwnFiles();
      const result = await doResolve('abandon', [], () => {
        state.rules = [{ ...state.rules[0], name: 'Rewritten probes' } as Rule];
      });
      if (!result.ok) throw new Error(`abandon failed: ${result.reason} ${result.detail ?? ''}`);
      // No follow-up commit: the tree IS the rewritten head's.
      expect(result.sha).toBe(result.remoteSha);
      expect(await fs.readFile(path.join(local, 'README.md'), 'utf-8')).toBe('# peer readme\n');
      await expect(fs.access(path.join(local, 'NOTES.md'))).rejects.toThrow();
      expect(await countDirtyFiles(run, local)).toBe(0);
    });

    it("re-apply: the rewritten head's own file lands and the local-only one rides the fresh commit", async () => {
      await divergeOwnFiles();
      const result = await doResolve('reapply', [], () => {
        state.rules = state.rules.map((rule) =>
          rule.uid === 'aaaaaaaa' ? ({ ...rule, name: 'Rewritten probes' } as Rule) : rule,
        );
      });
      if (!result.ok) throw new Error(`reapply failed: ${result.reason} ${result.detail ?? ''}`);
      expect((await raw(local, 'show', 'HEAD:README.md')).stdout).toBe('# peer readme\n');
      expect((await raw(local, 'show', 'HEAD:NOTES.md')).stdout).toBe('# local notes\n');
      expect(await countDirtyFiles(run, local)).toBe(0);
    });
  });

  describe('uncommitted work', () => {
    const status = async (): Promise<string> =>
      (await raw(local, 'status', '--porcelain', '--untracked-files=all')).stdout;
    const filesOf = async (commit: string): Promise<string[]> =>
      (await raw(local, 'diff-tree', '--no-commit-id', '--name-only', '-r', `${commit}^1`, commit)).stdout
        .split('\n')
        .filter(Boolean);

    /** An edit to the local-only rule no commit has, and an unversioned file — the first in a file the two heads hold differently, the second in none. */
    async function leaveLocalWork(): Promise<void> {
      state.rules = state.rules.map((rule) =>
        rule.uid === 'bbbbbbbb' ? ({ ...rule, name: 'Allow health, edited' } as Rule) : rule,
      );
      await materializer.flush();
      await fs.writeFile(path.join(local, 'scratch.txt'), 'unversioned\n', 'utf-8');
    }

    it('abandon: work in no file the heads differ in stays as it was and nothing is committed first', async () => {
      await fs.writeFile(path.join(local, 'scratch.txt'), 'unversioned\n', 'utf-8');
      const result = await doResolve('abandon', [], () => {
        state.rules = [{ ...state.rules[0], name: 'Rewritten probes' } as Rule];
      });
      if (!result.ok) throw new Error(`abandon failed: ${result.reason} ${result.detail ?? ''}`);
      expect(result).not.toHaveProperty('committedLocal');
      expect(localWorkCommits).toEqual([]);
      // The tree is the rewritten head's, the unversioned file beside it.
      expect(result.sha).toBe(rewrittenSha);
      expect(await status()).toBe('?? scratch.txt\n');
    });

    it('rescue: work in a file the resolution replaces is committed first, alone, and the rescue ref holds it', async () => {
      await leaveLocalWork();
      const result = await doResolve('rescue', [], () => {
        state.rules = [{ ...state.rules[0], name: 'Rewritten probes' } as Rule];
      });
      if (!result.ok) throw new Error(`rescue failed: ${result.reason} ${result.detail ?? ''}`);
      expect(result.committedLocal).toEqual([LOCAL_RULE_FILE]);
      expect(localWorkCommits).toEqual([[LOCAL_RULE_FILE]]);

      const rescue = `refs/heads/${result.rescueBranch}`;
      expect((await raw(local, 'rev-parse', `${rescue}^1`)).stdout.trim()).toBe(localHead);
      expect(await filesOf(rescue)).toEqual([LOCAL_RULE_FILE]);
      expect((await raw(local, 'show', `${rescue}:${LOCAL_RULE_FILE}`)).stdout).toContain('name: Allow health, edited');
      // The branch is on the rewrite; the unversioned file is no commit's.
      await expect(fs.access(path.join(local, ...LOCAL_RULE_FILE.split('/')))).rejects.toThrow();
      expect(await status()).toBe('?? scratch.txt\n');
    });

    it('re-apply: the fresh commit carries the local side as committed first — never the unversioned file', async () => {
      await leaveLocalWork();
      const result = await doResolve('reapply', [], () => {
        state.rules = state.rules.map((rule) =>
          rule.uid === 'aaaaaaaa' ? ({ ...rule, name: 'Rewritten probes' } as Rule) : rule,
        );
      });
      if (!result.ok) throw new Error(`reapply failed: ${result.reason} ${result.detail ?? ''}`);
      expect(result.committedLocal).toEqual([LOCAL_RULE_FILE]);
      expect(localWorkCommits).toEqual([[LOCAL_RULE_FILE]]);

      expect((await raw(local, 'rev-parse', 'HEAD^1')).stdout.trim()).toBe(rewrittenSha);
      expect((await raw(local, 'log', '-1', '--format=%s')).stdout.trim()).toBe('Re-apply local changes');
      expect(await filesOf('HEAD')).toEqual([LOCAL_RULE_FILE]);
      expect((await raw(local, 'show', `HEAD:${LOCAL_RULE_FILE}`)).stdout).toContain('name: Allow health, edited');
      expect(await status()).toBe('?? scratch.txt\n');
    });
  });

  it('re-apply: an ignored local file where the rewritten head adds one is never recorded as a deletion', async () => {
    await fs.appendFile(path.join(local, '.git', 'info', 'exclude'), 'local.cfg\n', 'utf-8');
    await fs.writeFile(path.join(local, 'local.cfg'), 'mine\n', 'utf-8');
    await fs.writeFile(path.join(peer, 'local.cfg'), 'theirs\n', 'utf-8');
    const added = await commitWorkspaceTree({ run, rootDir: peer, message: 'Config', identityEnv: RITA_ENV });
    if (!added.ok || !added.committed) throw new Error('peer config commit failed');
    await raw(peer, 'push', '--quiet', 'origin', 'main');

    const result = await doResolve('reapply', [], () => {
      state.rules = state.rules.map((rule) =>
        rule.uid === 'aaaaaaaa' ? ({ ...rule, name: 'Rewritten probes' } as Rule) : rule,
      );
    });
    if (!result.ok) throw new Error(`reapply failed: ${result.reason} ${result.detail ?? ''}`);
    expect((await raw(local, 'show', 'HEAD:local.cfg')).stdout).toBe('theirs\n');
    expect(await fs.readFile(path.join(local, 'local.cfg'), 'utf-8')).toBe('mine\n');
  });

  it('a resolution against a NOT-rewritten remote refuses as not-rewritten', async () => {
    const applied: EmissionBatch[] = [];
    const result = await resolveForcePushWorkspaceTree({
      run,
      rootDir: local,
      choice: 'abandon',
      workspaceUid: 'wsaaaaaa',
      // The rewritten head itself as watermark = nothing new happened.
      lastSyncedRemoteSha: rewrittenSha,
      readSnapshot: async () => state,
      nextCtx,
      liveSetEntries: () => [],
      apply: async (batches) => {
        applied.push(...batches);
      },
      flush: () => materializer.flush(),
      commitLocalWork,
      identityEnv: IDENTITY_ENV,
      bypassHooks: false,
    });
    expect(result).toMatchObject({ ok: false, reason: 'not-rewritten' });
    expect(applied).toHaveLength(0);
  });

  it('a foreign tree claiming another workspace uid is refused', async () => {
    await peerEdit('workspace.yaml', (content) => content.replace('uid: wsaaaaaa', 'uid: wsother1'));
    const stolen = await commitWorkspaceTree({ run, rootDir: peer, message: 'Steal', identityEnv: RITA_ENV });
    if (!stolen.ok || !stolen.committed) throw new Error('peer commit failed');
    await raw(peer, 'push', '--quiet', '--force', 'origin', 'main');

    const applied: EmissionBatch[] = [];
    const result = await doResolve('abandon', applied);
    expect(result).toMatchObject({ ok: false, reason: 'identity-mismatch' });
    expect(applied).toHaveLength(0);
  });
});
