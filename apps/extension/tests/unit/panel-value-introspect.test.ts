import { introspectionHasDepth, introspectValue } from '@openheaders/ui/panel/data/value-introspect';
import { describe, expect, it } from 'vitest';

function b64url(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

describe('introspectValue', () => {
  it('detects a JWT and parses header / payload / claims', () => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { sub: 'u1', iat: 1700000000, exp: 1700003600 };
    const token = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.signature-bytes`;
    const i = introspectValue(token);
    expect(i.kind).toBe('jwt');
    if (i.kind === 'jwt') {
      expect(i.jwt.header).toEqual(header);
      expect(i.jwt.payload).toEqual(payload);
      expect(i.jwt.expSec).toBe(1700003600);
      expect(i.jwt.iatSec).toBe(1700000000);
    }
  });

  it('rejects a 3-segment value that lacks a real JWT header', () => {
    const i = introspectValue('aaa.bbb.ccc');
    expect(i.kind).not.toBe('jwt');
  });

  it('detects percent-encoded values and surfaces the decoded form', () => {
    const i = introspectValue('Europe%2FMadrid');
    expect(i.kind).toBe('url-encoded');
    if (i.kind === 'url-encoded') expect(i.decoded).toBe('Europe/Madrid');
  });

  it('detects JSON (incl. after URL-decode)', () => {
    expect(introspectValue('{"a":1}').kind).toBe('json');
    expect(introspectValue(encodeURIComponent('{"a":1}')).kind).toBe('json');
  });

  it('detects plain base64', () => {
    const raw = 'hello world hello world hello';
    const b64 = Buffer.from(raw).toString('base64');
    const i = introspectValue(b64);
    expect(i.kind).toBe('base64');
    if (i.kind === 'base64') expect(i.decoded).toBe(raw);
  });

  it('returns plain for boring values', () => {
    expect(introspectValue('xlg').kind).toBe('plain');
    expect(introspectValue('dark').kind).toBe('plain');
  });

  it('shares the registry JWT policy: typ:JWT with no alg still detects', () => {
    const token = `${b64url('{"typ":"JWT"}')}.${b64url('{"sub":"u1"}')}.sig`;
    expect(introspectValue(token).kind).toBe('jwt');
  });

  it('shares the registry base64 policy: strict UTF-8, no loose printable tier', () => {
    // Valid base64 whose decode has non-UTF-8 bytes — the removed loose
    // tier accepted 80%-printable decodes; the shared codec rejects.
    const binary = Buffer.from([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0xff, 0xfe, 0x68, 0x65, 0x6c, 0x6c, 0x6f]);
    expect(introspectValue(binary.toString('base64')).kind).toBe('plain');
  });

  it('maps registry kinds without an expander view to plain', () => {
    expect(introspectValue('no-cache, max-age=0').kind).toBe('plain');
    expect(introspectValue('1720000000').kind).toBe('plain');
  });

  it('introspectionHasDepth is true only for non-plain', () => {
    expect(introspectionHasDepth(introspectValue('xlg'))).toBe(false);
    expect(introspectionHasDepth(introspectValue('Europe%2FMadrid'))).toBe(true);
  });
});
