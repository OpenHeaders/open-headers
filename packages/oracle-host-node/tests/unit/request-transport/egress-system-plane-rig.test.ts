/**
 * Refresh-subsystem egress through LIVE local proxies — the deferred
 * S30/S32 coverage slice (the request-engine proxy design): the
 * OAuth refresh_token exchange now dispatches through the injected
 * node transport instead of the bare global fetch, so an inheriting
 * token POST really tunnels through the proxy the machine's
 * environment names — CONNECT and SOCKS5 alike. The token store is
 * mocked at its module seam (it rides the sync oracle); resolvers are
 * the REAL env-var implementation, injected through the transport's
 * `systemProxy` option (the hermeticity law: the process-global
 * registry stays off for the whole run).
 */

import * as http from 'node:http';
import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { buildRefreshOAuthHook } from '@openheaders/oracle/live/request-exec/oauth-refresh';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeRequestTransport } from '../../../src/live/node-request-transport';
import { createEnvProxyResolver } from '../../../src/live/system-proxy/env-proxy-resolver';
import { listenPort, startConnectProxy, startSocks5Proxy } from './connect-proxy-rig';

const store = vi.hoisted(() => ({
  getTokenBundle: vi.fn(),
  putTokenBundle: vi.fn(async () => {}),
}));
vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => store.getTokenBundle(...(args as [])),
  putTokenBundle: (...args: unknown[]) => store.putTokenBundle(...(args as [])),
}));

interface TokenEndpointRig {
  url: string;
  /** Request paths served, arrival order. */
  hits: string[];
  close(): Promise<void>;
}

async function startTokenEndpoint(): Promise<TokenEndpointRig> {
  const hits: string[] = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url ?? '');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ access_token: 'at-fresh', token_type: 'Bearer', expires_in: 3600 }));
  });
  const port = await listenPort(server);
  return {
    url: `http://127.0.0.1:${port}/token`,
    hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function makeAuth(tokenEndpoint: string): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'cred-1',
    flow: 'authorization-code-pkce',
    tokenEndpoint,
    clientId: 'client-1',
    scopes: [],
  };
}

function makeBundle(): OAuth2TokenBundle {
  return {
    accessToken: 'at-stale',
    refreshToken: 'rt-1',
    tokenType: 'Bearer',
    expiresAt: Date.now() - 1000,
    issuedAt: Date.now() - 3_600_000,
    scope: '',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.getTokenBundle.mockResolvedValue(makeBundle());
});

describe('OAuth refresh egress through the system plane', () => {
  it('tunnels the token POST through the env-var CONNECT proxy', async () => {
    const endpoint = await startTokenEndpoint();
    const proxy = await startConnectProxy();
    try {
      const transport = createNodeRequestTransport({
        systemProxy: createEnvProxyResolver(() => ({ http_proxy: proxy.url })),
      });
      const bundle = await buildRefreshOAuthHook('ws-1', transport)(makeAuth(endpoint.url));
      expect(bundle?.accessToken).toBe('at-fresh');
      expect(endpoint.hits).toEqual(['/token']);
      expect(proxy.tunnels).toEqual([new URL(endpoint.url).host]);
      expect(store.putTokenBundle).toHaveBeenCalledOnce();
    } finally {
      await proxy.close();
      await endpoint.close();
    }
  });

  it('dials the token POST through the env-var SOCKS5 proxy', async () => {
    const endpoint = await startTokenEndpoint();
    const socks = await startSocks5Proxy();
    try {
      const transport = createNodeRequestTransport({
        systemProxy: createEnvProxyResolver(() => ({ all_proxy: socks.url })),
      });
      const bundle = await buildRefreshOAuthHook('ws-1', transport)(makeAuth(endpoint.url));
      expect(bundle?.accessToken).toBe('at-fresh');
      expect(endpoint.hits).toEqual(['/token']);
      expect(socks.targets).toEqual([new URL(endpoint.url).host]);
    } finally {
      await socks.close();
      await endpoint.close();
    }
  });

  it('honors NO_PROXY on the token endpoint — the exchange dials direct', async () => {
    const endpoint = await startTokenEndpoint();
    const proxy = await startConnectProxy();
    try {
      const transport = createNodeRequestTransport({
        systemProxy: createEnvProxyResolver(() => ({ http_proxy: proxy.url, no_proxy: '127.0.0.1' })),
      });
      const bundle = await buildRefreshOAuthHook('ws-1', transport)(makeAuth(endpoint.url));
      expect(bundle?.accessToken).toBe('at-fresh');
      expect(endpoint.hits).toEqual(['/token']);
      expect(proxy.tunnels).toEqual([]);
    } finally {
      await proxy.close();
      await endpoint.close();
    }
  });
});
