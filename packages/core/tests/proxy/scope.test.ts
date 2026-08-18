/**
 * Scope-match predicate laws (the proxy-security design §2.4 — scoped decrypt by
 * default). The empty list matches nothing; exact patterns match the
 * apex only; `*.` wildcards match any subdomain but never the apex;
 * matching is case-insensitive and port/bracket agnostic; there is no
 * bare catch-all pattern.
 */

import { describe, expect, it } from 'vitest';
import { hostInScope, isValidScopePattern, normalizeHost } from '../../src/proxy/scope';

describe('proxy scope — hostInScope', () => {
  it('matches nothing when the list is empty (passthrough is the default)', () => {
    expect(hostInScope('api.openheaders.io', [])).toBe(false);
    expect(hostInScope('openheaders.io', ['', '   '])).toBe(false);
  });

  it('matches an exact host, apex only', () => {
    expect(hostInScope('openheaders.io', ['openheaders.io'])).toBe(true);
    expect(hostInScope('api.openheaders.io', ['openheaders.io'])).toBe(false);
  });

  it('matches subdomains for a `*.` wildcard but never the apex', () => {
    const patterns = ['*.openheaders.io'];
    expect(hostInScope('api.openheaders.io', patterns)).toBe(true);
    expect(hostInScope('a.b.openheaders.io', patterns)).toBe(true);
    expect(hostInScope('openheaders.io', patterns)).toBe(false);
    // A sibling apex that merely ends with the string is not a subdomain.
    expect(hostInScope('evilopenheaders.io', patterns)).toBe(false);
  });

  it('is case-insensitive and ignores a trailing port', () => {
    expect(hostInScope('API.OpenHeaders.IO:443', ['api.openheaders.io'])).toBe(true);
    expect(hostInScope('api.openheaders.io:8443', ['*.openheaders.io'])).toBe(true);
  });

  it('matches an IP literal exactly, with no wildcarding', () => {
    expect(hostInScope('10.0.0.5', ['10.0.0.5'])).toBe(true);
    expect(hostInScope('10.0.0.6', ['10.0.0.5'])).toBe(false);
  });

  it('has no bare catch-all — a lone `*` never matches', () => {
    expect(hostInScope('anything.example', ['*'])).toBe(false);
  });
});

describe('proxy scope — normalizeHost', () => {
  it('strips a port and lowercases', () => {
    expect(normalizeHost('API.Example.com:443')).toBe('api.example.com');
  });

  it('unwraps a bracketed IPv6 literal with or without a port', () => {
    expect(normalizeHost('[::1]:443')).toBe('::1');
    expect(normalizeHost('[fe80::1]')).toBe('fe80::1');
  });

  it('leaves a bare IPv6 literal intact', () => {
    expect(normalizeHost('::1')).toBe('::1');
  });

  it('returns empty for a blank host', () => {
    expect(normalizeHost('   ')).toBe('');
  });
});

describe('proxy scope — isValidScopePattern', () => {
  it('accepts an exact host, a `*.` wildcard, and an IP literal', () => {
    expect(isValidScopePattern('openheaders.io')).toBe(true);
    expect(isValidScopePattern('*.openheaders.io')).toBe(true);
    expect(isValidScopePattern('10.0.0.5')).toBe(true);
  });

  it('rejects blank entries and a wildcard with no apex', () => {
    expect(isValidScopePattern('')).toBe(false);
    expect(isValidScopePattern('   ')).toBe(false);
    expect(isValidScopePattern('*.')).toBe(false);
  });

  it('rejects the bare catch-all so a scope list can never hold `*`', () => {
    expect(isValidScopePattern('*')).toBe(false);
    expect(isValidScopePattern('  *  ')).toBe(false);
  });
});
