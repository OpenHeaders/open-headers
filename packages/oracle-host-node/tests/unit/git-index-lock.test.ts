/**
 * The index lock's copies keep git's clock (`index-lock`). Git reads an
 * index's own time to know which files it must compare by content — one
 * whose recorded time is not older than the index may have been
 * rewritten in the same instant, at the same size. So the index a lock
 * holds carries the real index's time, and the index it publishes
 * carries the time the lock was last written: a copy stamped "now" would
 * read such a file as unchanged.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { acquireIndexLock } from '../../src/git/index-lock';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

/** A time well in the past, whole seconds — what a file system and git both keep. */
const THEN = new Date('2026-01-02T03:04:05.000Z');
const LATER = new Date('2026-01-02T03:04:09.000Z');

let rootDir: string;
let run: GitRunner;
let indexPath: string;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-index-lock-'));
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  await ensureWorkspaceRepo(run, rootDir);
  await fs.writeFile(path.join(rootDir, 'notes.md'), 'notes v1\n');
  await run([...repoArgs(rootDir), 'add', '-A'], { cwd: rootDir });
  indexPath = path.join(rootDir, '.git', 'index');
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

const writtenAt = async (file: string): Promise<number> => (await fs.stat(file)).mtime.getTime();

describe('acquireIndexLock', () => {
  it('the index the lock holds carries the real index’s time', async () => {
    await fs.utimes(indexPath, THEN, THEN);
    const acquired = await acquireIndexLock(run, rootDir);
    if (!acquired.ok) throw new Error(acquired.detail);
    try {
      expect(await writtenAt(acquired.lock.env.GIT_INDEX_FILE)).toBe(THEN.getTime());
    } finally {
      await acquired.lock.release();
    }
  });

  it('the index it publishes carries the time the lock was last written', async () => {
    await fs.utimes(indexPath, THEN, THEN);
    const acquired = await acquireIndexLock(run, rootDir);
    if (!acquired.ok) throw new Error(acquired.detail);
    try {
      // A git call wrote the lock's index at LATER.
      await fs.utimes(acquired.lock.env.GIT_INDEX_FILE, LATER, LATER);
      expect(await acquired.lock.publish()).toBe(true);
      expect(await writtenAt(indexPath)).toBe(LATER.getTime());
    } finally {
      await acquired.lock.release();
    }
  });
});
