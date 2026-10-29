/**
 * Watcher — debounced quiescence signaling over a real (tmp)
 * filesystem, with `.oh/` traffic ignored (sidecar writes must never
 * wake the sweep).
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { GitHeadWatcher } from '../../src/workspace-tree/head-watcher';
import { WorkspaceTreeWatcher } from '../../src/workspace-tree/watcher';

let tmpDir: string;
let watcher: WorkspaceTreeWatcher | null = null;
let headWatcher: GitHeadWatcher | null = null;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-watch-'));
});

afterEach(async () => {
  watcher?.dispose();
  watcher = null;
  headWatcher?.dispose();
  headWatcher = null;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const waitFor = async (predicate: () => boolean, timeoutMs = 2_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

describe('WorkspaceTreeWatcher', () => {
  it('collapses an edit burst into one quiescence callback', async () => {
    let calls = 0;
    watcher = new WorkspaceTreeWatcher({ rootDir: tmpDir, debounceMs: 50, onQuiescence: () => (calls += 1) });
    expect(watcher.start()).toBe(true);

    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'a\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'workspace.yaml'), 'b\n', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'README.md'), 'c\n', 'utf-8');

    await waitFor(() => calls > 0);
    expect(calls).toBe(1);
  });

  it('ignores sidecar traffic under .oh/', async () => {
    await fs.mkdir(path.join(tmpDir, '.oh'), { recursive: true });
    let calls = 0;
    watcher = new WorkspaceTreeWatcher({ rootDir: tmpDir, debounceMs: 50, onQuiescence: () => (calls += 1) });
    watcher.start();
    // macOS FSEvents replays just-before-watch history (the tmp dir's
    // own creation), which conservatively bumps once — a harmless
    // no-op sweep in production. Let the replay settle, then assert
    // that NAMED sidecar traffic never wakes the sweep.
    await new Promise((resolve) => setTimeout(resolve, 300));
    calls = 0;

    await fs.writeFile(path.join(tmpDir, '.oh', 'materialized-index.json'), '{}', 'utf-8');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(calls).toBe(0);
  });
});

describe('GitHeadWatcher', () => {
  const IDENTITY_ENV = {
    GIT_AUTHOR_NAME: 'Probe Operator',
    GIT_AUTHOR_EMAIL: 'probe-operator@users.noreply.openheaders.io',
    GIT_COMMITTER_NAME: 'Probe Operator',
    GIT_COMMITTER_EMAIL: 'probe-operator@users.noreply.openheaders.io',
  };
  const base = createGitExec();
  const run: GitRunner = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  const git = (dir: string, ...args: string[]) =>
    run(['--git-dir', path.join(dir, '.git'), '--work-tree', dir, ...args], { cwd: dir });

  async function seedRepo(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    await run(['init', '--quiet', dir], { cwd: dir });
    await git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    await fs.writeFile(path.join(dir, 'workspace.yaml'), 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probe\n', 'utf-8');
    await git(dir, 'add', 'workspace.yaml');
    await git(dir, 'commit', '--quiet', '-m', 'Initial tree');
  }

  it('fires once per checkout burst on a plain clone', async () => {
    const repo = path.join(tmpDir, 'repo');
    await seedRepo(repo);
    let moves = 0;
    headWatcher = new GitHeadWatcher({ rootDir: repo, debounceMs: 50, onHeadMove: () => (moves += 1) });
    expect(await headWatcher.start()).toBe(true);

    await git(repo, 'checkout', '--quiet', '-b', 'feature');
    await waitFor(() => moves > 0);
    expect(moves).toBe(1);
  });

  it('follows a linked worktree gitfile to the per-worktree HEAD (§3.4 layouts)', async () => {
    const main = path.join(tmpDir, 'main');
    const wt = path.join(tmpDir, 'wt');
    await seedRepo(main);
    const added = await git(main, 'worktree', 'add', '--quiet', wt, '-b', 'wt-branch');
    expect(added.code).toBe(0);
    expect((await fs.stat(path.join(wt, '.git'))).isFile()).toBe(true);

    let moves = 0;
    headWatcher = new GitHeadWatcher({ rootDir: wt, debounceMs: 50, onHeadMove: () => (moves += 1) });
    expect(await headWatcher.start()).toBe(true);

    // A checkout in the MAIN tree moves the main HEAD only — the
    // worktree watcher stays quiet; a checkout inside the worktree
    // moves the per-worktree HEAD and fires.
    await git(main, 'checkout', '--quiet', '-b', 'main-side');
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(moves).toBe(0);
    await git(wt, 'checkout', '--quiet', '-b', 'wt-side');
    await waitFor(() => moves > 0);
    expect(moves).toBe(1);
  });
});
