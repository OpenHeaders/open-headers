import { describe, expect, it } from 'vitest';
import type { RuleCondition } from '../../src/types/v5/rule';
import { isRuleComplete } from '../../src/utils/rule-validation';

const hostCondition: RuleCondition = { type: 'request-domains', values: ['openheaders.io'] };
const base = {
  schemaVersion: 5,
  version: 1,
  uid: 'x1',
  path: 'rules/col-abc1/rule-x1',
  name: 'Test',
  enabled: true,
  conditions: [hostCondition],
};

describe('isRuleComplete', () => {
  // ── Conditions (common to all) ─────────────────────────────────

  it('returns false when conditions is empty', () => {
    expect(isRuleComplete({ ...base, conditions: [], type: 'block', action: { statusCode: 403 } })).toBe(false);
  });

  it('returns false when all condition values are whitespace', () => {
    const emptyCondition: RuleCondition = { type: 'request-domains', values: ['  ', ''] };
    expect(isRuleComplete({ ...base, conditions: [emptyCondition], type: 'block', action: { statusCode: 403 } })).toBe(
      false,
    );
  });

  it('returns true with a valid condition', () => {
    expect(isRuleComplete({ ...base, type: 'block', action: { statusCode: 403 } })).toBe(true);
  });

  it('returns true with multiple conditions', () => {
    const methodCondition: RuleCondition = { type: 'request-methods', values: ['GET', 'POST'] };
    expect(
      isRuleComplete({
        ...base,
        conditions: [hostCondition, methodCondition],
        type: 'block',
        action: { statusCode: 403 },
      }),
    ).toBe(true);
  });

  it('returns false when condition values array is empty', () => {
    const noValues: RuleCondition = { type: 'request-domains', values: [] };
    expect(isRuleComplete({ ...base, conditions: [noValues], type: 'block', action: { statusCode: 403 } })).toBe(false);
  });

  // ── Header ──────────────────────────────────────────────────────

  it('header: complete with name + value', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: {
          requestHeaders: [{ operation: 'override', headerName: 'X-Debug', value: 'true' }],
          responseHeaders: [],
        },
      }),
    ).toBe(true);
  });

  it('header: incomplete without headerName', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: { requestHeaders: [{ operation: 'override', headerName: '', value: 'true' }], responseHeaders: [] },
      }),
    ).toBe(false);
  });

  it('header: incomplete without value for add/override', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: { requestHeaders: [{ operation: 'add', headerName: 'X-Debug', value: '' }], responseHeaders: [] },
      }),
    ).toBe(false);
  });

  it('header: complete without value for remove operation', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: { requestHeaders: [{ operation: 'remove', headerName: 'X-Debug' }], responseHeaders: [] },
      }),
    ).toBe(true);
  });

  // ── Block ───────────────────────────────────────────────────────

  it('block: complete with just conditions', () => {
    expect(isRuleComplete({ ...base, type: 'block', action: { statusCode: 403 } })).toBe(true);
  });

  // ── Redirect ────────────────────────────────────────────────────

  it('redirect: complete with redirectTo', () => {
    expect(
      isRuleComplete({ ...base, type: 'redirect', action: { matchPattern: '', redirectTo: 'https://openheaders.io' } }),
    ).toBe(true);
  });

  it('redirect: incomplete without redirectTo', () => {
    expect(isRuleComplete({ ...base, type: 'redirect', action: { matchPattern: '', redirectTo: '' } })).toBe(false);
  });

  // ── Query Param ─────────────────────────────────────────────────

  it('query-param: complete with at least one named param', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'query-param',
        action: { params: [{ param: 'debug', value: '1', operation: 'add' as const }] },
      }),
    ).toBe(true);
  });

  it('query-param: incomplete with empty params array', () => {
    expect(isRuleComplete({ ...base, type: 'query-param', action: { params: [] } })).toBe(false);
  });

  it('query-param: incomplete when all param names are empty', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'query-param',
        action: { params: [{ param: '', value: '1', operation: 'add' as const }] },
      }),
    ).toBe(false);
  });

  // ── Inject ──────────────────────────────────────────────────────

  it('inject: complete with code', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'inject',
        action: { injectType: 'script', source: 'code', code: 'console.log(1)', position: 'body-end' },
      }),
    ).toBe(true);
  });

  it('inject: incomplete without code', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'inject',
        action: { injectType: 'script', source: 'code', code: '', position: 'body-end' },
      }),
    ).toBe(false);
  });

  // ── Works without uid/path (for pre-save validation) ────────────

  it('works on Omit<Rule, uid | path> for pre-save checks', () => {
    const partial = {
      schemaVersion: 5,
      version: 1,
      name: 'Draft',
      type: 'header' as const,
      enabled: true,
      conditions: [hostCondition],
      action: {
        requestHeaders: [{ operation: 'override' as const, headerName: 'X-Test', value: 'val' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(partial)).toBe(true);
  });

  it('empty draft rule is incomplete', () => {
    const partial = {
      schemaVersion: 5,
      version: 1,
      name: 'New Header Rule',
      type: 'header' as const,
      enabled: true,
      conditions: [],
      action: { requestHeaders: [{ operation: 'override' as const, headerName: '', value: '' }], responseHeaders: [] },
    };
    expect(isRuleComplete(partial)).toBe(false);
  });

  // ── Exclude conditions are valid ────────────────────────────────

  it('exclude condition with values is valid', () => {
    const excludeCondition: RuleCondition = { type: 'exclude-request-domains', values: ['staging.openheaders.io'] };
    // Exclude alone is not useful (matches nothing to exclude from), but it's structurally complete.
    // In practice you'd pair it with a non-exclude condition.
    expect(
      isRuleComplete({
        ...base,
        conditions: [hostCondition, excludeCondition],
        type: 'block',
        action: { statusCode: 403 },
      }),
    ).toBe(true);
  });

  // ── Header condition types ──────────────────────────────────────

  it('request-header condition with headerName is valid', () => {
    const headerCondition: RuleCondition = { type: 'request-header', values: ['Bearer*'], headerName: 'Authorization' };
    expect(isRuleComplete({ ...base, conditions: [headerCondition], type: 'block', action: { statusCode: 403 } })).toBe(
      true,
    );
  });
});
