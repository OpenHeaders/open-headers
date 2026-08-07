/**
 * Bootstrap request handling — message-shape validation, the loopback
 * pin on the derived daemon endpoint (the host must refuse to dial a
 * non-loopback address whatever the message claims), and the relay's
 * response mapping over an injected fetch.
 */

import { describe, expect, it } from 'vitest';
import {
  daemonBootstrapEndpoint,
  daemonListenAddress,
  daemonListenPort,
  parseBootstrapRequest,
  performBootstrap,
} from '../../src/bootstrap';

describe('parseBootstrapRequest', () => {
  it('accepts the bootstrap shape with and without installId', () => {
    expect(parseBootstrapRequest({ kind: 'bootstrap', url: 'ws://127.0.0.1:59210' })).toEqual({
      url: 'ws://127.0.0.1:59210',
    });
    expect(parseBootstrapRequest({ kind: 'bootstrap', url: 'ws://127.0.0.1:59210', installId: ' abc ' })).toEqual({
      url: 'ws://127.0.0.1:59210',
      installId: 'abc',
    });
  });

  it('refuses foreign shapes and oversize install ids', () => {
    expect(parseBootstrapRequest(null)).toBeNull();
    expect(parseBootstrapRequest({ kind: 'other', url: 'ws://127.0.0.1:59210' })).toBeNull();
    expect(parseBootstrapRequest({ kind: 'bootstrap' })).toBeNull();
    const oversize = parseBootstrapRequest({
      kind: 'bootstrap',
      url: 'ws://127.0.0.1:59210',
      installId: 'x'.repeat(200),
    });
    expect(oversize).toEqual({ url: 'ws://127.0.0.1:59210' });
  });
});

describe('daemonBootstrapEndpoint', () => {
  it('derives the loopback HTTP endpoint from the backend WS URL', () => {
    expect(daemonBootstrapEndpoint('ws://127.0.0.1:59210')).toBe('http://127.0.0.1:59210/nm/bootstrap');
    expect(daemonBootstrapEndpoint('ws://localhost:59210')).toBe('http://localhost:59210/nm/bootstrap');
    expect(daemonBootstrapEndpoint('ws://[::1]:59210')).toBe('http://[::1]:59210/nm/bootstrap');
  });

  it('refuses non-loopback hosts and foreign schemes', () => {
    expect(daemonBootstrapEndpoint('ws://192.168.1.20:59210')).toBeNull();
    expect(daemonBootstrapEndpoint('ws://openheaders.io:59210')).toBeNull();
    expect(daemonBootstrapEndpoint('wss://127.0.0.1:59210')).toBeNull();
    expect(daemonBootstrapEndpoint('file:///etc/passwd')).toBeNull();
    expect(daemonBootstrapEndpoint('not a url')).toBeNull();
  });
});

describe('daemonListenPort', () => {
  it('names the explicit port and the schemes’ default', () => {
    expect(daemonListenPort('ws://127.0.0.1:59210')).toBe(59210);
    expect(daemonListenPort('ws://127.0.0.1')).toBe(80);
    expect(daemonListenPort('not a url')).toBeNull();
  });
});

describe('daemonListenAddress', () => {
  it('derives the dial-ready loopback address, brackets stripped', () => {
    expect(daemonListenAddress('ws://127.0.0.1:59210')).toEqual({ host: '127.0.0.1', port: 59210 });
    expect(daemonListenAddress('ws://[::1]:59210')).toEqual({ host: '::1', port: 59210 });
    expect(daemonListenAddress('ws://localhost')).toEqual({ host: 'localhost', port: 80 });
  });

  it('refuses non-loopback hosts and foreign schemes', () => {
    expect(daemonListenAddress('ws://192.168.1.20:59210')).toBeNull();
    expect(daemonListenAddress('wss://127.0.0.1:59210')).toBeNull();
    expect(daemonListenAddress('not a url')).toBeNull();
  });
});

function fetchAnswering(status: number, body: unknown): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

describe('performBootstrap', () => {
  const request = { url: 'ws://127.0.0.1:59210', installId: 'abc' };

  it('relays a successful mint', async () => {
    const result = await performBootstrap(request, {
      fetchImpl: fetchAnswering(200, { ok: true, secret: 'oh_secret', tokenId: 't1', browser: 'Google Chrome' }),
    });
    expect(result).toEqual({ ok: true, token: 'oh_secret', tokenId: 't1', browser: 'Google Chrome' });
  });

  it('maps a refused identity chain and the unsupported platform answer', async () => {
    expect(
      await performBootstrap(request, { fetchImpl: fetchAnswering(403, { ok: false, reason: 'refused' }) }),
    ).toEqual({ ok: false, reason: 'refused' });
    expect(
      await performBootstrap(request, { fetchImpl: fetchAnswering(501, { ok: false, reason: 'unsupported' }) }),
    ).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('answers unreachable when the daemon does not respond', async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    expect(await performBootstrap(request, { fetchImpl: failing })).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('refuses a non-loopback request without dialing', async () => {
    let dialed = false;
    const spy: typeof fetch = async () => {
      dialed = true;
      return new Response('{}');
    };
    expect(await performBootstrap({ url: 'ws://192.168.1.20:59210' }, { fetchImpl: spy })).toEqual({
      ok: false,
      reason: 'bad-request',
    });
    expect(dialed).toBe(false);
  });

  it('refuses without dialing when the listener verification says no', async () => {
    let dialed = false;
    const spy: typeof fetch = async () => {
      dialed = true;
      return new Response('{}');
    };
    const ports: number[] = [];
    const result = await performBootstrap(request, {
      fetchImpl: spy,
      verifyListener: async (port) => {
        ports.push(port);
        return false;
      },
    });
    expect(result).toEqual({ ok: false, reason: 'refused' });
    expect(ports).toEqual([59210]);
    expect(dialed).toBe(false);
  });

  it('relays normally when the listener verification passes', async () => {
    const result = await performBootstrap(request, {
      fetchImpl: fetchAnswering(200, { ok: true, secret: 'oh_secret', tokenId: 't1', browser: 'Google Chrome' }),
      verifyListener: async () => true,
    });
    expect(result).toEqual({ ok: true, token: 'oh_secret', tokenId: 't1', browser: 'Google Chrome' });
  });
});
