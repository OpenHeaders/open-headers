/**
 * OAuth loopback callback route — against a real bound loopback socket
 * (the metrics-http idiom): a parked waiter resolves with the full
 * redirect URL and the browser gets the landing page; a hit with no
 * waiter answers 404; unrelated paths fall through; the method gate;
 * the timeout rejection; a superseding wait for the same state; and
 * the off-device refusal through a fake socket (a real loopback
 * server cannot produce a non-loopback peer).
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createOAuthCallbackHandler,
  OAUTH_CALLBACK_PATH,
  type OAuthCallbackHandler,
} from '../../../src/daemon/oauth-callback-http';

describe('OAuth callback HTTP handler', () => {
  let server: Server;
  let baseUrl: string;
  let callback: OAuthCallbackHandler;

  beforeEach(async () => {
    setHostLogger(consoleLogger);
    callback = createOAuthCallbackHandler();
    server = createServer((req, res) => {
      if (callback.handler(req, res)) return;
      res.statusCode = 400;
      res.end('fallback');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('resolves the parked waiter with the full redirect URL and serves the landing page', async () => {
    const redirect = callback.awaitRedirect('st-1');
    expect(callback.pendingCount()).toBe(1);
    const res = await fetch(`${baseUrl}${OAUTH_CALLBACK_PATH}?code=code-1&state=st-1`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.text()).toContain('Authorization complete');
    const url = new URL(await redirect);
    expect(url.pathname).toBe(OAUTH_CALLBACK_PATH);
    expect(url.searchParams.get('code')).toBe('code-1');
    expect(url.searchParams.get('state')).toBe('st-1');
    expect(callback.pendingCount()).toBe(0);
  });

  it('a provider error redirect still settles the waiter — the flow reads the error, not the route', async () => {
    const redirect = callback.awaitRedirect('st-2');
    await fetch(`${baseUrl}${OAUTH_CALLBACK_PATH}?error=access_denied&state=st-2`);
    expect(new URL(await redirect).searchParams.get('error')).toBe('access_denied');
  });

  it('a hit with no matching waiter answers 404 with the stale page', async () => {
    const res = await fetch(`${baseUrl}${OAUTH_CALLBACK_PATH}?code=x&state=nobody`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('No authorization in progress');
  });

  it('a hit without a state answers 404', async () => {
    callback.awaitRedirect('st-3').catch(() => undefined);
    const res = await fetch(`${baseUrl}${OAUTH_CALLBACK_PATH}?code=x`);
    expect(res.status).toBe(404);
    expect(callback.pendingCount()).toBe(1);
  });

  it('unrelated paths fall through to the next handler', async () => {
    const res = await fetch(`${baseUrl}/oauth/other`);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('fallback');
  });

  it('only GET and HEAD are served on the path', async () => {
    const res = await fetch(`${baseUrl}${OAUTH_CALLBACK_PATH}?state=st-1`, { method: 'POST' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
  });

  it('refuses an off-device peer with 403 before reading the state', () => {
    const redirect = callback.awaitRedirect('st-4');
    redirect.catch(() => undefined);
    const end = vi.fn();
    const req = {
      url: `${OAUTH_CALLBACK_PATH}?code=x&state=st-4`,
      method: 'GET',
      headers: { host: '127.0.0.1:8137' },
      socket: { remoteAddress: '192.168.1.20' },
    } as unknown as IncomingMessage;
    const res = { statusCode: 200, setHeader: vi.fn(), writeHead: vi.fn(), end } as unknown as ServerResponse;
    expect(callback.handler(req, res)).toBe(true);
    expect(res.statusCode).toBe(403);
    expect(end).toHaveBeenCalled();
    expect(callback.pendingCount()).toBe(1);
  });

  it('a waiter times out with a message naming the wait', async () => {
    await expect(callback.awaitRedirect('st-5', { timeoutMs: 20 })).rejects.toThrow(/no redirect arrived within 0s/);
    expect(callback.pendingCount()).toBe(0);
  });

  it('a newer wait for the same state supersedes the older one', async () => {
    const first = callback.awaitRedirect('st-6');
    const second = callback.awaitRedirect('st-6');
    await expect(first).rejects.toThrow(/superseded/);
    expect(callback.pendingCount()).toBe(1);
    await fetch(`${baseUrl}${OAUTH_CALLBACK_PATH}?code=code-6&state=st-6`);
    expect(new URL(await second).searchParams.get('code')).toBe('code-6');
  });
});
