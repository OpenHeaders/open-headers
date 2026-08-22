/**
 * Install-flag → `daemon.json` update mapping — only explicitly-given
 * flags land in the update (an omitted flag must leave the persisted
 * value standing), negations write an explicit false, and the proxy
 * flags replace the proxy object as one unit.
 */

import { describe, expect, it } from 'vitest';

import { configFileUpdateFromFlags } from '../../src/cli/config-flags';

describe('configFileUpdateFromFlags', () => {
  it('maps nothing when no flags were given — a bare re-install changes nothing', () => {
    expect(configFileUpdateFromFlags({})).toEqual({});
  });

  it('maps exactly the given flags, converting the port to a number', () => {
    expect(
      configFileUpdateFromFlags({
        'bind-address': '0.0.0.0',
        'bind-port': '9000',
        'allow-insecure-lan': true,
        'allowed-host': ['oh.openheaders.io'],
      }),
    ).toEqual({
      bindAddress: '0.0.0.0',
      bindPort: 9000,
      allowInsecureLan: true,
      allowedHosts: ['oh.openheaders.io'],
    });
  });

  it('negations write an explicit false, and conflicting halves refuse', () => {
    expect(configFileUpdateFromFlags({ 'no-trusted-proxy': true })).toEqual({ trustedProxy: false });
    expect(configFileUpdateFromFlags({ 'no-allow-insecure-lan': true })).toEqual({ allowInsecureLan: false });
    expect(() => configFileUpdateFromFlags({ 'trusted-proxy': true, 'no-trusted-proxy': true })).toThrow(
      /mutually exclusive/,
    );
    expect(() => configFileUpdateFromFlags({ 'allow-insecure-lan': true, 'no-allow-insecure-lan': true })).toThrow(
      /mutually exclusive/,
    );
  });

  it('any proxy flag groups the given proxy fields into one replacement object', () => {
    expect(configFileUpdateFromFlags({ 'proxy-mode': 'env' })).toEqual({ proxy: { mode: 'env' } });
    expect(
      configFileUpdateFromFlags({
        'proxy-mode': 'manual',
        'proxy-url': 'corp.openheaders.io:8080',
        'proxy-credential-ref': 'corp-proxy',
        'proxy-bypass': '10.0.0.0/8',
      }),
    ).toEqual({
      proxy: {
        mode: 'manual',
        url: 'corp.openheaders.io:8080',
        credentialRef: 'corp-proxy',
        bypassList: '10.0.0.0/8',
      },
    });
  });

  it('paths and the log level pass through raw — validation and resolution happen at the write', () => {
    expect(configFileUpdateFromFlags({ 'data-dir': '/srv/oh', 'log-level': 'debug', 'web-root': '/srv/web' })).toEqual({
      dataDir: '/srv/oh',
      logLevel: 'debug',
      webRoot: '/srv/web',
    });
  });
});
