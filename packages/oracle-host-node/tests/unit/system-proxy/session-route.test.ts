/**
 * Session-dial ambient route resolution — the WS/gRPC twins of the
 * HTTP `proxy-route` walk: no request plane exists (H5), so the
 * system plane's answer is the whole story. Pins the attempt
 * shapes per chain, the socket-pin stand-down, the per-capability
 * SOCKS5 posture ('socks5-dialable' seats it, 'connect-only' skips it
 * like a failed dial), and the honest error when a chain resolves only
 * to proxies the dial cannot traverse.
 */

import { describe, expect, it } from 'vitest';
import {
  isSessionProxyDialFailure,
  resolveSessionProxyAttempts,
  type SessionRouteRequest,
} from '../../../src/live/system-proxy/session-route';
import type { SystemProxyEntry, SystemProxyResolver } from '../../../src/live/system-proxy/types';

const resolverOf = (entries: SystemProxyEntry[], source: 'env' | 'system' = 'env'): SystemProxyResolver => ({
  resolve: () => Promise.resolve({ entries, source }),
});

const wsRequest = (overrides: Partial<SessionRouteRequest> = {}): SessionRouteRequest => ({
  url: 'wss://ws.openheaders.io/session',
  capability: 'socks5-dialable',
  ...overrides,
});

describe('resolveSessionProxyAttempts', () => {
  it('answers one direct attempt when the plane is off or silent', async () => {
    expect(await resolveSessionProxyAttempts(wsRequest(), null)).toEqual({ attempts: [{}] });
    expect(await resolveSessionProxyAttempts(wsRequest(), { resolve: () => Promise.resolve(null) })).toEqual({
      attempts: [{}],
    });
    expect(await resolveSessionProxyAttempts(wsRequest(), resolverOf([]))).toEqual({ attempts: [{}] });
  });

  it('a resolver failure resolves direct, never throws', async () => {
    const failing: SystemProxyResolver = { resolve: () => Promise.reject(new Error('boom')) };
    expect(await resolveSessionProxyAttempts(wsRequest(), failing)).toEqual({ attempts: [{}] });
  });

  it('a proxy chain becomes dialable attempts with routes and chain marks', async () => {
    const result = await resolveSessionProxyAttempts(
      wsRequest(),
      resolverOf(
        [
          { kind: 'proxy', url: 'http://corp-a.openheaders.io:8080', credential: 'u:p' },
          { kind: 'proxy', url: 'http://corp-b.openheaders.io:8080' },
        ],
        'system',
      ),
    );
    expect(result).toEqual({
      attempts: [
        {
          proxy: { url: 'http://corp-a.openheaders.io:8080', credential: 'u:p' },
          route: { proxyUrl: 'http://corp-a.openheaders.io:8080', source: 'system' },
          environmentChain: true,
        },
        {
          proxy: { url: 'http://corp-b.openheaders.io:8080' },
          route: { proxyUrl: 'http://corp-b.openheaders.io:8080', source: 'system' },
          environmentChain: true,
        },
      ],
    });
  });

  it('a chain opening with DIRECT is a plain direct answer; direct as a fallback records the decision', async () => {
    expect(
      await resolveSessionProxyAttempts(
        wsRequest(),
        resolverOf([{ kind: 'direct' }, { kind: 'proxy', url: 'http://corp.openheaders.io:8080' }]),
      ),
    ).toEqual({ attempts: [{}] });
    const fallback = await resolveSessionProxyAttempts(
      wsRequest(),
      resolverOf([{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }, { kind: 'direct' }]),
    );
    expect(fallback).toEqual({
      attempts: [
        {
          proxy: { url: 'http://corp.openheaders.io:8080' },
          route: { proxyUrl: 'http://corp.openheaders.io:8080', source: 'env' },
          environmentChain: true,
        },
        { route: { source: 'env' } },
      ],
    });
  });

  it('a socket-pinned dial makes the answering plane stand down, recorded', async () => {
    const result = await resolveSessionProxyAttempts(
      wsRequest({ unixSocketPath: '/tmp/oh.sock' }),
      resolverOf([{ kind: 'proxy', url: 'http://corp.openheaders.io:8080' }], 'system'),
    );
    expect(result).toEqual({
      attempts: [{ route: { source: 'system', standDownReason: 'unix-socket' } }],
    });
    // A silent plane records nothing — the stand-down needs an answer.
    expect(await resolveSessionProxyAttempts(wsRequest({ unixSocketPath: '/tmp/oh.sock' }), resolverOf([]))).toEqual({
      attempts: [{}],
    });
  });

  it("'socks5-dialable' seats SOCKS5 entries; 'connect-only' skips them like a failed dial", async () => {
    const entries: SystemProxyEntry[] = [
      { kind: 'proxy', url: 'socks5://socks.openheaders.io:1080' },
      { kind: 'proxy', url: 'http://corp.openheaders.io:8080' },
    ];
    const ws = await resolveSessionProxyAttempts(wsRequest(), resolverOf(entries));
    if ('errorMessage' in ws) throw new Error('expected attempts');
    expect(ws.attempts.map((a) => a.proxy?.url)).toEqual([
      'socks5://socks.openheaders.io:1080',
      'http://corp.openheaders.io:8080',
    ]);
    const grpc = await resolveSessionProxyAttempts(
      { url: 'http://grpc.openheaders.io:50051', capability: 'connect-only' },
      resolverOf(entries),
    );
    if ('errorMessage' in grpc) throw new Error('expected attempts');
    expect(grpc.attempts.map((a) => a.proxy?.url)).toEqual(['http://corp.openheaders.io:8080']);
  });

  it("a SOCKS5-only chain on a 'connect-only' dial fails honestly, naming the proxy and the hatches", async () => {
    const result = await resolveSessionProxyAttempts(
      { url: 'http://grpc.openheaders.io:50051', capability: 'connect-only' },
      resolverOf([{ kind: 'proxy', url: 'socks5://socks.openheaders.io:1080' }]),
    );
    if (!('errorMessage' in result)) throw new Error('expected the honest error');
    expect(result.errorMessage).toContain('socks5://socks.openheaders.io:1080');
    expect(result.errorMessage).toContain('HTTP CONNECT only');
    expect(result.errorMessage).toContain('system-plane proxy to Off');
  });

  it('a SOCKS4-family-only chain fails honestly on every capability', async () => {
    for (const capability of ['socks5-dialable', 'connect-only'] as const) {
      const result = await resolveSessionProxyAttempts(
        wsRequest({ capability }),
        resolverOf([{ kind: 'socks', raw: 'SOCKS legacy.openheaders.io:1080' }]),
      );
      if (!('errorMessage' in result)) throw new Error('expected the honest error');
      expect(result.errorMessage).toContain('SOCKS legacy.openheaders.io:1080');
      expect(result.errorMessage).toContain('SOCKS4');
    }
  });
});

describe('isSessionProxyDialFailure', () => {
  it('marks dial-level codes anywhere on the cause chain, and nothing else', () => {
    expect(isSessionProxyDialFailure(Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }))).toBe(true);
    expect(
      isSessionProxyDialFailure(
        new Error('wrapped', { cause: Object.assign(new Error('dns'), { code: 'ENOTFOUND' }) }),
      ),
    ).toBe(true);
    expect(isSessionProxyDialFailure(Object.assign(new Error('reset'), { code: 'ECONNRESET' }))).toBe(false);
    expect(isSessionProxyDialFailure(new Error('plain'))).toBe(false);
  });
});
