import { describe, expect, it } from 'vitest';
import type { HeaderRule } from '../../src/types/v5/rule';
import {
  compilePatternToRegexSource,
  compileRuleForInjection,
  doesUrlMatchEntry,
  doesUrlMatchRule,
  formatUrlPattern,
  getRuleMatchPatterns,
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
  action: { requestHeaders: [{ operation: 'override', headerName: 'X', value: 'y' }], responseHeaders: [] },
};

describe('getRuleMatchPatterns', () => {
  it('normalizes request-domains to urlFilter form', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toEqual([{ pattern: '*://openheaders.io/*', kind: 'url-filter' }]);
  });

  it('takes url-filter patterns as authored', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'url-filter', values: ['*://openheaders.io/*'] }],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toEqual([{ pattern: '*://openheaders.io/*', kind: 'url-filter' }]);
  });

  it('takes url-regex patterns as-authored', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'url-regex', values: ['^https://openheaders\\.io/api/.*$'] }],
    };
    const patterns = getRuleMatchPatterns(rule);
    expect(patterns).toEqual([{ pattern: '^https://openheaders\\.io/api/.*$', kind: 'url-regex' }]);
  });

  it('ignores non-URL condition types', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [
        { type: 'request-methods', values: ['GET'] },
        { type: 'resource-types', values: ['xmlhttprequest'] },
      ],
    };
    expect(getRuleMatchPatterns(rule)).toEqual([]);
  });

  it('combines patterns from multiple URL condition types', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [
        { type: 'request-domains', values: ['openheaders.io'] },
        { type: 'url-filter', values: ['*://staging.openheaders.io/*'] },
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
      conditions: [{ type: 'request-domains', values: ['', '   ', 'openheaders.io'] }],
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
      conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    };
    expect(doesUrlMatchRule('https://openheaders.io/api', rule)).toBe(true);
  });

  it('returns false when no patterns match', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
    };
    expect(doesUrlMatchRule('https://evil.com/', rule)).toBe(false);
  });

  it('returns false for rules with no URL conditions (drafts never match)', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'request-methods', values: ['GET'] }],
    };
    expect(doesUrlMatchRule('https://openheaders.io/', rule)).toBe(false);
  });
});

// ── compileRuleForInjection ──────────────────────────────────────

describe('compileRuleForInjection', () => {
  it('returns regex sources that match the authored URL', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'url-filter', values: ['*://openheaders.io/*'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toHaveLength(1);
    const re = new RegExp(sources[0]!, 'i');
    expect(re.test('https://openheaders.io/manifest.json')).toBe(true);
  });

  it('returns empty array for rules without URL conditions (drafts)', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'request-methods', values: ['GET'] }],
    };
    expect(compileRuleForInjection(rule)).toEqual([]);
  });

  it('passes url-regex through as-authored', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'url-regex', values: ['^https://openheaders\\.io/api/.*$'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toEqual(['^https://openheaders\\.io/api/.*$']);
  });

  it('normalizes request-domains through formatUrlPattern before compiling', () => {
    const rule: HeaderRule = {
      ...baseRule,
      conditions: [{ type: 'request-domains', values: ['openheaders.io'] }],
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
      conditions: [{ type: 'url-filter', values: ['*'] }],
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
      conditions: [{ type: 'url-filter', values: ['*://github.com/*'] }],
    };
    const sources = compileRuleForInjection(rule);
    expect(sources).toHaveLength(1);
    const re = new RegExp(sources[0]!, 'i');
    expect(re.test('https://github.com/manifest.json')).toBe(true);
    expect(re.test('https://github.com/')).toBe(true);
    expect(re.test('https://api.github.com/')).toBe(false);
  });
});
