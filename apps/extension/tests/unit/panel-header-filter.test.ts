import {
  type HeaderRowMeta,
  matchesHeaderQuery,
  parseHeaderQuery,
} from '@openheaders/ui/panel/data/header-filter';
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
      { kind: 'text', value: 'cookie', negated: false },
      { kind: 'text', value: 'auth', negated: true },
      { kind: 'text', value: 'no cache', negated: false },
    ]);
  });

  it('parses name:/value:/is: operators', () => {
    expect(parseHeaderQuery('name:cookie value:no-cache is:rule')).toEqual([
      { kind: 'name', value: 'cookie', negated: false },
      { kind: 'value', value: 'no-cache', negated: false },
      { kind: 'is', value: 'rule', negated: false },
    ]);
  });

  it('falls back to text when is: value is unknown', () => {
    expect(parseHeaderQuery('is:nonsense')).toEqual([{ kind: 'text', value: 'is:nonsense', negated: false }]);
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
});
