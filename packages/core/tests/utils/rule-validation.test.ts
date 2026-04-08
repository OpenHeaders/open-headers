import { describe, expect, it } from 'vitest';
import { isRuleComplete } from '../../src/utils/rule-validation';

const base = { uid: 'x1', path: 'rules/col-abc1/rule-x1', name: 'Test', enabled: true, tags: [], domains: ['openheaders.io'] };

describe('isRuleComplete', () => {
  // ── Domains (common to all) ─────────────────────────────────────

  it('returns false when domains is empty', () => {
    expect(isRuleComplete({ ...base, domains: [], type: 'block', action: { statusCode: 403 } })).toBe(false);
  });

  it('returns false when all domains are whitespace', () => {
    expect(isRuleComplete({ ...base, domains: ['  ', ''], type: 'block', action: { statusCode: 403 } })).toBe(false);
  });

  // ── Header ──────────────────────────────────────────────────────

  it('header: complete with name + value', () => {
    expect(isRuleComplete({ ...base, type: 'header', action: { operation: 'override', headerName: 'X-Debug', isResponse: false }, staticValue: 'true' })).toBe(true);
  });

  it('header: incomplete without headerName', () => {
    expect(isRuleComplete({ ...base, type: 'header', action: { operation: 'override', headerName: '', isResponse: false }, staticValue: 'true' })).toBe(false);
  });

  it('header: incomplete without staticValue for add/override', () => {
    expect(isRuleComplete({ ...base, type: 'header', action: { operation: 'add', headerName: 'X-Debug', isResponse: false }, staticValue: '' })).toBe(false);
  });

  it('header: complete without staticValue for remove operation', () => {
    expect(isRuleComplete({ ...base, type: 'header', action: { operation: 'remove', headerName: 'X-Debug', isResponse: false }, staticValue: '' })).toBe(true);
  });

  // ── Block ───────────────────────────────────────────────────────

  it('block: complete with just domains', () => {
    expect(isRuleComplete({ ...base, type: 'block', action: { statusCode: 403 } })).toBe(true);
  });

  // ── Redirect ────────────────────────────────────────────────────

  it('redirect: complete with redirectTo', () => {
    expect(isRuleComplete({ ...base, type: 'redirect', action: { matchPattern: '', redirectTo: 'https://openheaders.io' } })).toBe(true);
  });

  it('redirect: incomplete without redirectTo', () => {
    expect(isRuleComplete({ ...base, type: 'redirect', action: { matchPattern: '', redirectTo: '' } })).toBe(false);
  });

  // ── Query Param ─────────────────────────────────────────────────

  it('query-param: complete with at least one named param', () => {
    expect(isRuleComplete({ ...base, type: 'query-param', action: { params: [{ param: 'debug', value: '1', operation: 'add' as const }] } })).toBe(true);
  });

  it('query-param: incomplete with empty params array', () => {
    expect(isRuleComplete({ ...base, type: 'query-param', action: { params: [] } })).toBe(false);
  });

  it('query-param: incomplete when all param names are empty', () => {
    expect(isRuleComplete({ ...base, type: 'query-param', action: { params: [{ param: '', value: '1', operation: 'add' as const }] } })).toBe(false);
  });

  // ── Inject ──────────────────────────────────────────────────────

  it('inject: complete with code', () => {
    expect(isRuleComplete({ ...base, type: 'inject', action: { injectType: 'script', code: 'console.log(1)', position: 'body-end' } })).toBe(true);
  });

  it('inject: incomplete without code', () => {
    expect(isRuleComplete({ ...base, type: 'inject', action: { injectType: 'script', code: '', position: 'body-end' } })).toBe(false);
  });

  // ── Works without uid/path (for pre-save validation) ────────────

  it('works on Omit<Rule, uid | path> for pre-save checks', () => {
    const partial = { name: 'Draft', type: 'header' as const, enabled: true, tags: [], domains: ['openheaders.io'], action: { operation: 'override' as const, headerName: 'X-Test', isResponse: false }, staticValue: 'val' };
    expect(isRuleComplete(partial)).toBe(true);
  });

  it('empty draft rule is incomplete', () => {
    const partial = { name: 'New Header Rule', type: 'header' as const, enabled: true, tags: [], domains: [], action: { operation: 'override' as const, headerName: '', isResponse: false }, staticValue: '' };
    expect(isRuleComplete(partial)).toBe(false);
  });
});
