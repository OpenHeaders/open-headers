import type { Rule } from '@openheaders/core/types';
import { prettyRulePath } from '@openheaders/ui/workbench/components/rule-fields/pretty-path';
import { describe, expect, it } from 'vitest';

const RULE: Rule = {
  uid: 'r-1',
  path: 'rules/r-1.yaml',
  name: 'h',
  enabled: true,
  type: 'header',
  schemaVersion: 5,
  conditions: [],
  action: {
    requestHeaders: [{ uid: 'aaaaaaaa', operation: 'override', headerName: 'X-Auth', value: '' }],
    responseHeaders: [{ uid: 'cccccccc', operation: 'override', headerName: 'X-Cache', value: '' }],
  },
} as unknown as Rule;

describe('prettyRulePath', () => {
  it('renders top-level name + scalar fields', () => {
    expect(prettyRulePath(RULE, 'name')).toBe('Name');
    const redirect = { ...RULE, type: 'redirect', action: { redirectTo: '' } } as unknown as Rule;
    expect(prettyRulePath(redirect, 'action.redirectTo')).toBe('Redirect URL');
    const delay = { ...RULE, type: 'delay', action: { delayMs: 100 } } as unknown as Rule;
    expect(prettyRulePath(delay, 'action.delayMs')).toBe('Delay (ms)');
  });

  it('substitutes header name when the row resolves', () => {
    expect(prettyRulePath(RULE, 'action.requestHeaders.aaaaaaaa.value')).toBe('Request header X-Auth (value)');
    expect(prettyRulePath(RULE, 'action.responseHeaders.cccccccc.headerName')).toBe('Response header X-Cache (name)');
  });

  it('falls back gracefully when the row uid is unknown', () => {
    expect(prettyRulePath(RULE, 'action.requestHeaders.deadbeef.value')).toBe('Request header (value)');
  });

  it('renders response + query-param + condition shapes', () => {
    const response = { ...RULE, type: 'response', action: { responseHeaders: { 'X-Foo': 'bar' } } } as unknown as Rule;
    expect(prettyRulePath(response, 'action.responseHeaders.X-Foo.value')).toBe('Response header X-Foo (value)');

    const qp = {
      ...RULE,
      type: 'query-param',
      action: { params: [{ uid: 'bbbbbbbb', operation: 'override', param: 'foo', value: '1' }] },
    } as unknown as Rule;
    expect(prettyRulePath(qp, 'action.params.bbbbbbbb.param')).toBe('Query param foo (name)');

    expect(prettyRulePath(RULE, 'conditions.aaaaaaaa.values')).toBe('Condition values');
  });

  it('returns the raw path when the structure is not recognized', () => {
    expect(prettyRulePath(RULE, 'totally.unknown.path')).toBe('totally.unknown.path');
  });
});
