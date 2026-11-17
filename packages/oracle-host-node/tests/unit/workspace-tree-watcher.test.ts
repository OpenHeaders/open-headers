/**
 * Watcher — debounced quiescence signaling over a real (tmp)
 * filesystem, with `.oh/` traffic ignored (sidecar writes must never
 * wake the sweep); and the git directory's watch over a real repo — a
 * checkout, and a ref that moved with HEAD where it was.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { GitDirWatcher } from '../../src/workspace-tree/git-dir-watcher';
import { WorkspaceTreeWatcher } from '../../src/workspace-tree/watcher';

let tmpDir: string;
let watcher: WorkspaceTreeWatcher | null = null;
let gitDirWatcher: GitDirWatcher | null = null;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-watch-'));
});

afterEach(async () => {
  watcher?.dispose();
  watcher = null;
  gitDirWatcher?.dispose();
  gitDirWatcher = null;
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

describe('GitDirWatcher', () => {
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

  const moves = { head: 0, ref: 0 };
  // The watcher runs at its own quiet window. A platform may hand one git
  // command's events over in more than one delivery (macOS, about 50 ms
  // apart on a busy machine): inside the window they are one burst, and
  // the settle outlasts the window after the last of them.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

  /** Watch `dir`'s git directory, the bursts counted from here on (FSEvents replays what came just before a watch). */
  async function watchGitDir(dir: string): Promise<void> {
    gitDirWatcher = new GitDirWatcher({
      rootDir: dir,
      onHeadMove: () => (moves.head += 1),
      onRefMove: () => (moves.ref += 1),
    });
    expect(await gitDirWatcher.start()).toBe(true);
    await settle();
    moves.head = 0;
    moves.ref = 0;
  }

  it('fires once per checkout burst on a plain clone — the branch made with it is the same burst', async () => {
    const repo = path.join(tmpDir, 'repo');
    await seedRepo(repo);
    await watchGitDir(repo);

    await git(repo, 'checkout', '--quiet', '-b', 'feature');
    await waitFor(() => moves.head > 0);
    await settle();
    expect(moves).toEqual({ head: 1, ref: 0 });
  });

  it('follows a linked worktree gitfile to the per-worktree HEAD and the shared refs (§3.4 layouts)', {
    timeout: 15_000,
  }, async () => {
    const main = path.join(tmpDir, 'main');
    const wt = path.join(tmpDir, 'wt');
    await seedRepo(main);
    const added = await git(main, 'worktree', 'add', '--quiet', wt, '-b', 'wt-branch');
    expect(added.code).toBe(0);
    expect((await fs.stat(path.join(wt, '.git'))).isFile()).toBe(true);
    await git(main, 'branch', 'packed');
    expect((await git(main, 'pack-refs', '--all')).code).toBe(0);
    await watchGitDir(wt);

    // A checkout in the MAIN tree moves the main HEAD only — the
    // worktree hears the branch it made, in the directory both share,
    // and no HEAD of its own; a checkout inside the worktree moves the
    // per-worktree HEAD and fires.
    await git(main, 'checkout', '--quiet', '-b', 'main-side');
    await waitFor(() => moves.ref > 0);
    await settle();
    expect(moves).toEqual({ head: 0, ref: 1 });
    await git(wt, 'checkout', '--quiet', '-b', 'wt-side');
    await waitFor(() => moves.head > 0);
    await settle();
    expect(moves).toEqual({ head: 1, ref: 1 });
    // A packed ref is a line of the shared directory's one file.
    expect((await git(main, 'branch', '-D', 'packed')).code).toBe(0);
    await waitFor(() => moves.ref > 1);
    await settle();
    expect(moves).toEqual({ head: 1, ref: 2 });
  });

  it('hears a branch and a tag made and deleted with HEAD where it was', { timeout: 15_000 }, async () => {
    const repo = path.join(tmpDir, 'repo');
    await seedRepo(repo);
    await watchGitDir(repo);

    const steps = [
      ['branch', 'feature/outside'],
      ['branch', '-D', 'feature/outside'],
      ['tag', 'v1'],
      ['tag', '-d', 'v1'],
    ];
    for (const [index, step] of steps.entries()) {
      expect((await git(repo, ...step)).code).toBe(0);
      await waitFor(() => moves.ref > index);
      await settle();
      expect(moves).toEqual({ head: 0, ref: index + 1 });
    }
  });

  it('hears a commit on the checked-out branch as a ref', async () => {
    const repo = path.join(tmpDir, 'repo');
    await seedRepo(repo);
    await watchGitDir(repo);

    await fs.writeFile(path.join(repo, 'workspace.yaml'), 'schemaVersion: 5\nuid: wsaaaaaa\nname: Probed\n', 'utf-8');
    expect((await git(repo, 'commit', '--quiet', '-am', 'Rename')).code).toBe(0);
    await waitFor(() => moves.ref > 0);
    await settle();
    expect(moves).toEqual({ head: 0, ref: 1 });
  });

  it('hears a packed ref deleted — nothing under refs/ is its own', async () => {
    const repo = path.join(tmpDir, 'repo');
    await seedRepo(repo);
    await git(repo, 'branch', 'packed');
    expect((await git(repo, 'pack-refs', '--all')).code).toBe(0);
    await expect(fs.stat(path.join(repo, '.git', 'refs', 'heads', 'packed'))).rejects.toThrow();
    await watchGitDir(repo);

    expect((await git(repo, 'branch', '-D', 'packed')).code).toBe(0);
    await waitFor(() => moves.ref > 0);
    await settle();
    expect(moves).toEqual({ head: 0, ref: 1 });
  });

  it('stays quiet under a fetch that brings nothing, and hears one that brings a ref', async () => {
    const origin = path.join(tmpDir, 'origin');
    const clone = path.join(tmpDir, 'clone');
    await seedRepo(origin);
    expect((await run(['clone', '--quiet', origin, clone], { cwd: tmpDir })).code).toBe(0);
    await watchGitDir(clone);

    expect((await git(clone, 'fetch', '--quiet')).code).toBe(0);
    await settle();
    expect(moves).toEqual({ head: 0, ref: 0 });

    await git(origin, 'branch', 'topic');
    expect((await git(clone, 'fetch', '--quiet')).code).toBe(0);
    await waitFor(() => moves.ref > 0);
    await settle();
    expect(moves).toEqual({ head: 0, ref: 1 });
  });

  it('does not take a lock for a ref', async () => {
    const repo = path.join(tmpDir, 'repo');
    await seedRepo(repo);
    await watchGitDir(repo);

    const lock = path.join(repo, '.git', 'refs', 'heads', 'main.lock');
    await fs.writeFile(lock, '', 'utf-8');
    await fs.rm(lock);
    await fs.writeFile(path.join(repo, '.git', 'packed-refs.lock'), '', 'utf-8');
    await fs.rm(path.join(repo, '.git', 'packed-refs.lock'));
    await settle();
    expect(moves).toEqual({ head: 0, ref: 0 });
  });
});
