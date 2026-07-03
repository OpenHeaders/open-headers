/**
 * Quick-create heuristic rule names — `smart-rule-name`.
 *
 * The popover pre-fills the rule name from what the rule does and where
 * (kind + captured URL + header/operation/response mode), so the
 * sidebar reads meaningfully later. Pin the per-kind formulas, that the
 * FULL path stays in the value (display layers ellipsize; the name is
 * never mutilated), the fallback to the old static bases on unparseable
 * URLs, and the `(2)` dedupe against existing names.
 */

import { generateSmartRuleName } from '@openheaders/ui/panel/data/smart-rule-name';
import { describe, expect, it } from 'vitest';

const URL = 'https://api.openheaders.io/v1/users?page=2';

describe('generateSmartRuleName — per-kind formulas', () => {
  it('names URL-action rules from host + path', () => {
    expect(generateSmartRuleName({ kind: 'redirect', url: URL }, [])).toBe('Redirect api.openheaders.io/v1/users');
    expect(generateSmartRuleName({ kind: 'replace-host', url: URL }, [])).toBe('Replace host · api.openheaders.io');
    expect(generateSmartRuleName({ kind: 'delay', url: URL }, [])).toBe('Delay api.openheaders.io/v1/users');
    expect(generateSmartRuleName({ kind: 'block', url: URL }, [])).toBe('Block api.openheaders.io/v1/users');
  });

  it('drops a bare "/" path', () => {
    expect(generateSmartRuleName({ kind: 'delay', url: 'https://openheaders.io/' }, [])).toBe('Delay openheaders.io');
  });

  it('names header rules from the seeded operation + header + host', () => {
    expect(
      generateSmartRuleName(
        { kind: 'header', url: URL, headerName: 'Cache-Control', headerOperation: 'override' },
        [],
      ),
    ).toBe('Set Cache-Control · api.openheaders.io');
    expect(
      generateSmartRuleName({ kind: 'header', url: URL, headerName: 'X-Powered-By', headerOperation: 'remove' }, []),
    ).toBe('Remove X-Powered-By · api.openheaders.io');
  });

  it('falls back to the static base for an empty header seed ("+ Add Header")', () => {
    expect(generateSmartRuleName({ kind: 'header', url: URL, headerName: '' }, [])).toBe('New Header Rule');
  });

  it('names response rules by mode', () => {
    expect(generateSmartRuleName({ kind: 'response', url: URL, responseSource: 'network' }, [])).toBe(
      'Modify response · api.openheaders.io/v1/users',
    );
    expect(generateSmartRuleName({ kind: 'response', url: URL, responseSource: 'mock' }, [])).toBe(
      'Mock response · api.openheaders.io/v1/users',
    );
  });

  it('names the payload rules', () => {
    expect(generateSmartRuleName({ kind: 'request-body', url: URL }, [])).toBe(
      'Request body · api.openheaders.io/v1/users',
    );
    expect(generateSmartRuleName({ kind: 'query-param', url: URL }, [])).toBe(
      'Query params · api.openheaders.io/v1/users',
    );
  });
});

describe('generateSmartRuleName — full value, fallback, dedupe', () => {
  it('keeps the FULL path in the name — truncation belongs to display layers', () => {
    const long = 'https://openheaders.io/api/very/long/path/that/keeps/going/forever';
    expect(generateSmartRuleName({ kind: 'block', url: long }, [])).toBe(
      'Block openheaders.io/api/very/long/path/that/keeps/going/forever',
    );
  });

  it('falls back to the static base when the URL does not parse', () => {
    expect(generateSmartRuleName({ kind: 'redirect', url: '' }, [])).toBe('New Redirect Rule');
    expect(generateSmartRuleName({ kind: 'query-param', url: 'not a url' }, [])).toBe('New Query Param Rule');
  });

  it('dedupes against existing rule names', () => {
    const taken = [{ name: 'Delay api.openheaders.io/v1/users' }];
    expect(generateSmartRuleName({ kind: 'delay', url: URL }, taken)).toBe('Delay api.openheaders.io/v1/users (2)');
  });
});
