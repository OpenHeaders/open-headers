/**
 * PAC-generation laws (the observability plan §5.1, Chromium leg). The
 * generated script must agree with `hostInScope` on every host — exact
 * apex-only, `*.`-wildcard-never-apex, IP-literal exact — route scoped
 * hosts with a DIRECT failover, and keep hostile patterns inert inside
 * their string literals.
 */

import { describe, expect, it } from 'vitest';
import { buildScopePac } from '../../src/proxy/pac';
import { hostInScope } from '../../src/proxy/scope';

const PORT = 8139;

/** Evaluate the generated PAC's FindProxyForURL for one host. */
function evaluatePac(pac: string, host: string): string {
  const run = new Function(`${pac}\nreturn FindProxyForURL;`)() as (url: string, host: string) => string;
  return run(`https://${host}/`, host);
}

function routes(patterns: string[], host: string): boolean {
  return evaluatePac(buildScopePac(patterns, PORT), host).startsWith('PROXY');
}

describe('proxy pac — buildScopePac', () => {
  it('agrees with hostInScope across the pattern grammar', () => {
    const patterns = ['openheaders.io', '*.staging.openheaders.io', '10.0.0.5', '', '*', 'API.openheaders.io'];
    const hosts = [
      'openheaders.io',
      'api.openheaders.io',
      'staging.openheaders.io',
      'a.staging.openheaders.io',
      'a.b.staging.openheaders.io',
      'evilopenheaders.io',
      '10.0.0.5',
      '10.0.0.6',
      'example.com',
    ];
    for (const host of hosts) {
      expect(routes(patterns, host), host).toBe(hostInScope(host, patterns));
    }
  });

  it('routes scoped hosts at the capture port with a DIRECT failover', () => {
    const verdict = evaluatePac(buildScopePac(['openheaders.io'], PORT), 'openheaders.io');
    expect(verdict).toBe(`PROXY 127.0.0.1:${PORT}; DIRECT`);
  });

  it('answers DIRECT for everything on an empty or all-invalid list', () => {
    expect(evaluatePac(buildScopePac([], PORT), 'openheaders.io')).toBe('DIRECT');
    expect(evaluatePac(buildScopePac(['', '*'], PORT), 'openheaders.io')).toBe('DIRECT');
  });

  it('lowercases the host and strips IPv6 brackets like the matcher', () => {
    expect(routes(['api.openheaders.io'], 'API.OpenHeaders.IO')).toBe(true);
    expect(routes(['::1'], '[::1]')).toBe(true);
  });

  it('never routes the apex for a wildcard, matching the SAN convention', () => {
    expect(routes(['*.openheaders.io'], 'openheaders.io')).toBe(false);
    expect(routes(['*.openheaders.io'], 'api.openheaders.io')).toBe(true);
  });

  it('keeps prototype-chain host names inert', () => {
    expect(routes(['openheaders.io'], '__proto__')).toBe(false);
    expect(routes(['openheaders.io'], 'constructor')).toBe(false);
  });

  it('embeds hostile pattern strings as inert literals', () => {
    const pac = buildScopePac(['"};fetch("https://openheaders.io");//'], PORT);
    // The generated script still parses and answers DIRECT — the
    // pattern never escapes its string literal.
    expect(evaluatePac(pac, 'example.com')).toBe('DIRECT');
  });
});
