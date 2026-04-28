import { describe, expect, it } from 'vitest';
import { mapAntdIdToFieldPath } from '@/workbench/components/rule-fields/field-path-map';

describe('mapAntdIdToFieldPath', () => {
  it('maps request header mod row ids', () => {
    expect(mapAntdIdToFieldPath('requestHeaders_0_value')).toBe('action.requestHeaders.0.value');
    expect(mapAntdIdToFieldPath('requestHeaders_2_headerName')).toBe('action.requestHeaders.2.headerName');
    expect(mapAntdIdToFieldPath('requestHeaders_5_operation')).toBe('action.requestHeaders.5.operation');
  });

  it('maps response header mod row ids', () => {
    expect(mapAntdIdToFieldPath('responseHeaders_1_value')).toBe('action.responseHeaders.1.value');
  });

  it('maps condition row ids', () => {
    expect(mapAntdIdToFieldPath('conditions_0_value')).toBe('conditions.0.value');
    expect(mapAntdIdToFieldPath('conditions_3_op')).toBe('conditions.3.op');
  });

  it('maps query-param row ids', () => {
    expect(mapAntdIdToFieldPath('queryParams_0_param')).toBe('action.params.0.param');
  });

  it('maps mock-response-header row ids', () => {
    expect(mapAntdIdToFieldPath('mockResponseHeaders_0_name')).toBe('action.responseHeaders.0.name');
  });

  it('maps scalar field ids verbatim', () => {
    expect(mapAntdIdToFieldPath('redirectTo')).toBe('redirectTo');
    expect(mapAntdIdToFieldPath('delayMs')).toBe('delayMs');
  });

  it('returns null for unknown ids', () => {
    expect(mapAntdIdToFieldPath(null)).toBeNull();
    expect(mapAntdIdToFieldPath('')).toBeNull();
    expect(mapAntdIdToFieldPath('foo-bar')).toBeNull();
    expect(mapAntdIdToFieldPath('requestHeaders_0_unknownLeaf')).toBeNull();
    expect(mapAntdIdToFieldPath('totallyUnrelated_42_thing')).toBeNull();
  });
});
