/**
 * Search over a whole history (`log-search`): the log's text field
 * asked of every commit a scope reaches — by subject, by author, by a
 * hash's start — the newest first, a page at a time with the word that
 * more exist, under the timeline's own scope and row filters; the
 * page's commits come back in full. And its bounds: a text that is no
 * shape, a deadline, the caller's signal, a walk that stops when the
 * page is full. Real git in scratch repos.
 */

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { createGitStream, type GitStreamResult, type GitStreamRunner } from '../../src/git/git-stream';
import { type CommitLogSearch, type LogSearchMatch, plainTextMatch, searchCommitLog } from '../../src/git/log-search';
import { LOG_SEARCH_MAX_TEXT } from '../../src/git/log-text-shape';
import { ensureWorkspaceRepo, localHeadSha } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const ISOLATED = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const JOHN = { name: 'John Doe', email: 'john.doe@openheaders.io' };
const JANE = { name: 'Jane Doe', email: 'jane.doe@openheaders.io' };

const base = createGitExec();
const run: GitRunner = (args, options) => base(args, { ...options, env: { ...ISOLATED, ...options.env } });
const stream = createGitStream();
const isolatedStream: GitStreamRunner = (args, options, read) =>
  stream(args, { ...options, env: { ...ISOLATED, ...options.env } }, read);

const matchOf = (text: string, matchCase = false): LogSearchMatch => {
  const match = plainTextMatch(text, matchCase);
  if (match === null) throw new Error(`no match for ${text}`);
  return match;
};

describe('a search’s text as a shape', () => {
  it('is something to match, bounded, with no control character', () => {
    expect(plainTextMatch('orders', false)).not.toBeNull();
    expect(plainTextMatch('   ', false)).toBeNull();
    expect(plainTextMatch('a'.repeat(LOG_SEARCH_MAX_TEXT), false)).not.toBeNull();
    expect(plainTextMatch('a'.repeat(LOG_SEARCH_MAX_TEXT + 1), false)).toBeNull();
    expect(plainTextMatch('orders\nmain', false)).toBeNull();
    expect(plainTextMatch('orders\u0000', false)).toBeNull();
  });
});

describe('search over a history', () => {
  let rootDir: string;
  let trunk: string;
  let clock = 1_700_000_000;
  const shas: Record<string, string> = {};

  const git = async (args: string[], who = JOHN): Promise<void> => {
    clock += 60;
    const stamp = `${clock} +0000`;
    const result = await run([...repoArgs(rootDir), ...args], {
      cwd: rootDir,
      env: {
        GIT_AUTHOR_NAME: who.name,
        GIT_AUTHOR_EMAIL: who.email,
        GIT_COMMITTER_NAME: who.name,
        GIT_COMMITTER_EMAIL: who.email,
        GIT_AUTHOR_DATE: stamp,
        GIT_COMMITTER_DATE: stamp,
      },
    });
    if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  };
  const commit = async (name: string, subject: string, file: string, who = JOHN): Promise<void> => {
    const target = path.join(rootDir, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${subject}\n`, 'utf-8');
    await git(['add', '-A']);
    await git(['commit', '-m', subject], who);
    const sha = await localHeadSha(run, rootDir);
    if (sha === null) throw new Error('no head');
    shas[name] = sha;
  };
  const search = (text: string, extra: Partial<CommitLogSearch> = {}) =>
    searchCommitLog(isolatedStream, run, rootDir, { limit: 200, match: matchOf(text), deadlineMs: 5_000, ...extra });
  const listed = async (text: string, extra: Partial<CommitLogSearch> = {}): Promise<string[]> => {
    const result = await search(text, extra);
    if (!result.ok) throw new Error(`search refused: ${result.reason}`);
    return result.entries.map((entry) => entry.subject);
  };

  beforeAll(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-search-'));
    await ensureWorkspaceRepo(run, rootDir);
    trunk = (await run([...repoArgs(rootDir), 'symbolic-ref', '--short', 'HEAD'], { cwd: rootDir })).stdout.trim();
    await commit('add', 'Add orders request', 'requests/orders.yaml');
    await commit('panel', 'Fix response panel layout', 'notes/panel.md', JANE);
    await commit('retry', 'Orders: retry on timeout', 'requests/orders.yaml');
    await git(['checkout', '-q', '-b', 'side']);
    await commit('side', 'Side work on orders export', 'side.txt', JANE);
    await git(['checkout', '-q', trunk]);
    await commit('bump', 'Bump version', 'version.txt');
    await git(['merge', '-q', '--no-ff', 'side', '-m', 'Merge the side branch']);
    await commit('docs', 'Document the Orders API', 'docs/orders.md', JANE);
    await git(['checkout', '-q', '-b', 'other']);
    await commit('spike', 'Unmerged orders spike', 'spike.txt');
    await git(['checkout', '-q', trunk]);
  });

  afterAll(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('lists every commit HEAD reaches whose subject holds the text, the newest first', async () => {
    expect(await listed('orders')).toEqual([
      'Document the Orders API',
      'Side work on orders export',
      'Orders: retry on timeout',
      'Add orders request',
    ]);
  });

  it('holds the case when asked to', async () => {
    expect(await listed('Orders', { match: matchOf('Orders', true) })).toEqual([
      'Document the Orders API',
      'Orders: retry on timeout',
    ]);
  });

  it('matches a commit by its author’s name and by the start of its hash', async () => {
    expect(await listed('jane')).toEqual([
      'Document the Orders API',
      'Side work on orders export',
      'Fix response panel layout',
    ]);
    expect(await listed(shas.retry.slice(0, 8))).toEqual(['Orders: retry on timeout']);
    expect(await listed(shas.retry.slice(4, 12))).toEqual([]);
  });

  it('answers the page’s commits in full — hash, parents, author, date and the files changed', async () => {
    const result = await search(shas.retry.slice(0, 10));
    expect(result).toEqual({
      ok: true,
      more: false,
      entries: [
        {
          sha: shas.retry,
          parents: [shas.panel],
          authorName: JOHN.name,
          authorEmail: JOHN.email,
          authoredAt: expect.stringMatching(/^2023-11-14T/),
          subject: 'Orders: retry on timeout',
          coAuthors: [],
          files: [{ status: 'M', path: 'requests/orders.yaml' }],
        },
      ],
    });
  });

  it('lists a page and says whether the history holds more', async () => {
    const page = await search('orders', { limit: 2 });
    expect(page.ok && page.entries.map((entry) => entry.subject)).toEqual([
      'Document the Orders API',
      'Side work on orders export',
    ]);
    expect(page.ok && page.more).toBe(true);
    const exact = await search('orders', { limit: 4 });
    expect(exact.ok && [exact.entries.length, exact.more]).toEqual([4, false]);
  });

  it('walks the scope it is given — a branch HEAD does not reach, or every ref', async () => {
    expect(await listed('spike')).toEqual([]);
    expect(await listed('spike', { scope: ['other'] })).toEqual(['Unmerged orders spike']);
    expect(await listed('spike', { filters: { allRefs: true } })).toEqual(['Unmerged orders spike']);
    expect(await listed('orders', { scope: ['side'] })).toEqual([
      'Side work on orders export',
      'Orders: retry on timeout',
      'Add orders request',
    ]);
  });

  it('searches under the timeline’s row filters — an author, a path, no merges', async () => {
    expect(await listed('orders', { filters: { author: 'John Doe' } })).toEqual([
      'Orders: retry on timeout',
      'Add orders request',
    ]);
    expect(await listed('orders', { filters: { paths: ['requests'] } })).toEqual([
      'Orders: retry on timeout',
      'Add orders request',
    ]);
    expect(await listed('side branch')).toEqual(['Merge the side branch']);
    expect(await listed('side branch', { filters: { noMerges: true } })).toEqual([]);
  });

  it('reads a match that answers later exactly as one that answers at once', async () => {
    const plain = matchOf('orders');
    const later: LogSearchMatch = async (rows, signal) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return plain(rows, signal);
    };
    expect(await listed('orders', { match: later })).toEqual(await listed('orders'));
  });

  it('ends at its deadline and says so', async () => {
    const never: LogSearchMatch = (rows, signal) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve(rows.map(() => false)), { once: true });
      });
    expect(await search('orders', { match: never, deadlineMs: 50 })).toEqual({ ok: false, reason: 'timeout' });
  });

  it('ends on the caller’s signal and says a newer search took its place', async () => {
    expect(await search('orders', { signal: AbortSignal.abort() })).toEqual({ ok: false, reason: 'aborted' });
  });

  it('refuses a scope member that is no ref name before git is asked', async () => {
    expect(await search('orders', { scope: [`${trunk}..other`] })).toEqual({ ok: false, reason: 'invalid-scope' });
  });
});

describe('search over a history with no commit yet', () => {
  it('answers an empty page, under HEAD and under every ref', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-search-unborn-'));
    try {
      await ensureWorkspaceRepo(run, rootDir);
      const search = { limit: 200, match: matchOf('orders'), deadlineMs: 5_000 };
      expect(await searchCommitLog(isolatedStream, run, rootDir, search)).toEqual({
        ok: true,
        entries: [],
        more: false,
      });
      expect(await searchCommitLog(isolatedStream, run, rootDir, { ...search, filters: { allRefs: true } })).toEqual({
        ok: true,
        entries: [],
        more: false,
      });
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});

describe('search over a history longer than one chunk', () => {
  const COMMITS = 3_000;
  const PAD = 'padding so that a record is cut where one chunk ends and the next begins '.repeat(3).trim();
  let rootDir: string;
  const reads: GitStreamResult[] = [];
  const watched: GitStreamRunner = async (args, options, read) => {
    const result = await isolatedStream(args, options, read);
    reads.push(result);
    return result;
  };

  beforeAll(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-search-long-'));
    await ensureWorkspaceRepo(run, rootDir);
    const branch = (await run([...repoArgs(rootDir), 'symbolic-ref', 'HEAD'], { cwd: rootDir })).stdout.trim();
    let script = '';
    for (let index = 1; index <= COMMITS; index += 1) {
      const message = `entry ${index}${index % 500 === 0 ? ' needle' : ''} ${PAD} tail\n`;
      script +=
        `commit ${branch}\nmark :${index}\n` +
        `author ${JOHN.name} <${JOHN.email}> ${1_700_000_000 + index * 60} +0000\n` +
        `committer ${JOHN.name} <${JOHN.email}> ${1_700_000_000 + index * 60} +0000\n` +
        `data ${Buffer.byteLength(message)}\n${message}\n` +
        (index > 1 ? `from :${index - 1}\n` : '') +
        '\n';
    }
    execFileSync('git', [...repoArgs(rootDir), 'fast-import', '--quiet'], {
      input: script,
      env: { ...process.env, ...ISOLATED },
    });
  });

  afterAll(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('hands the match every commit whole — a record cut where a chunk ends is joined, none is lost', async () => {
    // A pipe cuts a record wherever its buffer ends; small records rarely
    // meet that edge, so the same read is handed over in pieces that do.
    const ragged: GitStreamRunner = (args, options, read) =>
      isolatedStream(args, options, async (chunk) => {
        for (let at = 0; at < chunk.length; at += 997) await read(chunk.slice(at, at + 997));
      });
    let seen = 0;
    let whole = 0;
    const counting: LogSearchMatch = (rows) => {
      for (const row of rows) {
        seen += 1;
        if (/^[0-9a-f]{40}$/.test(row.sha) && row.authorName === JOHN.name && /^entry \d+.* tail$/.test(row.subject)) {
          whole += 1;
        }
      }
      return rows.map(() => false);
    };
    const result = await searchCommitLog(ragged, run, rootDir, { limit: 200, match: counting, deadlineMs: 10_000 });
    expect(result).toEqual({ ok: true, entries: [], more: false });
    expect([seen, whole]).toEqual([COMMITS, COMMITS]);
  });

  it('finds every match across the chunks, the oldest commit included', async () => {
    const result = await searchCommitLog(watched, run, rootDir, {
      limit: 200,
      match: matchOf('needle'),
      deadlineMs: 10_000,
    });
    expect(result.ok && result.more).toBe(false);
    expect(result.ok && result.entries.map((entry) => entry.subject.split(' ').slice(0, 3).join(' '))).toEqual([
      'entry 3000 needle',
      'entry 2500 needle',
      'entry 2000 needle',
      'entry 1500 needle',
      'entry 1000 needle',
      'entry 500 needle',
    ]);
    const first = await searchCommitLog(watched, run, rootDir, {
      limit: 200,
      match: matchOf('entry 1 padding'),
      deadlineMs: 10_000,
    });
    expect(first.ok && first.entries).toHaveLength(1);
    expect(reads.every((read) => read.code === 0 && !read.aborted)).toBe(true);
  });

  it('stops the walk the moment the page is full', async () => {
    reads.length = 0;
    const result = await searchCommitLog(watched, run, rootDir, {
      limit: 5,
      match: matchOf('entry'),
      deadlineMs: 10_000,
    });
    expect(result.ok && result.more).toBe(true);
    expect(result.ok && result.entries.map((entry) => entry.subject.split(' ').slice(0, 2).join(' '))).toEqual([
      'entry 3000',
      'entry 2999',
      'entry 2998',
      'entry 2997',
      'entry 2996',
    ]);
    expect(reads).toHaveLength(1);
    expect(reads[0].aborted).toBe(true);
  });
});
