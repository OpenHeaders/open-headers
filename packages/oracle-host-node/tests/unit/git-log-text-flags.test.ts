/**
 * The rows of a reading a text matches (`log-text-flags`,
 * `log-text-pattern`): a flag per row, answer for answer what core's
 * matcher says of the commit — by its subject, its author's name, its
 * hash — with a row that has no text tested by its hash alone. A plain
 * text is read on the host's thread a stretch at a time, the thread
 * handed back between two; a pattern runs in a worker over the store's
 * shared memory and is ENDED mid-run by the signal or by its deadline,
 * the host's own thread turning all the while. And over real git: the
 * texts a history holds, flagged.
 */

import { makeLogTextMatcher } from '@openheaders/core/workspace-tree';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { historyShaOf } from '../../src/git/log-skeleton';
import { flagLogTexts, type LogTextAsk, type LogTextRows } from '../../src/git/log-text-flags';
import { flagRowsByPattern } from '../../src/git/log-text-pattern';
import { createLogTextStore } from '../../src/git/log-text-store';
import { createRepoHistory, type RepoHistory } from '../../src/workspace-tree/history/repo-history';
import { createHistoryTexts, type HistoryTexts } from '../../src/workspace-tree/history/texts';
import { openScratchRepo, run, type ScratchRepo, seedHistory, stream } from './_log-history-repo';

interface Commit {
  sha: string;
  /** Null for a commit the reading holds no text of. */
  text: { authorName: string; subject: string } | null;
}

const commit = (sha: string, authorName: string, subject: string): Commit => ({ sha, text: { authorName, subject } });

const COMMITS: Commit[] = [
  commit('abc123def4567890abc123def4567890abc123de', 'John Doe', 'Fix Response panel'),
  commit('def4567890abc123def4567890abc123def45678', 'Jane Doe', 'orders: retry on timeout'),
  commit('0123456789abcdef0123456789abcdef01234567', 'John Roe', 'Bump version (v2.1)'),
  commit('fedcba9876543210fedcba9876543210fedcba98', 'jane roe', ''),
  { sha: 'abc1ffffffffffffffffffffffffffffffffffff', text: null },
  commit('cafe0123456789abcdef0123456789abcdef0123', 'Zoë Müller', 'Größe ändern — naïve café'),
];

/** A pattern that backtracks without end over this subject — the pair a deadline exists for. */
const RUNAWAY = '(a+)+$';
const CRAFTED = `${'a'.repeat(40)}!`;

/** The rows of a reading that lists `commits` — the hashes inside a larger memory, as a small history's stand in a pool. */
function rowsOf(commits: readonly Commit[], width = 20): LogTextRows {
  const store = createLogTextStore();
  const textOf = Int32Array.from(commits, ({ text }) =>
    text === null ? -1 : store.add(text.authorName, text.subject),
  );
  const hashes = Buffer.alloc(7 + commits.length * width).subarray(7);
  commits.forEach(({ sha }, row) => {
    hashes.write(sha, row * width, 'hex');
  });
  return { store, textOf, hashes, width };
}

/** Core's own answer for each commit; one with no text has its hash alone to be matched by. */
function coreSays(commits: readonly Commit[], ask: LogTextAsk): number[] {
  const matcher = makeLogTextMatcher(ask.text, ask.regex, ask.matchCase);
  if (matcher.kind !== 'match') throw new Error(`no matcher for ${ask.text}`);
  return commits.map(({ sha, text }) => {
    if (text === null) return matcher.testSha?.(sha) === true ? 1 : 0;
    return matcher.test({ sha, ...text }) ? 1 : 0;
  });
}

const live = (): AbortSignal => new AbortController().signal;
const LONG = 5_000;

async function flagsOf(rows: LogTextRows, ask: LogTextAsk, signal = live()): Promise<number[]> {
  const result = await flagLogTexts(rows, ask, { signal, patternDeadlineMs: LONG });
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  expect(result.flags).toBeInstanceOf(Uint8Array);
  return Array.from(result.flags);
}

const plain = (text: string, matchCase = false): LogTextAsk => ({ text, regex: false, matchCase });
const pattern = (text: string, matchCase = false): LogTextAsk => ({ text, regex: true, matchCase });

/** Many rows of one shape — more than a stretch holds. */
function manyRows(count: number): LogTextRows {
  const commits: Commit[] = [];
  for (let row = 0; row < count; row += 1) {
    commits.push(commit(row.toString(16).padStart(40, '0'), `Author ${row % 7}`, `Work item ${row}`));
  }
  return rowsOf(commits);
}

describe('the rows a plain text matches', () => {
  const rows = rowsOf(COMMITS);

  it('flags a row by its subject, by its author’s name, by the start of its hash', async () => {
    expect(await flagsOf(rows, plain('retry'))).toEqual([0, 1, 0, 0, 0, 0]);
    expect(await flagsOf(rows, plain('jane'))).toEqual([0, 1, 0, 1, 0, 0]);
    expect(await flagsOf(rows, plain('def45'))).toEqual([0, 1, 0, 0, 0, 0]);
    expect(await flagsOf(rows, plain('zzz'))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('tests a row that has no text by its hash alone', async () => {
    expect(await flagsOf(rows, plain('abc1'))).toEqual([1, 0, 0, 0, 1, 0]);
    expect(await flagsOf(rows, plain('abc1f'))).toEqual([0, 0, 0, 0, 1, 0]);
  });

  it.each([
    ['orders', false],
    ['ORDERS', false],
    ['ORDERS', true],
    ['Response', true],
    ['response', true],
    ['john', false],
    ['Jane', true],
    ['ABC123', false],
    ['c123', false],
    ['cafe', false],
    ['café', false],
    ['GRÖSSE', false],
    ['größe', false],
    ['müller', false],
    ['(v2.1)', false],
    ['v2x1', false],
    ['  retry  ', false],
    ['e', false],
    ['0', true],
  ])('answers as core’s matcher does — %s, case held: %s', async (text, matchCase) => {
    const ask = plain(text, matchCase);
    expect(await flagsOf(rows, ask)).toEqual(coreSays(COMMITS, ask));
  });

  it('reads a hash of any width', async () => {
    const wide: Commit[] = [
      commit(`ab${'0'.repeat(62)}`, 'John Doe', 'Add orders request'),
      commit(`cd${'0'.repeat(62)}`, 'Jane Doe', 'Fix response panel'),
      commit(`${'0'.repeat(62)}ab`, 'Jane Doe', 'Bump version'),
    ];
    // A hash read twenty bytes wide would start the second row inside the first.
    expect(await flagsOf(rowsOf(wide, 32), plain('cd0'))).toEqual([0, 1, 0]);
    expect(await flagsOf(rowsOf(wide, 32), pattern('ab$'))).toEqual([0, 0, 1]);
    expect(await flagsOf(rowsOf(wide, 32), pattern('^[0-9a-f]{64}$'))).toEqual([1, 1, 1]);
  });

  it('reads the texts where the store holds them now — a store grown since the rows were laid', async () => {
    const grown = rowsOf(COMMITS);
    for (let text = 0; text < 40_000; text += 1) grown.store.add(`Later ${text}`, `retry later ${'x'.repeat(40)}`);
    expect(await flagsOf(grown, plain('retry'))).toEqual([0, 1, 0, 0, 0, 0]);
    expect(await flagsOf(grown, pattern('^orders: retry'))).toEqual([0, 1, 0, 0, 0, 0]);
    expect(await flagsOf(grown, pattern('^later \\d+$'))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('hands the thread back between two stretches of rows', async () => {
    const order: string[] = [];
    setImmediate(() => order.push('the host’s other work'));
    const flags = await flagsOf(manyRows(50_000), plain('item 4999'));
    order.push('the answer');
    expect(order).toEqual(['the host’s other work', 'the answer']);
    // 4999, and 49990 to 49999.
    expect(flags.reduce((sum, flag) => sum + flag, 0)).toBe(11);
    expect(flags[4_999]).toBe(1);
    expect(flags[49_999]).toBe(1);
  });

  it('is ended by its signal between two stretches, and under one aborted before it began', async () => {
    const search = new AbortController();
    // Runs when the first stretch hands the thread back.
    setImmediate(() => search.abort());
    expect(
      await flagLogTexts(manyRows(50_000), plain('item'), { signal: search.signal, patternDeadlineMs: LONG }),
    ).toEqual({ ok: false, reason: 'aborted' });
    expect(await flagLogTexts(rows, plain('retry'), { signal: AbortSignal.abort(), patternDeadlineMs: LONG })).toEqual({
      ok: false,
      reason: 'aborted',
    });
  });

  it('has no deadline — the pattern’s is not its own', async () => {
    const result = await flagLogTexts(manyRows(200_000), plain('item 19999'), { signal: live(), patternDeadlineMs: 1 });
    expect(result.ok && result.flags.reduce((sum, flag) => sum + flag, 0)).toBe(11);
  });
});

describe('a text that is no shape', () => {
  const rows = rowsOf(COMMITS);
  const refused = { ok: false, reason: 'invalid-text' };
  const asked = (ask: LogTextAsk) => flagLogTexts(rows, ask, { signal: live(), patternDeadlineMs: LONG });

  it('is refused before anything is read: nothing to match, too long, a control character', async () => {
    for (const regex of [false, true]) {
      expect(await asked({ text: '   ', regex, matchCase: false })).toEqual(refused);
      expect(await asked({ text: 'a'.repeat(201), regex, matchCase: false })).toEqual(refused);
      expect(await asked({ text: 'orders\nmain', regex, matchCase: false })).toEqual(refused);
      expect(await asked({ text: 'orders\u0000', regex, matchCase: false })).toEqual(refused);
      expect((await asked({ text: 'a'.repeat(200), regex, matchCase: false })).ok).toBe(true);
    }
  });

  it('refuses a pattern that does not compile — the same text is a plain one', async () => {
    expect(await asked(pattern('('))).toEqual(refused);
    expect((await asked(plain('('))).ok).toBe(true);
  });
});

describe('the rows a pattern matches', () => {
  const rows = rowsOf(COMMITS);

  it.each([
    ['^fix .*panel$', false],
    ['^fix .*panel$', true],
    ['^(john|jane) ', false],
    ['^Jane', true],
    ['v\\d+\\.\\d+', false],
    ['^abc123', false],
    ['^abc1', false],
    ['[0-9a-f]{40}', false],
    ['\\d+', false],
    ['^$', false],
    ['^gr(ö|o)(ß|ss)e', false],
    ['müller$', false],
    ['  retry  ', false],
    ['zzz', false],
  ])('answers as core’s matcher does — %s, case held: %s', async (text, matchCase) => {
    const ask = pattern(text, matchCase);
    expect(await flagsOf(rows, ask)).toEqual(coreSays(COMMITS, ask));
  });

  it('flags a row by its subject, by its author’s name, by its whole hash — one with no text by its hash alone', async () => {
    expect(await flagsOf(rows, pattern('retry on'))).toEqual([0, 1, 0, 0, 0, 0]);
    expect(await flagsOf(rows, pattern('^jane'))).toEqual([0, 1, 0, 1, 0, 0]);
    expect(await flagsOf(rows, pattern('f{4}'))).toEqual([0, 0, 0, 0, 1, 0]);
    expect(await flagsOf(rows, pattern('^$'))).toEqual([0, 0, 0, 1, 0, 0]);
  });

  it('is ended mid-run by the signal, the host’s thread turning all the while', async () => {
    const stuck = rowsOf([commit(COMMITS[0].sha, 'John Doe', CRAFTED)]);
    const search = new AbortController();
    let turns = 0;
    const beat = setInterval(() => {
      turns += 1;
    }, 5);
    const started = performance.now();
    setTimeout(() => search.abort(), 150);
    const result = await flagLogTexts(stuck, pattern(RUNAWAY), { signal: search.signal, patternDeadlineMs: LONG });
    const took = performance.now() - started;
    clearInterval(beat);
    expect(result).toEqual({ ok: false, reason: 'aborted' });
    expect(took).toBeGreaterThanOrEqual(140);
    expect(took).toBeLessThan(2_000);
    // A pattern on the host's thread would have let no timer fire.
    expect(turns).toBeGreaterThan(10);
    // The thread is gone, not left running unheard: the process is at rest.
    const before = process.cpuUsage();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const spent = process.cpuUsage(before);
    expect((spent.user + spent.system) / 1_000).toBeLessThan(150);
  });

  it('never runs on the host’s thread over an author’s name either', async () => {
    const stuck = rowsOf([commit(COMMITS[0].sha, CRAFTED, 'Fix response panel')]);
    let turns = 0;
    const beat = setInterval(() => {
      turns += 1;
    }, 5);
    const result = await flagLogTexts(stuck, pattern(RUNAWAY), { signal: live(), patternDeadlineMs: 150 });
    clearInterval(beat);
    expect(result).toEqual({ ok: false, reason: 'timeout' });
    expect(turns).toBeGreaterThan(10);
  });

  it('is refused at its deadline as out of time, and under a signal aborted before it began as ended', async () => {
    const stuck = rowsOf([commit(COMMITS[0].sha, 'John Doe', CRAFTED)]);
    const started = performance.now();
    expect(await flagLogTexts(stuck, pattern(RUNAWAY), { signal: live(), patternDeadlineMs: 150 })).toEqual({
      ok: false,
      reason: 'timeout',
    });
    expect(performance.now() - started).toBeGreaterThanOrEqual(140);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(
      await flagLogTexts(rows, pattern('retry'), { signal: AbortSignal.abort(), patternDeadlineMs: LONG }),
    ).toEqual({ ok: false, reason: 'aborted' });
  });

  it('rejects when its worker fails — nobody waits for an answer that cannot come', async () => {
    const broken = {
      // Starts that are no whole number of 32-bit words: the worker cannot read them.
      view: { ...rows.store.view(), starts: new SharedArrayBuffer(3) },
      textOf: rows.textOf,
      hashes: rows.hashes,
      width: rows.width,
    };
    await expect(flagRowsByPattern(/retry/, broken, live())).rejects.toThrow();
  });
});

describe('the texts a history holds, flagged', () => {
  let repo: ScratchRepo;
  let history: RepoHistory;
  let texts: HistoryTexts;
  let rows: LogTextRows;
  /** The subjects of the rows a text flags, in the reading's order. */
  let flagged: (ask: LogTextAsk) => Promise<string[]>;

  beforeAll(async () => {
    repo = await openScratchRepo('oh-log-text-flags-');
    await seedHistory(repo);
    history = createRepoHistory({
      run,
      stream,
      rootDir: repo.rootDir,
      readTimeoutMs: 20_000,
      onMoved: () => undefined,
    });
    texts = createHistoryTexts({ run, stream, rootDir: repo.rootDir, readTimeoutMs: 20_000 });
    const opened = await history.open();
    if (!opened.ok) throw new Error(`history refused: ${opened.reason}`);
    const laid = await texts.of(opened.generation);
    if (!laid.ok) throw new Error(`texts refused: ${laid.reason}`);
    const { hashes, width } = opened.generation.history;
    rows = { ...laid.texts, hashes, width };
    flagged = async (ask) => {
      const shas = (await flagsOf(rows, ask)).flatMap((flag, row) =>
        flag === 1 ? [historyShaOf(opened.generation.history, row)] : [],
      );
      return repo.subjects(shas);
    };
  });

  afterAll(async () => {
    texts.close();
    history.close();
    await repo.remove();
  });

  it('lists every commit a plain text matches by its subject', async () => {
    expect(await flagged(plain('side'))).toEqual(['Merge the side branch', 'More side work', 'Side work']);
    expect(await flagged(plain('SIDE', true))).toEqual([]);
  });

  it('lists every commit of an author the text names', async () => {
    expect(await flagged(plain('jane'))).toEqual([
      'Remote hotfix',
      'Add staging environment',
      'More side work',
      'Side work',
    ]);
  });

  it('lists the one commit a hash’s start names', async () => {
    const sha = await repo.shaOf('Bump version');
    expect(await flagged(plain(sha.slice(0, 12)))).toEqual(['Bump version']);
    expect(await flagged(plain(sha.slice(1, 13)))).toEqual([]);
  });

  it('lists every commit a pattern matches', async () => {
    expect(await flagged(pattern('^(add|fix) '))).toEqual([
      'Add staging environment',
      'Fix response panel',
      'Add orders request',
    ]);
    expect(await flagged(pattern('^jane doe$'))).toEqual([
      'Remote hotfix',
      'Add staging environment',
      'More side work',
      'Side work',
    ]);
  });
});
