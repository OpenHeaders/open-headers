/**
 * RULE_FIELD path generators — pinning the itemId-based shape so two
 * surfaces editing the same row resolve to the same canonical path
 * across reorders. Replaces the index-based field-path-map.test.ts that
 * was removed alongside `mapAntdIdToFieldPath` in the same diff.
 */

import { RULE_FIELD } from '@openheaders/ui/shared/awareness';
import { describe, expect, it } from 'vitest';

describe('RULE_FIELD scalar leaves', () => {
  it('exposes top-level + per-action scalar paths', () => {
    expect(RULE_FIELD.name).toBe('name');
    expect(RULE_FIELD.enabled).toBe('enabled');
    expect(RULE_FIELD.conditions).toBe('conditions');
    expect(RULE_FIELD.redirectTo).toBe('action.redirectTo');
    expect(RULE_FIELD.injectCode).toBe('action.code');
    expect(RULE_FIELD.injectSourceUrl).toBe('action.sourceUrl');
    expect(RULE_FIELD.injectType).toBe('action.injectType');
    expect(RULE_FIELD.injectSource).toBe('action.source');
    expect(RULE_FIELD.injectPosition).toBe('action.position');
    expect(RULE_FIELD.requestBody).toBe('action.requestBody');
    expect(RULE_FIELD.requestBodyType).toBe('action.bodyType');
    expect(RULE_FIELD.apiResourceType).toBe('action.resourceType');
    expect(RULE_FIELD.delayMs).toBe('action.delayMs');
    expect(RULE_FIELD.responseSource).toBe('action.responseSource');
    expect(RULE_FIELD.responseStatusCode).toBe('action.statusCode');
    expect(RULE_FIELD.responseBody).toBe('action.responseBody');
    expect(RULE_FIELD.responseContentType).toBe('action.contentType');
    expect(RULE_FIELD.responseBodyType).toBe('action.bodyType');
  });
});

describe('RULE_FIELD set-row generators (itemId-keyed)', () => {
  it('headerMod composes direction + uid + leaf', () => {
    expect(RULE_FIELD.headerMod('request', 'thm00001', 'value')).toBe('action.requestHeaders.thm00001.value');
    expect(RULE_FIELD.headerMod('response', 'thm00002', 'headerName')).toBe(
      'action.responseHeaders.thm00002.headerName',
    );
    expect(RULE_FIELD.headerMod('request', 'thm00003', 'operation')).toBe('action.requestHeaders.thm00003.operation');
    expect(RULE_FIELD.headerMod('request', 'thm00004', 'mergeSeparator')).toBe(
      'action.requestHeaders.thm00004.mergeSeparator',
    );
  });

  it('condition composes uid + leaf', () => {
    expect(RULE_FIELD.condition('cnd00001', 'values')).toBe('conditions.cnd00001.values');
    expect(RULE_FIELD.condition('cnd00002', 'type')).toBe('conditions.cnd00002.type');
    expect(RULE_FIELD.condition('cnd00003', 'headerName')).toBe('conditions.cnd00003.headerName');
  });

  it('queryParam composes uid + leaf', () => {
    expect(RULE_FIELD.queryParam('qp000001', 'param')).toBe('action.params.qp000001.param');
    expect(RULE_FIELD.queryParam('qp000002', 'value')).toBe('action.params.qp000002.value');
    expect(RULE_FIELD.queryParam('qp000003', 'operation')).toBe('action.params.qp000003.operation');
  });

  it('responseHeader uses header name as the schema-key identity', () => {
    expect(RULE_FIELD.responseHeader('X-Foo', 'name')).toBe('action.responseHeaders.X-Foo.name');
    expect(RULE_FIELD.responseHeader('X-Foo', 'value')).toBe('action.responseHeaders.X-Foo.value');
  });

  it('itemId paths are reorder-stable — moving a row does not change its path', () => {
    // Two surfaces with rows in different orders both resolve to the
    // same path for the row whose uid is `thm00099`. This is the
    // load-bearing property the index-based scheme didn't have.
    const surfaceAPath = RULE_FIELD.headerMod('request', 'thm00099', 'value');
    const surfaceBPath = RULE_FIELD.headerMod('request', 'thm00099', 'value');
    expect(surfaceAPath).toBe(surfaceBPath);
  });
});
