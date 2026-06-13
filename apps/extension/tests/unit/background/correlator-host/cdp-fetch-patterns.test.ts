/**
 * `compileFetchPatterns` — debug-tier rules → CDP `Fetch.enable` URL
 * patterns. Standard-tier rules contribute nothing; a debug-tier rule's
 * url-filter / request-domains conditions become `*`-glob `urlPattern`s; a
 * debug-tier rule with no glob-able URL condition falls back to match-all so
 * it is never silently dropped (the paused-request handler re-checks the
 * full conditions). De-duplicated by `urlPattern`.
 */

import type { Rule, RuleCondition } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';

import { compileFetchPatterns } from '@/background/correlator-host/cdp-fetch-patterns';

const base = {
  schemaVersion: 5 as const,
  uid: 'r1',
  path: 'rules/col-abc1/rule-r1',
  name: 'Test',
  enabled: true,
};

const mockAction = {
  statusCode: 200,
  responseHeaders: {},
  responseBody: '',
  contentType: 'application/json',
  bodyType: 'static' as const,
};

function urlFilter(...values: string[]): RuleCondition {
  return { uid: 'cnd-uf', type: 'url-filter', values };
}
function requestDomains(...values: string[]): RuleCondition {
  return { uid: 'cnd-rd', type: 'request-domains', values };
}
function urlRegex(...values: string[]): RuleCondition {
  return { uid: 'cnd-rx', type: 'url-regex', values };
}
function resourceTypes(...values: string[]): RuleCondition {
  return { uid: 'cnd-rt', type: 'resource-types', values };
}

function mockRule(conditions: RuleCondition[]): Rule {
  return { ...base, type: 'mock', conditions, action: mockAction };
}

describe('compileFetchPatterns', () => {
  it('compiles a debug-tier mock url-filter condition to a CDP urlPattern verbatim', () => {
    expect(compileFetchPatterns([mockRule([urlFilter('*://api.openheaders.io/v1/*')])])).toEqual([
      { urlPattern: '*://api.openheaders.io/v1/*' },
    ]);
  });

  it('normalizes a request-domains condition through formatUrlPattern', () => {
    expect(compileFetchPatterns([mockRule([requestDomains('api.openheaders.io')])])).toEqual([
      { urlPattern: '*://api.openheaders.io/*' },
    ]);
  });

  it('skips standard-tier rules (header / a mock confined to xhr)', () => {
    const header: Rule = {
      ...base,
      type: 'header',
      conditions: [urlFilter('*://openheaders.io/*')],
      action: { requestHeaders: [], responseHeaders: [] },
    };
    const xhrMock = mockRule([urlFilter('*://api.openheaders.io/x'), resourceTypes('xhr')]);
    expect(compileFetchPatterns([header, xhrMock])).toEqual([]);
  });

  it('falls back to match-all for a debug-tier rule with no glob-able URL condition', () => {
    // resource-types only (no url) → debug-tier, but no url-filter pattern.
    expect(compileFetchPatterns([mockRule([resourceTypes('page')])])).toEqual([{ urlPattern: '*' }]);
    // url-regex only → CDP Fetch has no regex equivalent → match-all.
    expect(compileFetchPatterns([mockRule([urlRegex('.*\\.openheaders\\.io/api')])])).toEqual([{ urlPattern: '*' }]);
  });

  it('escapes literal ? and \\ so CDP does not read them as metacharacters', () => {
    expect(compileFetchPatterns([mockRule([urlFilter('*://openheaders.io/search?q=1')])])).toEqual([
      { urlPattern: '*://openheaders.io/search\\?q=1' },
    ]);
  });

  it('de-duplicates identical patterns across rules', () => {
    const a = mockRule([urlFilter('*://api.openheaders.io/v1/*')]);
    const b = mockRule([requestDomains('api.openheaders.io'), urlFilter('*://api.openheaders.io/v1/*')]);
    expect(compileFetchPatterns([a, b])).toEqual([
      { urlPattern: '*://api.openheaders.io/v1/*' },
      { urlPattern: '*://api.openheaders.io/*' },
    ]);
  });

  it('returns no patterns for an empty rule set', () => {
    expect(compileFetchPatterns([])).toEqual([]);
  });
});
