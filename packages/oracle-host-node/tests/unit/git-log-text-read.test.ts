/**
 * The texts of commits read from git (`log-text-read`): every commit
 * every ref and the checked-out commit reach with git's own author and
 * subject, however the output is cut; the commits named by hash alone,
 * a batch an invocation; and the edges — a repo with no commit, a read
 * nobody waits for, output that is no texts, a hash git does not hold.
 * Real git in a scratch repo.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { GitStreamRunner } from '../../src/git/git-stream';
import { readLogTexts, readLogTextsOf } from '../../src/git/log-text-read';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { EVERY_REF, JANE, openScratchRepo, run, type ScratchRepo, seedHistory, stream } from './_log-history-repo';

const OPTIONS = { timeoutMs: 20_000 };
const SEP = '\x1f';
const DONE = { code: 0, stderr: '', spawnFailed: false, timedOut: false, aborted: false };

type Row = [sha: string, authorName: string, subject: string];

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
    return DONE;
  };

describe('the texts of commits, read from git', () => {
  let repo: ScratchRepo;
  /** Git's own answer: every commit behind every ref, as `[hash, author, subject]`. */
  let own: Row[];

  const all = async (through: GitStreamRunner): Promise<Row[]> => {
    const rows: Row[] = [];
    const result = await readLogTexts(through, run, repo.rootDir, OPTIONS, (...row) => rows.push(row));
    if (!result.ok) throw new Error(`read refused: ${result.reason}`);
    return rows;
  };
  const bySha = (rows: readonly Row[]): Row[] => [...rows].sort((a, b) => a[0].localeCompare(b[0]));

  beforeAll(async () => {
    repo = await openScratchRepo('oh-log-text-read-');
    await seedHistory(repo);
    await repo.commit('Größe ändern — naïve café', 'notes.md', JANE);
    own = (await repo.git(['log', `--format=%H${SEP}%an${SEP}%s`, ...EVERY_REF]))
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => {
        const [sha, authorName, subject] = line.split(SEP);
        return [sha, authorName, subject];
      });
  });

  afterAll(async () => {
    await repo.remove();
  });

  it('hands on every commit every ref and the checked-out commit reach, with git’s own author and subject', async () => {
    const rows = await all(stream);
    expect(rows).toHaveLength(15);
    expect(bySha(rows)).toEqual(bySha(own));
    expect(
      rows.some(([, authorName, subject]) => authorName === 'Jane Doe' && subject === 'Größe ändern — naïve café'),
    ).toBe(true);
  });

  it('walks in git’s default order — the one that prints from its first commit', async () => {
    const asked: string[][] = [];
    await all((args, options, read) => {
      asked.push([...args]);
      return stream(args, options, read);
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('log');
    expect(asked[0]).toContain('--branches');
    expect(asked[0].filter((arg) => arg.endsWith('-order'))).toEqual([]);
  });

  it('hands on the same texts however the output is cut', async () => {
    const whole = await all(stream);
    const text = whole.map((row) => `${row.join(SEP)}\n`).join('');
    for (const sizes of [[1], [7, 3, 41], [40], [41], [100_000]]) {
      expect(await all(fed(text, sizes))).toEqual(whole);
    }
  });

  it('takes everything past the author’s name as the subject — a subject may hold the separator', async () => {
    const sha = 'a'.repeat(40);
    expect(
      await all(fed(`${sha}${SEP}John Doe${SEP}one${SEP}two\n${'b'.repeat(64)}${SEP}Jane Doe${SEP}\n`, [9])),
    ).toEqual([
      [sha, 'John Doe', `one${SEP}two`],
      ['b'.repeat(64), 'Jane Doe', ''],
    ]);
  });

  it('refuses output that is no texts', async () => {
    const sha = 'a'.repeat(40);
    for (const text of [
      'not a line of a commit\n',
      `${sha}${SEP}a name and no subject\n`,
      `${sha.slice(0, 20)}${SEP}John Doe${SEP}half a hash\n`,
      `${sha}${SEP}John Doe${SEP}a line git never ended`,
    ]) {
      expect(await readLogTexts(fed(text, [11]), run, repo.rootDir, OPTIONS, () => undefined)).toEqual({
        ok: false,
        reason: 'failed',
      });
    }
  });

  it('reads the commits named by hash alone — those, in the order named, and none walked from', async () => {
    const named = [
      await repo.shaOf('Side work'),
      await repo.shaOf('Release notes'),
      await repo.shaOf('Add orders request'),
    ];
    const rows: Row[] = [];
    expect(await readLogTextsOf(stream, repo.rootDir, named, OPTIONS, (...row) => rows.push(row))).toEqual({
      ok: true,
    });
    expect(rows).toEqual([
      [named[0], 'Jane Doe', 'Side work'],
      [named[1], 'John Doe', 'Release notes'],
      [named[2], 'John Doe', 'Add orders request'],
    ]);
  });

  it('names at most four hundred hashes an invocation, each batch in turn', async () => {
    const shas = Array.from({ length: 900 }, (_, at) => at.toString(16).padStart(40, '0'));
    const asked: string[][] = [];
    const rows: Row[] = [];
    const answering: GitStreamRunner = async (args, _options, read) => {
      const batch = args.slice(args.indexOf('--no-walk=unsorted') + 1, args.lastIndexOf('--'));
      asked.push(batch);
      await read(batch.map((sha) => `${sha}${SEP}John Doe${SEP}Commit ${sha.slice(-3)}\n`).join(''));
      return DONE;
    };
    expect(await readLogTextsOf(answering, repo.rootDir, shas, OPTIONS, (...row) => rows.push(row))).toEqual({
      ok: true,
    });
    expect(asked.map((batch) => batch.length)).toEqual([400, 400, 100]);
    expect(asked.flat()).toEqual(shas);
    expect(rows.map(([sha]) => sha)).toEqual(shas);
  });

  it('asks git nothing where no commit is named', async () => {
    let asked = 0;
    const counting: GitStreamRunner = (args, options, read) => {
      asked += 1;
      return stream(args, options, read);
    };
    expect(await readLogTextsOf(counting, repo.rootDir, [], OPTIONS, () => undefined)).toEqual({ ok: true });
    expect(asked).toBe(0);
  });

  it('fails on a hash git does not hold, and stops at the batch that failed', async () => {
    const rows: Row[] = [];
    const named = [await repo.shaOf('Side work'), 'f'.repeat(40)];
    expect(await readLogTextsOf(stream, repo.rootDir, named, OPTIONS, (...row) => rows.push(row))).toEqual({
      ok: false,
      reason: 'failed',
    });
    const shas = Array.from({ length: 900 }, (_, at) => at.toString(16).padStart(40, '0'));
    let asked = 0;
    const refusing: GitStreamRunner = async () => {
      asked += 1;
      return { ...DONE, code: 128 };
    };
    expect(await readLogTextsOf(refusing, repo.rootDir, shas, OPTIONS, () => undefined)).toEqual({
      ok: false,
      reason: 'failed',
    });
    expect(asked).toBe(1);
  });

  it('ends when nobody waits for it, and says a read that ran out of time did', async () => {
    const ended = { ...OPTIONS, signal: AbortSignal.abort() };
    const sha = await repo.shaOf('Side work');
    expect(await readLogTexts(stream, run, repo.rootDir, ended, () => undefined)).toEqual({
      ok: false,
      reason: 'aborted',
    });
    expect(await readLogTextsOf(stream, repo.rootDir, [sha], ended, () => undefined)).toEqual({
      ok: false,
      reason: 'aborted',
    });
    const late: GitStreamRunner = async () => ({ ...DONE, code: -1, timedOut: true });
    expect(await readLogTexts(late, run, repo.rootDir, OPTIONS, () => undefined)).toEqual({
      ok: false,
      reason: 'timeout',
    });
    expect(await readLogTextsOf(late, repo.rootDir, [sha], OPTIONS, () => undefined)).toEqual({
      ok: false,
      reason: 'timeout',
    });
  });

  it('names no further batch once the read’s time has run out', async () => {
    const shas = Array.from({ length: 900 }, (_, at) => at.toString(16).padStart(40, '0'));
    let asked = 0;
    const slow: GitStreamRunner = async () => {
      asked += 1;
      await new Promise((resolve) => setTimeout(resolve, 60));
      return DONE;
    };
    expect(await readLogTextsOf(slow, repo.rootDir, shas, { timeoutMs: 30 }, () => undefined)).toEqual({
      ok: false,
      reason: 'timeout',
    });
    expect(asked).toBe(1);
  });

  it('hands on nothing for a repo with no commit', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-text-read-empty-'));
    try {
      await ensureWorkspaceRepo(run, empty);
      const rows: Row[] = [];
      expect(await readLogTexts(stream, run, empty, OPTIONS, (...row) => rows.push(row))).toEqual({ ok: true });
      expect(rows).toEqual([]);
      // A git that ends with an error over no ref at all says the same: nothing to read. Over a history it is a failure.
      const refusing: GitStreamRunner = async () => ({ ...DONE, code: 128 });
      expect(await readLogTexts(refusing, run, empty, OPTIONS, () => undefined)).toEqual({ ok: true });
      expect(await readLogTexts(refusing, run, repo.rootDir, OPTIONS, () => undefined)).toEqual({
        ok: false,
        reason: 'failed',
      });
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});
