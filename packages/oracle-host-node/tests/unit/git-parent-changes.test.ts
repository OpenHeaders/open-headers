/**
 * A commit's change against each of its parents (`parent-changes`) — the
 * read that lists a merge's files, which `git log` leaves empty: a
 * group per parent in parent order with the parent's subject, a rename
 * at its new path, the files that differ from EVERY parent, and the
 * plain cases (one parent, the root, an unknown commit). Real git in a
 * scratch repo.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { parseCombinedNameStatus, readCommitParentChanges } from '../../src/git/parent-changes';
import { ensureWorkspaceRepo, listCommitLog, localHeadSha } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

let rootDir: string;
let run: GitRunner;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-parent-changes-'));
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  await ensureWorkspaceRepo(run, rootDir);
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const target = path.join(rootDir, rel);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, 'utf-8');
}

async function git(...args: string[]): Promise<number> {
  return (await run([...repoArgs(rootDir), ...args], { cwd: rootDir })).code;
}

async function commit(message: string): Promise<string> {
  await git('add', '-A');
  if ((await git('commit', '-m', message)) !== 0) throw new Error(`commit failed: ${message}`);
  const sha = await localHeadSha(run, rootDir);
  if (sha === null) throw new Error('no head');
  return sha;
}

/**
 * main and `feature` both change `both.txt`; main alone changes
 * `side.txt`; the feature alone adds `added.txt` and moves `keep.txt`.
 * The merge settles `both.txt` to a third text.
 */
async function seedMerge(): Promise<{ root: string; main: string; feature: string; merge: string }> {
  await write('both.txt', 'a\nb\nc\n');
  await write('side.txt', 'x\n');
  await write('keep.txt', 'kept as it is\n');
  const root = await commit('base');
  const trunk = (await run([...repoArgs(rootDir), 'symbolic-ref', '--short', 'HEAD'], { cwd: rootDir })).stdout.trim();
  await git('checkout', '-b', 'feature');
  await write('both.txt', 'a\nfeature\nc\n');
  await write('added.txt', 'new\n');
  await git('mv', 'keep.txt', 'moved.txt');
  const feature = await commit('feature: its change');
  await git('checkout', trunk);
  await write('both.txt', 'a\nmain\nc\n');
  await write('side.txt', 'x2\n');
  const main = await commit('main: its change');
  expect(await git('merge', '--no-ff', 'feature')).not.toBe(0);
  await write('both.txt', 'a\nsettled\nc\n');
  const merge = await commit('merge feature');
  return { root, main, feature, merge };
}

const byPath = (files: ReadonlyArray<{ status: string; path: string }>): string[] =>
  files.map((file) => `${file.status} ${file.path}`).sort();

describe('readCommitParentChanges', () => {
  it('lists a merge against each parent, in parent order, each with its subject', async () => {
    const { main, feature, merge } = await seedMerge();
    const changes = await readCommitParentChanges(run, rootDir, merge);
    expect(changes?.parents.map((parent) => [parent.sha, parent.subject])).toEqual([
      [main, 'main: its change'],
      [feature, 'feature: its change'],
    ]);
    expect(byPath(changes?.parents[0].files ?? [])).toEqual(['A added.txt', 'M both.txt', 'R moved.txt']);
    expect(byPath(changes?.parents[1].files ?? [])).toEqual(['M both.txt', 'M side.txt']);
  });

  it('names the files that differ from every parent', async () => {
    const { merge } = await seedMerge();
    expect((await readCommitParentChanges(run, rootDir, merge))?.merged).toEqual([{ status: 'M', path: 'both.txt' }]);
  });

  it('is what the log leaves out: a merge lists no files there', async () => {
    const { merge } = await seedMerge();
    const log = await listCommitLog(run, rootDir, 5);
    expect(log?.find((entry) => entry.sha === merge)?.files).toEqual([]);
  });

  it('answers one group for a plain commit and none for the root', async () => {
    const { root, main } = await seedMerge();
    const plain = await readCommitParentChanges(run, rootDir, main);
    expect(plain?.parents.map((parent) => parent.sha)).toEqual([root]);
    expect(byPath(plain?.parents[0].files ?? [])).toEqual(['M both.txt', 'M side.txt']);
    expect(plain?.merged).toEqual([]);
    expect(await readCommitParentChanges(run, rootDir, root)).toEqual({ parents: [], merged: [] });
  });

  it('refuses anything but a full sha the repo holds', async () => {
    const { merge } = await seedMerge();
    expect(await readCommitParentChanges(run, rootDir, merge.slice(0, 12))).toBeNull();
    expect(await readCommitParentChanges(run, rootDir, 'HEAD~1')).toBeNull();
    expect(await readCommitParentChanges(run, rootDir, '0'.repeat(40))).toBeNull();
  });
});

describe('parseCombinedNameStatus', () => {
  it('reads one change per record: added or deleted when every parent says so', () => {
    expect(parseCombinedNameStatus('MM\0both.txt\0AA\0new.txt\0DD\0gone.txt\0AM\0mixed.txt\0MMM\0three.txt\0')).toEqual(
      [
        { status: 'M', path: 'both.txt' },
        { status: 'A', path: 'new.txt' },
        { status: 'D', path: 'gone.txt' },
        { status: 'M', path: 'mixed.txt' },
        { status: 'M', path: 'three.txt' },
      ],
    );
  });
});
