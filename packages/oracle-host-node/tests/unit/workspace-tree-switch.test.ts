/**
 * Branch-switch pass on real tmp repos (the git-sync plan §6;
 * the data-plane topologies design §6.2): a dirty tree refuses without an
 * answer, and each of the Commit / Stash / Discard choices lands its
 * contract — the commit rides the engine's own commit seam, the stash
 * is the user's ordinary recoverable stash entry, and discard is the
 * only destructive path (checkout --force + clean).
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { commitWorkspaceTree, countDirtyFiles, currentBranch, ensureWorkspaceRepo } from '../../src/git/repo';
import { switchWorkspaceBranch } from '../../src/workspace-tree/switch';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Probe Operator',
  GIT_AUTHOR_EMAIL: 'probe-operator@users.noreply.openheaders.io',
  GIT_COMMITTER_NAME: 'Probe Operator',
  GIT_COMMITTER_EMAIL: 'probe-operator@users.noreply.openheaders.io',
};

function isolated(base: GitRunner): GitRunner {
  return (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...options.env },
    });
}

let tmpDir: string;
let repo: string;
let run: GitRunner;

const raw = (...args: string[]) =>
  run(['--git-dir', path.join(repo, '.git'), '--work-tree', repo, ...args], { cwd: repo });

const write = (rel: string, content: string) => fs.writeFile(path.join(repo, rel), content, 'utf-8');

const doSwitch = (branch: string, dirtyAction?: 'commit' | 'stash' | 'discard') =>
  switchWorkspaceBranch({
    run,
    rootDir: repo,
    branch,
    ...(dirtyAction !== undefined ? { dirtyAction } : {}),
    commit: async () => {
      const result = await commitWorkspaceTree({
        run,
        rootDir: repo,
        message: 'Switch-prompt commit',
        identityEnv: IDENTITY_ENV,
      });
      return result.ok ? { ok: true } : { ok: false, detail: result.detail };
    },
  });

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-switch-'));
  repo = path.join(tmpDir, 'repo');
  run = isolated(createGitExec());
  await fs.mkdir(repo, { recursive: true });
  await write('config.yaml', 'name: main content\n');
  await ensureWorkspaceRepo(run, repo);
  await raw('symbolic-ref', 'HEAD', 'refs/heads/main');
  const initial = await commitWorkspaceTree({ run, rootDir: repo, message: 'Initial', identityEnv: IDENTITY_ENV });
  if (!initial.ok || !initial.committed) throw new Error('initial commit failed');
  // A second branch with its own content, then back to main.
  await raw('checkout', '-q', '-b', 'feature');
  await write('config.yaml', 'name: feature content\n');
  const branched = await commitWorkspaceTree({
    run,
    rootDir: repo,
    message: 'Feature edit',
    identityEnv: IDENTITY_ENV,
  });
  if (!branched.ok || !branched.committed) throw new Error('feature commit failed');
  await raw('checkout', '-q', 'main');
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('switchWorkspaceBranch', () => {
  it('switches a clean tree and no-ops when already on the target', async () => {
    expect(await doSwitch('feature')).toEqual({ ok: true, branch: 'feature', switched: true });
    expect(await currentBranch(run, repo)).toBe('feature');
    expect((await fs.readFile(path.join(repo, 'config.yaml'), 'utf-8')).trim()).toBe('name: feature content');
    expect(await doSwitch('feature')).toEqual({ ok: true, branch: 'feature', switched: false });
  });

  it('refuses an unknown branch', async () => {
    expect(await doSwitch('no-such-branch')).toMatchObject({ ok: false, reason: 'unknown-branch' });
  });

  it('a dirty tree with no answer refuses with the count — the §6.2 prompt feed', async () => {
    await write('NOTES.md', '# scratch\n');
    const result = await doSwitch('feature');
    expect(result).toMatchObject({ ok: false, reason: 'dirty', dirtyFiles: 1 });
    expect(await currentBranch(run, repo)).toBe('main');
  });

  it('Commit lands the engine commit on the old branch, then switches', async () => {
    await write('NOTES.md', '# scratch\n');
    expect(await doSwitch('feature', 'commit')).toEqual({ ok: true, branch: 'feature', switched: true });
    expect(await currentBranch(run, repo)).toBe('feature');
    // The commit belongs to main's history, not feature's.
    const mainTree = await raw('ls-tree', '-r', '--name-only', 'refs/heads/main');
    expect(mainTree.stdout).toContain('NOTES.md');
    const featureTree = await raw('ls-tree', '-r', '--name-only', 'HEAD');
    expect(featureTree.stdout).not.toContain('NOTES.md');
    expect(await countDirtyFiles(run, repo)).toBe(0);
  });

  it('Stash preserves the work on the user’s stash stack, then switches', async () => {
    await write('NOTES.md', '# scratch\n');
    await write('config.yaml', 'name: edited main content\n');
    expect(await doSwitch('feature', 'stash')).toEqual({ ok: true, branch: 'feature', switched: true });
    expect(await currentBranch(run, repo)).toBe('feature');
    expect(await countDirtyFiles(run, repo)).toBe(0);
    const stashes = await raw('stash', 'list');
    expect(stashes.stdout).toContain('OpenHeaders: switch to feature');
  });

  it('Discard drops tracked edits AND new files, then switches — nothing survives', async () => {
    await write('NOTES.md', '# scratch\n');
    await write('config.yaml', 'name: edited main content\n');
    expect(await doSwitch('feature', 'discard')).toEqual({ ok: true, branch: 'feature', switched: true });
    expect(await currentBranch(run, repo)).toBe('feature');
    expect(await countDirtyFiles(run, repo)).toBe(0);
    await expect(fs.access(path.join(repo, 'NOTES.md'))).rejects.toThrow();
    expect((await fs.readFile(path.join(repo, 'config.yaml'), 'utf-8')).trim()).toBe('name: feature content');
    const stashes = await raw('stash', 'list');
    expect(stashes.stdout.trim()).toBe('');
  });

  it('holds while a git operation is in progress (§3.3)', async () => {
    await fs.writeFile(path.join(repo, '.git', 'MERGE_HEAD'), 'deadbeef\n', 'utf-8');
    expect(await doSwitch('feature')).toMatchObject({ ok: false, reason: 'op-in-progress', detail: 'MERGE_HEAD' });
  });
});
