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
  commitWorkspaceTree,
  countDirtyFiles,
  ensureWorkspaceRepo,
  isWorkspaceRepo,
  parsePorcelainCount,
  resolveCommitIdentity,
  userIndexHasStagedChanges,
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
