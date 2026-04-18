import type { V5 } from '@openheaders/core/types';
import { formatUrlPattern } from '@openheaders/core/utils';
import { normalizeHeaderName } from '@utils/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, generateRulesHash } from '@/background/modules/utils';

// ---------------------------------------------------------------------------
//  Factory functions
// ---------------------------------------------------------------------------

function hostConditions(domains: string[]): V5.RuleCondition[] {
  return domains.length > 0 ? [{ type: 'request-domains', values: domains }] : [];
}

function makeHeaderRule(overrides: Partial<V5.HeaderRule> = {}): V5.HeaderRule {
  return {
    schemaVersion: 5,
    uid: 'r1a2',
    path: 'rules/auth/bearer-r1a2',
    name: 'Bearer Token',
    type: 'header',
    enabled: true,
    conditions: hostConditions(['*.openheaders.io', 'api.partner-service.io:8443']),
    action: {
      requestHeaders: [
        {
          operation: 'override',
          headerName: 'Authorization',
          value: 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGFjbWUuY29tIn0.sig',
        },
      ],
      responseHeaders: [],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
//  normalizeHeaderName
// ---------------------------------------------------------------------------

describe('normalizeHeaderName', () => {
  it('capitalizes each word separated by hyphens', () => {
    expect(normalizeHeaderName('content-type')).toBe('Content-Type');
    expect(normalizeHeaderName('x-forwarded-for')).toBe('X-Forwarded-For');
  });

  it('handles single word headers', () => {
    expect(normalizeHeaderName('authorization')).toBe('Authorization');
  });

  it('handles already capitalized headers', () => {
    expect(normalizeHeaderName('Content-Type')).toBe('Content-Type');
  });

  it('handles ALL CAPS headers', () => {
    expect(normalizeHeaderName('CONTENT-TYPE')).toBe('Content-Type');
  });

  it('trims whitespace', () => {
    expect(normalizeHeaderName('  content-type  ')).toBe('Content-Type');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeHeaderName('')).toBe('');
  });

  it('normalizes enterprise header names', () => {
    expect(normalizeHeaderName('x-b3-traceid')).toBe('X-B3-Traceid');
    expect(normalizeHeaderName('x-amz-security-token')).toBe('X-Amz-Security-Token');
    expect(normalizeHeaderName('x-correlation-id')).toBe('X-Correlation-Id');
  });
});

// ---------------------------------------------------------------------------
//  generateRulesHash
// ---------------------------------------------------------------------------

describe('generateRulesHash', () => {
  it('returns consistent hash for same rules', () => {
    const rules = [makeHeaderRule(), makeHeaderRule({ uid: 'r3b4' })];
    const hash1 = generateRulesHash(rules);
    const hash2 = generateRulesHash(rules);
    expect(hash1).toBe(hash2);
  });

  it('creates different hash when uid changes', () => {
    const r1 = [makeHeaderRule({ uid: 'aaaa' })];
    const r2 = [makeHeaderRule({ uid: 'bbbb' })];
    expect(generateRulesHash(r1)).not.toBe(generateRulesHash(r2));
  });

  it('creates different hash when enabled changes', () => {
    const r1 = [makeHeaderRule({ enabled: true })];
    const r2 = [makeHeaderRule({ enabled: false })];
    expect(generateRulesHash(r1)).not.toBe(generateRulesHash(r2));
  });

  it('creates different hash when type changes', () => {
    const r1 = [makeHeaderRule({ uid: 'x1y2' })];
    const r2: V5.Rule[] = [
      {
        schemaVersion: 5,
        uid: 'x1y2',
        path: 'rules/test',
        name: 'Block Rule',
        type: 'block',
        enabled: true,
        conditions: hostConditions(['*.openheaders.io']),
        action: { statusCode: 403 },
      },
    ];
    expect(generateRulesHash(r1)).not.toBe(generateRulesHash(r2));
  });

  it('ignores fields other than uid, enabled, and type', () => {
    const r1 = [
      makeHeaderRule({
        name: 'Name A',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'value-1' }],
          responseHeaders: [],
        },
      }),
    ];
    const r2 = [
      makeHeaderRule({
        name: 'Name B',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'value-2' }],
          responseHeaders: [],
        },
      }),
    ];
    // Same uid + enabled + type → same hash regardless of other fields
    expect(generateRulesHash(r1)).toBe(generateRulesHash(r2));
  });

  it('returns a hash for empty array', () => {
    const hash = generateRulesHash([]);
    expect(typeof hash).toBe('string');
  });
});

// ---------------------------------------------------------------------------
//  debounce
// ---------------------------------------------------------------------------

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays invocation until after wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 250);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(249);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only invokes once for multiple rapid calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets timer on each call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();

    debounced(); // resets
    vi.advanceTimersByTime(80);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments from the last call', () => {
    const fn = vi.fn<(a: string, b: number) => void>();
    const debounced = debounce(fn, 50);

    debounced('first', 1);
    debounced('second', 2);
    debounced('third', 3);

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third', 3);
  });

  it('allows subsequent invocations after wait period', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
//  formatUrlPattern
// ---------------------------------------------------------------------------

describe('formatUrlPattern', () => {
  it('adds protocol and path to bare domains', () => {
    expect(formatUrlPattern('openheaders.io')).toBe('*://openheaders.io/*');
  });

  it('preserves full URL patterns', () => {
    expect(formatUrlPattern('https://openheaders.io/path')).toBe('https://openheaders.io/path');
  });

  it('adds path to URL patterns without path', () => {
    expect(formatUrlPattern('https://openheaders.io')).toBe('https://openheaders.io/*');
  });

  it('handles IP addresses', () => {
    expect(formatUrlPattern('192.168.1.1')).toBe('*://192.168.1.1/*');
    expect(formatUrlPattern('192.168.1.1:8080')).toBe('*://192.168.1.1:8080/*');
  });

  it('handles localhost', () => {
    expect(formatUrlPattern('localhost')).toBe('*://localhost/*');
    expect(formatUrlPattern('localhost:3000')).toBe('*://localhost:3000/*');
  });

  it('handles wildcard subdomains', () => {
    expect(formatUrlPattern('*.openheaders.io')).toBe('*://*.openheaders.io/*');
  });

  it('trims whitespace', () => {
    expect(formatUrlPattern('  openheaders.io  ')).toBe('*://openheaders.io/*');
  });

  it('handles enterprise domain patterns', () => {
    expect(formatUrlPattern('api.openheaders.io')).toBe('*://api.openheaders.io/*');
    expect(formatUrlPattern('*.partner-service.io')).toBe('*://*.partner-service.io/*');
  });

  it('handles bare single-label domains from env vars', () => {
    // Real-world: CORP_DOMAIN_LIST includes "intranet" and "portal.corp"
    expect(formatUrlPattern('intranet')).toBe('*://intranet/*');
    expect(formatUrlPattern('portal.corp')).toBe('*://portal.corp/*');
    expect(formatUrlPattern('development.api.openheaders.io')).toBe('*://development.api.openheaders.io/*');
  });
});
