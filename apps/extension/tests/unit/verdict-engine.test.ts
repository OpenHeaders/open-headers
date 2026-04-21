/**
 * Tests for the pure verdict engine — no rule-store or tab-telemetry
 * dependencies. Feeds the engine crafted inputs and asserts the
 * categorical verdict + reason string it renders.
 */

import type { V5 } from '@openheaders/core/types';
import { getRuleMatchPatterns } from '@openheaders/core/utils';
import { describe, expect, it } from 'vitest';
import { computeVerdict, registrableDomainOf } from '@/shared/verdict';
import type { ObservationSource, TrackedResource } from '@/types/browser';

function hostConditions(domains: string[]): V5.RuleCondition[] {
  return domains.length > 0 ? [{ type: 'request-domains', values: domains }] : [];
}

function makeRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    schemaVersion: 5,
    version: 1,
    uid: `rule-${Math.random().toString(36).slice(2, 6)}`,
    path: 'workbench/test',
    name: 'Test Rule',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io']),
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'v' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function resource(overrides: {
  sources: ObservationSource[];
  servedFromCache?: boolean;
  resourceType?: TrackedResource['resourceType'];
}): TrackedResource {
  const now = Date.now();
  return {
    firstSeenTs: now,
    lastSeenTs: now,
    timestamp: now,
    resourceType: overrides.resourceType ?? 'xmlhttprequest',
    sources: new Set<ObservationSource>(overrides.sources),
    servedFromCache: overrides.servedFromCache,
  };
}

// Identity normalizer for tests — the engine's pluggable hook. The
// production code wires `normalizeUrlForTracking`; the engine logic
// doesn't care what normalization does, only that it's applied
// consistently, which identity guarantees trivially.
const identityNormalize = (u: string) => u;

function callEngine(rule: V5.Rule, tabUrl: string, tracked: Map<string, TrackedResource>, firing = false) {
  return computeVerdict({
    rule,
    patterns: getRuleMatchPatterns(rule),
    normalizedTabUrl: tabUrl,
    trackedResources: tracked,
    firing,
    normalizeUrl: identityNormalize,
  });
}

describe('computeVerdict', () => {
  it('returns firing when the fire flag is set, regardless of other inputs', () => {
    const rule = makeRule();
    const result = callEngine(rule, 'https://openheaders.io/', new Map(), true);
    expect(result?.verdict).toBe('firing');
    expect(result?.reason).toContain('fired');
  });

  it('returns silent when a tracked URL matches the pattern and was served from cache', () => {
    const rule = makeRule({ conditions: hostConditions(['*.cdn.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      [
        'https://assets.cdn.openheaders.io/bundle.js',
        resource({ sources: ['webRequest', 'perfObserver'], servedFromCache: true }),
      ],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked);
    expect(result?.verdict).toBe('silent');
    expect(result?.reason).toMatch(/cach/i);
  });

  it('returns silent when the only source is perfObserver (webRequest missed it)', () => {
    const rule = makeRule({ conditions: hostConditions(['*.cdn.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://assets.cdn.openheaders.io/bundle.js', resource({ sources: ['perfObserver'], servedFromCache: false })],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked);
    expect(result?.verdict).toBe('silent');
    expect(result?.reason).toMatch(/Resource Timing/);
  });

  it('returns page when the pattern matches the tab URL with no subresource observations', () => {
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const result = callEngine(rule, 'https://app.openheaders.io/', new Map());
    expect(result?.verdict).toBe('page');
  });

  it('returns page when a non-cached webRequest subresource match exists', () => {
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://api.openheaders.io/v2', resource({ sources: ['webRequest'] })],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked);
    expect(result?.verdict).toBe('page');
  });

  it('returns related when only the registrable domain matches', () => {
    const rule = makeRule({ conditions: hostConditions(['api.openheaders.io']) });
    const result = callEngine(rule, 'https://www.openheaders.io/', new Map());
    expect(result?.verdict).toBe('related');
    expect(result?.reason).toContain('openheaders.io');
  });

  it('returns null when no signal exists', () => {
    const rule = makeRule({ conditions: hostConditions(['example.com']) });
    const result = callEngine(rule, 'https://openheaders.io/', new Map());
    expect(result).toBeNull();
  });

  it('prefers silent over page when both signals exist', () => {
    // The same pattern matches the tab URL AND a cached subresource.
    // Silent is the stronger (more specific) signal.
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://api.openheaders.io/data', resource({ sources: ['perfObserver'], servedFromCache: true })],
    ]);
    const result = callEngine(rule, 'https://app.openheaders.io/', tracked);
    expect(result?.verdict).toBe('silent');
  });

  it('prefers firing over silent when the fire flag is set and a silent match exists', () => {
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://api.openheaders.io/data', resource({ sources: ['perfObserver'], servedFromCache: true })],
    ]);
    const result = callEngine(rule, 'https://app.openheaders.io/', tracked, true);
    expect(result?.verdict).toBe('firing');
  });

  it('returns all matching silent records in silentRecords, not just the first', () => {
    const rule = makeRule({ conditions: hostConditions(['*.cdn.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://a.cdn.openheaders.io/x.js', resource({ sources: ['perfObserver'], servedFromCache: true })],
      ['https://b.cdn.openheaders.io/y.js', resource({ sources: ['perfObserver'], servedFromCache: true })],
      ['https://unrelated.com/z.js', resource({ sources: ['webRequest'], servedFromCache: false })],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked);
    expect(result?.verdict).toBe('silent');
    expect(result?.silentRecords.length).toBe(2);
    expect(new Set(result?.silentRecords.map((r) => r.url))).toEqual(
      new Set(['https://a.cdn.openheaders.io/x.js', 'https://b.cdn.openheaders.io/y.js']),
    );
  });

  it('includes silent records even when the rule is firing', () => {
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://cdn.openheaders.io/cached.js', resource({ sources: ['perfObserver'], servedFromCache: true })],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked, true);
    expect(result?.verdict).toBe('firing');
    expect(result?.silentRecords).toHaveLength(1);
    expect(result?.silentRecords[0]?.servedFromCache).toBe(true);
  });

  it('returns an empty silentRecords array when nothing is cached', () => {
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      ['https://api.openheaders.io/data', resource({ sources: ['webRequest'] })],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked);
    expect(result?.silentRecords).toEqual([]);
  });

  it('marks perfOnly correctly on silent records', () => {
    const rule = makeRule({ conditions: hostConditions(['*.openheaders.io']) });
    const tracked = new Map<string, TrackedResource>([
      // Both perf-only AND cached
      ['https://a.openheaders.io/', resource({ sources: ['perfObserver'], servedFromCache: true })],
      // Perf-only, not flagged as cache (SW-intercept or bfcache)
      ['https://b.openheaders.io/', resource({ sources: ['perfObserver'], servedFromCache: false })],
    ]);
    const result = callEngine(rule, 'https://openheaders.io/', tracked);
    expect(result?.silentRecords).toHaveLength(2);
    for (const r of result!.silentRecords) {
      expect(r.perfOnly).toBe(true);
    }
  });
});

describe('registrableDomainOf', () => {
  it('returns the last two labels for common TLDs', () => {
    expect(registrableDomainOf('https://api.openheaders.io/')).toBe('openheaders.io');
    expect(registrableDomainOf('https://cdn.www.openheaders.io/')).toBe('openheaders.io');
  });

  it('returns the hostname unchanged for two-label hosts', () => {
    expect(registrableDomainOf('https://openheaders.io/')).toBe('openheaders.io');
  });

  it('returns null for malformed URLs', () => {
    expect(registrableDomainOf('not a url')).toBeNull();
  });

  it('handles compound TLDs imperfectly — documented tradeoff', () => {
    // We know this is wrong for .co.uk; documenting the behavior so
    // a future PSL upgrade deliberately flips this test.
    expect(registrableDomainOf('https://api.example.co.uk/')).toBe('co.uk');
  });
});
