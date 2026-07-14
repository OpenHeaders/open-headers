import {
  buildNeedleMatcher,
  buildTextPredicate,
  compileRegexQuery,
  DEFAULT_TEXT_MATCH_CONFIG,
  textMatches,
} from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

describe('buildNeedleMatcher', () => {
  it('matches substrings case-insensitively by default', () => {
    const match = buildNeedleMatcher('OpenHeaders', DEFAULT_TEXT_MATCH_CONFIG);
    expect(match('https://api.openheaders.io/v1/users')).toBe(true);
    expect(match('https://example.org/')).toBe(false);
  });

  it('honours Match Case', () => {
    const match = buildNeedleMatcher('OpenHeaders', { ...DEFAULT_TEXT_MATCH_CONFIG, matchCase: true });
    expect(match('https://api.openheaders.io/')).toBe(false);
    expect(match('https://OpenHeaders.io/')).toBe(true);
  });

  it('honours Whole Word with regex metacharacters escaped', () => {
    const match = buildNeedleMatcher('api', { ...DEFAULT_TEXT_MATCH_CONFIG, wholeWord: true });
    expect(match('https://api.openheaders.io/')).toBe(true);
    expect(match('https://rapid.openheaders.io/')).toBe(false);
    const dotted = buildNeedleMatcher('a.b', { ...DEFAULT_TEXT_MATCH_CONFIG, wholeWord: true });
    expect(dotted('x a.b y')).toBe(true);
    expect(dotted('x aXb y')).toBe(false);
  });

  it('combines Match Case with Whole Word', () => {
    const match = buildNeedleMatcher('Api', { ...DEFAULT_TEXT_MATCH_CONFIG, matchCase: true, wholeWord: true });
    expect(match('the Api server')).toBe(true);
    expect(match('the api server')).toBe(false);
  });
});

describe('textMatches', () => {
  it('delegates to the same semantics', () => {
    expect(textMatches('https://api.openheaders.io/', 'API', DEFAULT_TEXT_MATCH_CONFIG)).toBe(true);
    expect(textMatches('https://api.openheaders.io/', 'API', { ...DEFAULT_TEXT_MATCH_CONFIG, matchCase: true })).toBe(
      false,
    );
  });
});

describe('compileRegexQuery', () => {
  it('compiles case-insensitively unless Match Case is on', () => {
    const loose = compileRegexQuery('^HTTPS', DEFAULT_TEXT_MATCH_CONFIG);
    expect(loose.pattern?.test('https://openheaders.io/')).toBe(true);
    const strict = compileRegexQuery('^HTTPS', { ...DEFAULT_TEXT_MATCH_CONFIG, matchCase: true });
    expect(strict.pattern?.test('https://openheaders.io/')).toBe(false);
  });

  it('reports broken patterns instead of throwing', () => {
    expect(compileRegexQuery('a(', DEFAULT_TEXT_MATCH_CONFIG)).toEqual({ pattern: null, error: true });
  });
});

describe('buildTextPredicate', () => {
  it('empty input matches everything and reports empty', () => {
    const p = buildTextPredicate('   ', DEFAULT_TEXT_MATCH_CONFIG);
    expect(p.empty).toBe(true);
    expect(p.error).toBe(false);
    expect(p.test('anything')).toBe(true);
  });

  it('literal mode matches substrings', () => {
    const p = buildTextPredicate('users', DEFAULT_TEXT_MATCH_CONFIG);
    expect(p.test('https://api.openheaders.io/v1/users?page=2')).toBe(true);
    expect(p.test('https://api.openheaders.io/v1/login')).toBe(false);
  });

  it('regex mode compiles the whole input as one pattern', () => {
    const p = buildTextPredicate('users\\?page=\\d+', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(p.error).toBe(false);
    expect(p.test('https://api.openheaders.io/v1/users?page=2')).toBe(true);
    expect(p.test('https://api.openheaders.io/v1/users')).toBe(false);
  });

  it('a broken regex matches everything and flags the error', () => {
    const p = buildTextPredicate('users(', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(p.error).toBe(true);
    expect(p.test('anything')).toBe(true);
  });
});
