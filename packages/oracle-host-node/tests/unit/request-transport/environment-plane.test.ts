/**
 * The transport's two-plane proxy behavior end to end over the fetch
 * seam — inherit-mode resolution, chain walking with dial-failure
 * fall-through, stand-down recording, and the proxy-route wire truth
 * (docs/REQUEST_ENGINE_PROXY_DESIGN.md). Fake resolvers only — no
 * Chromium, no real proxies.
 */

import { Agent, ProxyAgent, Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentProxyResolver, EnvironmentProxySelection } from '../../../src/live/environment-proxy/types';
import { fetchError, makeRequest, makeRig } from './helpers';

const rig = makeRig();

function resolverAnswering(selection: EnvironmentProxySelection | null): EnvironmentProxyResolver {
  return { resolve: vi.fn().mockResolvedValue(selection) };
}

function ok(): Response {
  return new Response('ok', { status: 200 });
}

beforeEach(() => {
  rig.fetchMock.mockReset();
  rig.requestMock.mockReset();
});

describe('environment-plane resolution', () => {
  it('routes an inheriting send through the resolved proxy and stamps the wire truth', async () => {
    rig.fetchMock.mockResolvedValue(ok());
    const resolver = resolverAnswering({
      entries: [{ kind: 'proxy', url: 'http://ambient.openheaders.io:8080' }],
      source: 'system',
    });
    const res = await rig.transport({ environmentProxy: resolver }).send(makeRequest());
    expect(res.status).toBe(200);
    expect(rig.callInit().dispatcher).toBeInstanceOf(ProxyAgent);
    expect(res.proxyRoute).toEqual({
      plane: 'environment',
      proxyUrl: 'http://ambient.openheaders.io:8080',
      source: 'system',
    });
  });

  it('leaves a plain default-direct send unstamped', async () => {
    rig.fetchMock.mockResolvedValue(ok());
    const res = await rig.transport().send(makeRequest());
    expect(res.proxyRoute).toBeUndefined();
    expect(rig.callInit().dispatcher).not.toBeInstanceOf(ProxyAgent);
  });

  it("records the request plane's explicit decisions", async () => {
    rig.fetchMock.mockResolvedValue(ok());
    const resolver = resolverAnswering({ entries: [{ kind: 'proxy', url: 'http://ambient:8080' }], source: 'env' });
    const direct = await rig.transport({ environmentProxy: resolver }).send(makeRequest({ proxyMode: 'direct' }));
    expect(direct.proxyRoute).toEqual({ plane: 'request' });
    expect(rig.callInit().dispatcher).not.toBeInstanceOf(ProxyAgent);
    rig.fetchMock.mockClear();
    rig.fetchMock.mockResolvedValue(ok());
    const explicit = await rig
      .transport({ environmentProxy: resolver })
      .send(makeRequest({ proxyUrl: 'http://corp.openheaders.io:3128' }));
    expect(explicit.proxyRoute).toEqual({ plane: 'request', proxyUrl: 'http://corp.openheaders.io:3128' });
    expect(rig.callInit().dispatcher).toBeInstanceOf(ProxyAgent);
  });

  it('walks the fallback chain: a dial failure reaching one proxy falls through to the next', async () => {
    rig.fetchMock.mockRejectedValueOnce(fetchError('ECONNREFUSED')).mockResolvedValueOnce(ok());
    const resolver = resolverAnswering({
      entries: [
        { kind: 'proxy', url: 'http://a.openheaders.io:8080' },
        { kind: 'proxy', url: 'http://b.openheaders.io:8080' },
      ],
      source: 'system',
    });
    const res = await rig.transport({ environmentProxy: resolver }).send(makeRequest());
    expect(res.status).toBe(200);
    expect(rig.fetchMock).toHaveBeenCalledTimes(2);
    expect(res.proxyRoute).toEqual({
      plane: 'environment',
      proxyUrl: 'http://b.openheaders.io:8080',
      source: 'system',
    });
  });

  it('falls through a failed proxy to a trailing DIRECT entry', async () => {
    rig.fetchMock.mockRejectedValueOnce(fetchError('ECONNREFUSED')).mockResolvedValueOnce(ok());
    const resolver = resolverAnswering({
      entries: [{ kind: 'proxy', url: 'http://a.openheaders.io:8080' }, { kind: 'direct' }],
      source: 'system',
    });
    const res = await rig.transport({ environmentProxy: resolver }).send(makeRequest());
    expect(res.status).toBe(200);
    expect(rig.callInit(1).dispatcher).not.toBeInstanceOf(ProxyAgent);
    expect(res.proxyRoute).toEqual({ plane: 'environment', source: 'system' });
  });

  it('surfaces non-dial failures without walking further', async () => {
    rig.fetchMock.mockRejectedValue(fetchError('ECONNRESET'));
    const resolver = resolverAnswering({
      entries: [
        { kind: 'proxy', url: 'http://a.openheaders.io:8080' },
        { kind: 'proxy', url: 'http://b.openheaders.io:8080' },
      ],
      source: 'system',
    });
    await expect(rig.transport({ environmentProxy: resolver }).send(makeRequest())).rejects.toThrow();
    expect(rig.fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the last dial failure when the chain has no DIRECT to fall to', async () => {
    rig.fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    const resolver = resolverAnswering({
      entries: [
        { kind: 'proxy', url: 'http://a.openheaders.io:8080' },
        { kind: 'proxy', url: 'http://b.openheaders.io:8080' },
      ],
      source: 'system',
    });
    await expect(rig.transport({ environmentProxy: resolver }).send(makeRequest())).rejects.toThrow(
      /Connection refused by the proxy/,
    );
    expect(rig.fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stands the ambient proxy down for a socket-pinned send, recorded with the reason', async () => {
    rig.fetchMock.mockResolvedValue(ok());
    const resolver = resolverAnswering({ entries: [{ kind: 'proxy', url: 'http://ambient:8080' }], source: 'system' });
    const res = await rig
      .transport({ environmentProxy: resolver })
      .send(makeRequest({ unixSocketPath: '/var/run/openheaders.sock' }));
    expect(res.status).toBe(200);
    expect(rig.callInit().dispatcher).toBeInstanceOf(Agent);
    expect(rig.callInit().dispatcher).not.toBeInstanceOf(ProxyAgent);
    expect(res.proxyRoute).toEqual({ plane: 'environment', source: 'system', standDownReason: 'unix-socket' });
  });

  it('keeps the explicit-vs-explicit conflicts as pre-wire errors', async () => {
    const resolver = resolverAnswering(null);
    await expect(
      rig
        .transport({ environmentProxy: resolver })
        .send(makeRequest({ proxyUrl: 'http://corp:3128', unixSocketPath: '/var/run/openheaders.sock' })),
    ).rejects.toThrow(/proxy tunnel can't dial a local socket/);
    expect(rig.fetchMock).not.toHaveBeenCalled();
  });

  it('fails honestly on a SOCKS-only environment answer', async () => {
    const resolver = resolverAnswering({ entries: [{ kind: 'socks', raw: 'socks5://corp:1080' }], source: 'env' });
    await expect(rig.transport({ environmentProxy: resolver }).send(makeRequest())).rejects.toThrow(
      /SOCKS proxy \(socks5:\/\/corp:1080\)/,
    );
    expect(rig.fetchMock).not.toHaveBeenCalled();
  });
});
