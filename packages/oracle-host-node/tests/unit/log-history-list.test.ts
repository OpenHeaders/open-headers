/**
 * The list an ask names (`history/derive-list`, through the histories'
 * one door): a scope's rows, the topological order, First Parent, No
 * Merges, the commits a walk under User / Date / Paths names, the
 * folded runs — each held to what git itself lists for the same ask —
 * with the joins a sifted or folded row carries, the colours a sifted
 * commit keeps, the band, and the layout made whole. Real git in a
 * scratch repo.
 */

import { computeLogGraph, logGraphRows } from '@openheaders/core/workspace-tree';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { historyShaOf } from '../../src/git/log-skeleton';
import type { LogTextAsk } from '../../src/git/log-text-flags';
import {
  createLogHistories,
  type LogAsk,
  type LogHistories,
  type LogList,
  NO_FOLDS,
} from '../../src/workspace-tree/history';
import { EVERY_REF, objects, openScratchRepo, run, type ScratchRepo, seedHistory, stream } from './_log-history-repo';

const WHOLE = [
  'Remote hotfix',
  'Unmerged spike',
  'Release notes',
  'Tidy the docs',
  'Rename the collection',
  'Rename the request',
  'Add staging environment',
  'Document the API',
  'Merge the side branch',
  'Bump version',
  'More side work',
  'Side work',
  'Fix response panel',
  'Add orders request',
];

const without = (subjects: readonly string[]): string[] => WHOLE.filter((subject) => !subjects.includes(subject));

describe('the list an ask names', () => {
  let repo: ScratchRepo;
  let histories: LogHistories;

  const read = async (over: Partial<LogAsk> = {}, from: ScratchRepo = repo): Promise<LogList> => {
    const ask: LogAsk = {
      scope: null,
      topological: false,
      firstParent: false,
      noMerges: false,
      walk: null,
      text: null,
      folds: NO_FOLDS,
      ...over,
    };
    const result = await histories.list(from.rootDir, from.rootDir, ask);
    if (!result.ok) throw new Error(`list refused: ${result.reason}`);
    return result.list;
  };
  const plain = (text: string, matchCase = false): LogTextAsk => ({ text, regex: false, matchCase });
  const pattern = (text: string): LogTextAsk => ({ text, regex: true, matchCase: false });
  const hashes = (list: LogList): string[] =>
    Array.from(list.historyRows, (row) => historyShaOf(list.generation.history, row));
  const titles = (list: LogList): Promise<string[]> => repo.subjects(hashes(list));
  /** What a row is joined to: each parent's subject, and whether the join passes over hidden commits. */
  const joins = async (list: LogList, subject: string): Promise<Array<[string, number]>> => {
    const names = await titles(list);
    const row = names.indexOf(subject);
    const { starts, parents, skips } = list.skeleton;
    return Array.from(parents.subarray(starts[row], starts[row + 1]), (parent, at) => [
      names[parent] ?? 'outside',
      skips?.[starts[row] + at] ?? 0,
    ]);
  };
  const gitLists = (...flags: string[]): Promise<string[]> => repo.shas('--date-order', ...flags);

  beforeAll(async () => {
    repo = await openScratchRepo('oh-log-history-list-');
    await seedHistory(repo);
    histories = createLogHistories({
      run,
      stream,
      objects,
      readTimeoutMs: 20_000,
      walkTimeoutMs: 20_000,
      textsTimeoutMs: 20_000,
      patternDeadlineMs: 5_000,
      maxPatterns: 4,
      idleMs: 600_000,
      maxLists: 4,
      onMoved: () => undefined,
    });
  });

  afterAll(async () => {
    histories.dispose();
    await repo.remove();
  });

  it('lists every ref’s history in the log’s order, its graph laid out whole', async () => {
    const list = await read();
    expect(hashes(list)).toEqual(await gitLists(...EVERY_REF));
    expect(await titles(list)).toEqual(WHOLE);
    expect(list.layout.swept).toBe(WHOLE.length);
    const cells = computeLogGraph(list.graph);
    expect(logGraphRows(list.graph, list.layout, 0, WHOLE.length)).toEqual(cells);
    expect(logGraphRows(list.graph, list.layout, 5, 3)).toEqual(cells.slice(5, 8));
    // A branch's commit inside the trunk starts that branch's colour where the trunk's lane reaches it.
    expect((await titles(list))[6]).toBe('Add staging environment');
    expect(cells[6].color).not.toBe(cells[5].color);
  });

  it('lists what a scope’s refs reach, in the same order', async () => {
    const scopes = [['side'], ['HEAD', 'other'], ['v1'], [repo.trunk, 'side'], ['HEAD'], [`origin/${repo.trunk}`]];
    for (const scope of scopes) {
      expect(hashes(await read({ scope }))).toEqual(await gitLists(...scope));
    }
  });

  it('refuses a scope with a ref the history does not hold, naming it', async () => {
    const ask: LogAsk = {
      scope: ['side', 'nowhere', 'HEAD', 'gone'],
      topological: false,
      firstParent: false,
      noMerges: false,
      walk: null,
      text: null,
      folds: NO_FOLDS,
    };
    expect(await histories.list(repo.rootDir, repo.rootDir, ask)).toEqual({
      ok: false,
      reason: 'unknown-ref',
      unknownRefs: ['nowhere', 'gone'],
    });
  });

  it('flags the rows the checked-out commit reaches', async () => {
    const list = await read();
    const onHead = new Set(await gitLists('HEAD'));
    expect(onHead.size).toBe(WHOLE.length - 2);
    expect(hashes(list).filter((_, row) => list.generation.onHead[list.historyRows[row]] === 1)).toEqual(
      hashes(list).filter((sha) => onHead.has(sha)),
    );
  });

  it('re-lists topologically: the checked-out commit leads, its upstream is the last head, a merged branch sits under its merge', async () => {
    expect(await titles(await read({ topological: true }))).toEqual([
      'Release notes',
      'Unmerged spike',
      'Tidy the docs',
      'Rename the collection',
      'Rename the request',
      'Remote hotfix',
      'Add staging environment',
      'Document the API',
      'Merge the side branch',
      'More side work',
      'Side work',
      'Bump version',
      'Fix response panel',
      'Add orders request',
    ]);
  });

  it('No Merges hides the merges and keeps the graph: the commit above one joins what it merged', async () => {
    const list = await read({ noMerges: true });
    expect(hashes(list)).toEqual(await gitLists('--no-merges', ...EVERY_REF));
    expect(await titles(list)).toEqual(without(['Merge the side branch']));
    expect(await joins(list, 'Document the API')).toEqual([
      ['Bump version', 1],
      ['More side work', 1],
    ]);
    expect(await joins(list, 'Bump version')).toEqual([['Fix response panel', 0]]);
    expect(list.folding).toBeNull();
  });

  it('a sifted commit wears the colour it has in the unsifted list', async () => {
    const sifts: Array<Partial<LogAsk>> = [
      { noMerges: true },
      { walk: { author: 'Jane' } },
      { firstParent: true, scope: [repo.trunk, 'other'] },
      { text: plain('side') },
      { text: pattern('^(add|fix) ') },
    ];
    for (const over of sifts) {
      const whole = await read({ scope: over.scope ?? null });
      const colorOf = new Map(Array.from(whole.historyRows, (row, at) => [row, whole.layout.colors[at]]));
      const list = await read(over);
      expect(Array.from(list.layout.colors)).toEqual(Array.from(list.historyRows, (row) => colorOf.get(row)));
    }
    // Jane's commit on the trunk wears the colour of the branch on it — laid out on its own it would wear the first.
    const jane = await read({ walk: { author: 'Jane' } });
    expect((await titles(jane))[1]).toBe('Add staging environment');
    expect(jane.layout.colors[1]).not.toBe(jane.layout.colors[0]);
  });

  it('First Parent lists what git’s first-parent walk lists, from every ref the log walks', async () => {
    const all = await read({ firstParent: true });
    expect(hashes(all)).toEqual(await gitLists('--first-parent', ...EVERY_REF));
    // A merge keeps its first parent alone.
    expect(await joins(all, 'Merge the side branch')).toEqual([['Bump version', 0]]);

    const trunk = await read({ firstParent: true, scope: [repo.trunk] });
    expect(hashes(trunk)).toEqual(await gitLists('--first-parent', repo.trunk));
    expect(await titles(trunk)).toEqual(without(['Remote hotfix', 'Unmerged spike', 'More side work', 'Side work']));

    // A scope's ref that only a merge's side parent leads to is walked from all the same.
    const both = await read({ firstParent: true, scope: [repo.trunk, 'side'] });
    expect(hashes(both)).toEqual(await gitLists('--first-parent', repo.trunk, 'side'));
    expect(await titles(both)).toEqual(without(['Remote hotfix', 'Unmerged spike']));
  });

  it('User, Date and Paths list the commits git names, joined through the hidden ones', async () => {
    const jane = await read({ walk: { author: 'Jane' } });
    expect(hashes(jane)).toEqual(await gitLists('-i', '--author=Jane', ...EVERY_REF));
    // The remote's commit is on no branch the checked-out commit reaches: every ref is walked.
    expect(await titles(jane)).toEqual(['Remote hotfix', 'Add staging environment', 'More side work', 'Side work']);
    expect(await joins(jane, 'Remote hotfix')).toEqual([['Add staging environment', 0]]);
    expect(await joins(jane, 'Add staging environment')).toEqual([['More side work', 1]]);
    expect(await joins(jane, 'More side work')).toEqual([['Side work', 0]]);

    expect(hashes(await read({ walk: { authors: ['Jane', 'nobody'] } }))).toEqual(hashes(jane));
    expect(hashes(await read({ walk: { author: 'Jane' }, scope: ['side'] }))).toEqual(
      await gitLists('-i', '--author=Jane', 'side'),
    );

    expect(hashes(await read({ walk: { paths: ['side.txt'] } }))).toEqual(
      await gitLists(...EVERY_REF, '--', 'side.txt'),
    );

    const documented = (await repo.git(['log', '-1', '--format=%cI', await repo.shaOf('Document the API')])).trim();
    const since = await read({ walk: { since: documented } });
    expect(hashes(since)).toEqual(await gitLists(`--since=${documented}`, ...EVERY_REF));
    expect(await titles(since)).toEqual(WHOLE.slice(0, 8));
    expect(hashes(await read({ walk: { until: documented } }))).toEqual(
      await gitLists(`--until=${documented}`, ...EVERY_REF),
    );

    // No Merges on top of a walk: both sift the one list.
    expect(hashes(await read({ walk: { since: documented }, noMerges: true }))).toEqual(
      await gitLists('--no-merges', `--since=${documented}`, ...EVERY_REF),
    );
  });

  it('under First Parent a path’s change a merge brought in is the merge’s — as git has it', async () => {
    const list = await read({ firstParent: true, scope: [repo.trunk], walk: { paths: ['side.txt'] } });
    expect(hashes(list)).toEqual(await gitLists('--first-parent', repo.trunk, '--', 'side.txt'));
    expect(await titles(list)).toEqual(['Merge the side branch']);
  });

  it('the text field lists EVERY commit it matches — by subject, by hash, by a pattern — in the order asked for', async () => {
    expect(await titles(await read({ text: plain('side') }))).toEqual([
      'Merge the side branch',
      'More side work',
      'Side work',
    ]);
    expect((await read({ text: plain('SIDE', true) })).skeleton.count).toBe(0);
    expect(await titles(await read({ text: pattern('^(add|fix) ') }))).toEqual([
      'Add staging environment',
      'Fix response panel',
      'Add orders request',
    ]);
    const bumped = await repo.shaOf('Bump version');
    expect(await titles(await read({ text: plain(bumped.slice(0, 12)) }))).toEqual(['Bump version']);
    expect(await titles(await read({ text: pattern('hotfix|spike|bump') }))).toEqual([
      'Remote hotfix',
      'Unmerged spike',
      'Bump version',
    ]);
    expect(await titles(await read({ text: pattern('hotfix|spike|bump'), topological: true }))).toEqual([
      'Unmerged spike',
      'Remote hotfix',
      'Bump version',
    ]);
  });

  it('a text that names an author lists what the walk under that User lists — the same rows, joins and colours', async () => {
    const walked = await read({ walk: { author: 'Jane' } });
    const matched = await read({ text: plain('jane') });
    expect(hashes(matched)).toEqual(hashes(walked));
    expect(Array.from(matched.skeleton.starts)).toEqual(Array.from(walked.skeleton.starts));
    expect(Array.from(matched.skeleton.parents)).toEqual(Array.from(walked.skeleton.parents));
    expect(Array.from(matched.skeleton.skips ?? [])).toEqual(Array.from(walked.skeleton.skips ?? []));
    expect(Array.from(matched.layout.colors)).toEqual(Array.from(walked.layout.colors));
    expect(await joins(matched, 'Add staging environment')).toEqual([['More side work', 1]]);
    expect(matched.folding).toBeNull();
  });

  it('a text sifts the one list the other sifts do — each leaves out its own', async () => {
    expect(await titles(await read({ text: plain('side'), noMerges: true }))).toEqual(['More side work', 'Side work']);
    expect(await titles(await read({ text: plain('side'), firstParent: true, scope: [repo.trunk] }))).toEqual([
      'Merge the side branch',
    ]);
    expect(await titles(await read({ text: pattern('orders|side'), scope: ['side'] }))).toEqual([
      'More side work',
      'Side work',
      'Add orders request',
    ]);
    // A walk and a text: a commit is listed where git names it AND the text matches it.
    const documented = (await repo.git(['log', '-1', '--format=%cI', await repo.shaOf('Document the API')])).trim();
    expect(await titles(await read({ walk: { since: documented } }))).toHaveLength(8);
    expect(await titles(await read({ text: plain('jane') }))).toHaveLength(4);
    expect(await titles(await read({ walk: { since: documented }, text: plain('jane') }))).toEqual([
      'Remote hotfix',
      'Add staging environment',
    ]);
  });

  it('folds the linear runs it is asked to — all of them, the ones named, or all but the ones named', async () => {
    const open = await read();
    expect(open.folding?.runs.count).toBe(4);
    expect(open.folding?.rows).toBeNull();

    const all = await read({ folds: { all: true, runs: [] } });
    expect(await titles(all)).toEqual(
      without(['Rename the collection', 'Rename the request', 'Document the API', 'Bump version', 'Side work']),
    );
    // The run's top reaches its bottom over the commits the fold hides.
    expect(await joins(all, 'Tidy the docs')).toEqual([['Add staging environment', 1]]);
    expect(await joins(all, 'Merge the side branch')).toEqual([
      ['Fix response panel', 1],
      ['More side work', 0],
    ]);
    expect(all.layout.swept).toBe(9);

    const first = await repo.shaOf('Rename the collection');
    expect(await titles(await read({ folds: { all: false, runs: [first] } }))).toEqual(
      without(['Rename the collection', 'Rename the request']),
    );
    expect(await titles(await read({ folds: { all: true, runs: [first] } }))).toEqual(
      without(['Document the API', 'Bump version', 'Side work']),
    );
  });

  it('folds nothing for a name that is no run’s first commit, and nothing on a sifted list', async () => {
    const inside = await repo.shaOf('Rename the request');
    const anEnd = await repo.shaOf('Tidy the docs');
    for (const runs of [[inside], [anEnd], ['f'.repeat(40)], ['not a hash']]) {
      expect(await titles(await read({ folds: { all: false, runs } }))).toEqual(WHOLE);
    }
    const sifted = await read({ noMerges: true });
    expect(await read({ noMerges: true, folds: { all: true, runs: [] } })).toBe(sifted);
    // A text sifts: its list folds nothing either, and is one list whatever blanks were typed around it.
    const matched = await read({ text: plain('side') });
    expect(await read({ text: plain('side'), folds: { all: true, runs: [] } })).toBe(matched);
    expect(await read({ text: plain('  side ') })).toBe(matched);
    expect(await read({ text: pattern('side') })).not.toBe(matched);
  });

  it('never runs a fold across the checked-out commit, and reads a name as git does — a tag before a branch', async () => {
    const small = await openScratchRepo('oh-log-history-small-');
    try {
      for (const subject of ['One', 'Two', 'Three', 'Four', 'Five']) await small.commit(subject, 'notes.md');
      await small.git(['branch', 'twin', 'HEAD~3']);
      await small.git(['tag', 'twin', 'HEAD~4']);
      await small.git(['checkout', '-q', '--detach', 'HEAD~2']);
      const list = await read({}, small);
      // Five, [Four], Three (checked out), Two (the branch), One (the tag): one run, and it stops at Three.
      expect(list.folding?.runs.count).toBe(1);
      expect(Array.from(list.folding?.runs.lengths ?? [])).toEqual([1]);
      expect(hashes(list).filter((_, row) => list.generation.onHead[row] === 1)).toEqual(
        await small.shas('--date-order', 'HEAD'),
      );
      expect(hashes(await read({ scope: ['twin'] }, small))).toEqual(await small.shas('--date-order', 'twin'));
      expect((await read({ scope: ['twin'] }, small)).skeleton.count).toBe(1);
    } finally {
      histories.drop(small.rootDir);
      await small.remove();
    }
  });

  it('lists nothing for a repo with no commit', async () => {
    const empty = await openScratchRepo('oh-log-history-empty-');
    try {
      const list = await read({}, empty);
      expect(list.skeleton.count).toBe(0);
      expect(list.layout.swept).toBe(0);
      expect((await read({ noMerges: true, topological: true }, empty)).skeleton.count).toBe(0);
      expect((await read({ text: plain('side') }, empty)).skeleton.count).toBe(0);
      expect((await read({ text: pattern('side') }, empty)).skeleton.count).toBe(0);
    } finally {
      histories.drop(empty.rootDir);
      await empty.remove();
    }
  });
});
