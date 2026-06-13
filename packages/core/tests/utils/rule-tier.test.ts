import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '../../src/types/rule';
import { isDebugTierRule } from '../../src/utils/rule-tier';

const base = {
  schemaVersion: 5 as const,
  uid: 'r1',
  path: 'rules/col-abc1/rule-r1',
  name: 'Test',
  enabled: true,
};

const hostCondition: RuleCondition = { uid: 'cnd00001', type: 'request-domains', values: ['openheaders.io'] };

function resourceTypes(...values: string[]): RuleCondition {
  return { uid: 'cnd00002', type: 'resource-types', values };
}

const mockAction = {
  statusCode: 200,
  responseHeaders: {},
  responseBody: '',
  contentType: 'application/json',
  bodyType: 'static' as const,
};
const bodyAction = { bodyType: 'static' as const, body: '', resourceType: 'rest' as const };

describe('isDebugTierRule', () => {
  // ── Non-Fetch-capable action types are always standard ──────────

  it('header rule is standard (DNR covers all contexts)', () => {
    expect(
      isDebugTierRule({
        ...base,
        type: 'header',
        conditions: [hostCondition],
        action: { requestHeaders: [], responseHeaders: [] },
      }),
    ).toBe(false);
  });

  it('block / redirect / query-param rules are standard', () => {
    expect(isDebugTierRule({ ...base, type: 'block', conditions: [hostCondition], action: {} })).toBe(false);
    expect(
      isDebugTierRule({ ...base, type: 'redirect', conditions: [hostCondition], action: { redirectTo: 'x' } }),
    ).toBe(false);
    expect(isDebugTierRule({ ...base, type: 'query-param', conditions: [hostCondition], action: { params: [] } })).toBe(
      false,
    );
  });

  it('inject / delay / ws / sse rules are standard (page-context only)', () => {
    expect(
      isDebugTierRule({
        ...base,
        type: 'inject',
        conditions: [hostCondition],
        action: { injectType: 'script', code: '', source: 'code', position: 'head' },
      }),
    ).toBe(false);
    expect(isDebugTierRule({ ...base, type: 'delay', conditions: [hostCondition], action: { delayMs: 0 } })).toBe(
      false,
    );
    expect(
      isDebugTierRule({
        ...base,
        type: 'ws',
        conditions: [hostCondition],
        action: { operation: 'modify', direction: 'receive', payload: '' },
      }),
    ).toBe(false);
    expect(
      isDebugTierRule({
        ...base,
        type: 'sse',
        conditions: [hostCondition],
        action: { operation: 'modify', payload: '' },
      }),
    ).toBe(false);
  });

  // ── mock: reach decides tier ────────────────────────────────────

  it('mock confined to xhr is standard (injection covers it)', () => {
    expect(
      isDebugTierRule({ ...base, type: 'mock', conditions: [hostCondition, resourceTypes('xhr')], action: mockAction }),
    ).toBe(false);
  });

  it('mock with no resource-types condition is debug (unrestricted reach)', () => {
    expect(isDebugTierRule({ ...base, type: 'mock', conditions: [hostCondition], action: mockAction })).toBe(true);
  });

  it('mock with an empty resource-types condition is debug (unrestricted)', () => {
    expect(
      isDebugTierRule({ ...base, type: 'mock', conditions: [hostCondition, resourceTypes()], action: mockAction }),
    ).toBe(true);
  });

  it('mock targeting a navigation/document is debug', () => {
    expect(isDebugTierRule({ ...base, type: 'mock', conditions: [resourceTypes('page')], action: mockAction })).toBe(
      true,
    );
  });

  it('mock spanning xhr + a non-fetch type is debug (reach exceeds injection)', () => {
    expect(
      isDebugTierRule({ ...base, type: 'mock', conditions: [resourceTypes('xhr', 'media')], action: mockAction }),
    ).toBe(true);
  });

  // ── body: same reach rule ───────────────────────────────────────

  it('body confined to xhr is standard', () => {
    expect(isDebugTierRule({ ...base, type: 'body', conditions: [resourceTypes('xhr')], action: bodyAction })).toBe(
      false,
    );
  });

  it('body with no resource-types condition is debug', () => {
    expect(isDebugTierRule({ ...base, type: 'body', conditions: [hostCondition], action: bodyAction })).toBe(true);
  });
});
