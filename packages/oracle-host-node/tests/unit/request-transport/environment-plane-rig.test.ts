/**
 * Environment-plane legs through a LIVE local CONNECT proxy — the H2
 * rig extended per P4 (docs/REQUEST_ENGINE_PROXY_DESIGN.md): an
 * inheriting send (no request-plane proxy) really tunnels through the
 * proxy the machine's environment names, the NO_PROXY bypass really
 * goes direct, an env-var credential really rides the CONNECT, and the
 * wire truth (`proxyRoute`) reports what actually happened. Resolvers
 * are the REAL env-var and manual implementations, injected through the
 * transport's `environmentProxy` option (the hermeticity law: the
 * process-global registry stays off for the whole run).
 */

import * as http from 'node:http';
import { describe, expect, it } from 'vitest';
import { createEnvProxyResolver } from '../../../src/live/environment-proxy/env-proxy-resolver';
import { createManualProxyResolver } from '../../../src/live/environment-proxy/manual-resolver';
import { createNodeRequestTransport } from '../../../src/live/node-request-transport';
import { listenPort, type ProxyRig, startConnectProxy } from './connect-proxy-rig';

interface OriginRig {
  url: string;
  close(): Promise<void>;
}

async function startOrigin(): Promise<OriginRig> {
  const server = http.createServer((_req, res) => {
    res.end('ok');
  });
  const port = await listenPort(server);
  return {
    url: `http://127.0.0.1:${port}/ping`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function makeRequest(originUrl: string) {
  return {
    method: 'GET',
    url: originUrl,
    headers: [],
    body: { kind: 'none' as const },
    redirect: 'follow' as const,
    credentials: 'omit' as const,
    maxBodyBytes: 2 * 1024 * 1024,
  };
}

/** Injected resolver — never the process env, never the registry. */
function sendInheriting(originUrl: string, envSource: Record<string, string | undefined>) {
  return createNodeRequestTransport({ environmentProxy: createEnvProxyResolver(() => envSource) }).send(
    makeRequest(originUrl),
  );
}

async function withRigs(
  test: (origin: OriginRig, proxy: ProxyRig) => Promise<void>,
  proxyOptions: { requireAuth?: string } = {},
): Promise<void> {
  const origin = await startOrigin();
  const proxy = await startConnectProxy(proxyOptions);
  try {
    await test(origin, proxy);
  } finally {
    await proxy.close();
    await origin.close();
  }
}

describe('environment plane through a live local proxy', () => {
  it('tunnels an inheriting send through the env-var proxy and stamps the wire truth', () =>
    withRigs(async (origin, proxy) => {
      const res = await sendInheriting(origin.url, { http_proxy: proxy.url });
      expect(res.status).toBe(200);
      expect(res.body).toBe('ok');
      expect(proxy.tunnels).toEqual([new URL(origin.url).host]);
      expect(res.proxyRoute).toEqual({ plane: 'environment', proxyUrl: proxy.url, source: 'env' });
    }));

  it('honors NO_PROXY — the bypassed target dials direct and stays unstamped', () =>
    withRigs(async (origin, proxy) => {
      const res = await sendInheriting(origin.url, { http_proxy: proxy.url, no_proxy: '127.0.0.1' });
      expect(res.status).toBe(200);
      expect(proxy.tunnels).toEqual([]);
      expect(proxy.authHeaders).toEqual([]);
      expect(res.proxyRoute).toBeUndefined();
    }));

  it('sends an env-var inline credential as Proxy-Authorization on the CONNECT', () =>
    withRigs(
      async (origin, proxy) => {
        const withCreds = proxy.url.replace('http://', 'http://user:secret@');
        const res = await sendInheriting(origin.url, { http_proxy: withCreds });
        expect(res.status).toBe(200);
        expect(proxy.authHeaders).toEqual([`Basic ${Buffer.from('user:secret').toString('base64')}`]);
      },
      { requireAuth: 'user:secret' },
    ));

  it('tunnels through the manual-mode resolver with its bypass honored', async () => {
    const origin = await startOrigin();
    const proxy = await startConnectProxy();
    try {
      const resolver = createManualProxyResolver({
        proxyValue: proxy.url.replace('http://', ''),
        bypassList: 'api.openheaders.io',
      });
      const res = await createNodeRequestTransport({ environmentProxy: resolver }).send(makeRequest(origin.url));
      expect(res.status).toBe(200);
      expect(proxy.tunnels).toEqual([new URL(origin.url).host]);
      expect(res.proxyRoute).toEqual({ plane: 'environment', proxyUrl: proxy.url, source: 'manual' });
    } finally {
      await proxy.close();
      await origin.close();
    }
  });
});
