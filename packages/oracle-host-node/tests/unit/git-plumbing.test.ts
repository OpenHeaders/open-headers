/**
 * Git plumbing — real tmp repos against the system binary
 * (GIT_PLAN.md §3.3 / §7 / §10 Phase 3): init/adopt, temp-index
 * commits that never touch the user's staging area, hook enforcement,
 * identity fallback, porcelain feeds, and audit rows. The injected
 * runner env pins GIT_CONFIG_GLOBAL/GIT_CONFIG_NOSYSTEM so the
 * developer's own git config can never leak into assertions.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createGitExec,
  type GitAuditRow,
  type GitRunner,
  probeGitAvailability,
  subcommandOf,
} from '../../src/git/git-exec';
import {
  checkoutWorkspaceBranch,
  cleanUntracked,
  commitWorkspaceTree,
  countDirtyFiles,
  countLeftRight,
  createAndSwitchBranch,
  createRescueBranch,
  currentBranch,
  diffForeignPaths,
  ensureWorkspaceRepo,
  fastForwardWorkspaceBranch,
  fetchWorkspaceRemote,
  gitOperationInProgress,
  isAncestorOf,
  isWorkspaceRepo,
  listForeignAuthors,
  listLocalBranches,
  listTreeYamlPaths,
  localHeadSha,
  mergeBaseOf,
  parsePorcelainCount,
  pushHeadToNewBranch,
  pushWorkspaceBranch,
  readCommitTreeFiles,
  resolveCommitIdentity,
  resolveRefSha,
  resolveUpstream,
  stashWorkspaceTree,
  userIndexHasStagedChanges,
  withCommitAttribution,
} from '../../src/git/repo';

let tmpDir: string;
let auditRows: GitAuditRow[];
let run: GitRunner;

/** Isolate every invocation from the developer's global/system git config. */
function isolated(base: GitRunner): GitRunner {
  return (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env },
    });
}

const IDENTITY = { name: 'Probe Operator', email: null };
const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Probe Operator',
  GIT_AUTHOR_EMAIL: 'probe-operator@users.noreply.openheaders.io',
  GIT_COMMITTER_NAME: 'Probe Operator',
  GIT_COMMITTER_EMAIL: 'probe-operator@users.noreply.openheaders.io',
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-git-'));
  auditRows = [];
  run = isolated(createGitExec({ audit: (row) => auditRows.push(row) }));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const target = path.join(tmpDir, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

async function initialCommit(): Promise<void> {
  await ensureWorkspaceRepo(run, tmpDir);
  await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
  const result = await commitWorkspaceTree({
    run,
    rootDir: tmpDir,
    message: 'Initial tree',
    identityEnv: IDENTITY_ENV,
  });
  if (!result.ok || !result.committed) throw new Error('initial commit failed');
}

describe('probeGitAvailability', () => {
  it('finds the system git', async () => {
    const availability = await probeGitAvailability(run, tmpDir);
    expect(availability.available).toBe(true);
    if (availability.available) expect(availability.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('degrades loudly when the binary is missing', async () => {
    const missing = isolated(createGitExec({ gitBinary: '/nonexistent/openheaders-git' }));
    const availability = await probeGitAvailability(missing, tmpDir);
    expect(availability).toEqual({ available: false, reason: 'missing' });
  });
});

describe('ensureWorkspaceRepo', () => {
  it('inits a fresh repo and adopts it on the second call', async () => {
    expect(await isWorkspaceRepo(run, tmpDir)).toBe(false);
    expect(await ensureWorkspaceRepo(run, tmpDir)).toEqual({ ok: true, initialized: true });
    expect(await isWorkspaceRepo(run, tmpDir)).toBe(true);
    expect(await ensureWorkspaceRepo(run, tmpDir)).toEqual({ ok: true, initialized: false });
  });
});

describe('resolveCommitIdentity', () => {
  it('falls back to the synthetic identity when git config is silent', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    const resolved = await resolveCommitIdentity(run, tmpDir, IDENTITY);
    expect(resolved.synthetic).toBe(true);
    expect(resolved.env).toEqual(IDENTITY_ENV);
  });

  it('leaves a fully configured identity to git itself', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await run(['--git-dir', path.join(tmpDir, '.git'), 'config', 'user.name', 'Dana Ferrand'], { cwd: tmpDir });
    await run(['--git-dir', path.join(tmpDir, '.git'), 'config', 'user.email', 'dana@openheaders.io'], {
      cwd: tmpDir,
    });
    const resolved = await resolveCommitIdentity(run, tmpDir, IDENTITY);
    expect(resolved).toEqual({ env: {}, synthetic: false });
  });

  it('fills only the missing half of a partial config', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await run(['--git-dir', path.join(tmpDir, '.git'), 'config', 'user.name', 'Dana Ferrand'], { cwd: tmpDir });
    const resolved = await resolveCommitIdentity(run, tmpDir, IDENTITY);
    expect(resolved.synthetic).toBe(true);
    expect(Object.keys(resolved.env).sort()).toEqual(['GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_EMAIL']);
  });
});

describe('withCommitAttribution', () => {
  const ALICE = { name: 'Alice', email: 'alice@users.noreply.openheaders.io' };
  const BOB = { name: 'Bob', email: 'bob@users.noreply.openheaders.io' };

  it('passes through untouched with no contributors', () => {
    expect(withCommitAttribution(IDENTITY_ENV, 'Update request', [])).toEqual({
      env: IDENTITY_ENV,
      message: 'Update request',
    });
  });

  it('a sole contributor becomes the author; the committer stays the operator', () => {
    const attributed = withCommitAttribution(IDENTITY_ENV, 'Update request', [ALICE]);
    expect(attributed.message).toBe('Update request');
    expect(attributed.env.GIT_AUTHOR_NAME).toBe('Alice');
    expect(attributed.env.GIT_AUTHOR_EMAIL).toBe('alice@users.noreply.openheaders.io');
    expect(attributed.env.GIT_COMMITTER_NAME).toBe('Probe Operator');
    expect(attributed.env.GIT_COMMITTER_EMAIL).toBe('probe-operator@users.noreply.openheaders.io');
  });

  it('several contributors keep the operator author and ride as deduped trailers', () => {
    const attributed = withCommitAttribution(IDENTITY_ENV, 'Update request', [ALICE, BOB, ALICE]);
    expect(attributed.env).toEqual(IDENTITY_ENV);
    expect(attributed.message).toBe(
      'Update request\n\n' +
        'Co-Authored-By: Alice <alice@users.noreply.openheaders.io>\n' +
        'Co-Authored-By: Bob <bob@users.noreply.openheaders.io>',
    );
  });

  it('the single-author env lands on a real commit — blame answers the contributor', async () => {
    await initialCommit();
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Renamed\n');
    const attributed = withCommitAttribution(IDENTITY_ENV, 'Rename workspace', [ALICE]);
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: attributed.message,
      identityEnv: attributed.env,
    });
    expect(result.ok && result.committed).toBe(true);
    const show = await run(['-C', tmpDir, 'log', '-1', '--format=%an <%ae>%n%cn <%ce>'], { cwd: tmpDir });
    expect(show.stdout.trim().split('\n')).toEqual([
      'Alice <alice@users.noreply.openheaders.io>',
      'Probe Operator <probe-operator@users.noreply.openheaders.io>',
    ]);
  });
});

describe('commitWorkspaceTree', () => {
  it('commits the tree with the synthetic identity and skips empty follow-ups', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    const first = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Add workspace manifest',
      identityEnv: IDENTITY_ENV,
    });
    expect(first).toMatchObject({ ok: true, committed: true });
    if (first.ok && first.committed) expect(first.sha).toMatch(/^[0-9a-f]{40}$/);

    const author = await run(['--git-dir', path.join(tmpDir, '.git'), 'log', '-1', '--format=%an <%ae>'], {
      cwd: tmpDir,
    });
    expect(author.stdout.trim()).toBe('Probe Operator <probe-operator@users.noreply.openheaders.io>');

    const second = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'No-op',
      identityEnv: IDENTITY_ENV,
    });
    expect(second).toEqual({ ok: true, committed: false });
  });

  it("preserves the user's partial staging byte-exactly (§3.3 mid-`git add -p`)", async () => {
    await initialCommit();
    // The user stages v1, then keeps editing — the classic add -p
    // shape: index holds their crafted snapshot, worktree moved on.
    await write('user-draft.yaml', 'draft: v1\n');
    await run(['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, 'add', '--', 'user-draft.yaml'], {
      cwd: tmpDir,
    });
    await write('user-draft.yaml', 'draft: v2\n');
    expect(await userIndexHasStagedChanges(run, tmpDir)).toBe(true);

    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Add rule',
      identityEnv: IDENTITY_ENV,
    });
    expect(result).toMatchObject({ ok: true, committed: true });

    // The engine committed the worktree (v2), but the user's staged
    // snapshot is still v1 and still visibly staged.
    const stagedBlob = await run(
      ['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, 'show', ':user-draft.yaml'],
      { cwd: tmpDir },
    );
    expect(stagedBlob.stdout).toBe('draft: v1\n');
    const staged = await run(
      ['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, 'diff', '--cached', '--name-only'],
      { cwd: tmpDir },
    );
    expect(staged.stdout.trim()).toBe('user-draft.yaml');
  });

  it('leaves the repo normal after a clean-index engine commit — git status stays quiet', async () => {
    await initialCommit();
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Add rule',
      identityEnv: IDENTITY_ENV,
    });
    expect(result).toMatchObject({ ok: true, committed: true });
    expect(await userIndexHasStagedChanges(run, tmpDir)).toBe(false);
    expect(await countDirtyFiles(run, tmpDir)).toBe(0);
  });

  it('respects .gitignore — the sidecar and secrets never enter a commit', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await write('.gitignore', '.oh/\n*.secret.yaml\n');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    await write('.oh/lock', '{}');
    await write('environments/dev-eeeeeeee.secret.yaml', 'variables: []\n');
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Initial tree',
      identityEnv: IDENTITY_ENV,
    });
    expect(result).toMatchObject({ ok: true, committed: true });
    const listed = await run(['--git-dir', path.join(tmpDir, '.git'), 'ls-tree', '-r', '--name-only', 'HEAD'], {
      cwd: tmpDir,
    });
    const paths = listed.stdout.trim().split('\n');
    expect(paths).toContain('workspace.yaml');
    expect(paths).toContain('.gitignore');
    expect(paths.some((entry) => entry.startsWith('.oh/'))).toBe(false);
    expect(paths.some((entry) => entry.endsWith('.secret.yaml'))).toBe(false);
  });

  it('a failing pre-commit hook blocks the commit and surfaces its output', async () => {
    await initialCommit();
    const hookPath = path.join(tmpDir, '.git', 'hooks', 'pre-commit');
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, '#!/bin/sh\necho "hook says no" >&2\nexit 1\n', { mode: 0o755 });

    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Renamed\n');
    const blocked = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Rename workspace',
      identityEnv: IDENTITY_ENV,
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.reason).toBe('commit-failed');
      expect(blocked.detail).toContain('hook says no');
    }

    const bypassed = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Rename workspace',
      identityEnv: IDENTITY_ENV,
      bypassHooks: true,
    });
    expect(bypassed).toMatchObject({ ok: true, committed: true });
  });

  it('audits state-changing commands but not reads', async () => {
    await initialCommit();
    const audited = auditRows.map((row) => subcommandOf(row.args));
    expect(audited).toContain('init');
    expect(audited).toContain('add');
    expect(audited).toContain('commit');
    expect(audited).not.toContain('status');
    expect(audited).not.toContain('rev-parse');
  });
});

const RITA_ENV = {
  GIT_AUTHOR_NAME: 'Remote Rita',
  GIT_AUTHOR_EMAIL: 'rita@openheaders.io',
  GIT_COMMITTER_NAME: 'Remote Rita',
  GIT_COMMITTER_EMAIL: 'rita@openheaders.io',
};

describe('remote plumbing (Phase 4)', () => {
  let bare: string;
  let repoA: string;
  let repoB: string;

  const raw = (dir: string, ...args: string[]) =>
    run(['--git-dir', path.join(dir, '.git'), '--work-tree', dir, ...args], { cwd: dir });

  const writeIn = async (dir: string, rel: string, content: string): Promise<void> => {
    const target = path.join(dir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
  };

  const commitIn = async (dir: string, message: string, env = IDENTITY_ENV): Promise<string> => {
    const result = await commitWorkspaceTree({ run, rootDir: dir, message, identityEnv: env });
    if (!result.ok || !result.committed) throw new Error(`commit failed in ${dir}`);
    return result.sha;
  };

  beforeEach(async () => {
    bare = path.join(tmpDir, 'remote.git');
    repoA = path.join(tmpDir, 'a');
    repoB = path.join(tmpDir, 'b');
    await run(['init', '--bare', bare], { cwd: tmpDir });
    await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
    await fs.mkdir(repoA, { recursive: true });
    await ensureWorkspaceRepo(run, repoA);
    await raw(repoA, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    await writeIn(repoA, 'workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    await commitIn(repoA, 'Initial tree');
    await raw(repoA, 'remote', 'add', 'origin', bare);
    await raw(repoA, 'push', '--quiet', '-u', 'origin', 'main');
    await run(['clone', '--quiet', bare, repoB], { cwd: tmpDir });
  });

  it('resolveUpstream reads the tracking ref; fetch refreshes ahead/behind', async () => {
    const atRest = await resolveUpstream(run, repoB);
    expect(atRest).toMatchObject({ upstream: 'origin/main', ahead: 0, behind: 0 });

    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Add rule');
    await raw(repoA, 'push', '--quiet', 'origin', 'main');

    // Non-mutating until fetched: the stale tracking ref still says 0.
    const stale = await resolveUpstream(run, repoB);
    expect(stale?.behind).toBe(0);

    expect(await fetchWorkspaceRemote(run, repoB)).toEqual({ ok: true });
    const fresh = await resolveUpstream(run, repoB);
    expect(fresh?.behind).toBe(1);
    expect(fresh?.ahead).toBe(0);
    const remoteHead = await raw(repoA, 'rev-parse', 'HEAD');
    expect(fresh?.sha).toBe(remoteHead.stdout.trim());
  });

  it('resolveUpstream is null without an upstream', async () => {
    expect(await resolveUpstream(run, repoA)).not.toBeNull();
    const lone = path.join(tmpDir, 'lone');
    await fs.mkdir(lone, { recursive: true });
    await ensureWorkspaceRepo(run, lone);
    expect(await resolveUpstream(run, lone)).toBeNull();
  });

  it('readCommitTreeFiles reads a ref as string-in yaml files, skipping non-yaml', async () => {
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await writeIn(repoA, 'README.md', '# mine\n');
    await commitIn(repoA, 'Add rule + readme');
    await raw(repoA, 'push', '--quiet', 'origin', 'main');
    await fetchWorkspaceRemote(run, repoB);
    const upstream = await resolveUpstream(run, repoB);
    const files = await readCommitTreeFiles(run, repoB, upstream?.sha ?? '');
    expect(files).not.toBeNull();
    const paths = (files ?? []).map((file) => file.path);
    expect(paths).toContain('workspace.yaml');
    expect(paths).toContain('rules/block-r0000001/rule.yaml');
    expect(paths).not.toContain('README.md');
    const rule = (files ?? []).find((file) => file.path.endsWith('rule.yaml'));
    expect(rule?.content).toBe('schemaVersion: 5\nuid: r0000001\n');
  });

  it('diffForeignPaths classifies changed/removed against the merge base; null base lists everything', async () => {
    const baseSha = (await raw(repoA, 'rev-parse', 'HEAD')).stdout.trim();
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await writeIn(repoA, 'workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Renamed\n');
    await commitIn(repoA, 'Add + rename');
    await fs.rm(path.join(repoA, 'rules'), { recursive: true });
    await commitIn(repoA, 'Delete rule');
    const foreignSha = (await raw(repoA, 'rev-parse', 'HEAD')).stdout.trim();

    const diff = await diffForeignPaths(run, repoA, baseSha, foreignSha);
    expect(diff?.changed).toEqual(new Set(['workspace.yaml']));
    expect(diff?.removed).toEqual(new Set());

    const full = await diffForeignPaths(run, repoA, null, foreignSha);
    expect(full?.changed.has('workspace.yaml')).toBe(true);
    expect(full?.removed.size).toBe(0);

    const midSha = (await raw(repoA, 'rev-parse', 'HEAD~1')).stdout.trim();
    const withRemoval = await diffForeignPaths(run, repoA, midSha, foreignSha);
    expect(withRemoval?.removed).toEqual(new Set(['rules/block-r0000001/rule.yaml']));

    expect(await mergeBaseOf(run, repoA, baseSha, foreignSha)).toBe(baseSha);
  });

  it('listForeignAuthors names the foreign-only commit authors uniquely', async () => {
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Rita adds a rule', RITA_ENV);
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\nenabled: true\n');
    await commitIn(repoA, 'Rita edits it again', RITA_ENV);
    await raw(repoA, 'push', '--quiet', 'origin', 'main');
    await fetchWorkspaceRemote(run, repoB);
    const upstream = await resolveUpstream(run, repoB);
    const authors = await listForeignAuthors(run, repoB, 'HEAD', upstream?.sha ?? '');
    expect(authors).toEqual(['Remote Rita <rita@openheaders.io>']);
  });

  it('mergeParent records a two-parent commit through the temp-index path and leaves no MERGE_HEAD', async () => {
    // Diverge: B commits locally, A pushes a foreign rule.
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    const localSha = await commitIn(repoB, 'Local template');
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Foreign rule', RITA_ENV);
    await raw(repoA, 'push', '--quiet', 'origin', 'main');
    await fetchWorkspaceRemote(run, repoB);
    const upstream = await resolveUpstream(run, repoB);
    expect(upstream?.behind).toBe(1);

    // The engine-converged tree: B's worktree gains the foreign rule.
    await writeIn(repoB, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const merged = await commitWorkspaceTree({
      run,
      rootDir: repoB,
      message: 'Merge origin/main\n\nCo-Authored-By: Remote Rita <rita@openheaders.io>',
      identityEnv: IDENTITY_ENV,
      mergeParent: upstream?.sha ?? '',
    });
    expect(merged).toMatchObject({ ok: true, committed: true });

    const p1 = await raw(repoB, 'rev-parse', 'HEAD^1');
    const p2 = await raw(repoB, 'rev-parse', 'HEAD^2');
    expect(p1.stdout.trim()).toBe(localSha);
    expect(p2.stdout.trim()).toBe(upstream?.sha);
    expect(await gitOperationInProgress(repoB)).toBeNull();
    expect(await countDirtyFiles(run, repoB)).toBe(0);
    const after = await resolveUpstream(run, repoB);
    expect(after?.behind).toBe(0);
    const body = await raw(repoB, 'log', '-1', '--format=%B');
    expect(body.stdout).toContain('Co-Authored-By: Remote Rita <rita@openheaders.io>');
  });

  it('a merge commit with an unchanged tree still records the merge', async () => {
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    await commitIn(repoB, 'Local template');
    // Foreign commit whose content B's tree ALREADY carries.
    await writeIn(repoA, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    await commitIn(repoA, 'Same bytes remotely', RITA_ENV);
    await raw(repoA, 'push', '--quiet', 'origin', 'main');
    await fetchWorkspaceRemote(run, repoB);
    const upstream = await resolveUpstream(run, repoB);
    const merged = await commitWorkspaceTree({
      run,
      rootDir: repoB,
      message: 'Merge origin/main',
      identityEnv: IDENTITY_ENV,
      mergeParent: upstream?.sha ?? '',
    });
    expect(merged).toMatchObject({ ok: true, committed: true });
    expect((await resolveUpstream(run, repoB))?.behind).toBe(0);
  });

  it('a failing pre-commit blocks the merge commit and cleans up MERGE_HEAD', async () => {
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Foreign rule', RITA_ENV);
    await raw(repoA, 'push', '--quiet', 'origin', 'main');
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    await commitIn(repoB, 'Local template');
    await fetchWorkspaceRemote(run, repoB);
    const upstream = await resolveUpstream(run, repoB);

    const hookPath = path.join(repoB, '.git', 'hooks', 'pre-commit');
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, '#!/bin/sh\necho "merge hook says no" >&2\nexit 1\n', { mode: 0o755 });

    await writeIn(repoB, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const blocked = await commitWorkspaceTree({
      run,
      rootDir: repoB,
      message: 'Merge origin/main',
      identityEnv: IDENTITY_ENV,
      mergeParent: upstream?.sha ?? '',
    });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.detail).toContain('merge hook says no');
    expect(await gitOperationInProgress(repoB)).toBeNull();
  });

  it("fastForwardWorkspaceBranch moves the branch and leaves the user's staging intact", async () => {
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Foreign rule', RITA_ENV);
    await raw(repoA, 'push', '--quiet', 'origin', 'main');
    await fetchWorkspaceRemote(run, repoB);
    const upstream = await resolveUpstream(run, repoB);

    // Mid-`git add -p`: staged v1, worktree v2 — must survive the ff.
    await writeIn(repoB, 'user-draft.yaml', 'draft: v1\n');
    await raw(repoB, 'add', '--', 'user-draft.yaml');
    await writeIn(repoB, 'user-draft.yaml', 'draft: v2\n');
    // The converged worktree already carries the foreign bytes (the
    // materializer's flush did this in the real flow).
    await writeIn(repoB, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');

    const ff = await fastForwardWorkspaceBranch(run, repoB, upstream?.sha ?? '');
    expect(ff).toEqual({ ok: true });
    expect((await raw(repoB, 'rev-parse', 'HEAD')).stdout.trim()).toBe(upstream?.sha);

    const stagedBlob = await raw(repoB, 'show', ':user-draft.yaml');
    expect(stagedBlob.stdout).toBe('draft: v1\n');
    const staged = await raw(repoB, 'diff', '--cached', '--name-only');
    expect(staged.stdout.trim()).toBe('user-draft.yaml');
    // Besides the user's own draft, the repo reads clean.
    expect(await countDirtyFiles(run, repoB)).toBe(1);
  });

  it('pushWorkspaceBranch pushes local commits and no-ops when in sync', async () => {
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const sha = await commitIn(repoA, 'Add rule');
    const pushed = await pushWorkspaceBranch(run, repoA);
    expect(pushed).toEqual({ ok: true, pushed: true, remoteSha: sha });
    const remoteHead = await run(['--git-dir', bare, 'rev-parse', 'HEAD'], { cwd: tmpDir });
    expect(remoteHead.stdout.trim()).toBe(sha);

    const again = await pushWorkspaceBranch(run, repoA);
    expect(again).toEqual({ ok: true, pushed: false, remoteSha: sha });
  });

  it('a non-fast-forward push is rejected with the pull-first classification', async () => {
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Foreign rule', RITA_ENV);
    await raw(repoA, 'push', '--quiet', 'origin', 'main');

    // B commits without fetching — its push is behind the remote.
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    await commitIn(repoB, 'Local template');
    const result = await pushWorkspaceBranch(run, repoB);
    expect(result).toMatchObject({ ok: false, reason: 'rejected' });
  });

  it('a lone remote with no upstream gets tracking established on first push', async () => {
    const fresh = path.join(tmpDir, 'fresh');
    await run(['clone', '--quiet', bare, fresh], { cwd: tmpDir });
    // Drop the tracking config the clone set up, keep the remote.
    await run(['--git-dir', path.join(fresh, '.git'), 'config', '--unset', 'branch.main.remote'], { cwd: fresh });
    await run(['--git-dir', path.join(fresh, '.git'), 'config', '--unset', 'branch.main.merge'], { cwd: fresh });
    expect(await resolveUpstream(run, fresh)).toBeNull();

    const target = path.join(fresh, 'templates', 'fresh-t0000002');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'template.yaml'), 'schemaVersion: 5\nuid: t0000002\n', 'utf-8');
    const committed = await commitWorkspaceTree({
      run,
      rootDir: fresh,
      message: 'Fresh template',
      identityEnv: IDENTITY_ENV,
    });
    if (!committed.ok || !committed.committed) throw new Error('fresh commit failed');

    const pushed = await pushWorkspaceBranch(run, fresh);
    expect(pushed).toMatchObject({ ok: true, pushed: true });
    expect((await resolveUpstream(run, fresh))?.upstream).toBe('origin/main');
  });

  it('pushHeadToNewBranch publishes HEAD as a new remote branch; invalid names refuse', async () => {
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    const sha = await commitIn(repoB, 'Local template');

    const invalid = await pushHeadToNewBranch(run, repoB, '..bad name');
    expect(invalid).toMatchObject({ ok: false, reason: 'push-failed' });

    const pushed = await pushHeadToNewBranch(run, repoB, 'my-experiment');
    expect(pushed).toEqual({ ok: true, pushed: true, remoteSha: sha });
    const remoteRef = await run(['--git-dir', bare, 'rev-parse', 'refs/heads/my-experiment'], { cwd: tmpDir });
    expect(remoteRef.stdout.trim()).toBe(sha);
  });

  it('createRescueBranch mints a NEW ref and never overwrites an existing one', async () => {
    const head = await localHeadSha(run, repoB);
    if (head === null) throw new Error('no head');
    expect(await createRescueBranch(run, repoB, 'oh-rescue-20260719-101500', head)).toEqual({ ok: true });
    const ref = await raw(repoB, 'rev-parse', 'refs/heads/oh-rescue-20260719-101500');
    expect(ref.stdout.trim()).toBe(head);

    const clash = await createRescueBranch(run, repoB, 'oh-rescue-20260719-101500', head);
    expect(clash.ok).toBe(false);
  });

  it('isAncestorOf reads history direction; unknown objects read as false', async () => {
    const base = await localHeadSha(run, repoB);
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    const tip = await commitIn(repoB, 'Local template');
    expect(await isAncestorOf(run, repoB, base ?? '', tip)).toBe(true);
    expect(await isAncestorOf(run, repoB, tip, base ?? '')).toBe(false);
    expect(await isAncestorOf(run, repoB, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', tip)).toBe(false);
  });

  it('listTreeYamlPaths lists only yaml files of a ref', async () => {
    await writeIn(repoB, 'templates/local-t0000001/template.yaml', 'schemaVersion: 5\nuid: t0000001\n');
    await writeIn(repoB, 'README.md', '# mine\n');
    await commitIn(repoB, 'Mixed content');
    const paths = await listTreeYamlPaths(run, repoB, 'HEAD');
    expect(paths).toContain('workspace.yaml');
    expect(paths).toContain('templates/local-t0000001/template.yaml');
    expect(paths?.some((entry) => entry.endsWith('README.md'))).toBe(false);
  });

  it('gitOperationInProgress detects the §3.3 markers', async () => {
    expect(await gitOperationInProgress(repoB)).toBeNull();
    await fs.writeFile(path.join(repoB, '.git', 'CHERRY_PICK_HEAD'), 'deadbeef\n', 'utf-8');
    expect(await gitOperationInProgress(repoB)).toBe('CHERRY_PICK_HEAD');
    await fs.rm(path.join(repoB, '.git', 'CHERRY_PICK_HEAD'));
    await fs.mkdir(path.join(repoB, '.git', 'rebase-merge'), { recursive: true });
    expect(await gitOperationInProgress(repoB)).toBe('rebase-merge');
  });
});

describe('porcelain feeds', () => {
  it('counts dirty files including untracked, skipping rename second tokens', async () => {
    await initialCommit();
    expect(await countDirtyFiles(run, tmpDir)).toBe(0);
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Edited\n');
    await write('notes.md', '# notes\n');
    expect(await countDirtyFiles(run, tmpDir)).toBe(2);
  });

  it('parsePorcelainCount handles rename records', () => {
    const z = ['R  old.yaml', 'new.yaml', ' M rules/a/rule.yaml', '?? notes.md'].join('\0') + '\0';
    expect(parsePorcelainCount(z)).toBe(3);
  });
});

describe('branch plumbing (Phase 6)', () => {
  const raw = (...args: string[]) =>
    run(['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, ...args], { cwd: tmpDir });

  async function onMain(): Promise<void> {
    await ensureWorkspaceRepo(run, tmpDir);
    await raw('symbolic-ref', 'HEAD', 'refs/heads/main');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Initial tree',
      identityEnv: IDENTITY_ENV,
    });
    if (!result.ok || !result.committed) throw new Error('initial commit failed');
  }

  it('currentBranch answers on an unborn branch and reads null when detached', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await raw('symbolic-ref', 'HEAD', 'refs/heads/main');
    expect(await currentBranch(run, tmpDir)).toBe('main');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Initial', identityEnv: IDENTITY_ENV });
    expect(await currentBranch(run, tmpDir)).toBe('main');
    await raw('checkout', '-q', '--detach', 'HEAD');
    expect(await currentBranch(run, tmpDir)).toBeNull();
  });

  it('listLocalBranches lists sorted names — rescue branches included naturally', async () => {
    await onMain();
    const head = await localHeadSha(run, tmpDir);
    if (head === null) throw new Error('no head');
    await raw('branch', 'zulu');
    await createRescueBranch(run, tmpDir, 'oh-rescue-20260719-101010', head);
    expect(await listLocalBranches(run, tmpDir)).toEqual(['main', 'oh-rescue-20260719-101010', 'zulu']);
  });

  it('createAndSwitchBranch carries a dirty tree along like checkout -b; invalid names refuse', async () => {
    await onMain();
    await write('notes.md', '# scratch\n');
    const invalid = await createAndSwitchBranch(run, tmpDir, 'bad name');
    expect(invalid.ok).toBe(false);
    const created = await createAndSwitchBranch(run, tmpDir, 'local-test');
    expect(created).toEqual({ ok: true });
    expect(await currentBranch(run, tmpDir)).toBe('local-test');
    expect(await countDirtyFiles(run, tmpDir)).toBe(1);
  });

  it('checkoutWorkspaceBranch refuses to clobber dirty work unless forced', async () => {
    await onMain();
    await raw('branch', 'feature');
    await raw('checkout', '-q', 'feature');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Feature\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Feature edit', identityEnv: IDENTITY_ENV });
    await raw('checkout', '-q', 'main');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Dirty\n');
    const refused = await checkoutWorkspaceBranch(run, tmpDir, 'feature');
    expect(refused.ok).toBe(false);
    const forced = await checkoutWorkspaceBranch(run, tmpDir, 'feature', { force: true });
    expect(forced).toEqual({ ok: true });
    const bytes = await fs.readFile(path.join(tmpDir, 'workspace.yaml'), 'utf-8');
    expect(bytes).toContain('Probe Feature');
  });

  it('stashWorkspaceTree stashes tracked edits AND untracked files onto the ordinary stash stack', async () => {
    await onMain();
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Dirty\n');
    await write('notes.md', '# scratch\n');
    const stashed = await stashWorkspaceTree(run, tmpDir, 'OpenHeaders: switch to feature');
    expect(stashed).toEqual({ ok: true });
    expect(await countDirtyFiles(run, tmpDir)).toBe(0);
    const list = await raw('stash', 'list');
    expect(list.stdout).toContain('OpenHeaders: switch to feature');
  });

  it('cleanUntracked removes untracked files but keeps gitignored paths', async () => {
    await onMain();
    await write('.gitignore', '.oh/\n*.secret.yaml\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Add gitignore', identityEnv: IDENTITY_ENV });
    await write('notes.md', '# scratch\n');
    await write('.oh/lock', '{}');
    await write('env.secret.yaml', 'value: sk-test\n');
    const cleaned = await cleanUntracked(run, tmpDir);
    expect(cleaned).toEqual({ ok: true });
    await expect(fs.access(path.join(tmpDir, 'notes.md'))).rejects.toThrow();
    await fs.access(path.join(tmpDir, '.oh', 'lock'));
    await fs.access(path.join(tmpDir, 'env.secret.yaml'));
  });

  it('countLeftRight and resolveRefSha read arbitrary refs', async () => {
    await onMain();
    await raw('checkout', '-q', '-b', 'feature');
    await write('feature.yaml', 'name: feature\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Feature edit', identityEnv: IDENTITY_ENV });
    await raw('checkout', '-q', 'main');
    await write('main.yaml', 'name: main\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Main edit', identityEnv: IDENTITY_ENV });

    expect(await countLeftRight(run, tmpDir, 'HEAD', 'feature')).toEqual({ ahead: 1, behind: 1 });
    expect(await countLeftRight(run, tmpDir, 'feature', 'HEAD')).toEqual({ ahead: 1, behind: 1 });
    expect(await resolveRefSha(run, tmpDir, 'feature')).toMatch(/^[0-9a-f]{40}$/);
    expect(await resolveRefSha(run, tmpDir, 'no-such-ref')).toBeNull();
  });
});
