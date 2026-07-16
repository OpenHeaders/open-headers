/**
 * Spec editor validation plane — parse-on-idle's pure core.
 *
 * Pins the Phase C contract: parse failures are errors, report drops
 * are warnings, the blank scaffold validates clean (vendor parity:
 * 0 errors / 0 warnings on creation), and file syntax derives from the
 * extension (invariant #15).
 */

import { OPENAPI_31_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import {
  specFileLanguage,
  specFileSyntaxLabel,
  validateSpecSource,
} from '@openheaders/ui/workbench/components/specs/spec-validation';
import { describe, expect, it } from 'vitest';

describe('validateSpecSource', () => {
  it('blank scaffold validates clean', () => {
    const result = validateSpecSource(OPENAPI_31_SCAFFOLD);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('accepts a JSON document', () => {
    const doc = JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'Test API', version: '1.0.0' },
      servers: [{ url: 'https://api.openheaders.io' }],
      paths: { '/status': { get: { responses: { '200': { description: 'OK' } } } } },
    });
    const result = validateSpecSource(doc);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports one error when the source is neither valid JSON nor YAML', () => {
    const result = validateSpecSource('foo: [unclosed');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('not valid JSON or YAML');
    expect(result.warnings).toEqual([]);
  });

  it('reports the version gate as an error', () => {
    const result = validateSpecSource('swagger: "2.0"\ninfo:\n  title: Old\n  version: "1.0"\n');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Swagger 2.0');
  });

  it('reports a non-object document as an error', () => {
    const result = validateSpecSource('- just\n- a\n- list\n');
    expect(result.errors).toHaveLength(1);
  });

  it('surfaces report drops as warnings on a parseable document', () => {
    const result = validateSpecSource('openapi: "3.1.0"\ninfo:\n  title: Empty API\n  version: "1.0.0"\n');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('paths');
  });
});

describe('spec file syntax derivation', () => {
  it('derives language and label from the extension', () => {
    expect(specFileLanguage('index.yaml')).toBe('yaml');
    expect(specFileLanguage('index.yml')).toBe('yaml');
    expect(specFileLanguage('index.json')).toBe('json');
    expect(specFileSyntaxLabel('index.yaml')).toBe('YAML');
    expect(specFileSyntaxLabel('index.json')).toBe('JSON');
  });
});
