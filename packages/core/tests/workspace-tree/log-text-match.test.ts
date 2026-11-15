/**
 * The log's text matcher: which commit a text matches — its subject,
 * its author's name, the start of its hash — and WHERE in a text it
 * matched, which is what a row paints. A plain text is itself; the
 * toggles make it a pattern or hold its case.
 */

import { describe, expect, it } from 'vitest';
import { makeLogTextMatcher } from '../../src/workspace-tree';

const matcherOf = (filter: string, regex: boolean, matchCase: boolean) => {
  const matcher = makeLogTextMatcher(filter, regex, matchCase);
  if (matcher.kind !== 'match') throw new Error(`no matcher for ${filter}`);
  return matcher;
};

const ENTRY = { subject: 'Fix Response panel', authorName: 'John Doe', sha: 'abc123def' };

describe('the log text matcher says which commit matches', () => {
  it('matches a plain text anywhere in the subject, whatever its case', () => {
    expect(matcherOf('response', false, false).test(ENTRY)).toBe(true);
    expect(matcherOf('request', false, false).test(ENTRY)).toBe(false);
  });

  it('holds the case when asked to', () => {
    expect(matcherOf('response', false, true).test(ENTRY)).toBe(false);
    expect(matcherOf('Response', false, true).test(ENTRY)).toBe(true);
  });

  it('matches the author’s name', () => {
    expect(matcherOf('john d', false, false).test(ENTRY)).toBe(true);
  });

  it('matches a hash by its start alone', () => {
    expect(matcherOf('abc12', false, false).test(ENTRY)).toBe(true);
    expect(matcherOf('ABC12', false, false).test(ENTRY)).toBe(true);
    expect(matcherOf('c123', false, false).test(ENTRY)).toBe(false);
  });

  it('reads a pattern over each field', () => {
    expect(matcherOf('^fix .*panel$', true, false).test(ENTRY)).toBe(true);
    expect(matcherOf('^fix .*panel$', true, true).test(ENTRY)).toBe(false);
    expect(matcherOf('^John', true, true).test(ENTRY)).toBe(true);
  });

  it('is none for a blank text and invalid for a pattern that does not compile', () => {
    expect(makeLogTextMatcher('  ', false, false).kind).toBe('none');
    expect(makeLogTextMatcher('(', true, false).kind).toBe('invalid');
    expect(makeLogTextMatcher('(', false, false).kind).toBe('match');
  });

  it('matches by what was typed without the blanks around it', () => {
    expect(matcherOf('  response ', false, false).test(ENTRY)).toBe(true);
  });
});

describe('the log text matcher says where it matched', () => {
  const rangesOf = (filter: string, regex: boolean, matchCase: boolean, text: string) =>
    matcherOf(filter, regex, matchCase).ranges(text);

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
  });
});
