import { introspectCookieValue, introspectionHasDepth } from '@openheaders/ui/panel/data/cookie-value-introspect';
import { describe, expect, it } from 'vitest';

function b64url(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('introspectCookieValue', () => {
  it('detects a JWT and parses header / payload / claims', () => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: 'u1', iat: 1700000000, exp: 1700003600 };
    const token = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.signature-bytes`;
    const i = introspectCookieValue(token);
    expect(i.kind).toBe('jwt');
    if (i.kind === 'jwt') {
      expect(i.jwt.header).toEqual(header);
      expect(i.jwt.payload).toEqual(payload);
      expect(i.jwt.expSec).toBe(1700003600);
      expect(i.jwt.iatSec).toBe(1700000000);
    }
  });

  it('rejects a 3-segment value that lacks a real JWT header', () => {
    const i = introspectCookieValue('aaa.bbb.ccc');
    expect(i.kind).not.toBe('jwt');
  });

  it('detects percent-encoded values and surfaces the decoded form', () => {
    const i = introspectCookieValue('Europe%2FMadrid');
    expect(i.kind).toBe('url-encoded');
    if (i.kind === 'url-encoded') expect(i.decoded).toBe('Europe/Madrid');
  });

  it('detects JSON-in-cookie (incl. after URL-decode)', () => {
    expect(introspectCookieValue('{"a":1}').kind).toBe('json');
    expect(introspectCookieValue(encodeURIComponent('{"a":1}')).kind).toBe('json');
  });

  it('detects plain base64', () => {
    const raw = 'hello world hello world hello';
    const b64 = Buffer.from(raw).toString('base64');
    const i = introspectCookieValue(b64);
    expect(i.kind).toBe('base64');
    if (i.kind === 'base64') expect(i.decoded).toBe(raw);
  });

  it('returns plain for boring values', () => {
    expect(introspectCookieValue('xlg').kind).toBe('plain');
    expect(introspectCookieValue('dark').kind).toBe('plain');
  });

  it('introspectionHasDepth is true only for non-plain', () => {
    expect(introspectionHasDepth(introspectCookieValue('xlg'))).toBe(false);
    expect(introspectionHasDepth(introspectCookieValue('Europe%2FMadrid'))).toBe(true);
  });
});
