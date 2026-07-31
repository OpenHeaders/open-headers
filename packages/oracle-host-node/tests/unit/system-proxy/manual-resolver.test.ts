/**
 * Manual-mode system-plane resolver — the config-driven resolver
 * the desktop's Manual mode (and the P4 daemon manual mode) builds:
 * value normalization via the shared parser, per-resolve credential
 * resolution through the injected callback (the vault seam), NO_PROXY
 * bypass, and the SOCKS carry for the transport's honest gate.
 */

import { describe, expect, it } from 'vitest';
import { createManualProxyResolver } from '../../../src/live/system-proxy/manual-resolver';

const TARGET = 'https://api.openheaders.io/v1/users';

describe('createManualProxyResolver', () => {
  it('resolves the configured proxy as a single-entry manual chain', async () => {
    const resolver = createManualProxyResolver({ proxyValue: 'corp.openheaders.io:8080' });
    await expect(resolver.resolve(TARGET)).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }],
      source: 'manual',
    });
  });

  it('attaches the credential resolved per resolve — a vault edit applies to the next send', async () => {
    let credential: string | null = 'user:secret';
    const resolver = createManualProxyResolver({
      proxyValue: 'http://corp.openheaders.io:8080',
      resolveCredential: () => credential,
    });
    await expect(resolver.resolve(TARGET)).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080', credential: 'user:secret' }],
      source: 'manual',
    });
    // A dangling ref answers null → the send goes unauthenticated (the
    // proxy's 407 is the honest surface), never a config error.
    credential = null;
    await expect(resolver.resolve(TARGET)).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }],
      source: 'manual',
    });
  });

  it('bypasses NO_PROXY-matched targets and unparsable values as direct (null)', async () => {
    const resolver = createManualProxyResolver({
      proxyValue: 'corp.openheaders.io:8080',
      bypassList: 'localhost, .internal.openheaders.io, 10.0.0.0/8',
    });
    await expect(resolver.resolve('https://build.internal.openheaders.io/status')).resolves.toBeNull();
    await expect(resolver.resolve('http://10.1.2.3/health')).resolves.toBeNull();
    await expect(resolver.resolve(TARGET)).resolves.not.toBeNull();
    await expect(resolver.resolve('not a url')).resolves.toBeNull();
    await expect(createManualProxyResolver({ proxyValue: '   ' }).resolve(TARGET)).resolves.toBeNull();
  });

  it('resolves a SOCKS5 value as a dialable entry, vault credential included', async () => {
    const resolver = createManualProxyResolver({
      proxyValue: 'socks5://corp.openheaders.io:1080',
      resolveCredential: () => 'user:secret',
    });
    await expect(resolver.resolve(TARGET)).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'socks5://corp.openheaders.io:1080', credential: 'user:secret' }],
      source: 'manual',
    });
  });

  it('carries a SOCKS4 value verbatim for the transport gate', async () => {
    const resolver = createManualProxyResolver({ proxyValue: 'socks4://corp.openheaders.io:1080' });
    await expect(resolver.resolve(TARGET)).resolves.toEqual({
      entries: [{ kind: 'socks', raw: 'socks4://corp.openheaders.io:1080' }],
      source: 'manual',
    });
  });
});
