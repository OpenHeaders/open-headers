/**
 * The shared dial policy → wire — the pinned `lookup` seat every node
 * dial spreads (HTTP dispatcher, WebSocket connector, gRPC session,
 * MQTT socket) and the failure prose a proxied or pinned session dial
 * classifies with, naming the plane that sent it there.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyPinnedDialFailure,
  classifyProxyLegFailure,
  pinnedLookup,
  pinnedLookupOptionsFor,
} from '../../src/live/dial-policy';
import { PROXY_CONNECT_REJECTED_CODE } from '../../src/live/request-transport/connect-tunnel';
import type { SessionProxyAttempt } from '../../src/live/system-proxy/session-route';

const coded = (code: string): Error => Object.assign(new Error(code), { code });
const rejected = (status: number): Error =>
  Object.assign(new Error('rejected'), { code: PROXY_CONNECT_REJECTED_CODE, proxyStatus: status });

const requestAttempt: SessionProxyAttempt = {
  proxy: { url: 'http://corp.openheaders.io:8080', credential: 'u:p' },
  route: { plane: 'request', proxyUrl: 'http://corp.openheaders.io:8080' },
};
const systemAttempt: SessionProxyAttempt = {
  proxy: { url: 'http://corp.openheaders.io:8080' },
  route: { plane: 'system', proxyUrl: 'http://corp.openheaders.io:8080', source: 'system' },
  environmentChain: true,
};

describe('pinnedLookup', () => {
  it('answers every hostname with the pin in both callback shapes', () => {
    const lookup = pinnedLookup('10.0.0.12');
    const single: unknown[] = [];
    lookup('api.openheaders.io', { all: false }, (...args: unknown[]) => single.push(args));
    expect(single).toEqual([[null, '10.0.0.12', 4]]);
    const all: unknown[] = [];
    lookup('api.openheaders.io', { all: true }, (...args: unknown[]) => all.push(args));
    expect(all).toEqual([[null, [{ address: '10.0.0.12', family: 4 }]]]);
    const six: unknown[] = [];
    pinnedLookup('2001:db8::1')('api.openheaders.io', { all: false }, (...args: unknown[]) => six.push(args));
    expect(six).toEqual([[null, '2001:db8::1', 6]]);
  });

  it('maps a pin to the lookup seat and nothing else to an empty bag', () => {
    expect(pinnedLookupOptionsFor({})).toEqual({});
    expect(typeof pinnedLookupOptionsFor({ resolveToAddress: '10.0.0.12' }).lookup).toBe('function');
  });
});

describe('classifyProxyLegFailure', () => {
  it('is silent for a direct attempt and for failures past the tunnel', () => {
    expect(classifyProxyLegFailure('ws.openheaders.io', coded('ECONNREFUSED'), undefined, 'session')).toBeUndefined();
    expect(classifyProxyLegFailure('ws.openheaders.io', coded('ECONNREFUSED'), {}, 'session')).toBeUndefined();
    expect(
      classifyProxyLegFailure('ws.openheaders.io', coded('ECONNRESET'), requestAttempt, 'session'),
    ).toBeUndefined();
  });

  it("names the request's proxy setting on the request plane and the machine's configuration on the system plane", () => {
    expect(classifyProxyLegFailure('ws.openheaders.io', coded('ECONNREFUSED'), requestAttempt, 'session')).toBe(
      "Connection refused by the proxy at corp.openheaders.io:8080 — the request's proxy setting routes this session through it. Is the proxy running?",
    );
    expect(classifyProxyLegFailure('grpc.openheaders.io', coded('ETIMEDOUT'), systemAttempt, 'call')).toBe(
      "Connection to the proxy at corp.openheaders.io:8080 timed out — this machine's proxy configuration routes this call through it.",
    );
  });

  it('a 407 names the proxy-credentials setting (and the vault entry) on the request plane, the app settings on the system plane', () => {
    expect(
      classifyProxyLegFailure('ws.openheaders.io', rejected(407), requestAttempt, 'session', 'corp-proxy'),
    ).toContain('the vault entry "corp-proxy" may hold the wrong user:password');
    expect(classifyProxyLegFailure('ws.openheaders.io', rejected(407), requestAttempt, 'session')).toContain(
      "Set the request's proxy-credentials setting",
    );
    expect(classifyProxyLegFailure('ws.openheaders.io', rejected(407), systemAttempt, 'session')).toContain(
      "system plane's proxy credentials",
    );
    expect(classifyProxyLegFailure('ws.openheaders.io', rejected(502), systemAttempt, 'session')).toContain(
      'could not open a tunnel to ws.openheaders.io (HTTP 502)',
    );
  });
});

describe('classifyPinnedDialFailure', () => {
  it('names the resolve-to-address setting for dial-level codes, nothing without a pin or for other codes', () => {
    expect(classifyPinnedDialFailure('ws.openheaders.io', undefined, coded('ECONNREFUSED'))).toBeUndefined();
    expect(classifyPinnedDialFailure('ws.openheaders.io', '10.0.0.12', coded('ECONNRESET'))).toBeUndefined();
    expect(classifyPinnedDialFailure('ws.openheaders.io', '10.0.0.12', coded('ECONNREFUSED'))).toBe(
      "Connection refused at 10.0.0.12 — the request's resolve-to-address setting points ws.openheaders.io there. Is the service listening on that address and the URL's port?",
    );
    expect(classifyPinnedDialFailure('ws.openheaders.io', '10.0.0.12', coded('EHOSTUNREACH'))).toContain(
      'No route to 10.0.0.12 (EHOSTUNREACH)',
    );
    expect(classifyPinnedDialFailure('ws.openheaders.io', '10.0.0.12', coded('ETIMEDOUT'))).toContain(
      'points it at 10.0.0.12',
    );
  });
});
