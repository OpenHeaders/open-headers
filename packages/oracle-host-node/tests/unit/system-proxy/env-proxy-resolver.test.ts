/**
 * Env-var system-plane adapter — curl precedence over the
 * HTTP_PROXY family, case-insensitive pairs, NO_PROXY bypass, and the
 * normalization of configured values (bare host:port, inline
 * credentials, SOCKS schemes).
 */

import { describe, expect, it } from 'vitest';
import { createEnvProxyResolver } from '../../../src/live/system-proxy/env-proxy-resolver';

function resolverFor(env: Record<string, string | undefined>) {
  return createEnvProxyResolver(() => env);
}

describe('createEnvProxyResolver', () => {
  it('answers null when nothing is configured', async () => {
    await expect(resolverFor({}).resolve('https://api.openheaders.io/v1')).resolves.toBeNull();
  });

  it('reads https_proxy for https targets and http_proxy for http targets', async () => {
    const resolver = resolverFor({ https_proxy: 'http://secure:3128', http_proxy: 'http://plain:3128' });
    await expect(resolver.resolve('https://api.openheaders.io/v1')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://secure:3128' }],
      source: 'env',
    });
    await expect(resolver.resolve('http://api.openheaders.io/v1')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://plain:3128' }],
      source: 'env',
    });
  });

  it('is case-insensitive with lowercase winning (curl precedence)', async () => {
    const both = resolverFor({ https_proxy: 'http://lower:3128', HTTPS_PROXY: 'http://upper:3128' });
    await expect(both.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://lower:3128' }],
      source: 'env',
    });
    const upperOnly = resolverFor({ HTTPS_PROXY: 'http://upper:3128' });
    await expect(upperOnly.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://upper:3128' }],
      source: 'env',
    });
  });

  it('falls back to all_proxy after the scheme-specific pair', async () => {
    const resolver = resolverFor({ ALL_PROXY: 'http://any:3128' });
    await expect(resolver.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://any:3128' }],
      source: 'env',
    });
    const specific = resolverFor({ all_proxy: 'http://any:3128', https_proxy: 'http://secure:3128' });
    await expect(specific.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://secure:3128' }],
      source: 'env',
    });
  });

  it('normalizes bare host:port to http:// and extracts inline credentials', async () => {
    const bare = resolverFor({ https_proxy: 'corp:8080' });
    await expect(bare.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp:8080' }],
      source: 'env',
    });
    const withCreds = resolverFor({ https_proxy: 'http://user:p%40ss@corp:8080' });
    await expect(withCreds.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp:8080', credential: 'user:p@ss' }],
      source: 'env',
    });
  });

  it('defaults the proxy port from its scheme', async () => {
    const resolver = resolverFor({ https_proxy: 'https://corp' });
    await expect(resolver.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'https://corp:443' }],
      source: 'env',
    });
  });

  it('resolves SOCKS5 schemes as dialable socks5 entries', async () => {
    const resolver = resolverFor({ all_proxy: 'socks5://corp:1080' });
    await expect(resolver.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'socks5://corp:1080' }],
      source: 'env',
    });
  });

  it('normalizes socks:// and socks5h:// to socks5 with the default port and inline credential', async () => {
    const resolver = resolverFor({ all_proxy: 'socks://corp' });
    await expect(resolver.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'socks5://corp:1080' }],
      source: 'env',
    });
    const hVariant = resolverFor({ all_proxy: 'socks5h://user:secret@corp:9050' });
    await expect(hVariant.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'socks5://corp:9050', credential: 'user:secret' }],
      source: 'env',
    });
  });

  it('carries SOCKS4-family schemes as socks entries (the transport owns the honest failure)', async () => {
    const resolver = resolverFor({ all_proxy: 'socks4://corp:1080' });
    await expect(resolver.resolve('https://api.openheaders.io/')).resolves.toEqual({
      entries: [{ kind: 'socks', raw: 'socks4://corp:1080' }],
      source: 'env',
    });
  });

  it('honors no_proxy bypasses', async () => {
    const resolver = resolverFor({ https_proxy: 'http://corp:8080', no_proxy: 'openheaders.io,10.0.0.0/8' });
    await expect(resolver.resolve('https://api.openheaders.io/v1')).resolves.toBeNull();
    await expect(resolver.resolve('https://10.1.2.3/health')).resolves.toBeNull();
    await expect(resolver.resolve('https://example.com/')).resolves.toEqual({
      entries: [{ kind: 'proxy', url: 'http://corp:8080' }],
      source: 'env',
    });
  });

  it('answers null on empty values, unparsable values, and invalid target URLs', async () => {
    await expect(resolverFor({ https_proxy: '   ' }).resolve('https://api.openheaders.io/')).resolves.toBeNull();
    await expect(resolverFor({ https_proxy: 'http://' }).resolve('https://api.openheaders.io/')).resolves.toBeNull();
    await expect(resolverFor({ https_proxy: 'http://corp:8080' }).resolve('not a url')).resolves.toBeNull();
  });
});
