import { introspectWithAuthScheme, splitAuthScheme } from '@openheaders/ui/panel/data/auth-scheme';
import { introspectionDetected } from '@openheaders/ui/panel/data/value-introspect';
import { describe, expect, it } from 'vitest';

function b64url(s: string): string {
  return Buffer.from(s, 'utf-8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeJwt(): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: 'u1', exp: 1700003600 };
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.signature-bytes`;
}

describe('splitAuthScheme', () => {
  it('splits a recognized scheme and trims the credential', () => {
    expect(splitAuthScheme('Bearer eyJabc.def.ghi')).toEqual({ scheme: 'Bearer', credential: 'eyJabc.def.ghi' });
  });

  it('canonicalizes the scheme casing', () => {
    expect(splitAuthScheme('bearer x')?.scheme).toBe('Bearer');
    expect(splitAuthScheme('BASIC dXNlcjpwYXNz')?.scheme).toBe('Basic');
  });

  it('returns null for unknown schemes, no space, or empty credential', () => {
    expect(splitAuthScheme('NotAScheme abc')).toBeNull();
    expect(splitAuthScheme('Bearer')).toBeNull();
    expect(splitAuthScheme('Bearer   ')).toBeNull();
    expect(splitAuthScheme('plainvalue')).toBeNull();
  });
});

describe('introspectWithAuthScheme', () => {
  it('wraps a Bearer JWT as a prefixed introspection', () => {
    const i = introspectWithAuthScheme(`Bearer ${makeJwt()}`);
    expect(i.kind).toBe('prefixed');
    if (i.kind === 'prefixed') {
      expect(i.label).toBe('Bearer');
      expect(i.inner.kind).toBe('jwt');
    }
  });

  it('wraps a Basic credential as prefixed base64', () => {
    const cred = Buffer.from('user:password123').toString('base64');
    const i = introspectWithAuthScheme(`Basic ${cred}`);
    expect(i.kind).toBe('prefixed');
    if (i.kind === 'prefixed') {
      expect(i.label).toBe('Basic');
      expect(i.inner.kind).toBe('base64');
      if (i.inner.kind === 'base64') expect(i.inner.decoded).toBe('user:password123');
    }
  });

  it('falls back to plain when the credential has no depth', () => {
    expect(introspectWithAuthScheme('Bearer plaintext').kind).toBe('plain');
  });

  it('introspects a scheme-less value normally', () => {
    expect(introspectWithAuthScheme('{"a":1}').kind).toBe('json');
    expect(introspectWithAuthScheme('xlg').kind).toBe('plain');
  });

  it('introspectionDetected peels the prefixed wrapper to the credential hit', () => {
    const jwt = introspectionDetected(introspectWithAuthScheme(`Bearer ${makeJwt()}`));
    expect(jwt?.type).toBe('jwt');
    const cred = Buffer.from('user:password123').toString('base64');
    const b64 = introspectionDetected(introspectWithAuthScheme(`Basic ${cred}`));
    expect(b64?.type).toBe('base64');
  });
});
