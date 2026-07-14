import {
  type CookieRowMeta,
  hasCookieQueryError,
  matchesCookieQuery,
  parseCookieQuery,
} from '@openheaders/ui/panel/data/cookies/cookie-filter';
import { DEFAULT_TEXT_MATCH_CONFIG } from '@openheaders/ui/panel/data/text-match';
import { describe, expect, it } from 'vitest';

function meta(over: Partial<CookieRowMeta> = {}): CookieRowMeta {
  return {
    name: 'session',
    value: 'abc123',
    domain: '.openheaders.io',
    path: '/',
    secure: true,
    httpOnly: true,
    session: false,
    expired: false,
    sameSite: 'lax',
    partitioned: false,
    hostPrefix: false,
    securePrefix: false,
    thirdParty: false,
    isSet: false,
    isSent: true,
    isFilteredOut: false,
    problem: false,
    ruleModified: false,
    ...over,
  };
}

describe('parseCookieQuery', () => {
  it('returns no tokens for empty input', () => {
    expect(parseCookieQuery('')).toEqual([]);
    expect(parseCookieQuery('   ')).toEqual([]);
  });

  it('parses bare text, quoted text and negation', () => {
    expect(parseCookieQuery('sess -auth "Europe Madrid"')).toEqual([
      { kind: 'text', value: 'sess', negated: false, match: expect.any(Function) },
      { kind: 'text', value: 'auth', negated: true, match: expect.any(Function) },
      { kind: 'text', value: 'Europe Madrid', negated: false, match: expect.any(Function) },
    ]);
  });

  it('parses name:/value:/domain:/path:/is: operators', () => {
    expect(parseCookieQuery('name:sess value:abc domain:.openheaders.io path:/api is:secure')).toEqual([
      { kind: 'name', value: 'sess', negated: false, match: expect.any(Function) },
      { kind: 'value', value: 'abc', negated: false, match: expect.any(Function) },
      { kind: 'domain', value: '.openheaders.io', negated: false, match: expect.any(Function) },
      { kind: 'path', value: '/api', negated: false, match: expect.any(Function) },
      { kind: 'is', value: 'secure', negated: false },
    ]);
  });

  it('falls back to text when is: value is unknown', () => {
    expect(parseCookieQuery('is:bogus')).toEqual([
      { kind: 'text', value: 'is:bogus', negated: false, match: expect.any(Function) },
    ]);
  });

  it('compiles the whole input as one pattern in regex mode', () => {
    const tokens = parseCookieQuery('^__Host-', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true });
    expect(tokens).toEqual([{ kind: 'regex', pattern: expect.any(RegExp), negated: false }]);
    expect(hasCookieQueryError(tokens)).toBe(false);
    expect(hasCookieQueryError(parseCookieQuery('sess(', { ...DEFAULT_TEXT_MATCH_CONFIG, regexMode: true }))).toBe(
      true,
    );
  });
});

describe('matchesCookieQuery', () => {
  it('matches empty query', () => {
    expect(matchesCookieQuery(meta(), parseCookieQuery(''))).toBe(true);
  });

  it('matches text on name, value, or domain', () => {
    expect(matchesCookieQuery(meta({ name: 'session' }), parseCookieQuery('sess'))).toBe(true);
    expect(matchesCookieQuery(meta({ value: 'XYZ' }), parseCookieQuery('xyz'))).toBe(true);
    expect(matchesCookieQuery(meta({ domain: '.openheaders.io' }), parseCookieQuery('openheaders'))).toBe(true);
    expect(matchesCookieQuery(meta(), parseCookieQuery('nope'))).toBe(false);
  });

  it('respects negation', () => {
    expect(matchesCookieQuery(meta({ secure: true }), parseCookieQuery('-is:secure'))).toBe(false);
    expect(matchesCookieQuery(meta({ secure: false }), parseCookieQuery('-is:secure'))).toBe(true);
  });

  it('matches semantic is: tokens', () => {
    expect(matchesCookieQuery(meta({ httpOnly: true }), parseCookieQuery('is:httponly'))).toBe(true);
    expect(matchesCookieQuery(meta({ session: true }), parseCookieQuery('is:session'))).toBe(true);
    expect(matchesCookieQuery(meta({ expired: true }), parseCookieQuery('is:expired'))).toBe(true);
    expect(matchesCookieQuery(meta({ sameSite: 'no_restriction' }), parseCookieQuery('is:samesite-none'))).toBe(true);
    expect(matchesCookieQuery(meta({ sameSite: 'strict' }), parseCookieQuery('is:samesite-strict'))).toBe(true);
    expect(matchesCookieQuery(meta({ partitioned: true }), parseCookieQuery('is:partitioned'))).toBe(true);
    expect(matchesCookieQuery(meta({ hostPrefix: true }), parseCookieQuery('is:host-prefix'))).toBe(true);
    expect(matchesCookieQuery(meta({ securePrefix: true }), parseCookieQuery('is:secure-prefix'))).toBe(true);
    expect(matchesCookieQuery(meta({ thirdParty: true }), parseCookieQuery('is:third-party'))).toBe(true);
    expect(matchesCookieQuery(meta({ isSet: true }), parseCookieQuery('is:set'))).toBe(true);
    expect(matchesCookieQuery(meta({ isSent: false }), parseCookieQuery('is:sent'))).toBe(false);
    expect(matchesCookieQuery(meta({ isFilteredOut: true }), parseCookieQuery('is:filtered-out'))).toBe(true);
    expect(matchesCookieQuery(meta({ problem: true }), parseCookieQuery('is:problem'))).toBe(true);
  });

  it('combines multiple tokens with AND semantics', () => {
    const m = meta({ secure: true, httpOnly: true, sameSite: 'lax' });
    expect(matchesCookieQuery(m, parseCookieQuery('is:secure is:httponly is:samesite-lax'))).toBe(true);
    expect(matchesCookieQuery(m, parseCookieQuery('is:secure -is:httponly'))).toBe(false);
  });
});
