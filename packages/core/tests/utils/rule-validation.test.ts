import { describe, expect, it } from 'vitest';
import type { Rule, RuleCondition } from '../../src/types/rule';
import type { ResolvedVariable } from '../../src/types/variable';
import { isRuleComplete, isRuleResolvable } from '../../src/utils/rule-validation';

const hostCondition: RuleCondition = { uid: 'cnd00001', type: 'request-domains', values: ['openheaders.io'] };
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
    expect(isRuleComplete({ ...base, conditions: [], type: 'block', action: {} })).toBe(false);
  });

  it('returns false when all condition values are whitespace', () => {
    const emptyCondition: RuleCondition = { uid: 'cnd00002', type: 'request-domains', values: ['  ', ''] };
    expect(isRuleComplete({ ...base, conditions: [emptyCondition], type: 'block', action: {} })).toBe(false);
  });

  it('returns true with a valid condition', () => {
    expect(isRuleComplete({ ...base, type: 'block', action: {} })).toBe(true);
  });

  it('returns true with multiple conditions', () => {
    const methodCondition: RuleCondition = { uid: 'cnd00003', type: 'request-methods', values: ['GET', 'POST'] };
    expect(
      isRuleComplete({
        ...base,
        conditions: [hostCondition, methodCondition],
        type: 'block',
        action: {},
      }),
    ).toBe(true);
  });

  it('returns false when condition values array is empty', () => {
    const noValues: RuleCondition = { uid: 'cnd00004', type: 'request-domains', values: [] };
    expect(isRuleComplete({ ...base, conditions: [noValues], type: 'block', action: {} })).toBe(false);
  });

  // ── Header ──────────────────────────────────────────────────────

  it('header: complete with name + value', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: {
          requestHeaders: [{ uid: 'hmd00001', operation: 'override', headerName: 'X-Debug', value: 'true' }],
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
        action: {
          requestHeaders: [{ uid: 'hmd00002', operation: 'override', headerName: '', value: 'true' }],
          responseHeaders: [],
        },
      }),
    ).toBe(false);
  });

  it('header: incomplete without value for add/override', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: {
          requestHeaders: [{ uid: 'hmd00003', operation: 'add', headerName: 'X-Debug', value: '' }],
          responseHeaders: [],
        },
      }),
    ).toBe(false);
  });

  it('header: complete without value for remove operation', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'header',
        action: {
          requestHeaders: [{ uid: 'hmd00004', operation: 'remove', headerName: 'X-Debug' }],
          responseHeaders: [],
        },
      }),
    ).toBe(true);
  });

  // ── Block ───────────────────────────────────────────────────────

  it('block: complete with just conditions', () => {
    expect(isRuleComplete({ ...base, type: 'block', action: {} })).toBe(true);
  });

  // ── Redirect ────────────────────────────────────────────────────

  it('redirect: complete with redirectTo', () => {
    expect(isRuleComplete({ ...base, type: 'redirect', action: { redirectTo: 'https://openheaders.io' } })).toBe(true);
  });

  it('redirect: incomplete without redirectTo', () => {
    expect(isRuleComplete({ ...base, type: 'redirect', action: { redirectTo: '' } })).toBe(false);
  });

  // ── Query Param ─────────────────────────────────────────────────

  it('query-param: complete with at least one named param', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'query-param',
        action: { params: [{ uid: 'qp000001', param: 'debug', value: '1', operation: 'add' as const }] },
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
        action: { params: [{ uid: 'qp000002', param: '', value: '1', operation: 'add' as const }] },
      }),
    ).toBe(false);
  });

  it('query-param: complete with a nameless remove-all entry (the editor hides its name input)', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'query-param',
        action: { params: [{ uid: 'qp000003', param: '', operation: 'remove-all' as const }] },
      }),
    ).toBe(true);
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

  // ── WS / SSE ────────────────────────────────────────────────────

  it('ws: modify complete with payload', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'ws',
        action: { operation: 'modify', direction: 'receive', payload: '{"mocked":true}' },
      }),
    ).toBe(true);
  });

  it('ws: modify incomplete without payload', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'ws',
        action: { operation: 'modify', direction: 'receive', payload: '' },
      }),
    ).toBe(false);
  });

  it('ws: inject incomplete with whitespace payload', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'ws',
        action: { operation: 'inject', direction: 'send', payload: '  ' },
      }),
    ).toBe(false);
  });

  it('ws: drop complete with conditions alone', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'ws',
        action: { operation: 'drop', direction: 'receive' },
      }),
    ).toBe(true);
  });

  it('sse: modify complete with payload', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'sse',
        action: { operation: 'modify', payload: 'data: ok' },
      }),
    ).toBe(true);
  });

  it('sse: drop complete without payload', () => {
    expect(
      isRuleComplete({
        ...base,
        type: 'sse',
        action: { operation: 'drop' },
      }),
    ).toBe(true);
  });

  // ── Works without uid/path (for pre-save validation) ────────────

  it('works on Omit<Rule, uid | path> for pre-save checks', () => {
    const partial = {
      schemaVersion: 5,
      name: 'Draft',
      type: 'header' as const,
      enabled: true,
      conditions: [hostCondition],
      action: {
        requestHeaders: [{ uid: 'hmd00005', operation: 'override' as const, headerName: 'X-Test', value: 'val' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(partial)).toBe(true);
  });

  it('empty draft rule is incomplete', () => {
    const partial = {
      schemaVersion: 5,
      name: 'New Header Rule',
      type: 'header' as const,
      enabled: true,
      conditions: [],
      action: {
        requestHeaders: [{ uid: 'hmd00006', operation: 'override' as const, headerName: '', value: '' }],
        responseHeaders: [],
      },
    };
    expect(isRuleComplete(partial)).toBe(false);
  });

  // ── Exclude conditions are valid ────────────────────────────────

  it('exclude condition with values is valid', () => {
    const excludeCondition: RuleCondition = {
      uid: 'cnd00005',
      type: 'exclude-request-domains',
      values: ['staging.openheaders.io'],
    };
    // Exclude alone is not useful (matches nothing to exclude from), but it's structurally complete.
    // In practice you'd pair it with a non-exclude condition.
    expect(
      isRuleComplete({
        ...base,
        conditions: [hostCondition, excludeCondition],
        type: 'block',
        action: {},
      }),
    ).toBe(true);
  });

  // ── Header condition types ──────────────────────────────────────

  it('response-header condition with headerName is valid', () => {
    const headerCondition: RuleCondition = {
      uid: 'cnd00006',
      type: 'response-header',
      values: ['application/json'],
      headerName: 'Content-Type',
    };
    expect(isRuleComplete({ ...base, conditions: [headerCondition], type: 'block', action: {} })).toBe(true);
  });

  // ── Per-condition input validation gating ──────────────────────
  //
  // Errors that Chrome's DNR will reject ought to render the rule
  // INCOMPLETE so the compiler skips it instead of breaking the
  // updateDynamicRules batch atomically. Warnings stay advisory.

  it('rejects a request-domains row whose value contains regex syntax (non-ascii kind)', () => {
    const c: RuleCondition = { uid: 'cnd00007', type: 'request-domains', values: ['^example.org'] };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(false);
  });

  it('rejects a url-regex row that does not compile', () => {
    const c: RuleCondition = { uid: 'cnd00008', type: 'url-regex', values: ['^https://[unclosed'] };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(false);
  });

  it('rejects a url-filter row with whitespace inside the pattern', () => {
    const c: RuleCondition = { uid: 'cnd00009', type: 'url-filter', values: ['*://api openheaders io/*'] };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(false);
  });

  it('rejects a request-methods row with an unknown method', () => {
    const c: RuleCondition = { uid: 'cnd00010', type: 'request-methods', values: ['BREW'] };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(false);
  });

  it('rejects a response-header row missing the header name', () => {
    const c: RuleCondition = { uid: 'cnd00011', type: 'response-header', values: ['application/json'], headerName: '' };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(false);
  });

  it('does NOT reject for advisory warnings — rule still compiles', () => {
    // url-filter with regex-looking syntax → warning, not error.
    const c: RuleCondition = { uid: 'cnd00012', type: 'url-filter', values: ['*://api+.openheaders.io/*'] };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(true);
  });

  it('does NOT reject for auto-fixable domain mistakes — they have a clean-up path', () => {
    // `*.foo.com` is a wildcard mistake (auto-fixable to `foo.com`),
    // not a structurally-broken value. Stays complete; banner offers cleanup.
    const c: RuleCondition = { uid: 'cnd00013', type: 'request-domains', values: ['*.foo.com'] };
    expect(isRuleComplete({ ...base, conditions: [c], type: 'block', action: {} })).toBe(true);
  });

  it('rejects when ANY of multiple conditions is invalid', () => {
    const good: RuleCondition = { uid: 'cnd00014', type: 'request-domains', values: ['openheaders.io'] };
    const bad: RuleCondition = { uid: 'cnd00015', type: 'request-methods', values: ['INVALID'] };
    expect(isRuleComplete({ ...base, conditions: [good, bad], type: 'block', action: {} })).toBe(false);
  });
});

// ── isRuleResolvable — reference-gating ──────────────────────────

describe('isRuleResolvable', () => {
  // Lookup that returns a value for every name in a given map.
  const lookupFromMap = (values: Record<string, string>) => {
    return (name: string): ResolvedVariable | null => {
      const v = values[name];
      if (v === undefined) return null;
      return { name, value: v, scope: 'workspace', isSensitive: false };
    };
  };

  // Header rule fixture with a `{{VAR}}` in a header value.
  const headerWithValue = (value: string) => ({
    ...base,
    type: 'header' as const,
    action: {
      requestHeaders: [{ uid: 'hmd00007', operation: 'override' as const, headerName: 'X-Auth', value }],
      responseHeaders: [],
    },
  });

  it('returns true when the rule has no templates', () => {
    expect(isRuleResolvable(headerWithValue('static-value'), () => null)).toBe(true);
  });

  it('returns true when every reference resolves', () => {
    expect(isRuleResolvable(headerWithValue('{{TOKEN}}'), lookupFromMap({ TOKEN: 'abc' }))).toBe(true);
  });

  it('returns false when a reference is unresolved', () => {
    expect(isRuleResolvable(headerWithValue('{{MISSING}}'), () => null)).toBe(false);
  });

  it('returns false when any of multiple references is unresolved', () => {
    const value = '{{HOST}}/{{PATH}}';
    // HOST resolves, PATH doesn't.
    expect(isRuleResolvable(headerWithValue(value), lookupFromMap({ HOST: 'openheaders.io' }))).toBe(false);
  });

  it('gates scoped references on the scoped lookup — misses block the rule', () => {
    // `{{file.X}}` without a scoped lookup falls back to the flat
    // lookup; no value found → `unresolved` → blocked.
    expect(isRuleResolvable(headerWithValue('{{file.fixture.json}}'), () => null)).toBe(false);

    // `{{dynamic.X}}` with a scoped lookup that misses surfaces
    // `unset-in-scope` (unknown generator) → blocked.
    expect(
      isRuleResolvable(
        headerWithValue('{{dynamic.notAGenerator}}'),
        () => null,
        () => null,
      ),
    ).toBe(false);

    // A scoped lookup that resolves (the real resolver path for a
    // known generator) unblocks the rule.
    expect(
      isRuleResolvable(
        headerWithValue('{{dynamic.timestamp}}'),
        () => null,
        (name) => ({ name, value: '1751500000', scope: 'dynamic', isSensitive: false }),
      ),
    ).toBe(true);
  });

  it('walks condition values + header rule action fields', () => {
    const rule = {
      ...base,
      conditions: [{ uid: 'cnd00016', type: 'request-domains' as const, values: ['{{HOST}}'] }],
      type: 'header' as const,
      action: {
        requestHeaders: [{ uid: 'hmd00008', operation: 'override' as const, headerName: 'X-Auth', value: '{{TOKEN}}' }],
        responseHeaders: [],
      },
    };
    // Only HOST defined → rule isn't resolvable because TOKEN misses.
    expect(isRuleResolvable(rule, lookupFromMap({ HOST: 'openheaders.io' }))).toBe(false);
    // Both defined → resolvable.
    expect(isRuleResolvable(rule, lookupFromMap({ HOST: 'openheaders.io', TOKEN: 'abc' }))).toBe(true);
  });

  it('handles redirect rule templates (matchPattern + redirectTo)', () => {
    const rule = {
      ...base,
      type: 'redirect' as const,
      action: { redirectTo: 'https://{{HOST}}/r' },
    };
    expect(isRuleResolvable(rule, lookupFromMap({ HOST: 'openheaders.io' }))).toBe(true);
    expect(isRuleResolvable(rule, () => null)).toBe(false);
  });
});

// ── isRuleResolvable — malformed persisted entities ────────────────
//
// Same trust-boundary contract as `isRequestResolvable`: rows the
// renderer reads raw from host storage can be malformed (git-edited
// files, rows from another version) and must answer "not resolvable"
// instead of throwing into the render path.

describe('isRuleResolvable — malformed entities', () => {
  it('a rule missing conditions answers false instead of throwing', () => {
    const rule = {
      ...base,
      type: 'header' as const,
      action: { requestHeaders: [], responseHeaders: [] },
    } as unknown as Rule;
    delete (rule as Partial<Rule>).conditions;
    expect(isRuleResolvable(rule, () => null)).toBe(false);
  });

  it('a query-param rule missing action.params answers false instead of throwing', () => {
    const rule = {
      ...base,
      type: 'query-param' as const,
      action: {} as unknown as Extract<Rule, { type: 'query-param' }>['action'],
    };
    expect(isRuleResolvable(rule, () => null)).toBe(false);
  });
});
