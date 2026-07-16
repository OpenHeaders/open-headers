/**
 * OpenAPI annotation catalog — pattern matching for the spec editor's
 * hover: anchored positions, wildcards, floating objects, specificity
 * ordering, and per-format gating.
 */

import { lookupSpecAnnotation } from '@openheaders/ui/workbench/components/specs/openapi-annotations';
import { describe, expect, it } from 'vitest';

describe('lookupSpecAnnotation', () => {
  it('matches root-anchored positions', () => {
    expect(lookupSpecAnnotation(['info', 'termsOfService'], 'openapi-3.1')).toContain('Terms of Service');
    expect(lookupSpecAnnotation(['info', 'license', 'url'], 'openapi-3.1')).toBe('The URL pointing to the license.');
    expect(lookupSpecAnnotation(['openapi'], 'openapi-3.0')).toContain('version number of the OpenAPI Specification');
  });

  it('matches wildcard segments for paths and operations', () => {
    expect(lookupSpecAnnotation(['paths', '/users', 'get'], 'openapi-3.1')).toBe(
      'A definition of a GET operation on this path.',
    );
    expect(lookupSpecAnnotation(['paths', '/users', 'get', 'summary'], 'openapi-3.1')).toBe(
      'A short summary of what the operation does.',
    );
    expect(lookupSpecAnnotation(['servers', 0, 'url'], 'openapi-3.1')).toContain('URL to the target host');
  });

  it('matches floating objects wherever they appear', () => {
    const refText = 'The reference string.';
    expect(
      lookupSpecAnnotation(
        ['paths', '/users', 'get', 'responses', '200', 'content', 'application/json', 'schema', '$ref'],
        'openapi-3.1',
      ),
    ).toBe(refText);
    expect(lookupSpecAnnotation(['components', 'schemas', 'User', 'properties', 'id', '$ref'], 'openapi-3.1')).toBe(
      refText,
    );
    expect(lookupSpecAnnotation(['components', 'schemas', 'User', 'properties'], 'openapi-3.1')).toContain(
      'properties of the object schema',
    );
    expect(lookupSpecAnnotation(['paths', '/users', 'get', 'responses', '200', 'description'], 'openapi-3.1')).toBe(
      'A description of the response. CommonMark syntax MAY be used.',
    );
  });

  it('prefers the specific object over the generic keyword', () => {
    // A parameter's description gets the parameter text, not the
    // generic description fallback.
    expect(lookupSpecAnnotation(['paths', '/users', 'get', 'parameters', 0, 'description'], 'openapi-3.1')).toContain(
      'description of the parameter',
    );
    // An unknown object's description falls back to the generic text.
    expect(lookupSpecAnnotation(['info', 'contact', 'description'], 'openapi-3.1')).toContain(
      'description of this element',
    );
    // A security scheme's `type` wins over the schema keyword.
    expect(lookupSpecAnnotation(['components', 'securitySchemes', 'ApiKey', 'type'], 'openapi-3.1')).toContain(
      'type of the security scheme',
    );
    expect(lookupSpecAnnotation(['components', 'schemas', 'User', 'type'], 'openapi-3.1')).toBe(
      'The data type of the schema.',
    );
  });

  it('gates entries by format', () => {
    expect(lookupSpecAnnotation(['info', 'summary'], 'openapi-3.1')).toBe('A short summary of the API.');
    // 3.0 has no info.summary — the floating summary text answers.
    expect(lookupSpecAnnotation(['info', 'summary'], 'openapi-3.0')).toBe('A short summary of this element.');
    expect(lookupSpecAnnotation(['components', 'schemas', 'User', 'nullable'], 'openapi-3.0')).toContain('null value');
    expect(lookupSpecAnnotation(['components', 'schemas', 'User', 'nullable'], 'openapi-3.1')).toBeNull();
  });

  it('returns null for unknown fields and the empty path', () => {
    expect(lookupSpecAnnotation(['x-custom-extension'], 'openapi-3.1')).toBeNull();
    expect(lookupSpecAnnotation(['info', 'x-logo'], 'openapi-3.1')).toBeNull();
    expect(lookupSpecAnnotation([], 'openapi-3.1')).toBeNull();
  });
});
