/**
 * A stretch of a list's rows as a view is handed them
 * (`history/log-rows`, `history/list-runs`) and a commit's place in a
 * list (`history/locate`): each commit in full, its graph cell, the
 * band's flag, the rows its joins and its child sit on, the linear run
 * a row and an edge belong to — unfolded, folded, and none on a sifted
 * list. Real git in a scratch repo.
 */

import { computeLogGraph } from '@openheaders/core/workspace-tree';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createLogHistories,
  type LogAsk,
  type LogHistories,
  type LogList,
  type LogRow,
  locateLogRow,
  NO_FOLDS,
  readLogRows,
} from '../../src/workspace-tree/history';
import { openScratchRepo, run, type ScratchRepo, seedHistory, stream } from './_log-history-repo';

/** The rows of the whole list, by the letters the scratch history is drawn with. */
const ROW = { R: 0, O: 1, H: 2, G: 3, F2: 4, F: 5, E: 6, D: 7, M: 8, C: 9, S2: 10, S1: 11, B: 12, A: 13 };

describe('a stretch of a list’s rows', () => {
  let repo: ScratchRepo;
  let histories: LogHistories;

  const list = async (over: Partial<LogAsk> = {}): Promise<LogList> => {
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
    const result = await histories.list(repo.rootDir, repo.rootDir, ask);
    if (!result.ok) throw new Error(`list refused: ${result.reason}`);
    return result.list;
  };
  const page = async (of: LogList, from: number, count: number) => {
    const read = await readLogRows(run, repo.rootDir, of, from, count);
    if (read === null) throw new Error('rows refused');
    return read;
  };
  /** The edges of a row's cell as `child>parent` and the run each carries. */
  const edgeRuns = (row: LogRow): Array<[string, number | undefined]> =>
    row.cell.edges.map((edge) => [`${edge.child}>${edge.parent}`, edge.run]);

  beforeAll(async () => {
    repo = await openScratchRepo('oh-log-history-rows-');
    await seedHistory(repo);
    histories = createLogHistories({
      run,
      stream,
      readTimeoutMs: 20_000,
      walkTimeoutMs: 20_000,
      textsTimeoutMs: 20_000,
      patternDeadlineMs: 5_000,
      idleMs: 600_000,
      maxLists: 4,
      onMoved: () => undefined,
    });
  });

  afterAll(async () => {
    histories.dispose();
    await repo.remove();
  });

  it('reads each commit in full, with its cell, the band’s flag, and where its joins and its child sit', async () => {
    const whole = await list();
    const { rows } = await page(whole, ROW.G, 4);
    expect(rows.map((row) => row.entry.subject)).toEqual([
      'Tidy the docs',
      'Rename the collection',
      'Rename the request',
      'Add staging environment',
    ]);
    expect(rows[0].entry).toMatchObject({
      sha: await repo.shaOf('Tidy the docs'),
      parents: [await repo.shaOf('Rename the collection')],
      authorName: 'John Doe',
      authorEmail: 'john.doe@openheaders.io',
      files: [{ status: 'M', path: 'docs.md' }],
      onHead: true,
    });
    expect(rows[3].entry).toMatchObject({ authorName: 'Jane Doe', files: [{ status: 'A', path: 'env.yaml' }] });

    const cells = computeLogGraph(whole.graph).slice(ROW.G, ROW.G + 4);
    expect(rows.map((row) => ({ lane: row.cell.lane, color: row.cell.color, laneCount: row.cell.laneCount }))).toEqual(
      cells.map((cell) => ({ lane: cell.lane, color: cell.color, laneCount: cell.laneCount })),
    );
    expect(rows.map((row) => row.cell.edges.map(({ run: _run, ...edge }) => edge))).toEqual(
      cells.map((cell) => cell.edges),
    );

    expect(rows.map((row) => row.parents)).toEqual([[ROW.F2], [ROW.F], [ROW.E], [ROW.D]]);
    // Two branches leave Tidy the docs and two leave Add staging environment: the child is the nearest row above.
    expect(rows.map((row) => row.child)).toEqual([ROW.H, ROW.G, ROW.F2, ROW.F]);

    const top = await page(whole, 0, 3);
    expect(top.rows.map((row) => [row.entry.subject, row.entry.onHead, row.child])).toEqual([
      ['Remote hotfix', false, -1],
      ['Unmerged spike', false, -1],
      ['Release notes', true, -1],
    ]);
    // A list that is not the whole history reads the band off the history's own rows.
    const other = await page(await list({ scope: ['other'] }), 0, 3);
    expect(other.rows.map((row) => [row.entry.subject, row.entry.onHead])).toEqual([
      ['Unmerged spike', false],
      ['Tidy the docs', true],
      ['Rename the collection', true],
    ]);
    // The first commit's parent is outside every list: it has none.
    expect((await page(whole, ROW.A, 1)).rows[0].parents).toEqual([]);
  });

  it('answers fewer rows where the list ends, and none past it', async () => {
    const whole = await list();
    expect((await page(whole, ROW.B, 400)).rows.map((row) => row.entry.subject)).toEqual([
      'Fix response panel',
      'Add orders request',
    ]);
    expect(await page(whole, 14, 10)).toEqual({ rows: [], runs: [] });
    expect(await page(whole, 5_000, 10)).toEqual({ rows: [], runs: [] });
    expect(await page(whole, -1, 10)).toEqual({ rows: [], runs: [] });
  });

  it('names the run a row sits in or leads into, and the run each edge is a step of', async () => {
    const whole = await list();
    const { rows, runs } = await page(whole, ROW.H, 6);
    const [h, g, f2, f, e, d] = rows;
    // Release notes leads into no stretch (two branches leave the commit under it); Tidy the docs tops the renames' run.
    expect(h.run).toBeUndefined();
    expect('run' in h).toBe(false);
    expect([g.run, f2.run, f.run]).toEqual([0, 0, 0]);
    // The run's bottom is no part of it: a pointer over it names the run under it.
    expect([e.run, d.run]).toEqual([1, 1]);
    expect(runs).toEqual([
      { run: 0, first: await repo.shaOf('Rename the collection'), top: ROW.G, bottom: ROW.E, hidden: 2, folded: false },
      { run: 1, first: await repo.shaOf('Document the API'), top: ROW.E, bottom: ROW.M, hidden: 1, folded: false },
    ]);

    const steps = new Map([...edgeRuns(g), ...edgeRuns(f2), ...edgeRuns(f), ...edgeRuns(e)]);
    expect(steps.get(`${ROW.G}>${ROW.F2}`)).toBe(0);
    expect(steps.get(`${ROW.F2}>${ROW.F}`)).toBe(0);
    expect(steps.get(`${ROW.F}>${ROW.E}`)).toBe(0);
    expect(steps.get(`${ROW.E}>${ROW.D}`)).toBe(1);
    // The remote's line into the run's bottom, and the checked-out commit's into its top, are no step of it.
    expect(steps.has(`${ROW.R}>${ROW.E}`)).toBe(true);
    expect(steps.get(`${ROW.R}>${ROW.E}`)).toBeUndefined();
    expect(steps.get(`${ROW.H}>${ROW.G}`)).toBeUndefined();
  });

  it('on a folded list either end of a run names it, and its one line is its edge', async () => {
    const folded = await list({ folds: { all: true, runs: [] } });
    const { rows, runs } = await page(folded, 0, 400);
    expect(rows.map((row) => row.entry.subject)).toEqual([
      'Remote hotfix',
      'Unmerged spike',
      'Release notes',
      'Tidy the docs',
      'Add staging environment',
      'Merge the side branch',
      'More side work',
      'Fix response panel',
      'Add orders request',
    ]);
    const [, , , g, e, m, s2, b] = rows;
    expect([g.run, e.run, m.run, s2.run, b.run]).toEqual([0, 0, 1, 3, 2]);
    expect(runs.map((found) => [found.run, found.top, found.bottom, found.hidden, found.folded])).toEqual([
      [0, 3, 4, 2, true],
      [1, 4, 5, 1, true],
      [2, 5, 7, 1, true],
      [3, 6, 7, 1, true],
    ]);
    expect(runs[0].first).toBe(await repo.shaOf('Rename the collection'));
    // The fold's line: flagged as passing over hidden commits, and the run's.
    expect(g.cell.edges.filter((edge) => edge.span === 'bottom')).toMatchObject([
      { child: 3, parent: 4, collapsed: true, run: 0 },
    ]);
    expect(new Map(edgeRuns(m)).get('5>7')).toBe(2);
    // The merge's side line is a plain join to a commit that stands: no run's.
    expect(new Map(edgeRuns(m)).get('5>6')).toBeUndefined();
    expect(g.parents).toEqual([4]);
    expect(e.child).toBe(3);
  });

  it('names no run on a sifted list', async () => {
    const { rows, runs } = await page(await list({ noMerges: true }), 0, 400);
    expect(runs).toEqual([]);
    expect(rows.some((row) => 'run' in row || row.cell.edges.some((edge) => 'run' in edge))).toBe(false);
    // The commit above the hidden merge is joined to both sides of it.
    const documented = rows.find((row) => row.entry.subject === 'Document the API');
    expect(documented?.parents.map((parent) => rows[parent].entry.subject)).toEqual(['Bump version', 'More side work']);
  });

  it('finds a commit’s row by its hash, by a ref’s name, and by the start of a hash', async () => {
    const whole = await list();
    const documented = await repo.shaOf('Document the API');
    expect(locateLogRow(whole, documented)).toEqual({ found: true, row: ROW.D });
    expect(locateLogRow(whole, documented.toUpperCase())).toEqual({ found: true, row: ROW.D });
    expect(locateLogRow(whole, documented.slice(0, 8))).toEqual({ found: true, row: ROW.D });
    expect(locateLogRow(whole, documented.slice(0, 4))).toEqual({ found: true, row: ROW.D });
    expect(locateLogRow(whole, 'HEAD')).toEqual({ found: true, row: ROW.H });
    expect(locateLogRow(whole, repo.trunk)).toEqual({ found: true, row: ROW.H });
    expect(locateLogRow(whole, 'v1')).toEqual({ found: true, row: ROW.M });
    expect(locateLogRow(whole, `origin/${repo.trunk}`)).toEqual({ found: true, row: ROW.R });

    for (const target of [documented.slice(0, 3), 'f'.repeat(40), 'nowhere', 'head', '']) {
      expect(locateLogRow(whole, target)).toEqual({ found: false, reason: 'not-found' });
    }
  });

  it('says a commit the list leaves out is not listed', async () => {
    const missing = { found: false, reason: 'not-listed' };
    expect(locateLogRow(await list({ noMerges: true }), 'v1')).toEqual(missing);
    expect(locateLogRow(await list({ scope: ['side'] }), 'HEAD')).toEqual(missing);
    const renamed = await repo.shaOf('Rename the request');
    expect(locateLogRow(await list({ folds: { all: true, runs: [] } }), renamed)).toEqual(missing);
    // Where a list re-orders, a commit is found where it is listed.
    expect(locateLogRow(await list({ topological: true }), 'HEAD')).toEqual({ found: true, row: 0 });
  });

  it('refuses a stretch whose commits git no longer holds', async () => {
    const gone = await openScratchRepo('oh-log-history-gone-');
    try {
      await gone.commit('One', 'notes.md');
      await gone.commit('Two', 'notes.md');
      const ask: LogAsk = {
        scope: null,
        topological: false,
        firstParent: false,
        noMerges: false,
        walk: null,
        text: null,
        folds: NO_FOLDS,
      };
      const held = await histories.list(gone.rootDir, gone.rootDir, ask);
      if (!held.ok) throw new Error(held.reason);
      // The newest commit is taken out of the repo under the list.
      await gone.git(['update-ref', 'HEAD', 'HEAD~1']);
      await gone.git(['reflog', 'expire', '--expire=now', '--all']);
      await gone.git(['gc', '-q', '--prune=now']);
      expect(await readLogRows(run, gone.rootDir, held.list, 0, 10)).toBeNull();
    } finally {
      histories.drop(gone.rootDir);
      await gone.remove();
    }
  });
});
