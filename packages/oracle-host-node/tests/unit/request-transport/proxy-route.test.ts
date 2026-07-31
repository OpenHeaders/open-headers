/**
 * Per-send proxy-route resolution — the request plane's precedence,
 * the stand-down rule, the SOCKS gate, and effective-proxy
 * materialization (docs/REQUEST_ENGINE_PROXY_DESIGN.md).
 */

import { TransportError } from '@openheaders/oracle/live/request-exec/transport';
import { describe, expect, it, vi } from 'vitest';
import type { EnvironmentProxyResolver, EnvironmentProxySelection } from '../../../src/live/environment-proxy/types';
import { materializeProxyAttempt, resolveProxyAttempts } from '../../../src/live/request-transport/proxy-route';
import { makeRequest } from './helpers';

function resolverAnswering(selection: EnvironmentProxySelection | null) {
  const resolve = vi.fn<EnvironmentProxyResolver['resolve']>().mockResolvedValue(selection);
  return { resolver: { resolve }, resolve };
}

describe('resolveProxyAttempts', () => {
  it('lets an explicit request-plane proxy win without consulting the environment', async () => {
    const { resolver, resolve } = resolverAnswering({
      entries: [{ kind: 'proxy', url: 'http://ambient:8080' }],
      source: 'env',
    });
    const request = makeRequest({ proxyUrl: 'http://corp.openheaders.io:3128' });
    const attempts = await resolveProxyAttempts(request, resolver);
    expect(attempts).toEqual([
      {
        proxy: { url: 'http://corp.openheaders.io:3128' },
        meta: { plane: 'request', proxyUrl: 'http://corp.openheaders.io:3128' },
      },
    ]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("treats proxyMode 'direct' as the explicit opt-out", async () => {
    const { resolver, resolve } = resolverAnswering({
      entries: [{ kind: 'proxy', url: 'http://ambient:8080' }],
      source: 'env',
    });
    const attempts = await resolveProxyAttempts(makeRequest({ proxyMode: 'direct' }), resolver);
    expect(attempts).toEqual([{ meta: { plane: 'request' } }]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('inherits the environment plane and maps its chain onto attempts', async () => {
    const { resolver } = resolverAnswering({
      entries: [
        { kind: 'proxy', url: 'http://a:8080', credential: 'user:pass' },
        { kind: 'proxy', url: 'http://b:8080' },
        { kind: 'direct' },
      ],
      source: 'env',
    });
    const attempts = await resolveProxyAttempts(makeRequest(), resolver);
    expect(attempts).toEqual([
      {
        proxy: { url: 'http://a:8080', credential: 'user:pass' },
        meta: { plane: 'environment', proxyUrl: 'http://a:8080', source: 'env' },
        environmentChain: true,
      },
      {
        proxy: { url: 'http://b:8080' },
        meta: { plane: 'environment', proxyUrl: 'http://b:8080', source: 'env' },
        environmentChain: true,
      },
      { meta: { plane: 'environment', source: 'env' } },
    ]);
  });

  it('answers plain direct with no meta when the plane is off, silent, or DIRECT-first', async () => {
    await expect(resolveProxyAttempts(makeRequest(), null)).resolves.toEqual([{}]);
    const { resolver: silent } = resolverAnswering(null);
    await expect(resolveProxyAttempts(makeRequest(), silent)).resolves.toEqual([{}]);
    const { resolver: direct } = resolverAnswering({ entries: [{ kind: 'direct' }], source: 'system' });
    await expect(resolveProxyAttempts(makeRequest(), direct)).resolves.toEqual([{}]);
    const failing: EnvironmentProxyResolver = { resolve: () => Promise.reject(new Error('resolver died')) };
    await expect(resolveProxyAttempts(makeRequest(), failing)).resolves.toEqual([{}]);
  });

  it('stands the ambient proxy down for explicit asks a tunnel cannot honor, recording the reason', async () => {
    const selection: EnvironmentProxySelection = {
      entries: [{ kind: 'proxy', url: 'http://ambient:8080' }],
      source: 'system',
    };
    for (const [overrides, reason] of [
      [{ unixSocketPath: '/var/run/openheaders.sock' }, 'unix-socket'],
      [{ resolveToAddress: '10.0.0.7' }, 'resolve-to-address'],
      [{ httpVersion: '3' }, 'http-version-3'],
    ] as const) {
      const { resolver } = resolverAnswering(selection);
      await expect(resolveProxyAttempts(makeRequest(overrides), resolver)).resolves.toEqual([
        { meta: { plane: 'environment', source: 'system', standDownReason: reason } },
      ]);
    }
    // No stand-down record when the environment answers DIRECT anyway.
    const { resolver: direct } = resolverAnswering({ entries: [{ kind: 'direct' }], source: 'system' });
    await expect(
      resolveProxyAttempts(makeRequest({ unixSocketPath: '/var/run/openheaders.sock' }), direct),
    ).resolves.toEqual([{}]);
  });

  it('maps a SOCKS5 answer onto a dialable attempt like any proxy entry', async () => {
    const { resolver } = resolverAnswering({
      entries: [{ kind: 'proxy', url: 'socks5://corp:1080', credential: 'user:secret' }],
      source: 'env',
    });
    await expect(resolveProxyAttempts(makeRequest(), resolver)).resolves.toEqual([
      {
        proxy: { url: 'socks5://corp:1080', credential: 'user:secret' },
        meta: { plane: 'environment', proxyUrl: 'socks5://corp:1080', source: 'env' },
        environmentChain: true,
      },
    ]);
  });

  it('fails honestly on a SOCKS4-only answer, naming the resolved proxy and the escape hatches', async () => {
    const { resolver } = resolverAnswering({
      entries: [{ kind: 'socks', raw: 'socks4://corp:1080' }],
      source: 'env',
    });
    await expect(resolveProxyAttempts(makeRequest(), resolver)).rejects.toThrow(TransportError);
    await expect(resolveProxyAttempts(makeRequest(), resolver)).rejects.toThrow(/socks4:\/\/corp:1080/);
    await expect(resolveProxyAttempts(makeRequest(), resolver)).rejects.toThrow(
      /SOCKS5 and HTTP\(S\) proxies are supported/,
    );
  });

  it('skips a SOCKS4 entry when a supported fallback follows it', async () => {
    const { resolver } = resolverAnswering({
      entries: [
        { kind: 'socks', raw: 'SOCKS corp:1080' },
        { kind: 'proxy', url: 'http://fallback:8080' },
      ],
      source: 'system',
    });
    const attempts = await resolveProxyAttempts(makeRequest(), resolver);
    expect(attempts).toEqual([
      {
        proxy: { url: 'http://fallback:8080' },
        meta: { plane: 'environment', proxyUrl: 'http://fallback:8080', source: 'system' },
        environmentChain: true,
      },
    ]);
    // SOCKS4 followed only by DIRECT falls to direct rather than erroring.
    const { resolver: withDirect } = resolverAnswering({
      entries: [{ kind: 'socks', raw: 'SOCKS corp:1080' }, { kind: 'direct' }],
      source: 'system',
    });
    await expect(resolveProxyAttempts(makeRequest(), withDirect)).resolves.toEqual([{}]);
  });

  it('gates SOCKS5 entries for pinned-h2 sends: skip past to a fallback, honest error when SOCKS5-only', async () => {
    const selection: EnvironmentProxySelection = {
      entries: [
        { kind: 'proxy', url: 'socks5://corp:1080' },
        { kind: 'proxy', url: 'http://fallback:8080' },
      ],
      source: 'system',
    };
    for (const httpVersion of ['2', '2-prior-knowledge'] as const) {
      const { resolver } = resolverAnswering(selection);
      await expect(resolveProxyAttempts(makeRequest({ httpVersion }), resolver)).resolves.toEqual([
        {
          proxy: { url: 'http://fallback:8080' },
          meta: { plane: 'environment', proxyUrl: 'http://fallback:8080', source: 'system' },
          environmentChain: true,
        },
      ]);
      const { resolver: socksOnly } = resolverAnswering({
        entries: [{ kind: 'proxy', url: 'socks5://corp:1080' }],
        source: 'system',
      });
      await expect(resolveProxyAttempts(makeRequest({ httpVersion }), socksOnly)).rejects.toThrow(
        /pins HTTP\/2.*socks5:\/\/corp:1080|socks5:\/\/corp:1080.*pins HTTP\/2/,
      );
    }
    // An unpinned send dials the same entry first.
    const { resolver: auto } = resolverAnswering(selection);
    const attempts = await resolveProxyAttempts(makeRequest(), auto);
    expect(attempts[0]?.proxy?.url).toBe('socks5://corp:1080');
  });
});

describe('materializeProxyAttempt', () => {
  it('returns the request unchanged for direct attempts and the explicit proxy', async () => {
    const direct = makeRequest();
    expect(materializeProxyAttempt(direct, {})).toBe(direct);
    const explicit = makeRequest({ proxyUrl: 'http://corp:3128', proxyCredentialRef: 'corp-proxy' });
    const [attempt] = await resolveProxyAttempts(explicit, null);
    expect(materializeProxyAttempt(explicit, attempt)).toBe(explicit);
  });

  it('materializes an environment proxy onto the seam fields without a vault ref', () => {
    const request = makeRequest();
    const effective = materializeProxyAttempt(request, {
      proxy: { url: 'http://ambient:8080', credential: 'user:pass' },
      environmentChain: true,
    });
    expect(effective.proxyUrl).toBe('http://ambient:8080');
    expect(effective.proxyCredential).toBe('user:pass');
    expect(effective.proxyCredentialRef).toBeUndefined();
    expect(effective.url).toBe(request.url);
  });
});
