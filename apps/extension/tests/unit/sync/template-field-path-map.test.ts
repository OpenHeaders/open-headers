import { describe, expect, it } from 'vitest';
import { mapAntdIdToTemplateFieldPath } from '@/workbench/components/template-field-path-map';

describe('mapAntdIdToTemplateFieldPath', () => {
  it('maps header mod row ids under formValues', () => {
    expect(mapAntdIdToTemplateFieldPath('requestHeaders_0_value')).toBe('formValues.requestHeaders.0.value');
    expect(mapAntdIdToTemplateFieldPath('responseHeaders_2_headerName')).toBe('formValues.responseHeaders.2.headerName');
  });

  it('maps condition row ids at the top level', () => {
    expect(mapAntdIdToTemplateFieldPath('conditions_0_value')).toBe('conditions.0.value');
    expect(mapAntdIdToTemplateFieldPath('conditions_3_op')).toBe('conditions.3.op');
  });

  it('maps query-param row ids under formValues', () => {
    expect(mapAntdIdToTemplateFieldPath('queryParams_0_param')).toBe('formValues.queryParams.0.param');
  });

  it('maps mock-response-header row ids under formValues.responseHeaders', () => {
    expect(mapAntdIdToTemplateFieldPath('mockResponseHeaders_0_name')).toBe('formValues.responseHeaders.0.name');
  });

  it('renames template metadata scalar ids', () => {
    expect(mapAntdIdToTemplateFieldPath('templateName')).toBe('name');
    expect(mapAntdIdToTemplateFieldPath('templateIcon')).toBe('icon');
    expect(mapAntdIdToTemplateFieldPath('templateDescription')).toBe('description');
    expect(mapAntdIdToTemplateFieldPath('includeConditions')).toBe('includes.conditions');
    expect(mapAntdIdToTemplateFieldPath('includeFormValues')).toBe('includes.formValues');
    expect(mapAntdIdToTemplateFieldPath('ruleType')).toBe('ruleType');
  });

  it('prefixes per-type scalar ids with formValues', () => {
    expect(mapAntdIdToTemplateFieldPath('redirectTo')).toBe('formValues.redirectTo');
    expect(mapAntdIdToTemplateFieldPath('delayMs')).toBe('formValues.delayMs');
    expect(mapAntdIdToTemplateFieldPath('mockStatusCode')).toBe('formValues.mockStatusCode');
    expect(mapAntdIdToTemplateFieldPath('bodyDynamicContent')).toBe('formValues.bodyDynamicContent');
  });

  it('returns null for unknown ids', () => {
    expect(mapAntdIdToTemplateFieldPath(null)).toBeNull();
    expect(mapAntdIdToTemplateFieldPath('')).toBeNull();
    expect(mapAntdIdToTemplateFieldPath('foo-bar')).toBeNull();
    expect(mapAntdIdToTemplateFieldPath('requestHeaders_0_unknownLeaf')).toBeNull();
  });
});
