import {
  type HeaderRowMeta,
  hasHeaderQueryError,
  matchesHeaderQuery,
  parseHeaderQuery,
} from '@openheaders/ui/panel/data/headers/header-filter';
import { DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

function meta(over: Partial<HeaderRowMeta> = {}): HeaderRowMeta {
  return {
    name: 'Content-Type',
    value: 'application/json',
    direction: 'response',
    origin: 'server',
    category: 'content',
    protectedHeader: false,
    drifted: false,
    ...over,
  };
}

describe('parseHeaderQuery', () => {
  it('returns no tokens for empty input', () => {
    expect(parseHeaderQuery('')).toEqual([]);
    expect(parseHeaderQuery('   ')).toEqual([]);
  });

  it('parses bare text, quoted text and negation', () => {
    expect(parseHeaderQuery('cookie -auth "no cache"')).toEqual([
      { kind: 'text', value: 'cookie', negated: false, match: expect.any(Function) },
      { kind: 'text', value: 'auth', negated: true, match: expect.any(Function) },
      { kind: 'text', value: 'no cache', negated: false, match: expect.any(Function) },
    ]);
  });

  it('parses name:/value:/is: operators', () => {
    expect(parseHeaderQuery('name:cookie value:no-cache is:rule')).toEqual([
      { kind: 'name', value: 'cookie', negated: false, match: expect.any(Function) },
      { kind: 'value', value: 'no-cache', negated: false, match: expect.any(Function) },
      { kind: 'is', value: 'rule', negated: false },
    ]);
  });

  it('falls back to text when is: value is unknown', () => {
    expect(parseHeaderQuery('is:nonsense')).toEqual([
      { kind: 'text', value: 'is:nonsense', negated: false, match: expect.any(Function) },
    ]);
  });

  it('compiles the whole input as one pattern in regex mode', () => {
    const tokens = parseHeaderQuery('^x-.*: ', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(tokens).toEqual([{ kind: 'regex', pattern: expect.any(RegExp), negated: false }]);
    expect(hasHeaderQueryError(tokens)).toBe(false);
  });

  it('flags a broken regex-mode pattern', () => {
    const tokens = parseHeaderQuery('x-(', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(hasHeaderQueryError(tokens)).toBe(true);
  });
});

describe('matchesHeaderQuery', () => {
  it('matches empty query', () => {
    expect(matchesHeaderQuery(meta(), parseHeaderQuery(''))).toBe(true);
  });

  it('matches bare text against name OR value, case-insensitive', () => {
    expect(matchesHeaderQuery(meta({ name: 'Set-Cookie' }), parseHeaderQuery('COOKIE'))).toBe(true);
    expect(matchesHeaderQuery(meta({ value: 'no-cache' }), parseHeaderQuery('no-cache'))).toBe(true);
    expect(matchesHeaderQuery(meta(), parseHeaderQuery('xxx'))).toBe(false);
  });

  it('respects name: and value: scoping', () => {
    const m = meta({ name: 'Cache-Control', value: 'no-cache' });
    expect(matchesHeaderQuery(m, parseHeaderQuery('name:cookie'))).toBe(false);
    expect(matchesHeaderQuery(m, parseHeaderQuery('value:no-cache'))).toBe(true);
  });

  it('matches is:rule / is:server / is:system', () => {
    expect(matchesHeaderQuery(meta({ origin: 'rule' }), parseHeaderQuery('is:rule'))).toBe(true);
    expect(matchesHeaderQuery(meta({ origin: 'server' }), parseHeaderQuery('is:rule'))).toBe(false);
    expect(matchesHeaderQuery(meta({ origin: 'system' }), parseHeaderQuery('is:system'))).toBe(true);
  });

  it('matches is:overridable / is:protected', () => {
    expect(matchesHeaderQuery(meta({ protectedHeader: false }), parseHeaderQuery('is:overridable'))).toBe(true);
    expect(matchesHeaderQuery(meta({ protectedHeader: true }), parseHeaderQuery('is:overridable'))).toBe(false);
    expect(matchesHeaderQuery(meta({ protectedHeader: true }), parseHeaderQuery('is:protected'))).toBe(true);
  });

  it('matches is:<category>', () => {
    expect(matchesHeaderQuery(meta({ category: 'security' }), parseHeaderQuery('is:security'))).toBe(true);
    expect(matchesHeaderQuery(meta({ category: 'content' }), parseHeaderQuery('is:security'))).toBe(false);
  });

  it('matches is:drifted, is:request, is:response', () => {
    expect(matchesHeaderQuery(meta({ drifted: true }), parseHeaderQuery('is:drifted'))).toBe(true);
    expect(matchesHeaderQuery(meta({ direction: 'request' }), parseHeaderQuery('is:request'))).toBe(true);
    expect(matchesHeaderQuery(meta({ direction: 'response' }), parseHeaderQuery('is:response'))).toBe(true);
    expect(matchesHeaderQuery(meta({ direction: 'request' }), parseHeaderQuery('is:response'))).toBe(false);
  });

  it('AND-combines all tokens', () => {
    const m = meta({ name: 'Set-Cookie', category: 'cookies', origin: 'server', direction: 'response' });
    expect(matchesHeaderQuery(m, parseHeaderQuery('is:cookies is:response'))).toBe(true);
    expect(matchesHeaderQuery(m, parseHeaderQuery('is:cookies is:request'))).toBe(false);
  });

  it('honours negation', () => {
    expect(matchesHeaderQuery(meta({ origin: 'server' }), parseHeaderQuery('-is:rule'))).toBe(true);
    expect(matchesHeaderQuery(meta({ origin: 'rule' }), parseHeaderQuery('-is:rule'))).toBe(false);
  });

  it('honours Match Case', () => {
    const caseSensitive = { ...DEFAULT_TEXT_MATCH_CONFIG, matchCase: true };
    expect(matchesHeaderQuery(meta({ name: 'Set-Cookie' }), parseHeaderQuery('COOKIE', caseSensitive))).toBe(false);
    expect(matchesHeaderQuery(meta({ name: 'Set-Cookie' }), parseHeaderQuery('Cookie', caseSensitive))).toBe(true);
  });

  it('honours Whole Word', () => {
    const wholeWord = { ...DEFAULT_TEXT_MATCH_CONFIG, wholeWord: true };
    expect(matchesHeaderQuery(meta({ value: 'no-cache' }), parseHeaderQuery('cache', wholeWord))).toBe(true);
    expect(matchesHeaderQuery(meta({ value: 'cachetastic' }), parseHeaderQuery('cache', wholeWord))).toBe(false);
  });

  it('regex mode tests the pattern against "name: value"', () => {
    const regex = { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true };
    expect(matchesHeaderQuery(meta(), parseHeaderQuery('^content-type: application', regex))).toBe(true);
    expect(matchesHeaderQuery(meta(), parseHeaderQuery('^application', regex))).toBe(false);
  });

  it('a broken regex matches every row (error shows in the input instead)', () => {
    const regex = { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true };
    expect(matchesHeaderQuery(meta(), parseHeaderQuery('x-(', regex))).toBe(true);
  });
});
