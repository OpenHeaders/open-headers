/**
 * Chromium `resolveProxy` answer parsing — PAC-format fallback chains
 * mapped onto system-plane entries.
 */

import { describe, expect, it } from 'vitest';
import { parsePacProxyList } from '../../../src/live/system-proxy/pac-result';

describe('parsePacProxyList', () => {
  it('maps DIRECT to a direct entry', () => {
    expect(parsePacProxyList('DIRECT')).toEqual([{ kind: 'direct' }]);
  });

  it('walks a fallback chain in order', () => {
    expect(parsePacProxyList('PROXY a.openheaders.io:8080; PROXY b.openheaders.io:8080; DIRECT')).toEqual([
      { kind: 'proxy', url: 'http://a.openheaders.io:8080' },
      { kind: 'proxy', url: 'http://b.openheaders.io:8080' },
      { kind: 'direct' },
    ]);
  });

  it('maps HTTPS to a TLS-reached proxy with its default port', () => {
    expect(parsePacProxyList('HTTPS secure.openheaders.io')).toEqual([
      { kind: 'proxy', url: 'https://secure.openheaders.io:443' },
    ]);
  });

  it('defaults the PROXY port to 80 when omitted', () => {
    expect(parsePacProxyList('PROXY corp')).toEqual([{ kind: 'proxy', url: 'http://corp:80' }]);
  });

  it('maps SOCKS5 answers to dialable socks5 entries with the default port', () => {
    expect(parsePacProxyList('SOCKS5 corp:1080; DIRECT')).toEqual([
      { kind: 'proxy', url: 'socks5://corp:1080' },
      { kind: 'direct' },
    ]);
    expect(parsePacProxyList('SOCKS5 corp')).toEqual([{ kind: 'proxy', url: 'socks5://corp:1080' }]);
  });

  it('carries SOCKS4-family answers verbatim for the honest failure (PAC SOCKS means v4)', () => {
    expect(parsePacProxyList('SOCKS corp:1080; DIRECT')).toEqual([
      { kind: 'socks', raw: 'SOCKS corp:1080' },
      { kind: 'direct' },
    ]);
    expect(parsePacProxyList('SOCKS4 corp:1080')).toEqual([{ kind: 'socks', raw: 'SOCKS4 corp:1080' }]);
  });

  it('keeps bracketed IPv6 proxy hosts intact', () => {
    expect(parsePacProxyList('PROXY [2001:db8::1]:8080')).toEqual([
      { kind: 'proxy', url: 'http://[2001:db8::1]:8080' },
    ]);
  });

  it('skips unknown tokens and empty segments', () => {
    expect(parsePacProxyList('QUIC corp:443; ; PROXY corp:8080;')).toEqual([
      { kind: 'proxy', url: 'http://corp:8080' },
    ]);
  });

  it('answers an empty chain for an empty string', () => {
    expect(parsePacProxyList('')).toEqual([]);
  });
});
