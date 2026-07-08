/**
 * Admission matrix (Phase 3) — pure posture evaluation: route
 * classification on the composed bind, per-route Origin rules
 * (non-browser for /mcp, own-served-origin for pairing, extension
 * origins on the WS upgrade), and the Host DNS-rebinding guard
 * (IP literals / localhost / *.local always known; anything else
 * must be config-declared).
 */

import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import { describe, expect, it } from 'vitest';
import {
  type AdmissionRequestFacts,
  evaluateAdmission,
  isKnownHost,
  routePostureFor,
} from '../../../src/daemon/admission-matrix';

function facts(overrides: Partial<AdmissionRequestFacts> = {}): AdmissionRequestFacts {
  return {
    upgrade: false,
    path: '/',
    origin: undefined,
    host: '192.168.1.20:8137',
    ...overrides,
  };
}

describe('routePostureFor', () => {
  it('classifies the composed routes', () => {
    expect(routePostureFor(facts({ path: '/healthz' })).route).toBe('healthz');
    expect(routePostureFor(facts({ path: '/pair/123456' })).route).toBe('pairing');
    expect(routePostureFor(facts({ path: MCP_HTTP_PATH })).route).toBe('mcp');
    expect(routePostureFor(facts({ path: `${MCP_HTTP_PATH}/` })).route).toBe('mcp');
    expect(routePostureFor(facts({ path: '/anything-else' })).route).toBe('default');
    expect(routePostureFor(facts({ upgrade: true, path: '/' })).route).toBe('ws-upgrade');
  });

  it('web-enabled composition claims unclaimed paths without touching the named routes', () => {
    const webEnabled = { webEnabled: true } as const;
    expect(routePostureFor(facts({ path: '/' }), webEnabled).route).toBe('web');
    expect(routePostureFor(facts({ path: '/assets/index-abc123.js' }), webEnabled).route).toBe('web');
    expect(routePostureFor(facts({ path: '/healthz' }), webEnabled).route).toBe('healthz');
    expect(routePostureFor(facts({ path: '/pair/123456' }), webEnabled).route).toBe('pairing');
    expect(routePostureFor(facts({ path: MCP_HTTP_PATH }), webEnabled).route).toBe('mcp');
    expect(routePostureFor(facts({ upgrade: true, path: '/' }), webEnabled).route).toBe('ws-upgrade');
  });

  it('marks the brute-force routes and their failure statuses', () => {
    expect(routePostureFor(facts({ path: '/healthz' })).rateLimited).toBe(false);
    expect(routePostureFor(facts({ path: '/pair/1' })).failureStatuses).toEqual([404]);
    expect(routePostureFor(facts({ path: MCP_HTTP_PATH })).failureStatuses).toEqual([401]);
    expect(routePostureFor(facts({ upgrade: true })).rateLimited).toBe(true);
  });
});

describe('origin posture', () => {
  it('healthz accepts any Origin', () => {
    const verdict = evaluateAdmission(facts({ path: '/healthz', origin: 'https://evil.example.com' }), []);
    expect(verdict.ok).toBe(true);
  });

  it('mcp rejects every Origin, browser or not', () => {
    const own = evaluateAdmission(facts({ path: MCP_HTTP_PATH, origin: 'http://192.168.1.20:8137' }), []);
    expect(own).toMatchObject({ ok: false, reason: 'origin-forbidden' });
    const none = evaluateAdmission(facts({ path: MCP_HTTP_PATH, origin: undefined }), []);
    expect(none.ok).toBe(true);
  });

  it('pairing accepts no Origin and the own served origin, rejects cross-origin', () => {
    expect(evaluateAdmission(facts({ path: '/pair/123456' }), []).ok).toBe(true);
    expect(evaluateAdmission(facts({ path: '/pair/123456', origin: 'http://192.168.1.20:8137' }), []).ok).toBe(true);
    expect(evaluateAdmission(facts({ path: '/pair/123456', origin: 'https://evil.example.com' }), [])).toMatchObject({
      ok: false,
      reason: 'origin-forbidden',
    });
  });

  it('own-origin comparison elides default ports', () => {
    const viaProxy = facts({ path: '/pair/123456', origin: 'https://oh.openheaders.io', host: 'oh.openheaders.io' });
    expect(evaluateAdmission(viaProxy, ['oh.openheaders.io']).ok).toBe(true);
    const explicitPort = facts({
      path: '/pair/123456',
      origin: 'https://oh.openheaders.io',
      host: 'oh.openheaders.io:443',
    });
    expect(evaluateAdmission(explicitPort, ['oh.openheaders.io']).ok).toBe(true);
  });

  it('ws upgrade accepts extension origins and the own origin, rejects pages and the null origin', () => {
    const base = { upgrade: true, path: '/' } as const;
    expect(evaluateAdmission(facts({ ...base, origin: 'chrome-extension://abcdefgh' }), []).ok).toBe(true);
    expect(evaluateAdmission(facts({ ...base, origin: 'moz-extension://uuid-here' }), []).ok).toBe(true);
    expect(evaluateAdmission(facts({ ...base, origin: 'http://192.168.1.20:8137' }), []).ok).toBe(true);
    expect(evaluateAdmission(facts({ ...base, origin: 'https://evil.example.com' }), [])).toMatchObject({
      ok: false,
      reason: 'origin-forbidden',
    });
    expect(evaluateAdmission(facts({ ...base, origin: 'null' }), [])).toMatchObject({
      ok: false,
      reason: 'origin-forbidden',
    });
  });

  it('web route accepts navigations and the own origin, rejects foreign pages', () => {
    const webEnabled = { webEnabled: true } as const;
    expect(evaluateAdmission(facts({ path: '/' }), [], webEnabled).ok).toBe(true);
    expect(evaluateAdmission(facts({ path: '/', origin: 'http://192.168.1.20:8137' }), [], webEnabled).ok).toBe(true);
    expect(evaluateAdmission(facts({ path: '/', origin: 'https://evil.example.com' }), [], webEnabled)).toMatchObject({
      ok: false,
      reason: 'origin-forbidden',
    });
    // Host guard applies to the front door like every browser-facing route.
    expect(evaluateAdmission(facts({ path: '/', host: 'rebound.example.com' }), [], webEnabled)).toMatchObject({
      ok: false,
      reason: 'host-forbidden',
    });
    expect(
      evaluateAdmission(facts({ path: '/', host: 'oh.openheaders.io' }), ['oh.openheaders.io'], webEnabled).ok,
    ).toBe(true);
  });

  it('default routes reject browser origins', () => {
    expect(evaluateAdmission(facts({ path: '/', origin: 'https://openheaders.io' }), [])).toMatchObject({
      ok: false,
      reason: 'origin-forbidden',
    });
    expect(evaluateAdmission(facts({ path: '/' }), []).ok).toBe(true);
  });
});

describe('host posture', () => {
  it('always knows IP literals, localhost, and mDNS names', () => {
    expect(isKnownHost('127.0.0.1:8137', [])).toBe(true);
    expect(isKnownHost('192.168.1.20:8137', [])).toBe(true);
    expect(isKnownHost('[::1]:8137', [])).toBe(true);
    expect(isKnownHost('localhost:8137', [])).toBe(true);
    expect(isKnownHost('daemon-box.local:8137', [])).toBe(true);
  });

  it('requires other hostnames to be declared', () => {
    expect(isKnownHost('oh.openheaders.io', [])).toBe(false);
    expect(isKnownHost('oh.openheaders.io', ['oh.openheaders.io'])).toBe(true);
    expect(isKnownHost('OH.OPENHEADERS.IO:443', ['oh.openheaders.io'])).toBe(true);
    expect(isKnownHost(undefined, ['oh.openheaders.io'])).toBe(false);
  });

  it('gates the browser-facing routes, not /mcp or /healthz', () => {
    const rebound = { host: 'rebound.example.com' } as const;
    expect(evaluateAdmission(facts({ path: '/pair/123456', ...rebound }), [])).toMatchObject({
      ok: false,
      reason: 'host-forbidden',
    });
    expect(evaluateAdmission(facts({ upgrade: true, path: '/', ...rebound }), [])).toMatchObject({
      ok: false,
      reason: 'host-forbidden',
    });
    expect(evaluateAdmission(facts({ path: MCP_HTTP_PATH, ...rebound }), []).ok).toBe(true);
    expect(evaluateAdmission(facts({ path: '/healthz', ...rebound }), []).ok).toBe(true);
  });
});
