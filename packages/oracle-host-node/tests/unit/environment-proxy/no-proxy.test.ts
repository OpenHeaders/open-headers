/**
 * NO_PROXY matcher — curl semantics: dot-boundary host suffixes,
 * host:port narrowing, IPv4 CIDR blocks, the `*` wildcard, and no
 * implicit loopback bypass. The exhaustive curl-parity table rides P4;
 * these pin the shared implementation's core behaviors.
 */

import { describe, expect, it } from 'vitest';
import { isBypassedByNoProxy } from '../../../src/live/environment-proxy/no-proxy';

describe('isBypassedByNoProxy', () => {
  it('matches exact hosts and dot-boundary suffixes', () => {
    expect(isBypassedByNoProxy('openheaders.io', 443, 'openheaders.io')).toBe(true);
    expect(isBypassedByNoProxy('api.openheaders.io', 443, 'openheaders.io')).toBe(true);
    expect(isBypassedByNoProxy('api.openheaders.io', 443, '.openheaders.io')).toBe(true);
    // Suffixes align at label boundaries — no partial-label bleed.
    expect(isBypassedByNoProxy('notopenheaders.io', 443, 'openheaders.io')).toBe(false);
    expect(isBypassedByNoProxy('openheaders.io.evil.example', 443, 'openheaders.io')).toBe(false);
  });

  it('is case-insensitive and tolerant of whitespace and empty entries', () => {
    expect(isBypassedByNoProxy('API.OpenHeaders.io', 443, ' openheaders.io ,, example.com')).toBe(true);
  });

  it('narrows to a port when the entry carries one', () => {
    expect(isBypassedByNoProxy('openheaders.io', 8443, 'openheaders.io:8443')).toBe(true);
    expect(isBypassedByNoProxy('openheaders.io', 443, 'openheaders.io:8443')).toBe(false);
  });

  it('matches IPv4 CIDR blocks against IP-literal targets only', () => {
    expect(isBypassedByNoProxy('10.1.2.3', 443, '10.0.0.0/8')).toBe(true);
    expect(isBypassedByNoProxy('11.1.2.3', 443, '10.0.0.0/8')).toBe(false);
    expect(isBypassedByNoProxy('openheaders.io', 443, '10.0.0.0/8')).toBe(false);
  });

  it('matches IPv6 literals, bracketed entries included', () => {
    expect(isBypassedByNoProxy('::1', 443, '::1')).toBe(true);
    expect(isBypassedByNoProxy('[::1]', 8443, '[::1]:8443')).toBe(true);
    expect(isBypassedByNoProxy('::1', 443, '[::1]:8443')).toBe(false);
  });

  it('bypasses everything on * and nothing implicitly', () => {
    expect(isBypassedByNoProxy('anything.example', 80, '*')).toBe(true);
    expect(isBypassedByNoProxy('localhost', 80, 'openheaders.io')).toBe(false);
    expect(isBypassedByNoProxy('127.0.0.1', 80, '')).toBe(false);
  });
});
