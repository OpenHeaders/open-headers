/**
 * NO_PROXY matcher — curl semantics: dot-boundary host suffixes,
 * host:port narrowing, IPv4 CIDR blocks, the `*` wildcard, and no
 * implicit loopback bypass. The focused specs pin the core behaviors;
 * the curl-parity table below (P4) is the exhaustive pin every tier's
 * bypass handling rides — the env-var resolver, the manual mode on
 * desktop and daemon alike.
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

/** The exhaustive curl-parity pin (P4): each row is
 *  [host, port, NO_PROXY value, bypassed?, what it proves]. */
const CURL_PARITY_TABLE: Array<[string, number, string, boolean, string]> = [
  // ── Name matching: exact hosts + dot-boundary suffixes ─────────────
  ['openheaders.io', 443, 'openheaders.io', true, 'exact host'],
  ['api.openheaders.io', 443, 'openheaders.io', true, 'subdomain rides the suffix'],
  ['a.b.api.openheaders.io', 443, 'openheaders.io', true, 'any depth of subdomain'],
  ['api.openheaders.io', 443, '.openheaders.io', true, 'leading dot tolerated'],
  ['openheaders.io', 443, '.openheaders.io', true, 'leading dot still matches the bare host'],
  ['notopenheaders.io', 443, 'openheaders.io', false, 'no partial-label bleed'],
  ['openheaders.io.evil.example', 443, 'openheaders.io', false, 'suffix must anchor at the end'],
  ['api.openheaders.dev', 443, 'openheaders.io', false, 'different domain'],
  // ── Case + list hygiene ────────────────────────────────────────────
  ['API.OpenHeaders.IO', 443, 'openheaders.io', true, 'target case-insensitive'],
  ['api.openheaders.io', 443, 'OPENHEADERS.IO', true, 'entry case-insensitive'],
  ['api.openheaders.io', 443, ' example.com , openheaders.io ', true, 'whitespace-padded lists'],
  ['api.openheaders.io', 443, 'example.com,,openheaders.io,', true, 'empty entries skipped'],
  ['api.openheaders.io', 443, 'example.com,other.example', false, 'no entry matches'],
  // ── Port narrowing ─────────────────────────────────────────────────
  ['openheaders.io', 8443, 'openheaders.io:8443', true, 'entry port narrows and matches'],
  ['openheaders.io', 443, 'openheaders.io:8443', false, 'entry port narrows and misses'],
  ['api.openheaders.io', 8443, 'openheaders.io:8443', true, 'ported entry still suffix-matches'],
  ['openheaders.io', 443, 'openheaders.io:8443,openheaders.io', true, 'portless entry rescues'],
  // ── Wildcard ───────────────────────────────────────────────────────
  ['anything.example', 80, '*', true, 'lone * bypasses everything'],
  ['anything.example', 80, 'example.com,*', true, '* among other entries'],
  ['10.1.2.3', 1234, '*', true, '* covers IP literals too'],
  // ── IPv4 literals + CIDR ───────────────────────────────────────────
  ['10.1.2.3', 443, '10.1.2.3', true, 'exact IPv4 literal'],
  ['10.1.2.3', 443, '10.0.0.0/8', true, 'CIDR /8 contains the target'],
  ['11.1.2.3', 443, '10.0.0.0/8', false, 'CIDR /8 excludes the target'],
  ['10.1.2.3', 443, '10.1.2.3/32', true, 'CIDR /32 is an exact match'],
  ['10.1.2.4', 443, '10.1.2.3/32', false, 'CIDR /32 excludes the neighbor'],
  ['10.1.2.3', 443, '0.0.0.0/0', true, 'CIDR /0 contains every IPv4'],
  ['openheaders.io', 443, '10.0.0.0/8', false, 'CIDR never matches a hostname'],
  ['10.1.2.3', 443, '10.0.0.0/40', false, 'invalid prefix matches nothing'],
  ['192.168.7.9', 443, '192.168.0.0/16,openheaders.io', true, 'CIDR alongside names'],
  // ── IPv6 literals ──────────────────────────────────────────────────
  ['::1', 443, '::1', true, 'exact IPv6 literal'],
  ['::1', 8443, '[::1]:8443', true, 'bracketed IPv6 entry with matching port'],
  ['::1', 443, '[::1]:8443', false, 'bracketed IPv6 entry with other port'],
  ['[::1]', 443, '::1', true, 'bracketed target normalized'],
  ['2001:DB8::1', 443, '2001:db8::1', true, 'IPv6 hex case-insensitive'],
  // ── No implicit loopback (curl has none) ───────────────────────────
  ['localhost', 80, 'openheaders.io', false, 'localhost needs an explicit entry'],
  ['127.0.0.1', 80, 'openheaders.io', false, 'loopback IP needs an explicit entry'],
  ['localhost', 80, 'localhost,127.0.0.1', true, 'the explicit loopback entry works'],
  ['127.0.0.1', 80, 'localhost,127.0.0.1', true, 'the explicit loopback IP works'],
  ['anything.example', 80, '', false, 'empty value bypasses nothing'],
];

describe('isBypassedByNoProxy — curl-parity table', () => {
  it.each(CURL_PARITY_TABLE)('%s:%i vs %j → %s (%s)', (host, port, noProxy, expected) => {
    expect(isBypassedByNoProxy(host, port, noProxy)).toBe(expected);
  });
});
