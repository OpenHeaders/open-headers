/**
 * Git plumbing — real tmp repos against the system binary
 * (the git-sync plan §3.3 / §7 / §10 Phase 3): init/adopt, temp-index
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
  createLocalBranch,
  deleteLocalBranch,
  fetchAllRemotes,
  listCommitRangeLog,
  updateBranchFromUpstream,
} from '../../src/git/branch-ops';
import { isStateChanging, subcommandOf } from '../../src/git/audit-classify';
import { createGitExec, type GitAuditRow, type GitRunner, probeGitAvailability } from '../../src/git/git-exec';
import { addIgnoreEntry, checkIgnoreProvenance, removeIgnoreEntry } from '../../src/git/ignore-ops';
import {
  checkoutWorkspaceBranch,
  cleanUntracked,
  commitParents,
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
  isCommitSha,
  isSafeRefName,
  isSafeTreePath,
  isWorkspaceRepo,
  listCommitLog,
  listFileLog,
  listForeignAuthors,
  listLocalBranches,
  listRepoRefs,
  listTreeYamlPaths,
  listWorkingChanges,
  localHeadSha,
  mergeBaseOf,
  parsePorcelainCount,
  parseWorkingChanges,
  pushHeadToNewBranch,
  pushWorkspaceBranch,
  readCommitFileDiff,
  readCommitTreeFiles,
  readWorkingFileDiff,
  resolveAuthorFilterValue,
  resolveCommitIdentity,
  resolveRefSha,
  resolveUpstream,
  stashWorkspaceTree,
  userIndexHasStagedChanges,
  withCommitAttribution,
} from '../../src/git/repo';
import { validateUserCommitInput } from '../../src/workspace-tree/runtime/user-commit';

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
  GIT_AUTHOR_EMAIL: 'probe-operator@users.noreply.openheaders.com',
  GIT_COMMITTER_NAME: 'Probe Operator',
  GIT_COMMITTER_EMAIL: 'probe-operator@users.noreply.openheaders.com',
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
  const ALICE = { name: 'Alice', email: 'alice@users.noreply.openheaders.com' };
  const BOB = { name: 'Bob', email: 'bob@users.noreply.openheaders.com' };

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
    expect(attributed.env.GIT_AUTHOR_EMAIL).toBe('alice@users.noreply.openheaders.com');
    expect(attributed.env.GIT_COMMITTER_NAME).toBe('Probe Operator');
    expect(attributed.env.GIT_COMMITTER_EMAIL).toBe('probe-operator@users.noreply.openheaders.com');
  });

  it('several contributors keep the operator author and ride as deduped trailers', () => {
    const attributed = withCommitAttribution(IDENTITY_ENV, 'Update request', [ALICE, BOB, ALICE]);
    expect(attributed.env).toEqual(IDENTITY_ENV);
    expect(attributed.message).toBe(
      'Update request\n\n' +
        'Co-Authored-By: Alice <alice@users.noreply.openheaders.com>\n' +
        'Co-Authored-By: Bob <bob@users.noreply.openheaders.com>',
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
      'Alice <alice@users.noreply.openheaders.com>',
      'Probe Operator <probe-operator@users.noreply.openheaders.com>',
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
    expect(author.stdout.trim()).toBe('Probe Operator <probe-operator@users.noreply.openheaders.com>');

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
    // Console-feed fields: wall-clock + captured output per row.
    const commitRow = auditRows.find((row) => subcommandOf(row.args) === 'commit');
    expect(commitRow?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(commitRow?.cwd).toBe(tmpDir);
    expect(commitRow?.output).toContain('Initial tree');
  });

  it('audits dual-use subcommands only in their write forms', async () => {
    await initialCommit();
    const before = auditRows.length;
    await currentBranch(run, tmpDir);
    expect(auditRows.length).toBe(before);

    const repo = ['--git-dir', '/repo/.git', '--work-tree', '/repo'];
    expect(isStateChanging([...repo, 'symbolic-ref', '--short', '-q', 'HEAD'])).toBe(false);
    expect(isStateChanging([...repo, 'config', '--get', 'user.email'])).toBe(false);
    expect(isStateChanging([...repo, 'symbolic-ref', 'HEAD', 'refs/heads/main'])).toBe(true);
    expect(isStateChanging([...repo, 'symbolic-ref', '--delete', 'refs/heads/tmp'])).toBe(true);
    expect(isStateChanging([...repo, 'config', 'user.email', 'engine@openheaders.io'])).toBe(true);
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
    const logged = await listCommitLog(run, repoB, 1);
    expect(logged?.[0].parents).toEqual([localSha, upstream?.sha]);
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

describe('history feeds (Phase 7)', () => {
  it('answers an empty list on a repo with no commits yet', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    expect(await listCommitLog(run, tmpDir, 20)).toEqual([]);
    expect(await listFileLog(run, tmpDir, 'workspace.yaml', 20)).toEqual([]);
  });

  it('lists commits newest-first with authors, trailers, and changed paths', async () => {
    await initialCommit();
    await write('rules/a/rule.yaml', 'name: a\n');
    const second = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Add rule a\n\nCo-Authored-By: Dana Reyes <dana@openheaders.io>',
      identityEnv: IDENTITY_ENV,
    });
    if (!second.ok || !second.committed) throw new Error('second commit failed');

    const entries = await listCommitLog(run, tmpDir, 20);
    if (entries === null) throw new Error('log failed');
    expect(entries).toHaveLength(2);
    expect(entries[0].sha).toBe(second.sha);
    expect(entries[0].subject).toBe('Add rule a');
    expect(entries[0].authorName).toBe('Probe Operator');
    expect(entries[0].authorEmail).toBe('probe-operator@users.noreply.openheaders.com');
    expect(entries[0].authoredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entries[0].coAuthors).toEqual(['Dana Reyes <dana@openheaders.io>']);
    expect(entries[0].files).toEqual([{ status: 'A', path: 'rules/a/rule.yaml' }]);
    expect(entries[0].parents).toEqual([entries[1].sha]);
    expect(entries[1].subject).toBe('Initial tree');
    expect(entries[1].coAuthors).toEqual([]);
    expect(entries[1].files).toEqual([{ status: 'A', path: 'workspace.yaml' }]);
    expect(entries[1].parents).toEqual([]);
  });

  it('reports a pure rename as one R record at the new path and honors the limit', async () => {
    await initialCommit();
    await write('rules/a/rule.yaml', 'name: a\nvalue: stable-content-for-rename-detection\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Add rule a', identityEnv: IDENTITY_ENV });
    await fs.rm(path.join(tmpDir, 'rules/a/rule.yaml'), { force: true });
    await write('rules/a/renamed.yaml', 'name: a\nvalue: stable-content-for-rename-detection\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Rename rule a', identityEnv: IDENTITY_ENV });

    const entries = await listCommitLog(run, tmpDir, 1);
    if (entries === null) throw new Error('log failed');
    expect(entries).toHaveLength(1);
    expect(entries[0].files).toEqual([{ status: 'R', path: 'rules/a/renamed.yaml' }]);
  });

  it('listFileLog scopes to one path and follows it across a rename', async () => {
    await initialCommit();
    await write('rules/a/rule.yaml', 'name: a\nvalue: stable-content-for-rename-detection\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Add rule a', identityEnv: IDENTITY_ENV });
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Edited\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Edit manifest', identityEnv: IDENTITY_ENV });
    await fs.rm(path.join(tmpDir, 'rules/a/rule.yaml'), { force: true });
    await write('rules/a/renamed.yaml', 'name: a\nvalue: stable-content-for-rename-detection\n');
    await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Rename rule a', identityEnv: IDENTITY_ENV });

    const scoped = await listFileLog(run, tmpDir, 'rules/a/renamed.yaml', 20);
    if (scoped === null) throw new Error('file log failed');
    expect(scoped.map((entry) => entry.subject)).toEqual(['Rename rule a', 'Add rule a']);
    expect(scoped[0].files).toEqual([]);

    const manifest = await listFileLog(run, tmpDir, 'workspace.yaml', 20);
    if (manifest === null) throw new Error('file log failed');
    expect(manifest.map((entry) => entry.subject)).toEqual(['Edit manifest', 'Initial tree']);
  });

  it('row filters ride the walk: author literal + case-insensitive, dates, paths, topo order', async () => {
    await initialCommit();
    await write('rules/a/rule.yaml', 'name: a\n');
    const second = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Add rule a',
      identityEnv: {
        GIT_AUTHOR_NAME: 'Dana R. Reyes',
        GIT_AUTHOR_EMAIL: 'dana@openheaders.io',
        GIT_COMMITTER_NAME: 'Dana R. Reyes',
        GIT_COMMITTER_EMAIL: 'dana@openheaders.io',
      },
    });
    if (!second.ok || !second.committed) throw new Error('second commit failed');

    // Author: literal escaped substring, case-insensitive — the dot in
    // the name must not act as a regex wildcard.
    const byAuthor = await listCommitLog(run, tmpDir, 20, undefined, { author: 'dana r. reyes' });
    expect(byAuthor?.map((entry) => entry.subject)).toEqual(['Add rule a']);
    const noWildcard = await listCommitLog(run, tmpDir, 20, undefined, { author: 'dana rX reyes' });
    expect(noWildcard).toEqual([]);

    // Dates: an all-inclusive window keeps both; an ancient until drops both.
    const wide = await listCommitLog(run, tmpDir, 20, undefined, { since: '2000-01-01' });
    expect(wide).toHaveLength(2);
    const ancient = await listCommitLog(run, tmpDir, 20, undefined, { until: '2000-01-02' });
    expect(ancient).toEqual([]);

    // Paths: only commits touching the scope answer.
    const scoped = await listCommitLog(run, tmpDir, 20, undefined, { paths: ['rules'] });
    expect(scoped?.map((entry) => entry.subject)).toEqual(['Add rule a']);

    // Walk riders compose without narrowing a linear history.
    const riders = await listCommitLog(run, tmpDir, 20, undefined, {
      topoOrder: true,
      noMerges: true,
      firstParent: true,
    });
    expect(riders?.map((entry) => entry.subject)).toEqual(['Add rule a', 'Initial tree']);
  });

  it('resolveAuthorFilterValue answers configured email first, then name, then the fallback', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    const gitDirArgs = ['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir];
    const fallback = { name: 'Probe Operator', email: null };
    expect(await resolveAuthorFilterValue(run, tmpDir, fallback)).toBe('Probe Operator');
    await run([...gitDirArgs, 'config', 'user.name', 'Config Name'], { cwd: tmpDir });
    expect(await resolveAuthorFilterValue(run, tmpDir, fallback)).toBe('Config Name');
    await run([...gitDirArgs, 'config', 'user.email', 'config@openheaders.io'], { cwd: tmpDir });
    expect(await resolveAuthorFilterValue(run, tmpDir, fallback)).toBe('config@openheaders.io');
  });
});

describe('ref tree (Phase 7 slice 2)', () => {
  const raw = (dir: string, ...args: string[]) =>
    run(['--git-dir', path.join(dir, '.git'), '--work-tree', dir, ...args], { cwd: dir });

  const writeIn = async (dir: string, rel: string, content: string): Promise<void> => {
    const target = path.join(dir, rel);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf-8');
  };

  const commitIn = async (dir: string, message: string): Promise<string> => {
    const result = await commitWorkspaceTree({ run, rootDir: dir, message, identityEnv: IDENTITY_ENV });
    if (!result.ok || !result.committed) throw new Error(`commit failed in ${dir}`);
    return result.sha;
  };

  it('isSafeRefName admits plain ref names and rejects revision expressions', () => {
    expect(isSafeRefName('main')).toBe(true);
    expect(isSafeRefName('origin/main')).toBe(true);
    expect(isSafeRefName('release/v2026.7')).toBe(true);
    expect(isSafeRefName('oh-rescue-20260720')).toBe(true);
    expect(isSafeRefName('')).toBe(false);
    expect(isSafeRefName('--all')).toBe(false);
    expect(isSafeRefName('-n')).toBe(false);
    expect(isSafeRefName('main..feature')).toBe(false);
    expect(isSafeRefName('main^')).toBe(false);
    expect(isSafeRefName('HEAD~1')).toBe(false);
    expect(isSafeRefName('main@{1}')).toBe(false);
    expect(isSafeRefName('a b')).toBe(false);
    expect(isSafeRefName('branch.lock')).toBe(false);
  });

  it('lists local branches, remote-tracking refs, and peeled tags — origin/HEAD dropped', async () => {
    const bare = path.join(tmpDir, 'remote.git');
    const repoA = path.join(tmpDir, 'a');
    const repoB = path.join(tmpDir, 'b');
    await run(['init', '--bare', bare], { cwd: tmpDir });
    await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
    await fs.mkdir(repoA, { recursive: true });
    await ensureWorkspaceRepo(run, repoA);
    await raw(repoA, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    await writeIn(repoA, 'workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    const mainSha = await commitIn(repoA, 'Initial tree');
    await raw(repoA, 'checkout', '-q', '-b', 'feature');
    await writeIn(repoA, 'rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(repoA, 'Feature edit');
    await raw(repoA, 'checkout', '-q', 'main');
    // The annotated tag needs a tagger identity — the isolated runner has no
    // config, and a bare-hostname machine (CI) refuses to fabricate one.
    await run(['--git-dir', path.join(repoA, '.git'), '--work-tree', repoA, 'tag', '-a', 'v1', '-m', 'release v1'], {
      cwd: repoA,
      env: IDENTITY_ENV,
    });
    await raw(repoA, 'remote', 'add', 'origin', bare);
    await raw(repoA, 'push', '--quiet', '-u', 'origin', 'main');
    await raw(repoA, 'push', '--quiet', 'origin', 'feature', 'v1');
    await run(['clone', '--quiet', bare, repoB], { cwd: tmpDir });

    const refs = await listRepoRefs(run, repoB);
    if (refs === null) throw new Error('refs listing failed');
    expect(refs.filter((ref) => ref.kind === 'local').map((ref) => ref.name)).toEqual(['main']);
    expect(refs.filter((ref) => ref.kind === 'remote').map((ref) => ref.name)).toEqual([
      'origin/feature',
      'origin/main',
    ]);
    // The annotated tag reports the PEELED commit, not the tag object.
    expect(refs.filter((ref) => ref.kind === 'tag')).toEqual([{ name: 'v1', kind: 'tag', sha: mainSha }]);
  });

  it('answers an empty list on a fresh repo and null outside one', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    expect(await listRepoRefs(run, tmpDir)).toEqual([]);
    const bareDir = path.join(tmpDir, 'not-a-repo');
    await fs.mkdir(bareDir, { recursive: true });
    expect(await listRepoRefs(run, bareDir)).toBeNull();
  });

  it('scopes the commit log to a ref and refuses revision expressions', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await raw(tmpDir, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    await commitIn(tmpDir, 'Initial tree');
    await raw(tmpDir, 'checkout', '-q', '-b', 'feature');
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(tmpDir, 'Feature edit');
    await raw(tmpDir, 'checkout', '-q', 'main');

    const scoped = await listCommitLog(run, tmpDir, 20, 'feature');
    if (scoped === null) throw new Error('scoped log failed');
    expect(scoped.map((entry) => entry.subject)).toEqual(['Feature edit', 'Initial tree']);

    const head = await listCommitLog(run, tmpDir, 20);
    if (head === null) throw new Error('log failed');
    expect(head.map((entry) => entry.subject)).toEqual(['Initial tree']);

    expect(await listCommitLog(run, tmpDir, 20, 'main..feature')).toBeNull();
    expect(await listCommitLog(run, tmpDir, 20, '--all')).toBeNull();
  });

  it('walks every ref under allRefs, and a ref scope wins over the flag', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await raw(tmpDir, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    await commitIn(tmpDir, 'Initial tree');
    await raw(tmpDir, 'tag', 'v1');
    await raw(tmpDir, 'checkout', '-q', '-b', 'feature');
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitIn(tmpDir, 'Feature edit');
    await raw(tmpDir, 'checkout', '-q', 'main');

    // HEAD alone sees only main; the all-refs walk sees the feature tip too.
    const head = await listCommitLog(run, tmpDir, 20);
    if (head === null) throw new Error('log failed');
    expect(head.map((entry) => entry.subject)).toEqual(['Initial tree']);
    const all = await listCommitLog(run, tmpDir, 20, undefined, { allRefs: true });
    if (all === null) throw new Error('all-refs log failed');
    expect(all.map((entry) => entry.subject).sort()).toEqual(['Feature edit', 'Initial tree']);

    // A ref scope wins: the flag never widens an explicit scope.
    const scoped = await listCommitLog(run, tmpDir, 20, 'main', { allRefs: true });
    if (scoped === null) throw new Error('scoped log failed');
    expect(scoped.map((entry) => entry.subject)).toEqual(['Initial tree']);
  });

  it('answers an empty all-refs timeline on a fresh repo', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    expect(await listCommitLog(run, tmpDir, 20, undefined, { allRefs: true })).toEqual([]);
  });
});

describe('commit file diff (Phase 7 slice 3)', () => {
  const commitHere = async (message: string): Promise<string> => {
    const result = await commitWorkspaceTree({ run, rootDir: tmpDir, message, identityEnv: IDENTITY_ENV });
    if (!result.ok || !result.committed) throw new Error('commit failed');
    return result.sha;
  };

  it('isCommitSha admits full hex object names only', () => {
    expect(isCommitSha('a'.repeat(40))).toBe(true);
    expect(isCommitSha('0123456789abcdef0123456789abcdef01234567')).toBe(true);
    expect(isCommitSha('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(true);
    expect(isCommitSha('0123456')).toBe(false);
    expect(isCommitSha('HEAD')).toBe(false);
    expect(isCommitSha('main')).toBe(false);
    expect(isCommitSha('0123456789ABCDEF0123456789abcdef01234567')).toBe(false);
    expect(isCommitSha('')).toBe(false);
  });

  it('isSafeTreePath admits plain tree paths and rejects escapes', () => {
    expect(isSafeTreePath('workspace.yaml')).toBe(true);
    expect(isSafeTreePath('rules/block-r0000001/rule.yaml')).toBe(true);
    expect(isSafeTreePath('')).toBe(false);
    expect(isSafeTreePath('-n')).toBe(false);
    expect(isSafeTreePath('/etc/passwd')).toBe(false);
    expect(isSafeTreePath('../outside.yaml')).toBe(false);
    expect(isSafeTreePath('rules/../../outside.yaml')).toBe(false);
    expect(isSafeTreePath('rules/./rule.yaml')).toBe(false);
    expect(isSafeTreePath('rules//rule.yaml')).toBe(false);
    expect(isSafeTreePath('rules/')).toBe(false);
  });

  it('isSafeTreePath rejects control characters', () => {
    expect(isSafeTreePath('foo\n!*.secret.yaml')).toBe(false);
    expect(isSafeTreePath('foo\rbar.yaml')).toBe(false);
    expect(isSafeTreePath('foo\tbar.yaml')).toBe(false);
    expect(isSafeTreePath('foo\0bar.yaml')).toBe(false);
    expect(isSafeTreePath('foo\x7fbar.yaml')).toBe(false);
  });

  it('answers old/new blob contents for a modified file', async () => {
    await initialCommit();
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Edited\n');
    const sha = await commitHere('Edit manifest');

    const result = await readCommitFileDiff(run, tmpDir, sha, 'workspace.yaml');
    if (!result.ok) throw new Error(`diff refused: ${result.reason}`);
    expect(result.diff.oldContent).toBe('schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    expect(result.diff.newContent).toBe('schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Edited\n');
    expect(result.diff.binary).toBe(false);
    expect(result.diff.tooLarge).toBe(false);
    expect(result.diff.oldSize).toBe(Buffer.byteLength('schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n'));
    expect(result.diff.newSize).toBe(Buffer.byteLength('schemaVersion: 5\nuid: wsaaaaaa\nname: Probe Edited\n'));
  });

  it('answers a null old side for an added file — including the root commit', async () => {
    await ensureWorkspaceRepo(run, tmpDir);
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');
    const rootSha = await commitHere('Initial tree');

    const root = await readCommitFileDiff(run, tmpDir, rootSha, 'workspace.yaml');
    if (!root.ok) throw new Error(`diff refused: ${root.reason}`);
    expect(root.diff.oldContent).toBeNull();
    expect(root.diff.oldSize).toBeNull();
    expect(root.diff.newContent).toBe('schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n');

    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const addSha = await commitHere('Add rule');
    const added = await readCommitFileDiff(run, tmpDir, addSha, 'rules/block-r0000001/rule.yaml');
    if (!added.ok) throw new Error(`diff refused: ${added.reason}`);
    expect(added.diff.oldContent).toBeNull();
    expect(added.diff.newContent).toBe('schemaVersion: 5\nuid: r0000001\n');
  });

  it('answers a null new side for a deleted file', async () => {
    await initialCommit();
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await commitHere('Add rule');
    await fs.rm(path.join(tmpDir, 'rules/block-r0000001/rule.yaml'), { force: true });
    const sha = await commitHere('Remove rule');

    const result = await readCommitFileDiff(run, tmpDir, sha, 'rules/block-r0000001/rule.yaml');
    if (!result.ok) throw new Error(`diff refused: ${result.reason}`);
    expect(result.diff.oldContent).toBe('schemaVersion: 5\nuid: r0000001\n');
    expect(result.diff.newContent).toBeNull();
    expect(result.diff.newSize).toBeNull();
  });

  it('flags a binary change and ships no contents', async () => {
    await initialCommit();
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02, 0x00, 0xff]);
    await fs.writeFile(path.join(tmpDir, 'logo.png'), bytes);
    const sha = await commitHere('Add logo');

    const result = await readCommitFileDiff(run, tmpDir, sha, 'logo.png');
    if (!result.ok) throw new Error(`diff refused: ${result.reason}`);
    expect(result.diff.binary).toBe(true);
    expect(result.diff.oldContent).toBeNull();
    expect(result.diff.newContent).toBeNull();
    expect(result.diff.newSize).toBe(bytes.length);
  });

  it('flags an over-cap blob and ships no contents', async () => {
    await initialCommit();
    await write('rules/block-r0000001/rule.yaml', `schemaVersion: 5\nuid: r0000001\nnote: ${'x'.repeat(64)}\n`);
    const sha = await commitHere('Add big rule');

    const result = await readCommitFileDiff(run, tmpDir, sha, 'rules/block-r0000001/rule.yaml', 32);
    if (!result.ok) throw new Error(`diff refused: ${result.reason}`);
    expect(result.diff.tooLarge).toBe(true);
    expect(result.diff.oldContent).toBeNull();
    expect(result.diff.newContent).toBeNull();
    expect(result.diff.newSize).toBeGreaterThan(32);
  });

  it('refuses unknown commits, revision expressions, and untouched paths typed', async () => {
    await initialCommit();
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const sha = await commitHere('Add rule');

    expect(await readCommitFileDiff(run, tmpDir, 'HEAD', 'workspace.yaml')).toEqual({
      ok: false,
      reason: 'unknown-commit',
    });
    expect(await readCommitFileDiff(run, tmpDir, `${sha.slice(0, -2)}^^`, 'workspace.yaml')).toEqual({
      ok: false,
      reason: 'unknown-commit',
    });
    expect(await readCommitFileDiff(run, tmpDir, 'f'.repeat(40), 'workspace.yaml')).toEqual({
      ok: false,
      reason: 'unknown-commit',
    });
    expect(await readCommitFileDiff(run, tmpDir, sha, '../outside.yaml')).toEqual({
      ok: false,
      reason: 'unknown-path',
    });
    // workspace.yaml exists in the tree but this commit didn't touch it.
    expect(await readCommitFileDiff(run, tmpDir, sha, 'workspace.yaml')).toEqual({
      ok: false,
      reason: 'unknown-path',
    });
  });
});

describe('branch ops (IDE-log activity bar)', () => {
  it('deleteLocalBranch answers the pre-delete sha and refuses unknown names', async () => {
    await initialCommit();
    await createAndSwitchBranch(run, tmpDir, 'feature/x');
    const featureSha = await localHeadSha(run, tmpDir);
    await checkoutWorkspaceBranch(
      run,
      tmpDir,
      (await listLocalBranches(run, tmpDir)).find((b) => b !== 'feature/x') ?? 'main',
    );

    const deleted = await deleteLocalBranch(run, tmpDir, 'feature/x');
    expect(deleted).toEqual({ ok: true, sha: featureSha });
    expect(await listLocalBranches(run, tmpDir)).not.toContain('feature/x');

    expect((await deleteLocalBranch(run, tmpDir, 'feature/x')).ok).toBe(false);
    expect((await deleteLocalBranch(run, tmpDir, '--force')).ok).toBe(false);
  });

  it('createLocalBranch mints a ref at a start point without moving HEAD; checkout/overwrite variants', async () => {
    await initialCommit();
    const first = await localHeadSha(run, tmpDir);
    if (first === null) throw new Error('no head');
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    const second = await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Second', identityEnv: IDENTITY_ENV });
    if (!second.ok || !second.committed) throw new Error('second commit failed');
    const head = await currentBranch(run, tmpDir);

    // No checkout: HEAD stays; the new branch points at the start sha.
    expect(
      await createLocalBranch(run, tmpDir, 'restore/x', { from: first, checkout: false, overwrite: false }),
    ).toEqual({
      ok: true,
    });
    expect(await currentBranch(run, tmpDir)).toBe(head);
    expect(await resolveRefSha(run, tmpDir, 'refs/heads/restore/x')).toBe(first);

    // Overwrite moves the existing ref (`branch -f`).
    expect(
      await createLocalBranch(run, tmpDir, 'restore/x', { from: second.sha, checkout: false, overwrite: true }),
    ).toEqual({ ok: true });
    expect(await resolveRefSha(run, tmpDir, 'refs/heads/restore/x')).toBe(second.sha);

    // Checkout variant is the `checkout -b` gesture.
    expect(
      await createLocalBranch(run, tmpDir, 'feature/y', { from: first, checkout: true, overwrite: false }),
    ).toEqual({
      ok: true,
    });
    expect(await currentBranch(run, tmpDir)).toBe('feature/y');
    expect(await localHeadSha(run, tmpDir)).toBe(first);

    // Duplicate without overwrite fails through git's own guard.
    expect((await createLocalBranch(run, tmpDir, 'restore/x', { checkout: false, overwrite: false })).ok).toBe(false);
  });

  it('listCommitRangeLog answers each exclusive side and refuses unsafe shapes', async () => {
    await initialCommit();
    const base = await currentBranch(run, tmpDir);
    if (base === null) throw new Error('no branch');
    await createAndSwitchBranch(run, tmpDir, 'feature/z');
    await write('rules/block-r0000002/rule.yaml', 'schemaVersion: 5\nuid: r0000002\n');
    const onBranch = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Branch work',
      identityEnv: IDENTITY_ENV,
    });
    if (!onBranch.ok || !onBranch.committed) throw new Error('branch commit failed');

    const onlyInFeature = await listCommitRangeLog(run, tmpDir, base, 'feature/z', 200);
    expect(onlyInFeature?.map((entry) => entry.subject)).toEqual(['Branch work']);
    expect(onlyInFeature?.[0].files.map((file) => file.path)).toEqual(['rules/block-r0000002/rule.yaml']);
    const onlyInBase = await listCommitRangeLog(run, tmpDir, 'feature/z', base, 200);
    expect(onlyInBase).toEqual([]);

    expect(await listCommitRangeLog(run, tmpDir, `${base}..feature/z`, base, 200)).toBeNull();
    expect(await listCommitRangeLog(run, tmpDir, base, '--all', 200)).toBeNull();
  });

  it('fetchAllRemotes refuses with no remote and updateBranchFromUpstream fast-forwards a non-current branch', async () => {
    await initialCommit();
    expect(await fetchAllRemotes(run, tmpDir)).toEqual({ ok: false, reason: 'no-remote' });

    // remote.git <- clone: the clone's main tracks origin/main.
    const bare = path.join(tmpDir, 'remote.git');
    const clone = path.join(tmpDir, 'clone');
    await run(['init', '--bare', bare], { cwd: tmpDir });
    const head = await currentBranch(run, tmpDir);
    await run(['--git-dir', path.join(tmpDir, '.git'), 'push', '--quiet', bare, `${head}:refs/heads/main`], {
      cwd: tmpDir,
    });
    await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
    await run(['clone', '--quiet', bare, clone], { cwd: tmpDir });

    // Park the clone on another branch so `main` is NOT checked out.
    await createAndSwitchBranch(run, clone, 'parking');
    // Advance the remote from the source repo.
    await write('rules/block-r0000003/rule.yaml', 'schemaVersion: 5\nuid: r0000003\n');
    const advanced = await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Advance', identityEnv: IDENTITY_ENV });
    if (!advanced.ok || !advanced.committed) throw new Error('advance commit failed');
    await run(['--git-dir', path.join(tmpDir, '.git'), 'push', '--quiet', bare, `${head}:refs/heads/main`], {
      cwd: tmpDir,
    });

    expect(await fetchAllRemotes(run, clone)).toEqual({ ok: true });
    expect(await updateBranchFromUpstream(run, clone, 'main')).toEqual({ ok: true });
    expect(await resolveRefSha(run, clone, 'refs/heads/main')).toBe(advanced.sha);

    // A branch with no upstream refuses typed.
    expect(await updateBranchFromUpstream(run, clone, 'parking')).toEqual({ ok: false, reason: 'no-upstream' });
  });
});

describe('Commit window plumbing (S22)', () => {
  it('parseWorkingChanges classifies porcelain rows and sorts by path', () => {
    const raw = [
      ' M b/modified.yaml',
      'A  a/staged-add.yaml',
      '?? z/new.yaml',
      '!! ignored.log',
      'R  renamed/new.yaml\0renamed/old.yaml',
      'MM twice.yaml',
    ].join('\0');
    const rows = parseWorkingChanges(`${raw}\0`);
    expect(rows.map((row) => row.path)).toEqual([
      'a/staged-add.yaml',
      'b/modified.yaml',
      'ignored.log',
      'renamed/new.yaml',
      'twice.yaml',
      'z/new.yaml',
    ]);
    expect(rows.find((row) => row.path === 'b/modified.yaml')).toMatchObject({ status: 'M', unversioned: false });
    expect(rows.find((row) => row.path === 'a/staged-add.yaml')).toMatchObject({ status: 'A' });
    expect(rows.find((row) => row.path === 'z/new.yaml')).toMatchObject({ status: '?', unversioned: true });
    expect(rows.find((row) => row.path === 'ignored.log')).toMatchObject({ status: '!', ignored: true });
    expect(rows.find((row) => row.path === 'renamed/new.yaml')).toMatchObject({
      status: 'R',
      renamedFrom: 'renamed/old.yaml',
    });
    expect(rows.find((row) => row.path === 'twice.yaml')).toMatchObject({ status: 'M' });
  });

  it('listWorkingChanges reads tracked, unversioned, and (on request) ignored rows', async () => {
    await initialCommit();
    await write('.gitignore', 'secret.log\n');
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Renamed\n');
    await write('rules/block-r0000001/rule.yaml', 'schemaVersion: 5\nuid: r0000001\n');
    await write('secret.log', 'shh\n');

    const plain = await listWorkingChanges(run, tmpDir);
    expect(plain).not.toBeNull();
    const paths = (plain ?? []).map((row) => row.path);
    expect(paths).toContain('workspace.yaml');
    expect(paths).toContain('rules/block-r0000001/rule.yaml');
    expect(paths).toContain('.gitignore');
    expect(paths).not.toContain('secret.log');
    expect((plain ?? []).find((row) => row.path === 'workspace.yaml')).toMatchObject({
      status: 'M',
      unversioned: false,
    });
    expect((plain ?? []).find((row) => row.path === 'rules/block-r0000001/rule.yaml')).toMatchObject({
      unversioned: true,
    });

    const withIgnored = await listWorkingChanges(run, tmpDir, { includeIgnored: true });
    expect((withIgnored ?? []).find((row) => row.path === 'secret.log')).toMatchObject({ ignored: true });
  });

  it('pathspec commit takes only the checked paths and leaves the rest dirty', async () => {
    await initialCommit();
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Dirty\n');
    await write('note.yaml', 'kind: note\n');

    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Add the note only',
      identityEnv: IDENTITY_ENV,
      paths: ['note.yaml'],
    });
    expect(result).toMatchObject({ ok: true, committed: true });

    // The unchecked path stays dirty; the checked one is committed.
    const rows = (await listWorkingChanges(run, tmpDir)) ?? [];
    expect(rows.map((row) => row.path)).toEqual(['workspace.yaml']);
    const log = await listCommitLog(run, tmpDir, 5);
    expect(log?.[0]?.subject).toBe('Add the note only');
    expect(log?.[0]?.files.map((file) => file.path)).toEqual(['note.yaml']);
    // The user's real staging area never participated (§3.3).
    expect(await userIndexHasStagedChanges(run, tmpDir)).toBe(false);
  });

  it('pathspec commit leaves the user-staged paths exactly as found (§3.3)', async () => {
    await initialCommit();
    await write('staged.yaml', 'kind: staged\n');
    await run(['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, 'add', '--', 'staged.yaml'], {
      cwd: tmpDir,
    });
    await write('note.yaml', 'kind: note\n');

    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Note only',
      identityEnv: IDENTITY_ENV,
      paths: ['note.yaml'],
    });
    expect(result).toMatchObject({ ok: true, committed: true });
    // staged.yaml is still the user's staged entry, not committed.
    expect(await userIndexHasStagedChanges(run, tmpDir)).toBe(true);
    const log = await listCommitLog(run, tmpDir, 1);
    expect(log?.[0]?.files.map((file) => file.path)).toEqual(['note.yaml']);
  });

  it('unchanged checked paths answer committed:false, never an empty commit', async () => {
    await initialCommit();
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Nothing really',
      identityEnv: IDENTITY_ENV,
      paths: ['workspace.yaml'],
    });
    expect(result).toEqual({ ok: true, committed: false });
  });

  it('amend rewrites HEAD in place — same parent, new message, extra path', async () => {
    await initialCommit();
    await write('a.yaml', 'kind: a\n');
    const second = await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Second', identityEnv: IDENTITY_ENV });
    if (!second.ok || !second.committed) throw new Error('second commit failed');
    const parentsBefore = await commitParents(run, tmpDir, second.sha);

    await write('b.yaml', 'kind: b\n');
    const amended = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Second, amended',
      identityEnv: IDENTITY_ENV,
      paths: ['b.yaml'],
      amend: true,
    });
    expect(amended).toMatchObject({ ok: true, committed: true });

    const log = await listCommitLog(run, tmpDir, 10);
    expect(log?.length).toBe(2);
    expect(log?.[0]?.subject).toBe('Second, amended');
    expect(log?.[0]?.files.map((file) => file.path).sort()).toEqual(['a.yaml', 'b.yaml']);
    if (!amended.ok || !amended.committed) throw new Error('amend failed');
    expect(await commitParents(run, tmpDir, amended.sha)).toEqual(parentsBefore);
    expect(await userIndexHasStagedChanges(run, tmpDir)).toBe(false);
  });

  it('message-only amend (empty pathspec) rewrites the subject alone', async () => {
    await initialCommit();
    await write('a.yaml', 'kind: a\n');
    const second = await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Second', identityEnv: IDENTITY_ENV });
    if (!second.ok || !second.committed) throw new Error('second commit failed');

    const amended = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Second, better said',
      identityEnv: IDENTITY_ENV,
      paths: [],
      amend: true,
    });
    expect(amended).toMatchObject({ ok: true, committed: true });
    const log = await listCommitLog(run, tmpDir, 10);
    expect(log?.length).toBe(2);
    expect(log?.[0]?.subject).toBe('Second, better said');
    expect(log?.[0]?.files.map((file) => file.path)).toEqual(['a.yaml']);
  });

  it('signOff appends the Signed-off-by trailer', async () => {
    await initialCommit();
    await write('a.yaml', 'kind: a\n');
    const result = await commitWorkspaceTree({
      run,
      rootDir: tmpDir,
      message: 'Signed work',
      identityEnv: IDENTITY_ENV,
      signOff: true,
    });
    expect(result).toMatchObject({ ok: true, committed: true });
    const body = await run(['--git-dir', path.join(tmpDir, '.git'), 'log', '-1', '--format=%B'], { cwd: tmpDir });
    expect(body.stdout).toContain('Signed-off-by: Probe Operator <probe-operator@users.noreply.openheaders.com>');
  });

  it('commitParents answers the parent chain (root, linear)', async () => {
    await initialCommit();
    const rootSha = await localHeadSha(run, tmpDir);
    expect(await commitParents(run, tmpDir, rootSha ?? '')).toEqual([]);
    await write('a.yaml', 'kind: a\n');
    const second = await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Second', identityEnv: IDENTITY_ENV });
    if (!second.ok || !second.committed) throw new Error('second commit failed');
    expect(await commitParents(run, tmpDir, second.sha)).toEqual([rootSha]);
    expect(await commitParents(run, tmpDir, 'deadbeef')).toBeNull();
  });

  it('the amend-pushed predicate: HEAD reachable from upstream after push, not after new work', async () => {
    const bare = path.join(tmpDir, 'remote.git');
    await run(['init', '--bare', bare], { cwd: tmpDir });
    await run(['--git-dir', bare, 'symbolic-ref', 'HEAD', 'refs/heads/main'], { cwd: tmpDir });
    await initialCommit();
    await run(['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, 'remote', 'add', 'origin', bare], {
      cwd: tmpDir,
    });
    await run(
      ['--git-dir', path.join(tmpDir, '.git'), '--work-tree', tmpDir, 'push', '--quiet', '-u', 'origin', 'HEAD'],
      {
        cwd: tmpDir,
      },
    );

    // Pushed: amending would rewrite published history — the refusal case.
    const pushedHead = await localHeadSha(run, tmpDir);
    const upstream = await resolveUpstream(run, tmpDir);
    expect(upstream).not.toBeNull();
    expect(await isAncestorOf(run, tmpDir, pushedHead ?? '', upstream?.sha ?? '')).toBe(true);

    // A fresh local commit is NOT reachable from the upstream — amend allowed.
    await write('a.yaml', 'kind: a\n');
    const local = await commitWorkspaceTree({ run, rootDir: tmpDir, message: 'Local only', identityEnv: IDENTITY_ENV });
    if (!local.ok || !local.committed) throw new Error('local commit failed');
    expect(await isAncestorOf(run, tmpDir, local.sha, upstream?.sha ?? '')).toBe(false);
  });

  it('readWorkingFileDiff answers modified / unversioned / deleted / unknown shapes', async () => {
    await initialCommit();
    await write('workspace.yaml', 'schemaVersion: 5\nuid: wsaaaaaa\nname: Edited\n');
    const modified = await readWorkingFileDiff(run, tmpDir, 'workspace.yaml');
    expect(modified.ok).toBe(true);
    if (modified.ok) {
      expect(modified.diff.oldContent).toContain('name: Probe');
      expect(modified.diff.newContent).toContain('name: Edited');
      expect(modified.diff.binary).toBe(false);
    }

    await write('fresh.yaml', 'kind: fresh\n');
    const fresh = await readWorkingFileDiff(run, tmpDir, 'fresh.yaml');
    expect(fresh.ok).toBe(true);
    if (fresh.ok) {
      expect(fresh.diff.oldContent).toBeNull();
      expect(fresh.diff.newContent).toContain('kind: fresh');
    }

    await fs.rm(path.join(tmpDir, 'workspace.yaml'));
    const deleted = await readWorkingFileDiff(run, tmpDir, 'workspace.yaml');
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(deleted.diff.oldContent).toContain('name: Probe');
      expect(deleted.diff.newContent).toBeNull();
      expect(deleted.diff.newSize).toBeNull();
    }

    expect(await readWorkingFileDiff(run, tmpDir, 'no-such.yaml')).toEqual({ ok: false, reason: 'unknown-path' });
    expect(await readWorkingFileDiff(run, tmpDir, '../escape.yaml')).toEqual({ ok: false, reason: 'unknown-path' });
  });

  it('readWorkingFileDiff flags binary bytes without contents', async () => {
    await initialCommit();
    await fs.writeFile(path.join(tmpDir, 'blob.bin'), Buffer.from([0x4f, 0x48, 0x00, 0x01, 0x02]));
    const result = await readWorkingFileDiff(run, tmpDir, 'blob.bin');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.diff.binary).toBe(true);
      expect(result.diff.oldContent).toBeNull();
      expect(result.diff.newContent).toBeNull();
    }
  });

  it('validateUserCommitInput refuses empty message, bad paths, and a pathless non-amend', () => {
    expect(validateUserCommitInput({ message: '  ', paths: ['a.yaml'] })).toEqual({
      ok: false,
      reason: 'empty-message',
    });
    expect(validateUserCommitInput({ message: 'ok', paths: ['../escape'] })).toEqual({
      ok: false,
      reason: 'invalid-paths',
    });
    expect(validateUserCommitInput({ message: 'ok', paths: [] })).toEqual({ ok: false, reason: 'no-paths' });
    expect(validateUserCommitInput({ message: 'ok', paths: [], amend: true })).toEqual({ ok: true });
    expect(validateUserCommitInput({ message: 'ok', paths: ['rules/a.yaml'] })).toEqual({ ok: true });
  });
});

describe('Ignore-file plumbing (S23)', () => {
  it('addIgnoreEntry appends the anchored entry and git starts ignoring the file', async () => {
    await initialCommit();
    await write('notes/scratch.yaml', 'kind: note\n');

    const before = (await listWorkingChanges(run, tmpDir)) ?? [];
    expect(before.find((row) => row.path === 'notes/scratch.yaml')).toMatchObject({ unversioned: true });

    const added = await addIgnoreEntry(tmpDir, 'notes/scratch.yaml', 'gitignore');
    expect(added).toEqual({ ok: true, added: true, entry: '/notes/scratch.yaml' });
    expect(await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe('/notes/scratch.yaml\n');

    // The row leaves the porcelain feed; with includeIgnored it comes
    // back flagged; the .gitignore itself now shows as a change row.
    const after = (await listWorkingChanges(run, tmpDir)) ?? [];
    expect(after.map((row) => row.path)).not.toContain('notes/scratch.yaml');
    expect(after.map((row) => row.path)).toContain('.gitignore');
    const withIgnored = (await listWorkingChanges(run, tmpDir, { includeIgnored: true })) ?? [];
    expect(withIgnored.find((row) => row.path === 'notes/scratch.yaml')).toMatchObject({ ignored: true });
  });

  it('addIgnoreEntry never duplicates an entry and preserves existing lines', async () => {
    await initialCommit();
    await write('.gitignore', 'secret.log');
    const first = await addIgnoreEntry(tmpDir, 'notes/scratch.yaml', 'gitignore');
    expect(first).toMatchObject({ ok: true, added: true });
    const second = await addIgnoreEntry(tmpDir, 'notes/scratch.yaml', 'gitignore');
    expect(second).toMatchObject({ ok: true, added: false });
    expect(await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe('secret.log\n/notes/scratch.yaml\n');
  });

  it('the exclude target writes .git/info/exclude and stays invisible to the changes feed', async () => {
    await initialCommit();
    await write('notes/local.yaml', 'kind: note\n');
    const added = await addIgnoreEntry(tmpDir, 'notes/local.yaml', 'exclude');
    expect(added).toEqual({ ok: true, added: true, entry: '/notes/local.yaml' });
    expect(await fs.readFile(path.join(tmpDir, '.git', 'info', 'exclude'), 'utf-8')).toContain('/notes/local.yaml\n');

    const after = (await listWorkingChanges(run, tmpDir)) ?? [];
    expect(after.map((row) => row.path)).not.toContain('notes/local.yaml');
    // Local-only: no working-tree file changed, so no new change rows.
    expect(after.map((row) => row.path)).not.toContain('.gitignore');
    const withIgnored = (await listWorkingChanges(run, tmpDir, { includeIgnored: true })) ?? [];
    expect(withIgnored.find((row) => row.path === 'notes/local.yaml')).toMatchObject({ ignored: true });
  });
});

describe('Ignore provenance + removal (S23)', () => {
  it('checkIgnoreProvenance attributes root .gitignore, exclude, and nested sources with the removable gate', async () => {
    await initialCommit();
    await write('.gitignore', '/notes/exact.yaml\n*.log\n');
    await write('notes/exact.yaml', 'kind: note\n');
    await write('notes/run.log', 'log\n');
    await write('deep/.gitignore', 'inner.yaml\n');
    await write('deep/inner.yaml', 'kind: note\n');
    await addIgnoreEntry(tmpDir, 'local.yaml', 'exclude');
    await write('local.yaml', 'kind: note\n');

    const provenance = await checkIgnoreProvenance(run, tmpDir, [
      'notes/exact.yaml',
      'notes/run.log',
      'deep/inner.yaml',
      'local.yaml',
      'not-ignored.yaml',
    ]);
    expect(provenance.get('notes/exact.yaml')).toMatchObject({
      kind: 'gitignore',
      pattern: '/notes/exact.yaml',
      removable: true,
    });
    // A glob match is never removable — deleting it would un-ignore other files.
    expect(provenance.get('notes/run.log')).toMatchObject({ kind: 'gitignore', pattern: '*.log', removable: false });
    expect(provenance.get('deep/inner.yaml')).toMatchObject({ kind: 'nested', removable: false });
    expect(provenance.get('deep/inner.yaml')?.source).toBe('deep/.gitignore');
    expect(provenance.get('local.yaml')).toMatchObject({ kind: 'exclude', removable: true });
    expect(provenance.has('not-ignored.yaml')).toBe(false);
  });

  it('removeIgnoreEntry deletes only the exact entry and round-trips with addIgnoreEntry', async () => {
    await initialCommit();
    await write('.gitignore', '# comment\n*.log\n');
    await write('notes/scratch.yaml', 'kind: note\n');
    await addIgnoreEntry(tmpDir, 'notes/scratch.yaml', 'gitignore');

    const removed = await removeIgnoreEntry(tmpDir, 'notes/scratch.yaml', 'gitignore');
    expect(removed).toEqual({ ok: true, removed: true });
    expect(await fs.readFile(path.join(tmpDir, '.gitignore'), 'utf-8')).toBe('# comment\n*.log\n');
    const again = await removeIgnoreEntry(tmpDir, 'notes/scratch.yaml', 'gitignore');
    expect(again).toEqual({ ok: true, removed: false });

    // The file is visible to porcelain again.
    const rows = (await listWorkingChanges(run, tmpDir)) ?? [];
    expect(rows.find((row) => row.path === 'notes/scratch.yaml')).toMatchObject({ unversioned: true });
    // A missing target file answers removed: false, never an error.
    expect(await removeIgnoreEntry(tmpDir, 'anything.yaml', 'exclude')).toEqual({ ok: true, removed: false });
  });
});
