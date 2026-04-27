import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '../../src/types/v5';
import {
  applyDomainValueCleanup,
  validateConditionStructure,
  validateConditionValues,
  validateDomainValues,
} from '../../src/utils';

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

describe('validateConditionStructure', () => {
  it('returns no issues for an empty list', () => {
    expect(validateConditionStructure([])).toEqual([]);
  });

  it('returns no issues for a single supported plural row', () => {
    expect(validateConditionStructure([cond('request-domains', ['openheaders.io'])])).toEqual([]);
  });

  it('returns no issues for one singleton of each different mutex group', () => {
    expect(
      validateConditionStructure([cond('url-filter', ['*://openheaders.io/*']), cond('domain-type', ['firstParty'])]),
    ).toEqual([]);
  });

  it('flags duplicate singletons of the same type — earlier row loses, last wins', () => {
    const issues = validateConditionStructure([
      cond('url-filter', ['*://openheaders.io/*']),
      cond('url-filter', ['*://api.openheaders.io/*']),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      index: 0,
      winningIndex: 1,
      kind: 'duplicate-singleton',
      mutexKey: 'url-pattern',
    });
  });

  it('flags every loser when three rows of the same singleton stack up', () => {
    const issues = validateConditionStructure([
      cond('url-filter', ['*://a.com/*']),
      cond('url-filter', ['*://b.com/*']),
      cond('url-filter', ['*://c.com/*']),
    ]);
    expect(issues.map((i) => i.index)).toEqual([0, 1]);
    expect(issues.every((i) => i.winningIndex === 2)).toBe(true);
    expect(issues.every((i) => i.kind === 'duplicate-singleton')).toBe(true);
  });

  it('flags mutex collisions across types in the same group (url-filter + url-regex)', () => {
    const issues = validateConditionStructure([
      cond('url-filter', ['*://openheaders.io/*']),
      cond('url-regex', ['^https?://openheaders\\.io/.*']),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      index: 0,
      winningIndex: 1,
      kind: 'mutex-conflict',
      mutexKey: 'url-pattern',
    });
  });

  it('flags duplicate domain-type rows (different mutex group from url-pattern)', () => {
    const issues = validateConditionStructure([
      cond('domain-type', ['firstParty']),
      cond('domain-type', ['thirdParty']),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ index: 0, winningIndex: 1, kind: 'duplicate-singleton' });
  });

  it('does not flag plural duplicates — multiple request-domains rows are valid', () => {
    expect(
      validateConditionStructure([
        cond('request-domains', ['openheaders.io']),
        cond('request-domains', ['api.openheaders.io']),
      ]),
    ).toEqual([]);
  });

  it('does not flag empty singleton rows as overwriting — they do not claim the slot', () => {
    // User mid-edit: typed a real url-filter, then added a second row that
    // hasn't been filled in yet. The empty row must NOT be reported as
    // the winner — that would falsely flag the real row as overwritten.
    expect(validateConditionStructure([cond('url-filter', ['*://openheaders.io/*']), cond('url-filter', [])])).toEqual(
      [],
    );
  });

  it('does not flag empty mutex-collision rows', () => {
    expect(validateConditionStructure([cond('url-filter', ['*://openheaders.io/*']), cond('url-regex', [''])])).toEqual(
      [],
    );
  });

  it('treats whitespace-only values as empty', () => {
    expect(
      validateConditionStructure([cond('url-filter', ['*://openheaders.io/*']), cond('url-filter', ['   ', '\t'])]),
    ).toEqual([]);
  });
});

describe('validateConditionValues', () => {
  // ── url-filter ────────────────────────────────────────────────
  describe('url-filter', () => {
    it('accepts a canonical pattern', () => {
      expect(validateConditionValues(cond('url-filter', ['*://api.openheaders.io/*']))).toEqual([]);
    });

    it('flags an empty value as error', () => {
      const issues = validateConditionValues(cond('url-filter', ['']));
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ kind: 'empty', severity: 'error' });
    });

    it('flags whitespace inside the pattern', () => {
      const issues = validateConditionValues(cond('url-filter', ['*://api openheaders io/*']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-url-filter', severity: 'error' });
      expect(issues[0].message.toLowerCase()).toContain('whitespace');
    });

    it('flags non-ASCII characters and suggests punycode', () => {
      const issues = validateConditionValues(cond('url-filter', ['*://éxample.com/*']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-url-filter', severity: 'error' });
      expect(issues[0].message).toContain('punycode');
    });

    it('warns when the pattern looks like a regex', () => {
      const issues = validateConditionValues(cond('url-filter', ['^https://(api|cdn)\\.openheaders\\.io/.*']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-url-filter', severity: 'warning' });
      expect(issues[0].message).toContain('URL Regex');
    });

    it('does not lex template references', () => {
      expect(validateConditionValues(cond('url-filter', ['{{API_HOST}}']))).toEqual([]);
    });
  });

  // ── url-regex ─────────────────────────────────────────────────
  describe('url-regex', () => {
    it('accepts a valid regex', () => {
      expect(validateConditionValues(cond('url-regex', ['^https?://openheaders\\.io/.*']))).toEqual([]);
    });

    it('flags an unparseable regex', () => {
      const issues = validateConditionValues(cond('url-regex', ['^https://[unclosed']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-url-regex', severity: 'error' });
    });

    it('flags an empty regex', () => {
      const issues = validateConditionValues(cond('url-regex', ['']));
      expect(issues[0]).toMatchObject({ kind: 'empty', severity: 'error' });
    });

    it('warns about lookbehind assertions (RE2 unsupported)', () => {
      const issues = validateConditionValues(cond('url-regex', ['(?<=foo)bar']));
      expect(issues[0]).toMatchObject({ kind: 'unsupported-regex-feature', severity: 'warning' });
      expect(issues[0].message).toContain('lookbehind');
    });

    it('warns about Python-style named groups (RE2 unsupported)', () => {
      const issues = validateConditionValues(cond('url-regex', ['(?P<name>foo)']));
      expect(issues[0]).toMatchObject({ kind: 'unsupported-regex-feature', severity: 'warning' });
    });

    it('skips templates', () => {
      expect(validateConditionValues(cond('url-regex', ['{{REGEX}}']))).toEqual([]);
    });
  });

  // ── methods ───────────────────────────────────────────────────
  describe('request-methods / exclude-request-methods', () => {
    it('accepts canonical methods regardless of case', () => {
      expect(validateConditionValues(cond('request-methods', ['GET', 'post', 'PaTcH']))).toEqual([]);
    });

    it('flags unknown methods', () => {
      const issues = validateConditionValues(cond('request-methods', ['BREW']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-method', severity: 'error' });
    });

    it('skips empties and templates', () => {
      expect(validateConditionValues(cond('exclude-request-methods', ['', '{{METHODS}}']))).toEqual([]);
    });
  });

  // ── resource types ────────────────────────────────────────────
  describe('resource-types / exclude-resource-types', () => {
    it('accepts our display-name set', () => {
      expect(validateConditionValues(cond('resource-types', ['xhr', 'image', 'page']))).toEqual([]);
    });

    it('accepts Chrome canonical names too (for imports)', () => {
      expect(validateConditionValues(cond('resource-types', ['main_frame', 'xmlhttprequest']))).toEqual([]);
    });

    it('flags unknown resource types', () => {
      const issues = validateConditionValues(cond('exclude-resource-types', ['turbomodule']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-resource-type', severity: 'error' });
    });
  });

  // ── domain-type ───────────────────────────────────────────────
  describe('domain-type', () => {
    it('accepts firstParty / thirdParty', () => {
      expect(validateConditionValues(cond('domain-type', ['firstParty']))).toEqual([]);
      expect(validateConditionValues(cond('domain-type', ['thirdParty']))).toEqual([]);
    });

    it('flags any other value', () => {
      const issues = validateConditionValues(cond('domain-type', ['somethirdparty']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-domain-type', severity: 'error' });
    });
  });

  // ── response-header conditions ────────────────────────────────
  describe('response-header / exclude-response-header', () => {
    function headerCond(headerName: string, values: string[]): RuleCondition {
      return { type: 'response-header', values, headerName };
    }

    it('passes for a valid header name + any values', () => {
      expect(validateConditionValues(headerCond('Content-Type', ['application/json']))).toEqual([]);
    });

    it('passes for a valid header name with no values (means "any value matches")', () => {
      expect(validateConditionValues(headerCond('X-Custom', []))).toEqual([]);
    });

    it('flags a missing header name', () => {
      const issues = validateConditionValues(headerCond('', ['application/json']));
      expect(issues[0]).toMatchObject({ kind: 'header-name-required', severity: 'error', valueIndex: -1 });
    });

    it('flags an invalid header name (RFC 7230 token violation)', () => {
      const issues = validateConditionValues(headerCond('Bad Header Name', ['v']));
      expect(issues[0]).toMatchObject({ kind: 'invalid-header-name', severity: 'error', valueIndex: -1 });
    });

    it('skips template-laced header names', () => {
      expect(validateConditionValues(headerCond('{{HEADER_NAME}}', ['v']))).toEqual([]);
    });
  });

  // ── domain-list types delegate to validateDomainValues ────────
  describe('domain-list types', () => {
    it('returns no value-validation issues — uses the dedicated validator', () => {
      // Bad domain values should NOT show up here. They surface via
      // `validateDomainValues` and the auto-cleanup banner instead.
      expect(validateConditionValues(cond('request-domains', ['*.foo.com', 'OK.com']))).toEqual([]);
    });
  });
});
