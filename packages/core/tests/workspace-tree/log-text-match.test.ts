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

  it('is invalid for a text that is no shape — longer than the field takes, or with a control character', () => {
    for (const regex of [false, true]) {
      expect(makeLogTextMatcher('a'.repeat(200), regex, false).kind).toBe('match');
      expect(makeLogTextMatcher('a'.repeat(201), regex, false).kind).toBe('invalid');
      // The blanks around a text are not part of it.
      expect(makeLogTextMatcher(`  ${'a'.repeat(200)}  `, regex, false).kind).toBe('match');
      expect(makeLogTextMatcher('orders\nmain', regex, false).kind).toBe('invalid');
      expect(makeLogTextMatcher('orders\tmain', regex, false).kind).toBe('invalid');
      expect(makeLogTextMatcher('orders\u0000', regex, false).kind).toBe('invalid');
      expect(makeLogTextMatcher('orders\u007f', regex, false).kind).toBe('invalid');
      expect(makeLogTextMatcher('orders main', regex, false).kind).toBe('match');
    }
  });
});

describe('the log text matcher says what it is made of', () => {
  it('tests one text — a subject or a name — by the same rule a commit’s are tested by', () => {
    expect(matcherOf('response', false, false).testText('Fix Response panel')).toBe(true);
    expect(matcherOf('response', false, true).testText('Fix Response panel')).toBe(false);
    expect(matcherOf('john d', false, false).testText('John Doe')).toBe(true);
    expect(matcherOf('^john', true, false).testText('John Doe')).toBe(true);
    expect(matcherOf('^john', true, true).testText('John Doe')).toBe(false);
    // A text is no hash: its start alone does not match it.
    expect(matcherOf('abc12', false, false).testText('zabc12')).toBe(true);
  });

  it('tests a hash by its start, whatever case it was typed in', () => {
    expect(matcherOf('abc12', false, false).testSha?.('abc123def')).toBe(true);
    expect(matcherOf('ABC12', false, true).testSha?.('abc123def')).toBe(true);
    expect(matcherOf('c123', false, false).testSha?.('abc123def')).toBe(false);
  });

  it('has no test of a hash for a plain text that can match none', () => {
    expect(matcherOf('response', false, false).testSha).toBeNull();
    expect(matcherOf('abc12g', false, false).testSha).toBeNull();
    expect(matcherOf('abc 12', false, false).testSha).toBeNull();
    expect(matcherOf('a'.repeat(64), false, false).testSha).not.toBeNull();
    expect(matcherOf('a'.repeat(65), false, false).testSha).toBeNull();
  });

  it('reads a pattern over the whole hash — any pattern may match one', () => {
    expect(matcherOf('response', true, false).testSha?.('abc123def')).toBe(false);
    expect(matcherOf('c123', true, false).testSha?.('abc123def')).toBe(true);
    expect(matcherOf('\\d+', true, false).testSha?.('abc123def')).toBe(true);
  });

  it('matches a commit by any ONE of its fields, each alone', () => {
    const blank = { subject: '', authorName: '', sha: '' };
    for (const matcher of [matcherOf('abc', false, false), matcherOf('^abc', true, false)]) {
      expect(matcher.test({ ...blank, subject: 'abc' })).toBe(true);
      expect(matcher.test({ ...blank, authorName: 'abc' })).toBe(true);
      expect(matcher.test({ ...blank, sha: 'abc' })).toBe(true);
      expect(matcher.test(blank)).toBe(false);
    }
    // A hash is hex digits: a text with any other character matches by a subject or a name alone.
    expect(matcherOf('xyz', false, false).test({ ...blank, sha: 'xyz' })).toBe(false);
  });

  it('hands out the pattern its tests run, and none for a plain text', () => {
    expect(matcherOf('fix', false, false).pattern).toBeNull();
    const held = matcherOf('  ^Fix\\b ', true, true).pattern;
    expect([held?.source, held?.flags]).toEqual(['^Fix\\b', '']);
    expect(matcherOf('^fix', true, false).pattern?.flags).toBe('i');
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
