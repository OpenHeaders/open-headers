/**
 * A whole history's skeleton (`log-skeleton`): every commit every ref
 * and the checked-out commit reach, in the log's order, as rows by
 * number — each row's parents the rows git names, each hash found again
 * by its row and each row by its hash or the start of it. And its
 * edges: a repo with no commit, a read nobody waits for, output cut
 * anywhere, a line that is no line of hashes, a parent the walk never
 * lists. Real git in scratch repos.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { createGitStream, type GitStreamRunner } from '../../src/git/git-stream';
import {
  type HistorySkeleton,
  historyRowOf,
  historyRowOfPrefix,
  historyShaOf,
  readLogSkeleton,
} from '../../src/git/log-skeleton';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const ISOLATED = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const JOHN = { name: 'John Doe', email: 'john.doe@openheaders.io' };

const base = createGitExec();
const run: GitRunner = (args, options) => base(args, { ...options, env: { ...ISOLATED, ...options.env } });
const real = createGitStream();
const stream: GitStreamRunner = (args, options, read) =>
  real(args, { ...options, env: { ...ISOLATED, ...options.env } }, read);

/** A stream that hands over `text` in pieces of the sizes given, round and round — no git behind it. */
const fed =
  (text: string, sizes: readonly number[]): GitStreamRunner =>
  async (_args, _options, read) => {
    let at = 0;
    for (let piece = 0; at < text.length; piece += 1) {
      const size = sizes[piece % sizes.length];
      await read(text.slice(at, at + size));
      at += size;
    }
    return { code: 0, stderr: '', spawnFailed: false, timedOut: false, aborted: false };
  };

const read = async (through: GitStreamRunner, rootDir: string, signal?: AbortSignal): Promise<HistorySkeleton> => {
  const result = await readLogSkeleton(through, run, rootDir, { timeoutMs: 20_000, ...(signal ? { signal } : {}) });
  if (!result.ok) throw new Error(`read refused: ${result.reason}`);
  return result.history;
};

/** The history as git's own lines: a row's hash, then the hashes its parents sit on. */
const lines = (history: HistorySkeleton): string[] => {
  const { count, starts, parents } = history.skeleton;
  return Array.from({ length: count }, (_, row) =>
    [row, ...parents.subarray(starts[row], starts[row + 1])]
      .map((at) => (at < count ? historyShaOf(history, at) : `outside${at - count}`))
      .join(' '),
  );
};

const REFS = ['--branches', '--tags', '--remotes'];

describe('the skeleton of a history', () => {
  let rootDir: string;
  let clock = 1_700_000_000;

  const git = async (args: string[]): Promise<string> => {
    clock += 60;
    const stamp = `${clock} +0000`;
    const result = await run([...repoArgs(rootDir), ...args], {
      cwd: rootDir,
      env: {
        GIT_AUTHOR_NAME: JOHN.name,
        GIT_AUTHOR_EMAIL: JOHN.email,
        GIT_COMMITTER_NAME: JOHN.name,
        GIT_COMMITTER_EMAIL: JOHN.email,
        GIT_AUTHOR_DATE: stamp,
        GIT_COMMITTER_DATE: stamp,
      },
    });
    if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout;
  };
  const commit = async (subject: string, file: string): Promise<void> => {
    await fs.writeFile(path.join(rootDir, file), `${subject}\n`, 'utf-8');
    await git(['add', '-A']);
    await git(['commit', '-m', subject]);
  };
  const walked = async (...revisions: string[]): Promise<string[]> =>
    (await git(['rev-list', '--date-order', '--parents', ...revisions])).split('\n').filter((line) => line.length > 0);

  beforeAll(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-skeleton-'));
    await ensureWorkspaceRepo(run, rootDir);
    const trunk = (await git(['symbolic-ref', '--short', 'HEAD'])).trim();
    await commit('Add orders request', 'orders.yaml');
    await commit('Fix response panel', 'panel.md');
    await git(['checkout', '-q', '-b', 'side']);
    await commit('Side work', 'side.txt');
    await git(['checkout', '-q', trunk]);
    await commit('Bump version', 'version.txt');
    await git(['merge', '-q', '--no-ff', 'side', '-m', 'Merge the side branch']);
    await git(['tag', 'v1']);
    await commit('Document the API', 'docs.md');
    await git(['checkout', '-q', '-b', 'other']);
    await commit('Unmerged spike', 'spike.txt');
    await git(['checkout', '-q', '--detach', 'HEAD~3']);
    await commit('Work on no branch', 'loose.txt');
  });

  afterAll(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('lists every commit every ref and the checked-out commit reach, in the log’s order, with git’s own parents', async () => {
    const history = await read(stream, rootDir);
    const expected = await walked(...REFS, 'HEAD');
    expect(expected).toHaveLength(8);
    expect(lines(history)).toEqual(expected);
    // The commit on no branch is there because HEAD is; a walk of the refs alone leaves it out.
    expect(await walked(...REFS)).toHaveLength(7);
    expect(history.width).toBe(20);
  });

  it('finds a row by its hash and by the start of one, and names the hash of a row', async () => {
    const history = await read(stream, rootDir);
    const shas = (await walked(...REFS, 'HEAD')).map((line) => line.slice(0, 40));
    for (const [row, sha] of shas.entries()) {
      expect(historyRowOf(history, sha)).toBe(row);
      expect(historyShaOf(history, row)).toBe(sha);
      expect(historyRowOfPrefix(history, sha.slice(0, 8))).toBe(row);
      expect(historyRowOfPrefix(history, sha.slice(0, 7))).toBe(row);
    }
    expect(historyRowOf(history, 'f'.repeat(40))).toBe(-1);
    expect(historyRowOf(history, shas[0].slice(0, 12))).toBe(-1);
    expect(historyRowOf(history, `${shas[0].slice(0, 39)}Z`)).toBe(-1);
    // An odd-length start is matched to its last character.
    const wrongLast = shas[0][6] === '0' ? '1' : '0';
    expect(historyRowOfPrefix(history, `${shas[0].slice(0, 6)}${wrongLast}`)).toBe(-1);
    expect(historyRowOfPrefix(history, '')).toBe(-1);
    expect(historyRowOfPrefix(history, 'not-hex')).toBe(-1);
  });

  it('is the same history however the output is cut', async () => {
    const whole = lines(await read(stream, rootDir));
    const text = `${whole.join('\n')}\n`;
    for (const sizes of [[1], [7, 3, 41], [40], [41], [1000]]) {
      expect(lines(await read(fed(text, sizes), rootDir))).toEqual(whole);
    }
  });

  it('numbers a parent the walk never lists past the history’s end — each one apart', async () => {
    const [a, b, gone1, gone2] = ['a', 'b', 'c', 'd'].map((letter) => letter.repeat(40));
    const history = await read(fed(`${a} ${b} ${gone1}\n${b} ${gone2} ${gone1}\n`, [13]), rootDir);
    expect(lines(history)).toEqual([`${a} ${b} outside0`, `${b} outside1 outside0`]);
  });

  it('refuses output that is no history', async () => {
    const sha = 'a'.repeat(40);
    for (const text of [`${sha} short\n`, 'not a hash\n', `${sha}\n${sha.slice(0, 20)}`]) {
      expect(await readLogSkeleton(fed(text, [9]), run, rootDir, { timeoutMs: 20_000 })).toEqual({
        ok: false,
        reason: 'failed',
      });
    }
  });

  it('ends when nobody waits for it', async () => {
    expect(await readLogSkeleton(stream, run, rootDir, { timeoutMs: 20_000, signal: AbortSignal.abort() })).toEqual({
      ok: false,
      reason: 'aborted',
    });
  });

  it('answers an empty history for a repo with no commit', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-skeleton-empty-'));
    try {
      await ensureWorkspaceRepo(run, empty);
      const history = await read(stream, empty);
      expect(history.skeleton.count).toBe(0);
      expect(historyRowOf(history, 'a'.repeat(40))).toBe(-1);
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});
