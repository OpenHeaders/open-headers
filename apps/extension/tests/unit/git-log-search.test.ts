/**
 * The log's text search, the reference's reading: the filter says WHERE
 * it matched (what a row paints), and the commits that stay keep a
 * graph — each joined to the nearest listed commits it descends from, a
 * join through hidden commits named so it draws as stubs, every commit
 * in the colour it wears in the whole log.
 */

import { computeLogGraph, edgeKey } from '@openheaders/ui/workbench/components/panels/git/graph';
import {
  contractLog,
  firstParentOnly,
  firstParentReach,
} from '@openheaders/ui/workbench/components/panels/git/graph-filtered';
import { makeTextMatcher } from '@openheaders/ui/workbench/components/panels/git/toolbar/log-filters';
import { describe, expect, it } from 'vitest';

const commit = (sha: string, ...parents: string[]) => ({ sha, parents });
const listed = (...shas: string[]) => new Set(shas);

const rangesOf = (filter: string, regex: boolean, matchCase: boolean, text: string) => {
  const matcher = makeTextMatcher(filter, regex, matchCase);
  if (matcher.kind !== 'match') throw new Error(`no matcher for ${filter}`);
  return matcher.ranges(text);
};

describe('the text filter says where it matched', () => {
  it('ranges every occurrence, whatever its case, on the text itself', () => {
    expect(rangesOf('or', false, false, 'Orders for workers')).toEqual([
      [0, 2],
      [8, 10],
      [12, 14],
    ]);
  });

  it('keeps the case when asked to', () => {
    expect(rangesOf('or', false, true, 'Orders for workers')).toEqual([
      [8, 10],
      [12, 14],
    ]);
  });

  it('reads a plain text as itself — a dot is a dot', () => {
    expect(rangesOf('v2.', false, false, 'v2x then v2.')).toEqual([[9, 12]]);
  });

  it('ranges a pattern’s matches and nothing for a text it misses', () => {
    expect(rangesOf('o.d', true, false, 'order old')).toEqual([
      [0, 3],
      [6, 9],
    ]);
    expect(rangesOf('zzz', false, false, 'order old')).toEqual([]);
    expect(makeTextMatcher('(', true, false).kind).toBe('invalid');
  });
});

describe('contractLog — the graph of a filtered list', () => {
  // e → d → c → b → a, newest first.
  const line = [commit('e', 'd'), commit('d', 'c'), commit('c', 'b'), commit('b', 'a'), commit('a')];

  it('joins a listed commit to the nearest listed commit under it and names a join that skips', () => {
    const { entries, skipped } = contractLog(line, listed('e', 'c', 'a'));
    expect(entries).toEqual([commit('e', 'c'), commit('c', 'a'), commit('a')]);
    expect([...skipped].sort()).toEqual([edgeKey('c', 'a'), edgeKey('e', 'c')]);
  });

  it('leaves a join between a commit and its own parent unnamed', () => {
    const { entries, skipped } = contractLog(line, listed('e', 'd'));
    expect(entries).toEqual([commit('e', 'd'), commit('d')]);
    expect(skipped.size).toBe(0);
  });

  it('joins two branches to the listed commit both descend from', () => {
    // main m3 → m2 → m1 → r; feature f1 → m1.
    const forked = [commit('m3', 'm2'), commit('f1', 'm1'), commit('m2', 'm1'), commit('m1', 'r'), commit('r')];
    const { entries, skipped } = contractLog(forked, listed('m3', 'f1', 'r'));
    expect(entries).toEqual([commit('m3', 'r'), commit('f1', 'r'), commit('r')]);
    expect([...skipped].sort()).toEqual([edgeKey('f1', 'r'), edgeKey('m3', 'r')]);
  });

  it('drops a join to a commit another join already leads to', () => {
    // t → M (a hidden merge of x and y); x → z; y → z.
    const merged = [commit('t', 'M'), commit('M', 'x', 'y'), commit('x', 'z'), commit('y', 'z'), commit('z')];
    const { entries, skipped } = contractLog(merged, listed('t', 'x', 'z'));
    expect(entries).toEqual([commit('t', 'x'), commit('x', 'z'), commit('z')]);
    expect([...skipped]).toEqual([edgeKey('t', 'x')]);
  });

  it('keeps both sides of a hidden merge when neither leads to the other', () => {
    const merged = [commit('t', 'M'), commit('M', 'x', 'y'), commit('x', 'z'), commit('y', 'z'), commit('z')];
    const { entries } = contractLog(merged, listed('t', 'x', 'y'));
    expect(entries).toEqual([commit('t', 'x', 'y'), commit('x'), commit('y')]);
  });

  it('bridges a hidden merge: the commit above it joins the merged branch, which joins the base', () => {
    // status → merge (of bump and fix); fix → bump — No Merges on the seed.
    const seed = [commit('status', 'merge'), commit('merge', 'bump', 'fix'), commit('fix', 'bump'), commit('bump')];
    const { entries, skipped } = contractLog(seed, listed('status', 'fix', 'bump'));
    expect(entries).toEqual([commit('status', 'fix'), commit('fix', 'bump'), commit('bump')]);
    expect([...skipped]).toEqual([edgeKey('status', 'fix')]);
  });

  it('ends the line at a parent the window does not hold', () => {
    expect(contractLog([commit('a', 'gone')], listed('a')).entries).toEqual([commit('a')]);
  });
});

describe('First Parent — the view’s own walk', () => {
  // status → merge (of bump and fix); fix → bump — the seed's merged branch.
  const seed = [commit('status', 'merge'), commit('merge', 'bump', 'fix'), commit('fix', 'bump'), commit('bump')];

  it('joins every commit to its first parent alone', () => {
    expect(firstParentOnly(seed)).toEqual([
      commit('status', 'merge'),
      commit('merge', 'bump'),
      commit('fix', 'bump'),
      commit('bump'),
    ]);
  });

  it('lists a merged branch a ref still names, and not one no ref does', () => {
    expect([...firstParentReach(seed, ['fix'])].sort()).toEqual(['bump', 'fix', 'merge', 'status']);
    expect([...firstParentReach(seed, [])].sort()).toEqual(['bump', 'merge', 'status']);
    expect([...firstParentReach(seed, ['gone'])].sort()).toEqual(['bump', 'merge', 'status']);
  });

  it('draws the merge without its side line, the merged branch on its own', () => {
    const { entries, skipped } = contractLog(firstParentOnly(seed), firstParentReach(seed, ['fix']));
    expect(entries).toEqual([
      commit('status', 'merge'),
      commit('merge', 'bump'),
      commit('fix', 'bump'),
      commit('bump'),
    ]);
    expect(skipped.size).toBe(0);
  });

  it('with No Merges too, the commit above the merge joins the trunk under it — not the merged branch', () => {
    const { entries, skipped } = contractLog(firstParentOnly(seed), listed('status', 'fix', 'bump'));
    expect(entries).toEqual([commit('status', 'bump'), commit('fix', 'bump'), commit('bump')]);
    expect([...skipped]).toEqual([edgeKey('status', 'bump')]);
  });
});

describe('the filtered graph keeps the whole log’s colours and draws a skip as stubs', () => {
  it('a commit wears the colour handed in, and so does the lane that leaves it', () => {
    const rows = computeLogGraph([commit('c', 'a'), commit('a')], {
      colors: new Map([
        ['c', 'red'],
        ['a', 'blue'],
      ]),
    });
    expect(rows.map((row) => row.color)).toEqual(['red', 'blue']);
    expect(rows[0].edges.map((edge) => edge.color)).toEqual(['red']);
  });

  it('a named skip is a collapsed edge on both of its rows', () => {
    const line = [commit('e', 'd'), commit('d', 'c'), commit('c')];
    const { entries, skipped } = contractLog(line, listed('e', 'c'));
    const rows = computeLogGraph(entries, { collapsedEdges: skipped });
    expect(rows[0].edges.map((edge) => [edge.span, edge.collapsed])).toEqual([['bottom', true]]);
    expect(rows[1].edges.map((edge) => [edge.span, edge.collapsed])).toEqual([['top', true]]);
  });
});
