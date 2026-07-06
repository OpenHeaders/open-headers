import { describe, expect, it } from 'vitest';
import type { HeaderRule } from '../../src/types/rule';
import {
  compilePatternToRegexSource,
  compileRuleForInjection,
  doesHostMatchDomains,
  doesInitiatorMatchRule,
  doesMethodMatchRule,
  doesRequestDomainMatchRule,
  doesResourceTypeMatchRule,
  doesResponseHeaderMatchRule,
  doesUrlMatchEntry,
  doesUrlMatchRule,
  formatUrlPattern,
  getRuleMatchPatterns,
  isResponseGatedRule,
} from '../../src/utils/rule-matcher';

// ── formatUrlPattern ─────────────────────────────────────────────

describe('formatUrlPattern', () => {
  it('adds wildcard protocol and path to bare domain', () => {
    expect(formatUrlPattern('openheaders.io')).toBe('*://openheaders.io/*');
  });

  it('preserves explicit protocol', () => {
    expect(formatUrlPattern('https://openheaders.io')).toBe('https://openheaders.io/*');
  });

  it('preserves explicit path when present', () => {
    expect(formatUrlPattern('https://openheaders.io/api')).toBe('https://openheaders.io/api');
  });

  it('handles wildcard subdomain', () => {
    expect(formatUrlPattern('*.openheaders.io')).toBe('*://*.openheaders.io/*');
  });

  it('handles localhost with port', () => {
    expect(formatUrlPattern('localhost:3000')).toBe('*://localhost:3000/*');
  });

  it('passes match-all through unchanged', () => {
    expect(formatUrlPattern('*')).toBe('*');
  });

  it('trims whitespace', () => {
    expect(formatUrlPattern('  openheaders.io  ')).toBe('*://openheaders.io/*');
  });
});

// ── compilePatternToRegexSource ──────────────────────────────────

describe('compilePatternToRegexSource', () => {
  it('returns null for match-all', () => {
    expect(compilePatternToRegexSource('*')).toBeNull();
  });

  it('compiles bare domain to prefix-anchored regex', () => {
    const src = compilePatternToRegexSource('openheaders.io');
    expect(src).toBeTruthy();
    const re = new RegExp(src!, 'i');
    expect(re.test('https://openheaders.io/anything')).toBe(true);
    expect(re.test('http://openheaders.io/')).toBe(true);
    expect(re.test('https://evil.com/openheaders.io')).toBe(false);
  });

  it('compiles wildcard subdomain pattern', () => {
    const src = compilePatternToRegexSource('*.openheaders.io');
    const re = new RegExp(src!, 'i');
    expect(re.test('https://api.openheaders.io/v2')).toBe(true);
    expect(re.test('https://openheaders.io/')).toBe(false);
  });

  it('compiles explicit urlFilter pattern', () => {
    const src = compilePatternToRegexSource('*://openheaders.io/*');
    const re = new RegExp(src!, 'i');
    expect(re.test('https://openheaders.io/manifest.json')).toBe(true);
    expect(re.test('http://openheaders.io/')).toBe(true);
    expect(re.test('https://api.openheaders.io/')).toBe(false);
  });

  it('is case-insensitive via the i flag', () => {
    const src = compilePatternToRegexSource('openheaders.io');
    const re = new RegExp(src!, 'i');
    expect(re.test('HTTPS://OpenHeaders.io/')).toBe(true);
  });
});

// ── getRuleMatchPatterns ─────────────────────────────────────────

const baseRule: Omit<HeaderRule, 'conditions'> = {
  schemaVersion: 5,
  uid: 'x1',
  path: 'rules/col-abc1/rule-x1',
  name: 'T',
  type: 'header',
  enabled: true,
  action: {
    requestHeaders: [{ uid: 'hmd00001', operation: 'override', headerName: 'X', value: 'y' }],
    responseHeaders: [],
  },
};

describe('getRuleMatchPatterns', () => {
  it('normalizes request-domains to urlFilter form', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00001', type: 'request-domains', values: ['openheaders.io'] }],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toEqual([{ pattern: '*://openheaders.io/*', kind: 'url-filter' }]);
  });

  it('takes url-filter patterns as authored', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00002', type: 'url-filter', values: ['*://openheaders.io/*'] }],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toEqual([{ pattern: '*://openheaders.io/*', kind: 'url-filter' }]);
  });

  it('takes url-regex patterns as-authored', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00003', type: 'url-regex', values: ['^https://openheaders\\.io/api/.*$'] }],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toEqual([{ pattern: '^https://openheaders\\.io/api/.*$', kind: 'url-regex' }]);
  });

  it('ignores non-URL condition types', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [
        { uid: 'cnd00004', type: 'request-methods', values: ['GET'] },
        { uid: 'cnd00005', type: 'resource-types', values: ['xmlhttprequest'] },
      ],
    };
    expect(getRuleMatchPatterns(rule)).toEqual([]);
  });

  it('combines patterns from multiple URL condition types', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [
        { uid: 'cnd00006', type: 'request-domains', values: ['openheaders.io'] },
        { uid: 'cnd00007', type: 'url-filter', values: ['*://staging.openheaders.io/*'] },
      ],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toHaveLength(2);
    expect(patterns[0]).toEqual({ pattern: '*://openheaders.io/*', kind: 'url-filter' });
    expect(patterns[1]).toEqual({ pattern: '*://staging.openheaders.io/*', kind: 'url-filter' });
  });

  it('skips empty / whitespace-only values', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00008', type: 'request-domains', values: ['', '   ', 'openheaders.io'] }],
    };
    expect(getRuleMatchPatterns(rule)).toHaveLength(1);
  });
});

// ── doesUrlMatchEntry ────────────────────────────────────────────

describe('doesUrlMatchEntry', () => {
  it('matches url-filter entries via the compiled regex', () => {
    expect(
      doesUrlMatchEntry('https://openheaders.io/api', { pattern: '*://openheaders.io/*', kind: 'url-filter' }),
    ).toBe(true);
    expect(doesUrlMatchEntry('https://evil.com/', { pattern: '*://openheaders.io/*', kind: 'url-filter' })).toBe(false);
  });

  it('matches url-regex entries via native RegExp', () => {
    expect(
      doesUrlMatchEntry('https://openheaders.io/api/v2', {
        pattern: '^https://openheaders\\.io/api/.*$',
        kind: 'url-regex',
      }),
    ).toBe(true);
    expect(
      doesUrlMatchEntry('https://openheaders.io/web', {
        pattern: '^https://openheaders\\.io/api/.*$',
        kind: 'url-regex',
      }),
    ).toBe(false);
  });

  it('returns false for invalid regex rather than throwing', () => {
    expect(doesUrlMatchEntry('https://openheaders.io/', { pattern: '[unclosed', kind: 'url-regex' })).toBe(false);
  });
});

// ── doesUrlMatchRule ─────────────────────────────────────────────

describe('doesUrlMatchRule', () => {
  it('returns true when any pattern matches', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00009', type: 'request-domains', values: ['openheaders.io'] }],
    };
    expect(doesUrlMatchRule('https://openheaders.io/api', rule)).toBe(true);
  });

  it('returns false when no patterns match', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00010', type: 'request-domains', values: ['openheaders.io'] }],
    };
    expect(doesUrlMatchRule('https://evil.com/', rule)).toBe(false);
  });

  it('returns false for rules with no URL conditions (drafts never match)', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00011', type: 'request-methods', values: ['GET'] }],
    };
    expect(doesUrlMatchRule('https://openheaders.io/', rule)).toBe(false);
  });
});

// ── compileRuleForInjection ──────────────────────────────────────

describe('compileRuleForInjection', () => {
  it('returns regex sources that match the authored URL', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00012', type: 'url-filter', values: ['*://openheaders.io/*'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toHaveLength(1);
    const re = new RegExp(sources[0]!, 'i');
    expect(re.test('https://openheaders.io/manifest.json')).toBe(true);
  });

  it('returns empty array for rules without URL conditions (drafts)', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00013', type: 'request-methods', values: ['GET'] }],
    };
    expect(compileRuleForInjection(rule)).toEqual([]);
  });

  it('passes url-regex through as-authored', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00014', type: 'url-regex', values: ['^https://openheaders\\.io/api/.*$'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toEqual(['^https://openheaders\\.io/api/.*$']);
  });

  it('normalizes request-domains through formatUrlPattern before compiling', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00015', type: 'request-domains', values: ['openheaders.io'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toHaveLength(1);
    const re = new RegExp(sources[0]!, 'i');
    expect(re.test('https://openheaders.io/')).toBe(true);
    expect(re.test('https://api.openheaders.io/')).toBe(false);
  });

  it('uses ".*" as the regex source for match-all patterns', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00016', type: 'url-filter', values: ['*'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toEqual(['.*']);
  });

  it('handles the real-world delay-rule case that previously broke', () => {
    // This is the regression test for the bug that drove the refactor:
    // rule stored as url-filter '*://github.com/*' was yielding empty
    // patterns via the old extractPatterns → scripts never matched.
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ uid: 'cnd00017', type: 'url-filter', values: ['*://github.com/*'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toHaveLength(1);
    const re = new RegExp(sources[0]!, 'i');
    expect(re.test('https://github.com/manifest.json')).toBe(true);
    expect(re.test('https://github.com/')).toBe(true);
    expect(re.test('https://api.github.com/')).toBe(false);
  });
});

// ── doesMethodMatchRule ──────────────────────────────────────────

describe('doesMethodMatchRule', () => {
  const withConditions = (conditions: HeaderRule['conditions']): HeaderRule => ({ ...baseRule, conditions });

  it('matches every method when the rule has no method condition', () => {
    const rule = withConditions([{ uid: 'cnd00101', type: 'url-filter', values: ['*://openheaders.io/*'] }]);
    expect(doesMethodMatchRule('GET', rule)).toBe(true);
    expect(doesMethodMatchRule('POST', rule)).toBe(true);
  });

  it('request-methods: only listed methods match, case-insensitively', () => {
    const rule = withConditions([{ uid: 'cnd00102', type: 'request-methods', values: ['POST'] }]);
    expect(doesMethodMatchRule('POST', rule)).toBe(true);
    expect(doesMethodMatchRule('post', rule)).toBe(true);
    expect(doesMethodMatchRule('GET', rule)).toBe(false);
  });

  it('exclude-request-methods: listed methods reject', () => {
    const rule = withConditions([{ uid: 'cnd00103', type: 'exclude-request-methods', values: ['POST'] }]);
    expect(doesMethodMatchRule('GET', rule)).toBe(true);
    expect(doesMethodMatchRule('POST', rule)).toBe(false);
  });

  it('conditions AND together', () => {
    const rule = withConditions([
      { uid: 'cnd00104', type: 'request-methods', values: ['GET', 'POST'] },
      { uid: 'cnd00105', type: 'exclude-request-methods', values: ['POST'] },
    ]);
    expect(doesMethodMatchRule('GET', rule)).toBe(true);
    expect(doesMethodMatchRule('POST', rule)).toBe(false);
    expect(doesMethodMatchRule('PUT', rule)).toBe(false);
  });

  it('an empty or blank method matches (no evidence to gate on)', () => {
    const rule = withConditions([{ uid: 'cnd00106', type: 'request-methods', values: ['POST'] }]);
    expect(doesMethodMatchRule('', rule)).toBe(true);
    expect(doesMethodMatchRule('  ', rule)).toBe(true);
  });
});

// ── doesResourceTypeMatchRule ────────────────────────────────────

describe('doesResourceTypeMatchRule', () => {
  const withConditions = (conditions: HeaderRule['conditions']): HeaderRule => ({ ...baseRule, conditions });

  it('matches every type when the rule has no resource-type condition', () => {
    const rule = withConditions([{ uid: 'cnd00107', type: 'url-filter', values: ['*://openheaders.io/*'] }]);
    expect(doesResourceTypeMatchRule('image', rule)).toBe(true);
    expect(doesResourceTypeMatchRule('xmlhttprequest', rule)).toBe(true);
  });

  it('resource-types: maps model vocab to DNR vocab (xhr → xmlhttprequest)', () => {
    const rule = withConditions([{ uid: 'cnd00108', type: 'resource-types', values: ['xhr'] }]);
    expect(doesResourceTypeMatchRule('xmlhttprequest', rule)).toBe(true);
    expect(doesResourceTypeMatchRule('image', rule)).toBe(false);
  });

  it('resource-types: only listed types match', () => {
    const rule = withConditions([{ uid: 'cnd00109', type: 'resource-types', values: ['image'] }]);
    expect(doesResourceTypeMatchRule('image', rule)).toBe(true);
    expect(doesResourceTypeMatchRule('xmlhttprequest', rule)).toBe(false);
    expect(doesResourceTypeMatchRule('sub_frame', rule)).toBe(false);
  });

  it('exclude-resource-types: listed types reject', () => {
    const rule = withConditions([{ uid: 'cnd00110', type: 'exclude-resource-types', values: ['xhr'] }]);
    expect(doesResourceTypeMatchRule('xmlhttprequest', rule)).toBe(false);
    expect(doesResourceTypeMatchRule('image', rule)).toBe(true);
  });

  it('values already in DNR vocab pass through unmapped', () => {
    const rule = withConditions([{ uid: 'cnd00111', type: 'resource-types', values: ['xmlhttprequest'] }]);
    expect(doesResourceTypeMatchRule('xmlhttprequest', rule)).toBe(true);
  });

  it('model "page" gates on main_frame', () => {
    const rule = withConditions([{ uid: 'cnd00112', type: 'resource-types', values: ['page'] }]);
    expect(doesResourceTypeMatchRule('main_frame', rule)).toBe(true);
    expect(doesResourceTypeMatchRule('sub_frame', rule)).toBe(false);
  });
});

// ── doesRequestDomainMatchRule / doesInitiatorMatchRule ──────────

describe('doesRequestDomainMatchRule', () => {
  const withConditions = (conditions: HeaderRule['conditions']): HeaderRule => ({ ...baseRule, conditions });

  it('matches every URL when the rule has no domain condition', () => {
    const rule = withConditions([{ uid: 'cnd00201', type: 'url-filter', values: ['*://*/api/*'] }]);
    expect(doesRequestDomainMatchRule('https://openheaders.io/api/x', rule)).toBe(true);
  });

  it('request-domains ANDs with the URL filter — a host outside the list rejects', () => {
    const rule = withConditions([
      { uid: 'cnd00202', type: 'url-filter', values: ['*://*/api/*'] },
      { uid: 'cnd00203', type: 'request-domains', values: ['openheaders.io'] },
    ]);
    expect(doesRequestDomainMatchRule('https://openheaders.io/api/x', rule)).toBe(true);
    expect(doesRequestDomainMatchRule('https://app.openheaders.io/api/x', rule)).toBe(true);
    expect(doesRequestDomainMatchRule('https://openheaders.dev/api/x', rule)).toBe(false);
  });

  it('supports wildcard domain values via the urlFilter form', () => {
    const rule = withConditions([{ uid: 'cnd00208', type: 'request-domains', values: ['*.openheaders.io'] }]);
    expect(doesRequestDomainMatchRule('https://api.openheaders.io/v2', rule)).toBe(true);
    expect(doesRequestDomainMatchRule('https://openheaders.dev/v2', rule)).toBe(false);
  });

  it('exclude-request-domains rejects listed hosts', () => {
    const rule = withConditions([{ uid: 'cnd00204', type: 'exclude-request-domains', values: ['openheaders.io'] }]);
    expect(doesRequestDomainMatchRule('https://openheaders.io/x', rule)).toBe(false);
    expect(doesRequestDomainMatchRule('https://openheaders.dev/x', rule)).toBe(true);
  });
});

describe('doesInitiatorMatchRule', () => {
  const withConditions = (conditions: HeaderRule['conditions']): HeaderRule => ({ ...baseRule, conditions });

  it('matches every initiator when the rule has no initiator condition', () => {
    const rule = withConditions([{ uid: 'cnd00205', type: 'url-filter', values: ['*://*/api/*'] }]);
    expect(doesInitiatorMatchRule('openheaders.io', rule)).toBe(true);
  });

  it('initiator-domains: only listed initiators match (subdomains included)', () => {
    const rule = withConditions([{ uid: 'cnd00206', type: 'initiator-domains', values: ['openheaders.io'] }]);
    expect(doesInitiatorMatchRule('openheaders.io', rule)).toBe(true);
    expect(doesInitiatorMatchRule('app.openheaders.io', rule)).toBe(true);
    expect(doesInitiatorMatchRule('openheaders.dev', rule)).toBe(false);
  });

  it('exclude-initiator-domains: listed initiators reject', () => {
    const rule = withConditions([{ uid: 'cnd00207', type: 'exclude-initiator-domains', values: ['openheaders.io'] }]);
    expect(doesInitiatorMatchRule('openheaders.io', rule)).toBe(false);
    expect(doesInitiatorMatchRule('openheaders.dev', rule)).toBe(true);
  });
});

// ── doesHostMatchDomains ─────────────────────────────────────────

describe('doesHostMatchDomains', () => {
  it('matches the domain itself', () => {
    expect(doesHostMatchDomains('openheaders.io', ['openheaders.io'])).toBe(true);
  });

  it('matches subdomains (DNR initiatorDomains semantics)', () => {
    expect(doesHostMatchDomains('app.openheaders.io', ['openheaders.io'])).toBe(true);
    expect(doesHostMatchDomains('deep.app.openheaders.io', ['openheaders.io'])).toBe(true);
  });

  it('does not match suffix overlaps that are not subdomains', () => {
    expect(doesHostMatchDomains('evilopenheaders.io', ['openheaders.io'])).toBe(false);
  });

  it('does not match unrelated hosts', () => {
    expect(doesHostMatchDomains('api.openheaders.dev', ['openheaders.io'])).toBe(false);
  });

  it('is case-insensitive on both sides', () => {
    expect(doesHostMatchDomains('App.OpenHeaders.IO', ['openheaders.io'])).toBe(true);
    expect(doesHostMatchDomains('app.openheaders.io', ['OpenHeaders.IO'])).toBe(true);
  });

  it('matches any entry in the list', () => {
    expect(doesHostMatchDomains('test.openheaders.io', ['openheaders.dev', 'openheaders.io'])).toBe(true);
  });

  it('ignores empty and whitespace-only entries', () => {
    expect(doesHostMatchDomains('openheaders.io', ['', '  '])).toBe(false);
    expect(doesHostMatchDomains('openheaders.io', [' openheaders.io '])).toBe(true);
  });

  it('returns false for an empty domain list', () => {
    expect(doesHostMatchDomains('openheaders.io', [])).toBe(false);
  });
});

// ── isResponseGatedRule / doesResponseHeaderMatchRule ────────────

describe('isResponseGatedRule', () => {
  const withConditions = (conditions: HeaderRule['conditions']): HeaderRule => ({ ...baseRule, conditions });

  it('false without any response-header condition', () => {
    const rule = withConditions([{ uid: 'cnd00301', type: 'url-filter', values: ['*://openheaders.io/*'] }]);
    expect(isResponseGatedRule(rule)).toBe(false);
  });

  it('true for response-header and exclude-response-header rows', () => {
    expect(
      isResponseGatedRule(
        withConditions([{ uid: 'cnd00302', type: 'response-header', headerName: 'X-OH-Echo', values: [] }]),
      ),
    ).toBe(true);
    expect(
      isResponseGatedRule(
        withConditions([{ uid: 'cnd00303', type: 'exclude-response-header', headerName: 'X-OH-Echo', values: [] }]),
      ),
    ).toBe(true);
  });

  it('a row without a header name is unconfigured and does not gate', () => {
    const rule = withConditions([
      { uid: 'cnd00304', type: 'response-header', values: ['true'] },
      { uid: 'cnd00305', type: 'exclude-response-header', headerName: '   ', values: [] },
    ]);
    expect(isResponseGatedRule(rule)).toBe(false);
  });
});

describe('doesResponseHeaderMatchRule', () => {
  const withConditions = (conditions: HeaderRule['conditions']): HeaderRule => ({ ...baseRule, conditions });
  const headers = (...pairs: [string, string][]) => pairs.map(([name, value]) => ({ name, value }));

  it('matches every response when the rule has no response-header condition', () => {
    const rule = withConditions([{ uid: 'cnd00310', type: 'url-filter', values: ['*://openheaders.io/*'] }]);
    expect(doesResponseHeaderMatchRule(headers(['Content-Type', 'text/html']), rule)).toBe(true);
    expect(doesResponseHeaderMatchRule([], rule)).toBe(true);
  });

  it('presence-only row (no values) matches when the header exists', () => {
    const rule = withConditions([{ uid: 'cnd00311', type: 'response-header', headerName: 'X-OH-Echo', values: [] }]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['Content-Type', 'text/html']), rule)).toBe(false);
  });

  it('header names compare case-insensitively', () => {
    const rule = withConditions([{ uid: 'cnd00312', type: 'response-header', headerName: 'x-oh-echo', values: [] }]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(true);
  });

  it('values gate on the full header value, case-insensitively', () => {
    const rule = withConditions([
      { uid: 'cnd00313', type: 'response-header', headerName: 'X-OH-Echo', values: ['TRUE'] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'untrue']), rule)).toBe(false);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'nope']), rule)).toBe(false);
  });

  it('multiple values in one row OR together', () => {
    const rule = withConditions([
      { uid: 'cnd00314', type: 'response-header', headerName: 'X-OH-Echo', values: ['nope', 'true'] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'other']), rule)).toBe(false);
  });

  it('value patterns support * (any run) and ? (at most one character)', () => {
    const star = withConditions([
      { uid: 'cnd00315', type: 'response-header', headerName: 'Cache-Control', values: ['*no-store*'] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['Cache-Control', 'private, no-store']), star)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['Cache-Control', 'public']), star)).toBe(false);
    const q = withConditions([{ uid: 'cnd00316', type: 'response-header', headerName: 'X-OH-Echo', values: ['tru?'] }]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), q)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'tru']), q)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'trues']), q)).toBe(false);
  });

  it('any instance of a repeated header can satisfy the value gate', () => {
    const rule = withConditions([
      { uid: 'cnd00317', type: 'response-header', headerName: 'Set-Cookie', values: ['session=*'] },
    ]);
    const hs = headers(['Set-Cookie', 'theme=dark'], ['Set-Cookie', 'session=abc123']);
    expect(doesResponseHeaderMatchRule(hs, rule)).toBe(true);
  });

  it('multiple response-header rows OR together', () => {
    const rule = withConditions([
      { uid: 'cnd00318', type: 'response-header', headerName: 'X-Absent', values: [] },
      { uid: 'cnd00319', type: 'response-header', headerName: 'X-OH-Echo', values: ['true'] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(true);
  });

  it('exclude-response-header rejects when the header is present', () => {
    const rule = withConditions([
      { uid: 'cnd00320', type: 'exclude-response-header', headerName: 'X-OH-Echo', values: [] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(false);
    expect(doesResponseHeaderMatchRule(headers(['Content-Type', 'text/html']), rule)).toBe(true);
    expect(doesResponseHeaderMatchRule([], rule)).toBe(true);
  });

  it('exclude with values rejects only matching values', () => {
    const rule = withConditions([
      { uid: 'cnd00321', type: 'exclude-response-header', headerName: 'X-OH-Echo', values: ['true'] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(false);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'other']), rule)).toBe(true);
  });

  it('include and exclude AND together — exclude wins on both matching', () => {
    const rule = withConditions([
      { uid: 'cnd00322', type: 'response-header', headerName: 'X-OH-Echo', values: [] },
      { uid: 'cnd00323', type: 'exclude-response-header', headerName: 'Cache-Control', values: ['no-store'] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true']), rule)).toBe(true);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'true'], ['Cache-Control', 'no-store']), rule)).toBe(
      false,
    );
  });

  it('rows without a header name are skipped', () => {
    const rule = withConditions([{ uid: 'cnd00324', type: 'response-header', values: ['true'] }]);
    expect(doesResponseHeaderMatchRule([], rule)).toBe(true);
  });

  it('whitespace-only values collapse to presence-only', () => {
    const rule = withConditions([
      { uid: 'cnd00325', type: 'response-header', headerName: 'X-OH-Echo', values: ['  '] },
    ]);
    expect(doesResponseHeaderMatchRule(headers(['X-OH-Echo', 'anything']), rule)).toBe(true);
  });
});
