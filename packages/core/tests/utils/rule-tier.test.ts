import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '../../src/types/rule';
import { isDebugTierRule, isFetchRealizableNow } from '../../src/utils/rule-tier';

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
  responseSource: 'mock' as const,
  bodyType: 'static' as const,
  responseBody: '',
  statusCode: 200,
  contentType: 'application/json',
  responseHeaders: {},
};
const mockActionDynamic = { ...mockAction, bodyType: 'dynamic' as const };
const networkAction = { ...mockAction, responseSource: 'network' as const };
const bodyAction = { bodyType: 'static' as const, requestBody: '', resourceType: 'rest' as const };
const bodyActionDynamic = { ...bodyAction, bodyType: 'dynamic' as const };
const authAction = { username: 'devuser', password: '{{vault.PW}}' };

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
      isDebugTierRule({
        ...base,
        type: 'response',
        conditions: [hostCondition, resourceTypes('xhr')],
        action: mockAction,
      }),
    ).toBe(false);
  });

  it('mock with no resource-types condition is debug (unrestricted reach)', () => {
    expect(isDebugTierRule({ ...base, type: 'response', conditions: [hostCondition], action: mockAction })).toBe(true);
  });

  it('mock with an empty resource-types condition is debug (unrestricted)', () => {
    expect(
      isDebugTierRule({ ...base, type: 'response', conditions: [hostCondition, resourceTypes()], action: mockAction }),
    ).toBe(true);
  });

  it('mock targeting a navigation/document is debug', () => {
    expect(
      isDebugTierRule({ ...base, type: 'response', conditions: [resourceTypes('page')], action: mockAction }),
    ).toBe(true);
  });

  it('mock spanning xhr + a non-fetch type is debug (reach exceeds injection)', () => {
    expect(
      isDebugTierRule({ ...base, type: 'response', conditions: [resourceTypes('xhr', 'media')], action: mockAction }),
    ).toBe(true);
  });

  // ── body: same reach rule ───────────────────────────────────────

  it('body confined to xhr is standard', () => {
    expect(
      isDebugTierRule({ ...base, type: 'request-body', conditions: [resourceTypes('xhr')], action: bodyAction }),
    ).toBe(false);
  });

  it('body with no resource-types condition is debug', () => {
    expect(isDebugTierRule({ ...base, type: 'request-body', conditions: [hostCondition], action: bodyAction })).toBe(
      true,
    );
  });

  // ── auth: unconditionally debug-tier (CDP-only, no injection equivalent) ──

  it('auth rule is debug-tier', () => {
    expect(isDebugTierRule({ ...base, type: 'auth', conditions: [hostCondition], action: authAction })).toBe(true);
  });

  it('auth confined to xhr is STILL debug-tier (no injection path to contest reach)', () => {
    expect(
      isDebugTierRule({ ...base, type: 'auth', conditions: [hostCondition, resourceTypes('xhr')], action: authAction }),
    ).toBe(true);
  });
});

describe('isFetchRealizableNow', () => {
  // Realizable = debug-tier AND a static reaction. The dormant badge/notice
  // gate on this so they never promise an effect arming can't yet deliver.

  it('static debug-tier mock is realizable now', () => {
    expect(isFetchRealizableNow({ ...base, type: 'response', conditions: [hostCondition], action: mockAction })).toBe(
      true,
    );
  });

  it('static debug-tier body is realizable now', () => {
    expect(
      isFetchRealizableNow({ ...base, type: 'request-body', conditions: [hostCondition], action: bodyAction }),
    ).toBe(true);
  });

  it('dynamic debug-tier mock is NOT realizable now (arming can not eval its JS body)', () => {
    expect(
      isFetchRealizableNow({ ...base, type: 'response', conditions: [hostCondition], action: mockActionDynamic }),
    ).toBe(false);
  });

  it('dynamic debug-tier body is NOT realizable now', () => {
    expect(
      isFetchRealizableNow({ ...base, type: 'request-body', conditions: [hostCondition], action: bodyActionDynamic }),
    ).toBe(false);
  });

  it('static network-source response IS realizable now (Response-stage round-trip, D2b-1)', () => {
    expect(
      isFetchRealizableNow({ ...base, type: 'response', conditions: [hostCondition], action: networkAction }),
    ).toBe(true);
  });

  it('dynamic network-source response is NOT realizable now (host can not eval the modify yet)', () => {
    expect(
      isFetchRealizableNow({
        ...base,
        type: 'response',
        conditions: [hostCondition],
        action: { ...networkAction, bodyType: 'dynamic' },
      }),
    ).toBe(false);
  });

  it('static mock confined to xhr is NOT realizable now (not debug-tier — injection already covers it)', () => {
    expect(
      isFetchRealizableNow({
        ...base,
        type: 'response',
        conditions: [hostCondition, resourceTypes('xhr')],
        action: mockAction,
      }),
    ).toBe(false);
  });

  it('non-Fetch-capable rule types are never realizable now', () => {
    expect(
      isFetchRealizableNow({
        ...base,
        type: 'header',
        conditions: [hostCondition],
        action: { requestHeaders: [], responseHeaders: [] },
      }),
    ).toBe(false);
  });

  it('auth rule is realizable now (static credentials, always debug-tier)', () => {
    expect(isFetchRealizableNow({ ...base, type: 'auth', conditions: [hostCondition], action: authAction })).toBe(true);
  });

  it('auth confined to xhr is realizable now (unconditionally debug-tier)', () => {
    expect(
      isFetchRealizableNow({
        ...base,
        type: 'auth',
        conditions: [hostCondition, resourceTypes('xhr')],
        action: authAction,
      }),
    ).toBe(true);
  });
});
