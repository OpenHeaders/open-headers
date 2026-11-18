/**
 * What a pass wrote, by its writers' account (`pass-writes.ts`), on real
 * git in a scratch repo: a file that came into git's sight while the
 * pass ran, or left it, is not the pass's write; and the paths a commit
 * staged from a tree may carry are asked at their own name — never
 * through a link, never taking for gone what will not be looked at.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import { snapshotWorkingTree } from '../../src/git/tree-ops';
import { readPassWrites, recordablePaths } from '../../src/workspace-tree/pass-writes';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

let scratch: string;
let rootDir: string;
let outside: string;
let run: GitRunner;

const inTree = (file: string): string => path.join(rootDir, ...file.split('/'));

async function git(...args: string[]): Promise<string> {
  const result = await run([...repoArgs(rootDir), ...args], { cwd: rootDir });
  if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

async function write(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(inTree(file)), { recursive: true });
  await fs.writeFile(inTree(file), text);
}

async function commit(message: string): Promise<void> {
  await git('add', '-A');
  await git('commit', '-q', '-m', message);
}

/** The working tree read as a tree object, as a pass reads it before it writes. */
async function reading(): Promise<string> {
  const tree = await snapshotWorkingTree(run, rootDir);
  if (tree === null) throw new Error('the working tree could not be read');
  return tree;
}

beforeEach(async () => {
  scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oh-pass-writes-')));
  rootDir = path.join(scratch, 'bound');
  outside = path.join(scratch, 'outside');
  await fs.mkdir(rootDir);
  await fs.mkdir(outside);
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  await ensureWorkspaceRepo(run, rootDir);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(scratch, { recursive: true, force: true });
});

describe('readPassWrites — the writers’ account laid over the reading', () => {
  it('a file an ignore file the pass wrote brought into sight is not the pass’s write', async () => {
    await write('.gitignore', '/notes.txt\n');
    await write('notes.txt', 'my own notes\n');
    await commit('base');
    const before = await reading();

    await write('.gitignore', '');
    const pass = await readPassWrites(run, rootDir, before, ['.gitignore']);
    expect(pass?.wrote).toEqual(['.gitignore']);
    expect(await git('ls-tree', '-r', '--name-only', pass?.after ?? '')).toBe('.gitignore');
    expect([...(pass?.uncommitted ?? [])]).toEqual([]);
  });

  it('a file an ignore file the pass wrote hid is not the pass’s write, and stays the uncommitted work it was', async () => {
    await write('.gitignore', '');
    await commit('base');
    await write('notes.txt', 'my own notes\n');
    const before = await reading();

    await write('.gitignore', '/notes.txt\n');
    const pass = await readPassWrites(run, rootDir, before, ['.gitignore']);
    expect(pass?.wrote).toEqual(['.gitignore']);
    expect(await git('ls-tree', '-r', '--name-only', pass?.after ?? '')).toBe('.gitignore\nnotes.txt');
    expect([...(pass?.uncommitted ?? [])]).toEqual(['notes.txt']);
  });

  it('a path a writer names that stands as the reading has it is no write', async () => {
    await write('docs/guide.md', '# guide\n');
    await commit('base');
    const before = await reading();
    await write('docs/other.md', '# other\n');
    expect((await readPassWrites(run, rootDir, before, ['docs/guide.md', 'docs/other.md']))?.wrote).toEqual([
      'docs/other.md',
    ]);
  });
});

describe('recordablePaths — what a commit staged from a tree may carry', () => {
  it('carries a path the tree holds, and one neither the tree nor the folder holds: a deletion', async () => {
    await write('docs/guide.md', '# guide\n');
    await write('docs/gone.md', '# gone\n');
    await commit('base');
    await fs.rm(inTree('docs/gone.md'));
    expect(await recordablePaths(run, rootDir, await reading(), ['docs/guide.md', 'docs/gone.md'])).toEqual([
      'docs/guide.md',
      'docs/gone.md',
    ]);
    expect(await recordablePaths(run, rootDir, 'not-a-tree', ['docs/guide.md'])).toBeNull();
  });

  it('leaves out a file standing where the tree holds none — one git ignores', async () => {
    await write('.gitignore', '*.log\n');
    await commit('base');
    await write('keep.log', 'the local one\n');
    expect(await recordablePaths(run, rootDir, await reading(), ['keep.log', '.gitignore'])).toEqual(['.gitignore']);
  });

  it('leaves out a path through a link, whatever stands where the link points', async () => {
    await write('workspace.yaml', 'schemaVersion: 5\n');
    await commit('base');
    await fs.symlink(outside, inTree('rules'));
    const tree = await reading();
    // Nothing where the link points: asked through it, the path would read as gone and be carried as a deletion.
    expect(await recordablePaths(run, rootDir, tree, ['rules/rule.yaml'])).toEqual([]);
    await fs.writeFile(path.join(outside, 'rule.yaml'), 'another folder’s\n');
    expect(await recordablePaths(run, rootDir, tree, ['rules/rule.yaml'])).toEqual([]);
  });

  it.each(['EACCES', 'EPERM'])('leaves out a name that will not be looked at (%s)', async (code) => {
    await write('workspace.yaml', 'schemaVersion: 5\n');
    await commit('base');
    const tree = await reading();
    const lstat = fs.lstat.bind(fs);
    vi.spyOn(fs, 'lstat').mockImplementation((...args: Parameters<typeof fs.lstat>) =>
      String(args[0]).endsWith('rule.yaml') ? Promise.reject(Object.assign(new Error(code), { code })) : lstat(...args),
    );
    expect(await recordablePaths(run, rootDir, tree, ['rules/rule.yaml', 'rules/gone.yaml'])).toEqual([
      'rules/gone.yaml',
    ]);
  });
});
