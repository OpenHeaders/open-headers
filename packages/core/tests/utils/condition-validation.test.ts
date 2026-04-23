import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '../../src/types/v5';
import { applyDomainValueCleanup, validateDomainValues } from '../../src/utils';

function cond(type: RuleCondition['type'], values: string[]): RuleCondition {
  return { type, values };
}

describe('validateDomainValues', () => {
  it('returns no issues for canonical hostnames', () => {
    expect(
      validateDomainValues(cond('request-domains', ['development.api.openheaders.io', 'localhost', 'portal.corp'])),
    ).toEqual([]);
  });

  it('flags `*.foo.com` as redundant wildcard, suggests stripping the prefix', () => {
    const issues = validateDomainValues(cond('request-domains', ['*.1.development.api.openheaders.io']));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: 'wildcard',
      cleaned: '1.development.api.openheaders.io',
    });
  });

  it('flags `:port` suffix and suggests stripping it', () => {
    const issues = validateDomainValues(cond('request-domains', ['localhost:3000']));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'port', cleaned: 'localhost' });
  });

  it('flags scheme prefix and strips path too', () => {
    const issues = validateDomainValues(cond('request-domains', ['https://api.openheaders.io/v2']));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'scheme', cleaned: 'api.openheaders.io' });
  });

  it('flags uppercase and lowercases the hostname', () => {
    const issues = validateDomainValues(cond('request-domains', ['Foo.COM']));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'uppercase', cleaned: 'foo.com' });
  });

  it('combines scheme + wildcard + port + uppercase into one canonical cleanup', () => {
    const issues = validateDomainValues(cond('request-domains', ['HTTPS://*.Foo.COM:443/admin']));
    expect(issues).toHaveLength(1);
    expect(issues[0].cleaned).toBe('foo.com');
  });

  it('SKIPS values containing template references — resolver expands them later', () => {
    // {{CORP_DOMAIN_LIST}} would otherwise trip the lowercase + non-ASCII
    // checks; the resolver replaces it before the value reaches Chrome.
    expect(validateDomainValues(cond('request-domains', ['{{CORP_DOMAIN_LIST}}']))).toEqual([]);
    expect(validateDomainValues(cond('request-domains', ['prefix-{{X}}-suffix']))).toEqual([]);
  });

  it('returns no issues for non-domain condition types', () => {
    expect(validateDomainValues(cond('url-filter', ['*.foo.com']))).toEqual([]);
    expect(validateDomainValues(cond('request-methods', ['GET']))).toEqual([]);
  });

  it('flags `*.` alone as empty', () => {
    const issues = validateDomainValues(cond('request-domains', ['*.']));
    // `*.` cleans to '' — the wildcard rule fires first; cleanup drops it.
    expect(issues[0]).toMatchObject({ kind: 'wildcard', cleaned: '' });
  });
});

describe('applyDomainValueCleanup', () => {
  it('replaces values in-place and drops empties', () => {
    const c = cond('request-domains', ['*.foo.com', 'good.com', '*.', 'bar.com:8080']);
    const issues = validateDomainValues(c);
    const cleaned = applyDomainValueCleanup(c, issues);
    expect(cleaned.values).toEqual(['foo.com', 'good.com', 'bar.com']);
  });

  it('is a no-op when there are no issues', () => {
    const c = cond('request-domains', ['foo.com']);
    expect(applyDomainValueCleanup(c, [])).toBe(c);
  });

  it('preserves non-issue entries verbatim', () => {
    const c = cond('request-domains', ['good.com', '*.bad.com']);
    const issues = validateDomainValues(c);
    expect(applyDomainValueCleanup(c, issues).values).toEqual(['good.com', 'bad.com']);
  });
});
