/**
 * Core's log models over rows by number answer what the view's own
 * models over named commits answer — the same generated histories
 * through both: the topological order, what tips reach, the first-parent
 * walk, the graph of a sifted list, the linear runs and their folding.
 * The view's models are what the log lists today; this holds the ones
 * that take their place to them.
 */

import {
  contractLog as contractRows,
  type DerivedLog,
  firstParentReach as firstParentFlags,
  firstParentOnly as firstParentRows,
  foldRuns,
  LOG_JOIN_LIMIT,
  linearRuns,
  numberLog,
  reachFrom,
  topologicalRows,
} from '@openheaders/core/workspace-tree';
import { edgeKey } from '@openheaders/ui/workbench/components/panels/git/graph';
import {
  contractLog,
  firstParentOnly,
  firstParentReach,
} from '@openheaders/ui/workbench/components/panels/git/graph-filtered';
import {
  allLinearFragments,
  collapseLog,
  fragmentKey,
} from '@openheaders/ui/workbench/components/panels/git/graph-fragment';
import { reachableFrom } from '@openheaders/ui/workbench/components/panels/git/log-reachability';
import { topologicalOrder } from '@openheaders/ui/workbench/components/panels/git/log-topological';
import { describe, expect, it } from 'vitest';

interface Entry {
  sha: string;
  parents: string[];
}

/** A history with forks, merges, heads entering part-way and (when asked) lines that leave the list — the same one every run. */
function tangle(count: number, seed: number, leaves: boolean): Entry[] {
  let state = seed;
  const next = (below: number): number => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % below;
  };
  const entries: Entry[] = [];
  for (let row = 0; row < count; row += 1) {
    const parents: string[] = [];
    const left = count - 1 - row;
    if (left > 0 && next(10) > 0) parents.push(`c${row + 1 + next(Math.min(left, 4))}`);
    else if (leaves && next(3) === 0) parents.push(`gone${next(3)}`);
    if (left > 1 && next(4) === 0) {
      const second = `c${row + 1 + next(Math.min(left, 9))}`;
      if (!parents.includes(second)) parents.push(second);
    }
    entries.push({ sha: `c${row}`, parents });
  }
  return entries;
}

const HISTORIES = [
  { name: '40 commits', entries: tangle(40, 7, false) },
  { name: '150 commits', entries: tangle(150, 11, false) },
  { name: '150 commits, lines leaving the list', entries: tangle(150, 23, true) },
  { name: '400 commits', entries: tangle(400, 5, false) },
];

function numbered(entries: readonly Entry[]) {
  const { skeleton, shas, numberOf } = numberLog(entries);
  const flags = (names: Iterable<string>): Uint8Array => {
    const out = new Uint8Array(skeleton.count);
    for (const name of names) {
      const row = numberOf.get(name);
      if (row !== undefined && row < skeleton.count) out[row] = 1;
    }
    return out;
  };
  const named = (out: Uint8Array): string[] => entries.filter((_, row) => out[row] === 1).map((entry) => entry.sha);
  /** A list made out of this one, in the view's terms. */
  const read = (derived: DerivedLog) => {
    const nameOf = (at: number): string => shas[derived.rows[at]];
    const list: Entry[] = [];
    const skipped = new Set<string>();
    for (let at = 0; at < derived.skeleton.count; at += 1) {
      const parents: string[] = [];
      for (let pointer = derived.skeleton.starts[at]; pointer < derived.skeleton.starts[at + 1]; pointer += 1) {
        const parent = nameOf(derived.skeleton.parents[pointer]);
        parents.push(parent);
        if (derived.skeleton.skips?.[pointer] === 1) skipped.add(edgeKey(nameOf(at), parent));
      }
      list.push({ sha: nameOf(at), parents });
    }
    return { entries: list, skipped };
  };
  return { skeleton, shas, row: (name: string): number => numberOf.get(name) ?? -1, flags, named, read };
}

const heads = (entries: readonly Entry[]): string[] => {
  const hasChild = new Set(entries.flatMap((entry) => entry.parents));
  return entries.filter((entry) => !hasChild.has(entry.sha)).map((entry) => entry.sha);
};

describe.each(HISTORIES)('core’s log models answer as the view’s do — $name', ({ entries }) => {
  const list = numbered(entries);
  const tips = heads(entries);

  it('the topological order', () => {
    for (const [lead, last] of [
      [null, []],
      [tips[0], []],
      [tips[tips.length - 1], tips.slice(0, 2)],
      [entries[5].sha, [tips[1]]],
    ] as const) {
      const theirs = topologicalOrder(entries, { lead, last: new Set(last) }).map((entry) => entry.sha);
      const rows = topologicalRows(list.skeleton, {
        lead: lead === null ? -1 : list.row(lead),
        last: list.flags(last),
      });
      expect([...rows].map((row) => list.shas[row])).toEqual(theirs);
    }
  });

  it('what a tip reaches', () => {
    for (const tip of [tips[0], tips[tips.length - 1], entries[9].sha]) {
      const theirs = reachableFrom(tip, entries) ?? new Set<string>();
      expect(list.named(reachFrom(list.skeleton, [list.row(tip)]))).toEqual(
        entries.filter((entry) => theirs.has(entry.sha)).map((entry) => entry.sha),
      );
    }
  });

  it('the first-parent walk', () => {
    for (const roots of [[], [entries[7].sha, entries[20].sha], ['nowhere']]) {
      const theirs = firstParentReach(entries, roots);
      expect(
        list.named(
          firstParentFlags(
            list.skeleton,
            roots.map((root) => list.row(root)),
          ),
        ),
      ).toEqual(entries.filter((entry) => theirs.has(entry.sha)).map((entry) => entry.sha));
    }
  });

  it('the graph of a sifted list', () => {
    const sifts: Array<(entry: Entry, row: number) => boolean> = [
      (entry) => entry.parents.length < 2,
      (_, row) => row % 3 === 0,
      (_, row) => (row * 7) % 5 < 2,
      (entry, row) => entry.parents.length < 2 && row % 2 === 0,
    ];
    for (const sift of sifts) {
      const kept = new Set(entries.filter(sift).map((entry) => entry.sha));
      const theirs = contractLog(entries, kept);
      const ours = list.read(contractRows(list.skeleton, list.flags(kept), Number.MAX_SAFE_INTEGER));
      expect(ours.entries).toEqual(theirs.entries);
      expect(ours.skipped).toEqual(theirs.skipped);

      // First Parent with the sift on top of it.
      const walked = firstParentReach(entries, []);
      const both = new Set([...kept].filter((sha) => walked.has(sha)));
      const theirWalk = contractLog(firstParentOnly(entries), both);
      const ourWalk = list.read(
        contractRows(firstParentRows(list.skeleton), list.flags(both), Number.MAX_SAFE_INTEGER),
      );
      expect(ourWalk.entries).toEqual(theirWalk.entries);
      expect(ourWalk.skipped).toEqual(theirWalk.skipped);
    }
  });

  it('the linear runs, and the list with every one of them folded', () => {
    for (const anchors of [[], [entries[3].sha, entries[12].sha, entries[30].sha]]) {
      const theirs = allLinearFragments(entries, new Set(anchors));
      const runs = linearRuns(list.skeleton, list.flags(anchors));
      const ours = Array.from({ length: runs.count }, (_, run) => ({
        top: list.shas[runs.tops[run]],
        bottom: list.shas[runs.bottoms[run]],
        interior: entries.filter((_, row) => runs.runOf[row] === run).map((entry) => entry.sha),
      }));
      const byKey = (
        a: { top: string; interior: readonly string[] },
        b: { top: string; interior: readonly string[] },
      ) => edgeKey(a.top, a.interior[0]).localeCompare(edgeKey(b.top, b.interior[0]));
      expect([...ours].sort(byKey)).toEqual([...theirs].sort(byKey));
      expect(runs.count).toBeGreaterThan(0);

      // Lines that leave the list are numbered apart on each side; the folded list is compared where none does.
      if (entries.some((entry) => entry.parents.some((parent) => parent.startsWith('gone')))) continue;
      const collapsed = collapseLog(entries, new Map(theirs.map((fragment) => [fragmentKey(fragment), fragment])));
      const folded = list.read(foldRuns(list.skeleton, runs, new Uint8Array(runs.count).fill(1)));
      expect(folded.entries).toEqual(collapsed.entries.map((entry) => ({ sha: entry.sha, parents: entry.parents })));
      expect(folded.skipped).toEqual(new Set(collapsed.collapsedEdges));
    }
  });
});

describe('the join limit', () => {
  it('is wide enough that a history of ordinary shape never meets it', () => {
    for (const { entries } of HISTORIES) {
      const list = numbered(entries);
      const kept = list.flags(entries.filter((_, row) => row % 3 === 0).map((entry) => entry.sha));
      expect(list.read(contractRows(list.skeleton, kept)).entries).toEqual(
        list.read(contractRows(list.skeleton, kept, Number.MAX_SAFE_INTEGER)).entries,
      );
    }
    expect(LOG_JOIN_LIMIT).toBe(8);
  });
});
