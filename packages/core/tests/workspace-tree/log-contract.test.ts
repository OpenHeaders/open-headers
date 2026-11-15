/**
 * A sifted log is still a graph: each commit that stays is joined to
 * the nearest listed commits it descends from, a join over hidden
 * commits is flagged, a join another join already leads to is dropped,
 * and a row carries no more than the nearest few.
 */

import { describe, expect, it } from 'vitest';
import {
  contractLog,
  contractLogSteps,
  firstParentOnly,
  firstParentReach,
  type NamedLogEntry,
} from '../../src/workspace-tree';
import { commit, named } from './log-named';

const contracted = (entries: readonly NamedLogEntry[], listed: string[], limit?: number) => {
  const list = named(entries);
  return list.read(contractLog(list.skeleton, list.flags(...listed), limit));
};

describe('contractLog — the graph of a sifted list', () => {
  // e → d → c → b → a, newest first.
  const line = [commit('e', 'd'), commit('d', 'c'), commit('c', 'b'), commit('b', 'a'), commit('a')];

  it('joins a listed commit to the nearest listed commit under it and flags a join that skips', () => {
    const { entries, skipped } = contracted(line, ['e', 'c', 'a']);
    expect(entries).toEqual([commit('e', 'c'), commit('c', 'a'), commit('a')]);
    expect(skipped).toEqual(['e>c', 'c>a']);
  });

  it('leaves a join between a commit and its own parent plain', () => {
    const { entries, skipped } = contracted(line, ['e', 'd']);
    expect(entries).toEqual([commit('e', 'd'), commit('d')]);
    expect(skipped).toEqual([]);
  });

  it('joins two branches to the listed commit both descend from', () => {
    // main m3 → m2 → m1 → r; feature f1 → m1.
    const forked = [commit('m3', 'm2'), commit('f1', 'm1'), commit('m2', 'm1'), commit('m1', 'r'), commit('r')];
    const { entries, skipped } = contracted(forked, ['m3', 'f1', 'r']);
    expect(entries).toEqual([commit('m3', 'r'), commit('f1', 'r'), commit('r')]);
    expect(skipped).toEqual(['m3>r', 'f1>r']);
  });

  // t → M (a hidden merge of x and y); x → z; y → z.
  const merged = [commit('t', 'M'), commit('M', 'x', 'y'), commit('x', 'z'), commit('y', 'z'), commit('z')];

  it('drops a join to a commit another join already leads to', () => {
    const { entries, skipped } = contracted(merged, ['t', 'x', 'z']);
    expect(entries).toEqual([commit('t', 'x'), commit('x', 'z'), commit('z')]);
    expect(skipped).toEqual(['t>x']);
  });

  it('keeps both sides of a hidden merge when neither leads to the other', () => {
    expect(contracted(merged, ['t', 'x', 'y']).entries).toEqual([commit('t', 'x', 'y'), commit('x'), commit('y')]);
  });

  // status → merge (of bump and fix); fix → bump — No Merges on the seed.
  const seed = [commit('status', 'merge'), commit('merge', 'bump', 'fix'), commit('fix', 'bump'), commit('bump')];

  it('bridges a hidden merge: the commit above it joins the merged branch, which joins the base', () => {
    const { entries, skipped } = contracted(seed, ['status', 'fix', 'bump']);
    expect(entries).toEqual([commit('status', 'fix'), commit('fix', 'bump'), commit('bump')]);
    expect(skipped).toEqual(['status>fix']);
  });

  it('ends the line at a parent the list does not hold', () => {
    expect(contracted([commit('a', 'gone')], ['a']).entries).toEqual([commit('a')]);
  });

  it('over a first-parent walk: the merge without its side line, and with No Merges the trunk under it', () => {
    const list = named(seed);
    const first = firstParentOnly(list.skeleton);
    const walked = list.read(contractLog(first, firstParentReach(list.skeleton, [list.row('fix')])));
    expect(walked.entries).toEqual([
      commit('status', 'merge'),
      commit('merge', 'bump'),
      commit('fix', 'bump'),
      commit('bump'),
    ]);
    expect(walked.skipped).toEqual([]);

    const noMerges = list.read(contractLog(first, list.flags('status', 'fix', 'bump')));
    expect(noMerges.entries).toEqual([commit('status', 'bump'), commit('fix', 'bump'), commit('bump')]);
    expect(noMerges.skipped).toEqual(['status>bump']);
  });

  it('keeps a pointer flagged that already passed over hidden commits', () => {
    const list = named([commit('b', 'a'), commit('a')]);
    list.skeleton.skips = Uint8Array.from([1]);
    expect(list.read(contractLog(list.skeleton, list.flags('a', 'b'))).skipped).toEqual(['b>a']);
  });
});

describe('a row carries the nearest few joins', () => {
  // A hidden trunk, every commit of it a merge of a listed commit nothing else leads to.
  const stubs = [
    commit('tip', 'm1'),
    commit('m1', 'm2', 's1'),
    commit('s1'),
    commit('m2', 'm3', 's2'),
    commit('s2'),
    commit('m3', 'm4', 's3'),
    commit('s3'),
    commit('m4', 'root', 's4'),
    commit('s4'),
    commit('root'),
  ];
  const listed = ['tip', 's1', 's2', 's3', 's4'];

  it('joins to every one of them while they are few', () => {
    expect(contracted(stubs, listed).entries[0]).toEqual(commit('tip', 's4', 's3', 's2', 's1'));
  });

  it('keeps the nearest by row once they are more than the limit', () => {
    const { entries, skipped } = contracted(stubs, listed, 3);
    expect(entries[0]).toEqual(commit('tip', 's3', 's2', 's1'));
    expect(skipped).toEqual(['tip>s3', 'tip>s2', 'tip>s1']);
  });
});

describe('contractLogSteps', () => {
  it('is the same list, handed back a stretch at a time', () => {
    const entries = Array.from({ length: 45_000 }, (_, at) => commit(`c${at}`, ...(at < 44_999 ? [`c${at + 1}`] : [])));
    const list = named(entries);
    const listed = new Uint8Array(list.skeleton.count);
    for (let row = 0; row < listed.length; row += 3) listed[row] = 1;

    const steps = contractLogSteps(list.skeleton, listed);
    let handedBack = 0;
    let step = steps.next();
    while (step.done !== true) {
      handedBack += 1;
      step = steps.next();
    }
    expect(handedBack).toBe(2);
    expect(step.value).toEqual(contractLog(list.skeleton, listed));
    expect(step.value.skeleton.count).toBe(15_000);
  });
});
