import {
  humanDuration,
  parseAuthorization,
  parseCacheControl,
  parseContentType,
  parseHsts,
  parseSetCookie,
} from '@openheaders/ui/panel/data/headers/header-value-introspection';
import { describe, expect, it } from 'vitest';

describe('parseSetCookie', () => {
  it('parses a fully-decorated cookie', () => {
    const info = parseSetCookie(
      'sid=abc; Max-Age=3600; Domain=openheaders.io; Path=/; Secure; HttpOnly; SameSite=Lax',
      1_700_000_000_000,
    );
    expect(info?.name).toBe('sid');
    expect(info?.secure).toBe(true);
    expect(info?.httpOnly).toBe(true);
    expect(info?.sameSite).toBe('Lax');
    expect(info?.domain).toBe('openheaders.io');
    expect(info?.path).toBe('/');
    expect(info?.expiresAtMs).toBe(1_700_000_000_000 + 3600 * 1000);
    expect(info?.session).toBe(false);
    expect(info?.missingFlags).toEqual([]);
  });

  it('flags missing best-practice flags', () => {
    const info = parseSetCookie('tracker=1', 1_700_000_000_000);
    expect(info?.missingFlags).toEqual(['Secure', 'HttpOnly', 'SameSite']);
    expect(info?.session).toBe(true);
  });

  it('honors Expires when Max-Age missing', () => {
    const info = parseSetCookie('a=b; Expires=Wed, 21 Oct 2099 07:28:00 GMT');
    expect(info?.expiresAtMs).toBeGreaterThan(Date.now());
    expect(info?.session).toBe(false);
  });

  it('rejects malformed cookies', () => {
    expect(parseSetCookie('')).toBeNull();
    expect(parseSetCookie('noequals')).toBeNull();
  });

  it('parses Partitioned and SameSite=None', () => {
    const info = parseSetCookie('a=b; Partitioned; Secure; SameSite=None');
    expect(info?.partitioned).toBe(true);
    expect(info?.sameSite).toBe('None');
  });
});

describe('parseCacheControl', () => {
  it('parses max-age and produces a fresh summary', () => {
    const info = parseCacheControl('public, max-age=3600');
    expect(info.maxAgeSec).toBe(3600);
    expect(info.isPublic).toBe(true);
    expect(info.summary).toBe('fresh 1h');
  });

  it('detects no-store', () => {
    const info = parseCacheControl('no-store');
    expect(info.noStore).toBe(true);
    expect(info.summary).toBe('no-store');
  });

  it('detects no-cache', () => {
    const info = parseCacheControl('no-cache');
    expect(info.noCache).toBe(true);
    expect(info.summary).toBe('revalidate every request');
  });

  it('detects immutable with duration', () => {
    const info = parseCacheControl('public, max-age=31536000, immutable');
    expect(info.immutable).toBe(true);
    expect(info.summary).toBe('immutable · 1y');
  });

  it('appends must-revalidate to fresh summary', () => {
    const info = parseCacheControl('max-age=600, must-revalidate');
    expect(info.summary).toBe('fresh 10m · must-revalidate');
  });
});

describe('humanDuration', () => {
  it('rounds to sensible units', () => {
    expect(humanDuration(30)).toBe('30s');
    expect(humanDuration(120)).toBe('2m');
    expect(humanDuration(3600)).toBe('1h');
    expect(humanDuration(86400)).toBe('1d');
    expect(humanDuration(86400 * 30)).toBe('1mo');
    expect(humanDuration(86400 * 365)).toBe('1y');
  });
});

describe('parseContentType', () => {
  it('splits type, charset and boundary', () => {
    expect(parseContentType('application/json; charset=utf-8')).toEqual({
      type: 'application/json',
      charset: 'utf-8',
      boundary: null,
    });
    expect(parseContentType('multipart/form-data; boundary="abc 123"')).toEqual({
      type: 'multipart/form-data',
      charset: null,
      boundary: 'abc 123',
    });
  });
});

describe('parseAuthorization', () => {
  it('reports scheme for non-JWT bearer', () => {
    const info = parseAuthorization('Bearer opaque-token');
    expect(info?.scheme).toBe('Bearer');
    expect(info?.isJwt).toBe(false);
  });

  it('detects JWT and decodes header + payload + exp remaining', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const exp = 1_700_000_000;
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp })).toString('base64url');
    const sig = 'sig';
    const info = parseAuthorization(`Bearer ${header}.${payload}.${sig}`, exp * 1000 - 60_000);
    expect(info?.isJwt).toBe(true);
    expect(info?.jwtHeader).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(info?.jwtPayload).toEqual({ sub: 'u1', exp });
    expect(info?.jwtExpSecondsRemaining).toBe(60);
  });
});

describe('parseHsts', () => {
  it('parses a 1y subdomains preload directive', () => {
    const info = parseHsts('max-age=31536000; includeSubDomains; preload');
    expect(info?.maxAgeSec).toBe(31_536_000);
    expect(info?.includeSubDomains).toBe(true);
    expect(info?.preload).toBe(true);
    expect(info?.summary).toBe('1y · includeSubDomains · preload');
  });

  it('returns null without max-age', () => {
    expect(parseHsts('includeSubDomains')).toBeNull();
  });
});
