/**
 * The lane a history search's text is matched in: a plain text is read
 * on the spot; a pattern runs in a worker of its own, answers exactly
 * as core's matcher does, and is ENDED by the search's signal — a
 * pattern that backtracks without end over a crafted subject is stopped
 * mid-run while the host's own thread keeps turning. And the whole
 * search over real git: a pattern lists what it should, and one that
 * never finishes is refused at the deadline.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type LogTextFields, makeLogTextMatcher } from '@openheaders/core/workspace-tree';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGitExec, type GitRunner } from '../../src/git/git-exec';
import { createGitStream, type GitStreamRunner } from '../../src/git/git-stream';
import { LOG_SEARCH_MAX_TEXT, searchCommitLog } from '../../src/git/log-search';
import { type LogSearchLane, openLogSearchLane } from '../../src/git/log-search-lane';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';

const ROWS: LogTextFields[] = [
  { sha: 'abc123def4567890abc123def4567890abc123de', authorName: 'John Doe', subject: 'Fix Response panel' },
  { sha: 'def4567890abc123def4567890abc123def45678', authorName: 'Jane Doe', subject: 'orders: retry on timeout' },
  { sha: '0123456789abcdef0123456789abcdef01234567', authorName: 'John Roe', subject: 'Bump version (v2.1)' },
  { sha: 'fedcba9876543210fedcba9876543210fedcba98', authorName: 'jane roe', subject: '' },
];

/** A pattern that backtracks without end over this subject — the pair a deadline exists for. */
const RUNAWAY = '(a+)+$';
const CRAFTED = `${'a'.repeat(40)}!`;

const laneOf = (text: string, regex: boolean, matchCase = false): LogSearchLane => {
  const lane = openLogSearchLane(text, regex, matchCase);
  if (lane === null) throw new Error(`no lane for ${text}`);
  return lane;
};
const live = (): AbortSignal => new AbortController().signal;

describe('the lane a search’s text is matched in', () => {
  it('reads a plain text on the spot — an answer, not a promise', () => {
    const lane = laneOf('orders', false);
    expect(lane.match(ROWS, live())).toEqual([false, true, false, false]);
    lane.close();
  });

  it('refuses a text that is no shape, and a pattern that does not compile', () => {
    expect(openLogSearchLane('  ', false, false)).toBeNull();
    expect(openLogSearchLane('  ', true, false)).toBeNull();
    expect(openLogSearchLane('a'.repeat(LOG_SEARCH_MAX_TEXT + 1), true, false)).toBeNull();
    expect(openLogSearchLane('orders\nmain', true, false)).toBeNull();
    expect(openLogSearchLane('(', true, false)).toBeNull();
    expect(openLogSearchLane('(', false, false)).not.toBeNull();
  });

  it.each([
    ['^fix .*panel$', false],
    ['^fix .*panel$', true],
    ['^(john|jane) ', false],
    ['^Jane', true],
    ['v\\d+\\.\\d+', false],
    ['^abc123', false],
    ['[0-9a-f]{40}', false],
    ['^$', false],
    ['  retry  ', false],
  ])('a pattern answers as core’s matcher does — %s, case held: %s', async (text, matchCase) => {
    const matcher = makeLogTextMatcher(text, true, matchCase);
    if (matcher.kind !== 'match') throw new Error('expected a matcher');
    const lane = laneOf(text, true, matchCase);
    try {
      expect(await lane.match(ROWS, live())).toEqual(ROWS.map(matcher.test));
      // The same lane answers batch after batch.
      expect(await lane.match(ROWS.slice(1), live())).toEqual(ROWS.slice(1).map(matcher.test));
    } finally {
      lane.close();
    }
  });

  it('ends a pattern mid-run on the search’s signal, the host’s thread turning all the while', async () => {
    const lane = laneOf(RUNAWAY, true);
    const search = new AbortController();
    let turns = 0;
    const beat = setInterval(() => {
      turns += 1;
    }, 5);
    const started = performance.now();
    setTimeout(() => search.abort(), 150);
    const answer = await lane.match([{ ...ROWS[0], subject: CRAFTED }], search.signal);
    const took = performance.now() - started;
    clearInterval(beat);
    expect(answer).toEqual([false]);
    expect(took).toBeGreaterThanOrEqual(140);
    expect(took).toBeLessThan(2_000);
    // A pattern on the host's thread would have let no timer fire.
    expect(turns).toBeGreaterThan(10);
    // What follows on an ended lane is answered at once, and nothing matched.
    expect(await lane.match(ROWS, live())).toEqual([false, false, false, false]);
    lane.close();
  });

  it('answers nothing under a signal that was aborted before it began', async () => {
    const lane = laneOf('orders', true);
    expect(await lane.match(ROWS, AbortSignal.abort())).toEqual([false, false, false, false]);
    lane.close();
  });
});

describe('a pattern searched over a history', () => {
  const ISOLATED = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
  const IDENTITY = {
    GIT_AUTHOR_NAME: 'John Doe',
    GIT_AUTHOR_EMAIL: 'john.doe@openheaders.io',
    GIT_COMMITTER_NAME: 'John Doe',
    GIT_COMMITTER_EMAIL: 'john.doe@openheaders.io',
  };
  const base = createGitExec();
  const run: GitRunner = (args, options) => base(args, { ...options, env: { ...ISOLATED, ...options.env } });
  const reading = createGitStream();
  const stream: GitStreamRunner = (args, options, read) =>
    reading(args, { ...options, env: { ...ISOLATED, ...options.env } }, read);
  let rootDir: string;

  beforeAll(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-search-lane-'));
    await ensureWorkspaceRepo(run, rootDir);
    let clock = 1_700_000_000;
    for (const subject of ['Add orders request', CRAFTED, 'orders: retry on timeout', 'Fix response panel']) {
      clock += 60;
      await fs.writeFile(path.join(rootDir, 'notes.txt'), `${subject}\n`, 'utf-8');
      await run([...repoArgs(rootDir), 'add', '-A'], { cwd: rootDir });
      const stamp = `${clock} +0000`;
      const committed = await run([...repoArgs(rootDir), 'commit', '-m', subject], {
        cwd: rootDir,
        env: { ...IDENTITY, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp },
      });
      if (committed.code !== 0) throw new Error(committed.stderr);
    }
  });

  afterAll(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('lists the commits a pattern matches, the newest first', async () => {
    const lane = laneOf('^(add )?orders', true);
    try {
      const result = await searchCommitLog(stream, run, rootDir, { limit: 200, match: lane.match, deadlineMs: 5_000 });
      expect(result.ok && result.entries.map((entry) => entry.subject)).toEqual([
        'orders: retry on timeout',
        'Add orders request',
      ]);
      expect(result.ok && result.more).toBe(false);
    } finally {
      lane.close();
    }
  });

  it('refuses at the deadline a pattern that a commit in the history never lets finish', async () => {
    const lane = laneOf(RUNAWAY, true);
    const started = performance.now();
    try {
      expect(await searchCommitLog(stream, run, rootDir, { limit: 200, match: lane.match, deadlineMs: 200 })).toEqual({
        ok: false,
        reason: 'timeout',
      });
      expect(performance.now() - started).toBeLessThan(2_000);
    } finally {
      lane.close();
    }
  });
});
