/**
 * The user's own files across an integration and the folder's boundary
 * (`own-files.ts`), on real git in a scratch repo: what the landing
 * writes and removes itself — an answered file, an answer that the file
 * is gone — is asked of the boundary before anything is written, and
 * again once git has landed the foreign side's files. A link is never
 * written or removed through; what git's own checkout lands is git's.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import { landForeignOwnFiles } from '../../src/workspace-tree/own-files';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

const README = 'notes/readme.md';

let scratch: string;
let rootDir: string;
let outside: string;
let run: GitRunner;
let baseRef: string;

const inTree = (file: string): string => path.join(rootDir, ...file.split('/'));
const read = (file: string): Promise<string | null> => fs.readFile(file, 'utf8').catch(() => null);

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

/** The branch `theirs` off the base, made by `change`; the branch then holds its own edit of the readme. */
async function bothSidesChangeTheReadme(change: () => Promise<void>): Promise<void> {
  const branch = await git('rev-parse', '--abbrev-ref', 'HEAD');
  await git('checkout', '-q', '-b', 'theirs');
  await change();
  await commit('theirs');
  await git('checkout', '-q', branch);
  await write(README, 'ours\n');
  await commit('ours');
}

const land = (answer: string) =>
  landForeignOwnFiles(run, rootDir, { baseRef, foreignRef: 'theirs' }, new Map([[README, answer]]));

beforeEach(async () => {
  scratch = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'oh-own-files-')));
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
  await write(README, 'base\n');
  await commit('base');
  baseRef = await git('rev-parse', 'HEAD');
});

afterEach(async () => {
  await fs.rm(scratch, { recursive: true, force: true });
});

describe('landForeignOwnFiles — the folder’s boundary', () => {
  /** The foreign side edits the readme and adds a file; here the readme's directory is then a link out of the folder. */
  async function theReadmeLiesThroughALink(): Promise<void> {
    await bothSidesChangeTheReadme(async () => {
      await write(README, 'theirs\n');
      await write('other.md', 'theirs alone\n');
    });
    await fs.rename(inTree('notes'), path.join(outside, 'notes'));
    await fs.symlink(path.join(outside, 'notes'), inTree('notes'));
  }
  const REFUSED = { ok: false, detail: '"notes/" is a link, on the way to "notes/readme.md"' };

  it('an answered file whose directory is a link here is not written through it: the landing fails with nothing done', async () => {
    await theReadmeLiesThroughALink();
    expect(await land('answered\n')).toEqual(REFUSED);
    expect(await read(path.join(outside, 'notes', 'readme.md'))).toBe('ours\n');
    // Refused before git landed anything: the foreign side's own file is not here.
    expect(await read(inTree('other.md'))).toBeNull();
  });

  it('an answer that the file is gone does not remove it through a link', async () => {
    await theReadmeLiesThroughALink();
    expect(await land('')).toEqual(REFUSED);
    expect(await read(path.join(outside, 'notes', 'readme.md'))).toBe('ours\n');
  });

  it('a link standing at the answered file’s own name is replaced, never written through — and the rest lands', async () => {
    const victim = path.join(outside, 'victim.txt');
    await fs.writeFile(victim, 'as its owner left it\n');
    await bothSidesChangeTheReadme(async () => {
      await write(README, 'theirs\n');
      await write('other.md', 'theirs alone\n');
    });
    await fs.rm(inTree(README));
    await fs.symlink(victim, inTree(README));

    expect(await land('answered\n')).toEqual({ ok: true, landed: [README, 'other.md'], kept: [] });
    expect(await read(victim)).toBe('as its owner left it\n');
    expect((await fs.lstat(inTree(README))).isFile()).toBe(true);
    expect(await read(inTree(README))).toBe('answered\n');
    expect(await read(inTree('other.md'))).toBe('theirs alone\n');
  });

  describe('the foreign side put a link where the readme’s directory was, and git lands it in this pass', () => {
    /** The directory is gone from the folder here, so nothing stands where the foreign side's link lands. */
    async function theForeignSideLinksTheDirectory(): Promise<void> {
      await fs.writeFile(path.join(outside, 'readme.md'), 'as its owner left it\n');
      await bothSidesChangeTheReadme(async () => {
        await fs.rm(inTree('notes'), { recursive: true });
        await fs.symlink(outside, inTree('notes'));
      });
      await fs.rm(inTree('notes'), { recursive: true });
    }

    it('an answer that the file is gone removes nothing through the link git has just landed', async () => {
      await theForeignSideLinksTheDirectory();
      expect(await land('')).toEqual(REFUSED);
      expect((await fs.lstat(inTree('notes'))).isSymbolicLink()).toBe(true);
      expect(await read(path.join(outside, 'readme.md'))).toBe('as its owner left it\n');
    });

    it('an answered file is not written through it either', async () => {
      await theForeignSideLinksTheDirectory();
      expect(await land('answered\n')).toEqual(REFUSED);
      expect(await read(path.join(outside, 'readme.md'))).toBe('as its owner left it\n');
    });
  });
});
