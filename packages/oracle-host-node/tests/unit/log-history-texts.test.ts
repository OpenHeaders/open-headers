/**
 * The texts of a history across its readings (`history/texts`): every
 * row of a reading has its own commit's subject and author; a reading
 * is laid once, by whoever asks first; a later reading finds its texts
 * again by hash and reads only the commits it gained — by their hashes
 * where they are few, by walking every ref where they are many; and the
 * edges — a commit newer than the reading, a read that fails, texts
 * nobody reads any more, a repo with no commit. Real git in a scratch
 * repo.
 */

import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GitStreamRunner } from '../../src/git/git-stream';
import { historyRowOf, historyShaOf } from '../../src/git/log-skeleton';
import { ensureWorkspaceRepo } from '../../src/git/repo';
import { repoArgs } from '../../src/git/repo-args';
import type { HistoryGeneration } from '../../src/workspace-tree/history/generation';
import { createRepoHistory, type RepoHistory } from '../../src/workspace-tree/history/repo-history';
import { createHistoryTexts, type HistoryTexts, type LogTexts } from '../../src/workspace-tree/history/texts';
import {
  EVERY_REF,
  JANE,
  JOHN,
  openScratchRepo,
  run,
  type ScratchRepo,
  seedHistory,
  stream,
} from './_log-history-repo';

const SEP = '\x1f';
const DONE = { code: 0, stderr: '', spawnFailed: false, timedOut: false, aborted: false };

describe('the texts of a history, across its readings', () => {
  let repo: ScratchRepo;
  let history: RepoHistory;
  let texts: HistoryTexts;
  /** The arguments of every read of texts so far. */
  let asked: string[][];
  /** While set, a read of texts answers this in place of git. */
  let instead: GitStreamRunner | null;
  let onMoved: () => void;

  const through: GitStreamRunner = (args, options, read) => {
    if (!args.some((arg) => arg.startsWith('--format=%H%x1f'))) return stream(args, options, read);
    asked.push([...args]);
    return (instead ?? stream)(args, options, read);
  };
  const walks = (): number => asked.filter((args) => args.includes('--branches')).length;
  /** The hashes each read by hash named. */
  const named = (): string[][] =>
    asked
      .filter((args) => args.includes('--no-walk=unsorted'))
      .map((args) => args.slice(args.indexOf('--no-walk=unsorted') + 1, args.lastIndexOf('--')));

  const openOn = (rootDir: string): void => {
    history = createRepoHistory({ run, stream, rootDir, readTimeoutMs: 20_000, onMoved: () => onMoved() });
    texts = createHistoryTexts({ run, stream: through, rootDir, readTimeoutMs: 20_000 });
  };
  const reading = async (): Promise<HistoryGeneration> => {
    const opened = await history.open();
    if (!opened.ok) throw new Error(`history refused: ${opened.reason}`);
    return opened.generation;
  };
  /** The reading after something moved in the repo. */
  const nextReading = async (): Promise<HistoryGeneration> => {
    const landed = new Promise<void>((resolve) => {
      onMoved = resolve;
    });
    history.stale();
    await history.open();
    await landed;
    return reading();
  };
  const laid = async (generation: HistoryGeneration): Promise<LogTexts> => {
    const result = await texts.of(generation);
    if (!result.ok) throw new Error(`texts refused: ${result.reason}`);
    return result.texts;
  };
  /** Each row's hash with the text laid on it, as `<hash> <author> <subject>`. */
  const lines = (generation: HistoryGeneration, { store, textOf }: LogTexts): string[] =>
    Array.from(textOf, (text, row) =>
      [
        historyShaOf(generation.history, row),
        text === -1 ? '(none)' : store.authors[store.authorIdOf(text)],
        text === -1 ? '(none)' : store.subjectOf(text),
      ].join(SEP),
    );
  /** Git's own answer for the same rows. */
  const own = async (generation: HistoryGeneration): Promise<string[]> => {
    const printed = (await repo.git(['log', `--format=%H${SEP}%an${SEP}%s`, ...EVERY_REF]))
      .split('\n')
      .filter((line) => line.length > 0);
    const byRow: string[] = [];
    for (const line of printed) byRow[historyRowOf(generation.history, line.slice(0, 40))] = line;
    return byRow;
  };

  beforeEach(async () => {
    repo = await openScratchRepo('oh-log-history-texts-');
    await seedHistory(repo);
    asked = [];
    instead = null;
    onMoved = () => undefined;
    openOn(repo.rootDir);
  });

  afterEach(async () => {
    texts.close();
    history.close();
    await repo.remove();
  });

  it('lays on every row of a reading its own commit’s subject and author', async () => {
    const generation = await reading();
    const held = await laid(generation);
    expect(held.textOf).toHaveLength(14);
    expect(lines(generation, held)).toEqual(await own(generation));
    expect(held.store.count).toBe(14);
    expect(held.store.authors).toEqual(expect.arrayContaining(['John Doe', 'Jane Doe']));
    expect(held.store.authors).toHaveLength(2);
    expect(walks()).toBe(1);
    expect(named()).toEqual([]);
  });

  it('lays a reading once: asked again, and asked twice at once, it is the same texts and one read', async () => {
    const generation = await reading();
    const [first, second] = await Promise.all([laid(generation), laid(generation)]);
    expect(second.textOf).toBe(first.textOf);
    expect((await laid(generation)).textOf).toBe(first.textOf);
    expect(asked).toHaveLength(1);
  });

  it('reads only the commit a later reading gained, by its hash — every other row finds its text again', async () => {
    const before = await laid(await reading());
    await repo.commit('Größe ändern — naïve café', 'notes.md', JANE);
    const generation = await nextReading();
    const held = await laid(generation);
    expect(held.textOf).toHaveLength(15);
    expect(lines(generation, held)).toEqual(await own(generation));
    expect(walks()).toBe(1);
    expect(named()).toEqual([[await repo.shaOf('Größe ändern — naïve café')]]);
    // The store only grew, by the one text.
    expect(held.store).toBe(before.store);
    expect(held.store.count).toBe(15);
  });

  it('walks every ref again where a later reading gained more than an eighth of its commits', async () => {
    const before = await laid(await reading());
    for (const subject of ['Third hotfix', 'Fourth hotfix', 'Fifth hotfix']) await repo.commit(subject, 'notes.md');
    const generation = await nextReading();
    const held = await laid(generation);
    expect(lines(generation, held)).toEqual(await own(generation));
    expect(walks()).toBe(2);
    expect(named()).toEqual([]);
    // The walk prints every commit; only the three without a text are added.
    expect(held.store).toBe(before.store);
    expect(held.store.count).toBe(17);
  });

  it('names two of sixteen commits by hash: an eighth is not more than an eighth', async () => {
    await laid(await reading());
    await repo.commit('Third hotfix', 'notes.md');
    await repo.commit('Fourth hotfix', 'notes.md');
    const generation = await nextReading();
    expect(lines(generation, await laid(generation))).toEqual(await own(generation));
    expect(walks()).toBe(1);
    expect(named().map((batch) => batch.length)).toEqual([2]);
  });

  it('reads nothing for a later reading that only lost commits, and renumbers the rows it kept', async () => {
    const first = await reading();
    const before = await laid(first);
    const spike = await repo.shaOf('Unmerged spike');
    await repo.git(['branch', '-D', 'other']);
    const generation = await nextReading();
    const held = await laid(generation);
    expect(held.textOf).toHaveLength(13);
    expect(lines(generation, held)).toEqual(await own(generation));
    expect(asked).toHaveLength(1);
    expect(held.store.count).toBe(14);
    // The reading before is laid again from the one after — the commit that one lost is read by its hash.
    const again = await laid(first);
    expect(lines(first, again)).toEqual(lines(first, before));
    expect(named()).toEqual([[spike]]);
  });

  it('gives a commit made since the reading no text — it has no row yet', async () => {
    const generation = await reading();
    await repo.commit('Made after the reading', 'notes.md');
    const held = await laid(generation);
    expect(held.textOf).toHaveLength(14);
    expect(held.store.count).toBe(14);
    expect(lines(generation, held).some((line) => line.endsWith('Made after the reading'))).toBe(false);
    expect(held.textOf.includes(-1)).toBe(false);
  });

  it('answers a read that failed as its reason, and reads from nothing the next time — no text twice', async () => {
    const generation = await reading();
    // Git printed half of the history, then ended with an error.
    instead = async (args, options, read) => {
      let printed = '';
      await stream(args, options, (chunk) => {
        printed += chunk;
      });
      await read(`${printed.split('\n').slice(0, 5).join('\n')}\n`);
      return { ...DONE, code: 128 };
    };
    expect(await texts.of(generation)).toEqual({ ok: false, reason: 'failed' });
    instead = async () => ({ ...DONE, code: -1, timedOut: true });
    expect(await texts.of(generation)).toEqual({ ok: false, reason: 'timeout' });
    instead = () => Promise.reject(new Error('the reader broke'));
    expect(await texts.of(generation)).toEqual({ ok: false, reason: 'failed' });
    instead = null;
    const held = await laid(generation);
    expect(lines(generation, held)).toEqual(await own(generation));
    expect(held.store.count).toBe(14);
    expect(asked).toHaveLength(4);
  });

  it('answers everyone who asked while a read was in flight with that read’s refusal — one read, not one each', async () => {
    const generation = await reading();
    instead = async () => ({ ...DONE, code: -1, timedOut: true });
    const refusals = await Promise.all([texts.of(generation), texts.of(generation), texts.of(generation)]);
    expect(refusals).toEqual(Array(3).fill({ ok: false, reason: 'timeout' }));
    expect(asked).toHaveLength(1);
    // The refusal was that read's: the next ask reads again.
    instead = null;
    expect(lines(generation, await laid(generation))).toEqual(await own(generation));
    expect(asked).toHaveLength(2);
  });

  it('lays two readings asked at once each over its own rows — a lay in flight answers for its reading alone', async () => {
    const first = await reading();
    await repo.commit('Third hotfix', 'notes.md');
    const second = await nextReading();
    const [one, two] = await Promise.all([laid(first), laid(second)]);
    expect(one.textOf).toHaveLength(14);
    expect(two.textOf).toHaveLength(15);
    expect(lines(second, two)).toEqual(await own(second));
    // The reading before holds every commit of the one after but the newest, in the same order.
    expect(lines(first, one)).toEqual(lines(second, two).filter((line) => !line.endsWith('Third hotfix')));
  });

  it('ends a read in flight when nobody reads the texts any more, and answers closed from then on', async () => {
    const generation = await reading();
    let started: () => void = () => undefined;
    const reached = new Promise<void>((resolve) => {
      started = resolve;
    });
    // Git that never prints: only the signal ends it.
    instead = (_args, options) => {
      started();
      return new Promise((resolve) => {
        options.signal?.addEventListener('abort', () => resolve({ ...DONE, code: -1, aborted: true }), { once: true });
      });
    };
    const waiting = texts.of(generation);
    await reached;
    texts.close();
    expect(await waiting).toEqual({ ok: false, reason: 'closed' });
    expect(await texts.of(generation)).toEqual({ ok: false, reason: 'closed' });
  });

  it('lays nothing over a repo with no commit, and walks once its first commit lands', async () => {
    const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'oh-log-history-texts-empty-'));
    texts.close();
    history.close();
    try {
      await ensureWorkspaceRepo(run, empty);
      openOn(empty);
      expect((await laid(await reading())).textOf).toHaveLength(0);
      expect(asked).toEqual([]);
      await fs.writeFile(path.join(empty, 'orders.yaml'), 'first\n', 'utf-8');
      const identity = ['-c', `user.name=${JOHN.name}`, '-c', `user.email=${JOHN.email}`];
      await run([...repoArgs(empty), 'add', '-A'], { cwd: empty });
      await run([...repoArgs(empty), ...identity, 'commit', '-m', 'First commit'], { cwd: empty });
      const generation = await nextReading();
      const held = await laid(generation);
      expect(held.textOf).toHaveLength(1);
      expect(held.store.subjectOf(held.textOf[0])).toBe('First commit');
      expect(walks()).toBe(1);
    } finally {
      await fs.rm(empty, { recursive: true, force: true });
    }
  });
});
