/**
 * A caller's ask for a log's list as the histories take it
 * (`runtime/log-list-ask`): the text field read at the door — nothing a
 * history is searched for goes further — the scope, the order, the
 * sifts, the walk and the folds each in their place; and the histories'
 * refusals as the log verbs answer them.
 */

import { describe, expect, it, vi } from 'vitest';
import type { LogAsk } from '../../src/workspace-tree/history';
import { logAskOf, logListRefusal, readLogText } from '../../src/workspace-tree/runtime/log-list-ask';

const NOTHING: LogAsk = {
  scope: ['HEAD'],
  topological: false,
  firstParent: false,
  noMerges: false,
  walk: null,
  text: null,
  folds: { all: false, runs: [] },
};

describe('the text field of an ask', () => {
  it('is none when the caller sent none — whatever toggles ride alone', () => {
    expect(readLogText({})).toBeUndefined();
    expect(readLogText({ regex: true, matchCase: true })).toBeUndefined();
  });

  it('is the text as sent, each toggle on only by the word true', () => {
    expect(readLogText({ text: ' orders ' })).toEqual({ text: ' orders ', regex: false, matchCase: false });
    expect(readLogText({ text: '^orders', regex: true })).toEqual({ text: '^orders', regex: true, matchCase: false });
    expect(readLogText({ text: 'Orders', matchCase: true })).toEqual({ text: 'Orders', regex: false, matchCase: true });
  });

  it('is refused when it is nothing a history is searched for', () => {
    expect(readLogText({ text: '' })).toBeNull();
    expect(readLogText({ text: '   ' })).toBeNull();
    expect(readLogText({ text: 'a'.repeat(201) })).toBeNull();
    expect(readLogText({ text: 'a'.repeat(200) })).not.toBeNull();
    expect(readLogText({ text: 'orders\nmain' })).toBeNull();
    expect(readLogText({ text: 'orders\u0000' })).toBeNull();
    // A pattern that does not compile; the same text is a plain one.
    expect(readLogText({ text: '(', regex: true })).toBeNull();
    expect(readLogText({ text: '(' })).not.toBeNull();
  });
});

describe('the list an ask names', () => {
  it('is the checked-out commit’s history with nothing else asked', () => {
    expect(logAskOf({}, {}, undefined)).toEqual(NOTHING);
  });

  it('lists a scope’s refs, or every ref in place of any scope', () => {
    expect(logAskOf({ scope: ['main', 'side'] }, {}, undefined).scope).toEqual(['main', 'side']);
    expect(logAskOf({}, { allRefs: true }, undefined).scope).toBeNull();
  });

  it('takes the order and the sifts from the filters, each by its own word', () => {
    expect(logAskOf({}, { topoOrder: true }, undefined)).toEqual({ ...NOTHING, topological: true });
    expect(logAskOf({}, { firstParent: true }, undefined)).toEqual({ ...NOTHING, firstParent: true });
    expect(logAskOf({}, { noMerges: true }, undefined)).toEqual({ ...NOTHING, noMerges: true });
  });

  it('asks a walk for User, Date and Paths alone — each one is a walk, and nothing else is', () => {
    expect(
      logAskOf({}, { noMerges: true, firstParent: true, topoOrder: true, allRefs: true }, undefined).walk,
    ).toBeNull();
    expect(logAskOf({}, { author: 'Jane' }, undefined).walk).toEqual({ author: 'Jane' });
    expect(logAskOf({}, { authors: ['Jane', 'John'] }, undefined).walk).toEqual({ authors: ['Jane', 'John'] });
    expect(logAskOf({}, { since: '2026-01-01' }, undefined).walk).toEqual({ since: '2026-01-01' });
    expect(logAskOf({}, { until: '2026-02-01' }, undefined).walk).toEqual({ until: '2026-02-01' });
    expect(logAskOf({}, { paths: ['requests'] }, undefined).walk).toEqual({ paths: ['requests'] });
    expect(
      logAskOf({}, { author: 'Jane', since: '2026-01-01', paths: ['requests'], noMerges: true }, undefined).walk,
    ).toEqual({ author: 'Jane', since: '2026-01-01', paths: ['requests'] });
  });

  it('carries the text it was read with, and none without', () => {
    const text = { text: 'orders', regex: true, matchCase: false };
    expect(logAskOf({ text: 'orders', regex: true }, {}, text)).toEqual({ ...NOTHING, text });
    expect(logAskOf({ text: 'orders' }, {}, undefined).text).toBeNull();
  });

  it('folds the runs named, or all but the ones named', () => {
    const first = 'a'.repeat(40);
    expect(logAskOf({ folds: [first] }, {}, undefined).folds).toEqual({ all: false, runs: [first] });
    expect(logAskOf({ foldAll: true, folds: [first] }, {}, undefined).folds).toEqual({ all: true, runs: [first] });
    expect(logAskOf({ foldAll: true }, {}, undefined).folds).toEqual({ all: true, runs: [] });
  });
});

describe('a list the histories refused', () => {
  const repo = () => vi.fn(async () => true);

  it('names the refs the history does not hold', async () => {
    const isRepo = repo();
    expect(await logListRefusal({ ok: false, reason: 'unknown-ref', unknownRefs: ['gone'] }, isRepo)).toEqual({
      ok: false,
      reason: 'unknown-ref',
      unknownRefs: ['gone'],
    });
    expect(await logListRefusal({ ok: false, reason: 'invalid-scope' }, isRepo)).toEqual({
      ok: false,
      reason: 'unknown-ref',
    });
    expect(isRepo).not.toHaveBeenCalled();
  });

  it('answers a text that is no search as an invalid filter, and a pattern past its deadline as a search out of time', async () => {
    const isRepo = repo();
    expect(await logListRefusal({ ok: false, reason: 'invalid-text' }, isRepo)).toEqual({
      ok: false,
      reason: 'invalid-filter',
    });
    expect(await logListRefusal({ ok: false, reason: 'pattern-timeout' }, isRepo)).toEqual({
      ok: false,
      reason: 'search-timeout',
    });
    expect(isRepo).not.toHaveBeenCalled();
  });

  it('answers a history, its texts or a walk out of time as the log out of time', async () => {
    const isRepo = repo();
    expect(await logListRefusal({ ok: false, reason: 'timeout' }, isRepo)).toEqual({
      ok: false,
      reason: 'log-timeout',
    });
    expect(isRepo).not.toHaveBeenCalled();
  });

  it('asks whether the folder is a repo at all for a history that could not be read', async () => {
    for (const reason of ['failed', 'closed'] as const) {
      expect(await logListRefusal({ ok: false, reason }, async () => true)).toEqual({
        ok: false,
        reason: 'log-failed',
        detail: reason,
      });
      expect(await logListRefusal({ ok: false, reason }, async () => false)).toEqual({
        ok: false,
        reason: 'not-a-repo',
      });
    }
  });
});
