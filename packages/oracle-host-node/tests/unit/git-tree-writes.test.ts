/**
 * The watch of git's writes to the working tree (`tree-writes`). A git
 * command that replaces files holds the index's lock while it does and
 * leaves a new index behind, so a stretch read with either in sight may
 * have seen a file between its removal and its write.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import { watchTreeWrites } from '../../src/git/tree-writes';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

let rootDir: string;
let run: GitRunner;

const git = async (...args: string[]): Promise<void> => {
  const result = await run([...repoArgs(rootDir), ...args], { cwd: rootDir });
  if (result.code !== 0) throw new Error(result.stderr);
};

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-writes-'));
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  await ensureWorkspaceRepo(run, rootDir);
  await fs.writeFile(path.join(rootDir, 'notes.md'), 'notes v1\n');
  await git('add', '-A');
  await git('commit', '-q', '-m', 'notes');
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

describe('watchTreeWrites', () => {
  it('a repo at rest meets nothing, however often it is asked', async () => {
    const watch = await watchTreeWrites(rootDir);
    expect(await watch.met()).toBe(false);
    expect(await watch.met()).toBe(false);
  });

  it('the index lock held is met, and no longer once it is given up', async () => {
    const watch = await watchTreeWrites(rootDir);
    const lock = path.join(rootDir, '.git', 'index.lock');
    await fs.writeFile(lock, '');
    expect(await watch.met()).toBe(true);
    await fs.rm(lock);
    expect(await watch.met()).toBe(false);
  });

  it('a checkout that came and went is met by the index it left', async () => {
    await git('checkout', '-q', '-b', 'side');
    await fs.writeFile(path.join(rootDir, 'notes.md'), 'notes v2\n');
    await git('commit', '-q', '-am', 'notes v2');

    const watch = await watchTreeWrites(rootDir);
    await git('checkout', '-q', '-');
    expect(await watch.met()).toBe(true);
    // A watch begun after it sees a repo at rest again.
    expect(await (await watchTreeWrites(rootDir)).met()).toBe(false);
  });

  it('a folder with no repo meets nothing', async () => {
    const bare = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-tree-writes-none-'));
    try {
      expect(await (await watchTreeWrites(bare)).met()).toBe(false);
    } finally {
      await fs.rm(bare, { recursive: true, force: true });
    }
  });
});
