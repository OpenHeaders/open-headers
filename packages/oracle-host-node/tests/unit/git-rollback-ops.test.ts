/**
 * Rollback of working changes (`rollback-ops`) — the Commit window's
 * Rollback Changes, on real git in a scratch repo: a changed or deleted
 * file HEAD holds is HEAD's again; an added file leaves the index and
 * stays on disk (or is deleted when asked); a renamed file goes back
 * under its old name; a path that is not a change row — clean,
 * unversioned — is left alone, as is every change that was not named. A
 * path is literal, never a pattern. The index is written under its lock:
 * a busy lock refuses with nothing written, and what the user staged
 * elsewhere survives the rollback. A file rewritten at the same size
 * within the second git last looked at it is rolled back all the same —
 * the index the lock holds keeps the real index's own time, which is
 * what git reads to know such a file must be compared by content.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveGitDirs } from '../../src/git/git-dir';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { ensureWorkspaceRepo, listWorkingChanges } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import { planRollback, rollbackWorkingPaths } from '../../src/git/rollback-ops';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'John Doe',
  GIT_AUTHOR_EMAIL: 'john@openheaders.io',
  GIT_COMMITTER_NAME: 'John Doe',
  GIT_COMMITTER_EMAIL: 'john@openheaders.io',
};

let rootDir: string;
let run: GitRunner;

beforeEach(async () => {
  rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-rollback-'));
  const base = createGitExec({ audit: () => undefined });
  run = (args, options) =>
    base(args, {
      ...options,
      env: { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', ...IDENTITY_ENV, ...options.env },
    });
  await ensureWorkspaceRepo(run, rootDir);
  await write('docs/guide.md', 'guide v1\n');
  await write('docs/setup.md', 'setup v1\n');
  await write('notes.md', 'notes v1\n');
  await write('notes[1].md', 'bracket v1\n');
  await write('notes1.md', 'plain v1\n');
  await git('add', '-A');
  await git('commit', '-q', '-m', 'seed');
});

afterEach(async () => {
  await fs.rm(rootDir, { recursive: true, force: true });
});

async function git(...args: string[]): Promise<string> {
  const result = await run([...repoArgs(rootDir), ...args], { cwd: rootDir });
  if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

async function write(file: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(path.join(rootDir, file)), { recursive: true });
  await fs.writeFile(path.join(rootDir, file), text);
}

const read = (file: string): Promise<string | null> => fs.readFile(path.join(rootDir, file), 'utf8').catch(() => null);

/** `XY path` per change, as porcelain lists them. */
async function status(): Promise<string[]> {
  return (await git('status', '--porcelain', '--untracked-files=all'))
    .split('\n')
    .filter((line) => line.length > 0)
    .sort();
}

describe('rollbackWorkingPaths', () => {
  it('a changed and a deleted file HEAD holds are HEAD’s again — a change that was not named stays', async () => {
    await write('docs/guide.md', 'guide v2\n');
    await fs.rm(path.join(rootDir, 'docs/setup.md'));
    await write('notes.md', 'notes v2\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['docs/guide.md', 'docs/setup.md'])).toEqual({
      ok: true,
      rolledBack: 2,
    });
    expect(await read('docs/guide.md')).toBe('guide v1\n');
    expect(await read('docs/setup.md')).toBe('setup v1\n');
    expect(await read('notes.md')).toBe('notes v2\n');
    expect(await status()).toEqual([' M notes.md']);
  });

  it('a staged change is rolled back too — the index entry returns to HEAD’s with the file', async () => {
    await write('notes.md', 'notes staged\n');
    await git('add', 'notes.md');
    await write('notes.md', 'notes staged, then edited\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['notes.md'])).toEqual({ ok: true, rolledBack: 1 });
    expect(await read('notes.md')).toBe('notes v1\n');
    expect(await status()).toEqual([]);
  });

  it('an added file leaves the index and stays on disk, unversioned — an intent-to-add and a staged one alike', async () => {
    await write('added.md', 'tracked by intent\n');
    await git('add', '-N', 'added.md');
    await write('staged.md', 'staged\n');
    await git('add', 'staged.md');
    await write('staged.md', 'staged, then edited\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['added.md', 'staged.md'])).toEqual({ ok: true, rolledBack: 2 });
    expect(await read('added.md')).toBe('tracked by intent\n');
    expect(await read('staged.md')).toBe('staged, then edited\n');
    expect(await status()).toEqual(['?? added.md', '?? staged.md']);
  });

  it('an added file is deleted from disk when asked — a changed file beside it is only restored', async () => {
    await write('added.md', 'tracked by intent\n');
    await git('add', '-N', 'added.md');
    await write('notes.md', 'notes v2\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['added.md', 'notes.md'], { deleteAdded: true })).toEqual({
      ok: true,
      rolledBack: 2,
    });
    expect(await read('added.md')).toBeNull();
    expect(await read('notes.md')).toBe('notes v1\n');
    expect(await status()).toEqual([]);
  });

  it('a renamed file goes back under its old name with HEAD’s content — staged by git, or by intent', async () => {
    await git('mv', 'docs/setup.md', 'docs/getting-started.md');
    await write('docs/getting-started.md', 'setup v1\nand a line more\n');
    await fs.rename(path.join(rootDir, 'docs/guide.md'), path.join(rootDir, 'docs/handbook.md'));
    await git('add', '-N', 'docs/handbook.md');
    const renamed = (await listWorkingChanges(run, rootDir)) ?? [];
    expect(renamed.map((row) => [row.path, row.renamedFrom])).toEqual([
      ['docs/getting-started.md', 'docs/setup.md'],
      ['docs/handbook.md', 'docs/guide.md'],
    ]);

    expect(await rollbackWorkingPaths(run, rootDir, ['docs/getting-started.md', 'docs/handbook.md'])).toEqual({
      ok: true,
      rolledBack: 2,
    });
    expect(await read('docs/getting-started.md')).toBeNull();
    expect(await read('docs/setup.md')).toBe('setup v1\n');
    expect(await read('docs/handbook.md')).toBeNull();
    expect(await read('docs/guide.md')).toBe('guide v1\n');
    expect(await status()).toEqual([]);
  });

  it('a file that goes takes the directories it leaves empty — one that still holds a file stands', async () => {
    await write('moved/deep/setup.md', 'setup v1\n');
    await fs.rm(path.join(rootDir, 'docs/setup.md'));
    await git('add', '-N', 'moved/deep/setup.md');
    await write('drafts/new/added.md', 'tracked by intent\n');
    await git('add', '-N', 'drafts/new/added.md');
    await write('drafts/loose.md', 'never added\n');

    expect(
      await rollbackWorkingPaths(run, rootDir, ['moved/deep/setup.md', 'drafts/new/added.md'], { deleteAdded: true }),
    ).toEqual({ ok: true, rolledBack: 2 });
    expect(await read('docs/setup.md')).toBe('setup v1\n');
    expect(await fs.readdir(rootDir)).not.toContain('moved');
    expect(await fs.readdir(path.join(rootDir, 'drafts'))).toEqual(['loose.md']);
    expect(await status()).toEqual(['?? drafts/loose.md']);
  });

  it('a path that is no change row is left alone — clean, unversioned, unknown', async () => {
    await write('loose.md', 'never added\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['notes.md', 'loose.md', 'nowhere.md'])).toEqual({
      ok: true,
      rolledBack: 0,
    });
    expect(await read('loose.md')).toBe('never added\n');
    expect(await status()).toEqual(['?? loose.md']);
  });

  it('a path is literal, never a pattern', async () => {
    await write('notes[1].md', 'bracket v2\n');
    await write('notes1.md', 'plain v2\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['notes[1].md'])).toEqual({ ok: true, rolledBack: 1 });
    expect(await read('notes[1].md')).toBe('bracket v1\n');
    expect(await read('notes1.md')).toBe('plain v2\n');
  });

  it('a file rewritten at the same size, within the second git last looked at it, is rolled back', async () => {
    // Git's own stat of the file and the rewrite share one second, so only the index's time tells git to compare.
    for (;;) {
      await write('notes.md', 'notes v1\n');
      await git('add', 'notes.md');
      const looked = Math.floor((await fs.stat(path.join(rootDir, 'notes.md'))).mtimeMs / 1000);
      await write('notes.md', 'notes v2\n');
      const rewritten = Math.floor((await fs.stat(path.join(rootDir, 'notes.md'))).mtimeMs / 1000);
      const indexed = Math.floor((await fs.stat(path.join(rootDir, '.git', 'index'))).mtimeMs / 1000);
      if (looked === rewritten && indexed === looked) break;
    }
    expect(await status()).toEqual([' M notes.md']);
    // The rollback starts in a later second than the index was written in.
    await delay(1100);

    expect(await rollbackWorkingPaths(run, rootDir, ['notes.md'])).toEqual({ ok: true, rolledBack: 1 });
    expect(await read('notes.md')).toBe('notes v1\n');
    expect(await status()).toEqual([]);
  });

  it('what the user staged elsewhere survives the rollback', async () => {
    await write('notes1.md', 'plain staged\n');
    await git('add', 'notes1.md');
    await write('notes.md', 'notes v2\n');

    expect(await rollbackWorkingPaths(run, rootDir, ['notes.md'])).toEqual({ ok: true, rolledBack: 1 });
    expect(await status()).toEqual(['M  notes1.md']);
    expect(await git('show', ':notes1.md')).toBe('plain staged\n');
  });

  it('a busy index refuses with nothing written', async () => {
    await write('notes.md', 'notes v2\n');
    await write('added.md', 'tracked by intent\n');
    await git('add', '-N', 'added.md');
    const before = await status();
    const lock = path.join((await resolveGitDirs(rootDir)).gitDir, 'index.lock');
    await fs.writeFile(lock, '', { flag: 'wx' });
    try {
      const refused = await rollbackWorkingPaths(run, rootDir, ['notes.md', 'added.md'], { deleteAdded: true });
      expect(refused).toMatchObject({ ok: false, reason: 'index-locked' });
    } finally {
      await fs.rm(lock, { force: true });
    }
    expect(await read('notes.md')).toBe('notes v2\n');
    expect(await read('added.md')).toBe('tracked by intent\n');
    expect(await status()).toEqual(before);
  });
});

describe('planRollback', () => {
  const row = (filePath: string, status: string, renamedFrom?: string) => ({
    path: filePath,
    status,
    unversioned: false,
    ignored: false,
    ...(renamedFrom !== undefined ? { renamedFrom } : {}),
  });

  it('an origin that still stands with a row of its own is not restored by the copy’s rollback', () => {
    const plan = planRollback([row('copy.md', 'A', 'origin.md'), row('origin.md', 'M')], new Set(['origin.md']), [
      'copy.md',
    ]);
    expect(plan).toEqual({ restore: [], unadd: ['copy.md'], remove: ['copy.md'], rolledBack: 1 });
  });

  it('a path named twice is rolled back once; an ignored or unversioned row is no change of the verb’s', () => {
    const plan = planRollback(
      [row('a.md', 'M'), { path: 'b.md', status: '?', unversioned: true, ignored: false }],
      new Set(['a.md']),
      ['a.md', 'a.md', 'b.md'],
    );
    expect(plan).toEqual({ restore: ['a.md'], unadd: [], remove: [], rolledBack: 1 });
  });
});

describe('rollbackWorkingPaths — the folder’s boundary', () => {
  it('an added file whose directory has since become a link is not deleted through it: refused while nothing is put back', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-rollback-outside-'));
    try {
      await write('drafts/added.md', 'tracked by intent\n');
      await git('add', '-N', 'drafts/added.md');
      await write('notes.md', 'notes v2\n');
      await fs.rename(path.join(rootDir, 'drafts'), path.join(outside, 'drafts'));
      await fs.symlink(path.join(outside, 'drafts'), path.join(rootDir, 'drafts'));
      const before = await status();

      expect(await rollbackWorkingPaths(run, rootDir, ['drafts/added.md', 'notes.md'], { deleteAdded: true })).toEqual({
        ok: false,
        reason: 'rollback-failed',
        detail: '"drafts/" is a link, on the way to "drafts/added.md"',
      });
      expect(await fs.readFile(path.join(outside, 'drafts', 'added.md'), 'utf8')).toBe('tracked by intent\n');
      expect(await read('notes.md')).toBe('notes v2\n');
      expect(await status()).toEqual(before);
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });

  it('a link HEAD holds, put back by this rollback where a directory stood, carries no removal out: the folder is looked at anew', async () => {
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-rollback-outside-'));
    try {
      await fs.writeFile(path.join(outside, 'added.md'), 'as its owner left it\n');
      await fs.symlink(outside, path.join(rootDir, 'drafts'));
      await git('add', '-A');
      await git('commit', '-q', '-m', 'a link');
      // Here the link gave way to a directory with an added file in it.
      await fs.rm(path.join(rootDir, 'drafts'));
      await write('drafts/added.md', 'tracked by intent\n');
      await git('add', '-N', 'drafts/added.md');

      const result = await rollbackWorkingPaths(run, rootDir, ['drafts', 'drafts/added.md'], { deleteAdded: true });
      expect(result).toMatchObject({ ok: false, reason: 'rollback-failed' });
      expect(await fs.readFile(path.join(outside, 'added.md'), 'utf8')).toBe('as its owner left it\n');
    } finally {
      await fs.rm(outside, { recursive: true, force: true });
    }
  });
});
