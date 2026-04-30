/**
 * Pure unit tests for rule-origins: given a V5.Rule, what origins
 * does it cover and when do we fall back to a broad wipe?
 */
import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { extractOriginsFromRules, extractRuleOrigins, originsFromUrlFilter } from '@/background/modules/rule-origins';

function rule(conditions: V5.RuleCondition[]): V5.Rule {
  return {
    uid: 'r1',
    path: 'rules/test',
    name: 'Test',
    type: 'block',
    enabled: true,
    conditions,
    action: {},
  } as V5.Rule;
}

describe('originsFromUrlFilter', () => {
  it('extracts http + https for a wildcard-scheme pattern', () => {
    expect(originsFromUrlFilter('*://api.openheaders.io/*')).toEqual([
      'http://api.openheaders.io',
      'https://api.openheaders.io',
    ]);
  });

  it('extracts only the specified scheme when not wildcarded', () => {
    expect(originsFromUrlFilter('https://api.openheaders.io/*')).toEqual(['https://api.openheaders.io']);
    expect(originsFromUrlFilter('http://api.openheaders.io/*')).toEqual(['http://api.openheaders.io']);
  });

  it('preserves port when present', () => {
    expect(originsFromUrlFilter('https://api.openheaders.io:8443/*')).toEqual(['https://api.openheaders.io:8443']);
  });

  it('flags wildcard host as broad', () => {
    expect(originsFromUrlFilter('*')).toBe('broad');
  });

  it('flags wildcard subdomain as broad', () => {
    expect(originsFromUrlFilter('*://*.openheaders.io/*')).toBe('broad');
  });

  it('flags mid-host wildcard as broad', () => {
    expect(originsFromUrlFilter('*://api-*.openheaders.io/*')).toBe('broad');
  });

  it('flags malformed pattern as broad', () => {
    expect(originsFromUrlFilter('not-a-url')).toBe('broad');
    expect(originsFromUrlFilter('')).toBe('broad');
  });

  it('ignores path / query — origin is scheme + authority only', () => {
    expect(originsFromUrlFilter('*://api.openheaders.io/v1/users?id=42')).toEqual([
      'http://api.openheaders.io',
      'https://api.openheaders.io',
    ]);
  });
});

describe('extractRuleOrigins', () => {
  it('returns empty set for a rule with no URL conditions', () => {
    expect(extractRuleOrigins(rule([]))).toEqual({ origins: [], broad: false });
  });

  it('extracts from request-domains (normalized via formatUrlPattern)', () => {
    const r = rule([{ uid: 'tcd00043', type: 'request-domains', values: ['api.openheaders.io'] }]);
    const result = extractRuleOrigins(r);
    expect(result.broad).toBe(false);
    expect(new Set(result.origins)).toEqual(new Set(['http://api.openheaders.io', 'https://api.openheaders.io']));
  });

  it('dedupes origins across multiple conditions', () => {
    const r = rule([
      { uid: 'tcd00044', type: 'request-domains', values: ['api.openheaders.io'] },
      { uid: 'tcd00045', type: 'url-filter', values: ['*://api.openheaders.io/v1/*'] },
    ]);
    const result = extractRuleOrigins(r);
    expect(result.origins).toHaveLength(2);
    expect(new Set(result.origins)).toEqual(new Set(['http://api.openheaders.io', 'https://api.openheaders.io']));
  });

  it('sets broad when any single pattern is broad', () => {
    const r = rule([
      { uid: 'tcd00046', type: 'request-domains', values: ['api.openheaders.io'] },
      { uid: 'tcd00047', type: 'url-filter', values: ['*://*.demo.openheaders.io/*'] },
    ]);
    const result = extractRuleOrigins(r);
    expect(result.broad).toBe(true);
    // Concrete origins still collected from the non-broad pattern.
    expect(new Set(result.origins)).toEqual(new Set(['http://api.openheaders.io', 'https://api.openheaders.io']));
  });

  it('tries url-regex with a trivial literal host prefix', () => {
    const r = rule([{ uid: 'tcd00048', type: 'url-regex', values: ['^https://api\\.openheaders\\.io/v1/'] }]);
    const result = extractRuleOrigins(r);
    expect(result.broad).toBe(false);
    expect(result.origins).toEqual(['https://api.openheaders.io']);
  });

  it('marks complex url-regex as broad', () => {
    const r = rule([{ uid: 'tcd00049', type: 'url-regex', values: ['^https?://(api|cdn)\\.openheaders\\.io/'] }]);
    const result = extractRuleOrigins(r);
    expect(result.broad).toBe(true);
  });
});

describe('extractOriginsFromRules', () => {
  it('folds origins across multiple rules, dedupes', () => {
    const rules = [
      rule([{ uid: 'tcd00050', type: 'request-domains', values: ['api.openheaders.io'] }]),
      rule([{ uid: 'tcd00051', type: 'request-domains', values: ['cdn.openheaders.io'] }]),
      rule([{ uid: 'tcd00052', type: 'request-domains', values: ['api.openheaders.io'] }]), // duplicate
    ];
    const result = extractOriginsFromRules(rules);
    expect(result.broad).toBe(false);
    expect(new Set(result.origins)).toEqual(
      new Set([
        'http://api.openheaders.io',
        'https://api.openheaders.io',
        'http://cdn.openheaders.io',
        'https://cdn.openheaders.io',
      ]),
    );
  });

  it('one broad rule promotes the whole batch to broad', () => {
    const rules = [
      rule([{ uid: 'tcd00053', type: 'request-domains', values: ['api.openheaders.io'] }]),
      rule([{ uid: 'tcd00054', type: 'url-filter', values: ['*'] }]),
    ];
    const result = extractOriginsFromRules(rules);
    expect(result.broad).toBe(true);
  });
});
