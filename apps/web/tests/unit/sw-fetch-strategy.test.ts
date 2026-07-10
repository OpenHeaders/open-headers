/**
 * Service-worker fetch routing (Phase 6 PWA shell) — the law rows: the
 * worker must never answer for a daemon-owned route (a cached /healthz
 * would lie to the login gate's offline probe; the pairing/SSO/MCP/
 * metrics planes are live token-gated surfaces), never touch non-GET or
 * cross-origin traffic, serve navigations network-first, and everything
 * else same-origin cache-first.
 */

import { describe, expect, it } from 'vitest';
import { classifyFetch, isDaemonUnreachableStatus, isReservedDaemonPath } from '../../src/sw/fetch-strategy';

const OWN = 'https://daemon.openheaders.io:8137';

const facts = (url: string, method = 'GET', mode = 'no-cors') => ({ method, url, mode });

describe('isReservedDaemonPath', () => {
  it('reserves every daemon-claimed route', () => {
    expect(isReservedDaemonPath('/healthz')).toBe(true);
    expect(isReservedDaemonPath('/metrics')).toBe(true);
    expect(isReservedDaemonPath('/mcp')).toBe(true);
    expect(isReservedDaemonPath('/mcp/')).toBe(true);
    expect(isReservedDaemonPath('/pair/abc123')).toBe(true);
    expect(isReservedDaemonPath('/auth/oidc/meta')).toBe(true);
    expect(isReservedDaemonPath('/auth/oidc/start')).toBe(true);
  });

  it('leaves the static surface alone', () => {
    expect(isReservedDaemonPath('/')).toBe(false);
    expect(isReservedDaemonPath('/assets/index-abc123.js')).toBe(false);
    expect(isReservedDaemonPath('/manifest.webmanifest')).toBe(false);
    expect(isReservedDaemonPath('/healthz-lookalike')).toBe(false);
  });
});

describe('isDaemonUnreachableStatus', () => {
  it('reads a proxy answering for a dead upstream as unreachable', () => {
    expect(isDaemonUnreachableStatus(502)).toBe(true);
    expect(isDaemonUnreachableStatus(503)).toBe(true);
    expect(isDaemonUnreachableStatus(504)).toBe(true);
  });

  it('passes every live answer through, daemon-served errors included', () => {
    expect(isDaemonUnreachableStatus(200)).toBe(false);
    expect(isDaemonUnreachableStatus(304)).toBe(false);
    expect(isDaemonUnreachableStatus(401)).toBe(false);
    expect(isDaemonUnreachableStatus(404)).toBe(false);
    expect(isDaemonUnreachableStatus(500)).toBe(false);
  });
});

describe('classifyFetch', () => {
  it('bypasses daemon-owned routes so probes fail honestly offline', () => {
    expect(classifyFetch(facts(`${OWN}/healthz`, 'GET', 'cors'), OWN)).toBe('bypass');
    expect(classifyFetch(facts(`${OWN}/auth/oidc/meta`, 'GET', 'cors'), OWN)).toBe('bypass');
    expect(classifyFetch(facts(`${OWN}/metrics`), OWN)).toBe('bypass');
    expect(classifyFetch(facts(`${OWN}/mcp`), OWN)).toBe('bypass');
    expect(classifyFetch(facts(`${OWN}/pair/abc123`, 'GET', 'navigate'), OWN)).toBe('bypass');
  });

  it('bypasses non-GET and cross-origin requests', () => {
    expect(classifyFetch(facts(`${OWN}/auth/oidc/claim`, 'POST'), OWN)).toBe('bypass');
    expect(classifyFetch(facts(`${OWN}/assets/index-abc123.js`, 'HEAD'), OWN)).toBe('bypass');
    expect(classifyFetch(facts('https://api.openheaders.io/data'), OWN)).toBe('bypass');
    expect(classifyFetch(facts('not a url'), OWN)).toBe('bypass');
  });

  it('routes navigations to the shell and same-origin GETs to the cache', () => {
    expect(classifyFetch(facts(`${OWN}/`, 'GET', 'navigate'), OWN)).toBe('shell');
    expect(classifyFetch(facts(`${OWN}/workbench/rules`, 'GET', 'navigate'), OWN)).toBe('shell');
    expect(classifyFetch(facts(`${OWN}/assets/index-abc123.js`, 'GET', 'no-cors'), OWN)).toBe('asset');
    expect(classifyFetch(facts(`${OWN}/js/theme-init.js`, 'GET', 'no-cors'), OWN)).toBe('asset');
    expect(classifyFetch(facts(`${OWN}/assets/monaco-def456.js?import`, 'GET', 'cors'), OWN)).toBe('asset');
  });
});
