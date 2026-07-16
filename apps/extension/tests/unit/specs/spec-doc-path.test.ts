/**
 * Spec document path navigation — the pure core under the editor's
 * hover and go-to-definition services: offset → document path, and
 * local JSON Pointer → target span.
 */

import {
  collectSpecRefs,
  parseSpecDocument,
  resolveSpecPointer,
  specPathAtOffset,
} from '@openheaders/ui/workbench/components/specs/spec-doc-path';
import { describe, expect, it } from 'vitest';

const SAMPLE_YAML = `openapi: '3.1.0'
info:
  title: Openheaders API
  version: '1.0.0'
  termsOfService: https://openheaders.io/terms
servers:
  - url: https://api.openheaders.io
  - url: https://staging.openheaders.io
paths:
  /users:
    get:
      summary: List users
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
`;

function docOf(content: string) {
  const doc = parseSpecDocument(content);
  expect(doc).not.toBeNull();
  if (doc === null) throw new Error('unreachable');
  return doc;
}

describe('parseSpecDocument', () => {
  it('parses mapping documents and rejects everything else', () => {
    expect(parseSpecDocument(SAMPLE_YAML)).not.toBeNull();
    expect(parseSpecDocument('foo: [unclosed')).toBeNull();
    expect(parseSpecDocument('- a\n- list\n')).toBeNull();
    expect(parseSpecDocument('')).toBeNull();
  });
});

describe('specPathAtOffset', () => {
  it('resolves a key token to its document path', () => {
    const doc = docOf(SAMPLE_YAML);
    const hit = specPathAtOffset(doc, SAMPLE_YAML.indexOf('termsOfService'));
    expect(hit).toMatchObject({ path: ['info', 'termsOfService'], token: 'key' });
    expect(SAMPLE_YAML.slice(hit?.start, hit?.end)).toBe('termsOfService');
  });

  it('resolves a scalar value token with its text', () => {
    const doc = docOf(SAMPLE_YAML);
    const hit = specPathAtOffset(doc, SAMPLE_YAML.indexOf('https://openheaders.io/terms') + 3);
    expect(hit).toMatchObject({
      path: ['info', 'termsOfService'],
      token: 'value',
      value: 'https://openheaders.io/terms',
    });
  });

  it('resolves nested operation fields and sequence indices', () => {
    const doc = docOf(SAMPLE_YAML);
    expect(specPathAtOffset(doc, SAMPLE_YAML.indexOf('summary'))?.path).toEqual(['paths', '/users', 'get', 'summary']);
    expect(specPathAtOffset(doc, SAMPLE_YAML.indexOf('staging'))?.path).toEqual(['servers', 1, 'url']);
    expect(specPathAtOffset(doc, SAMPLE_YAML.indexOf('$ref'))?.path).toEqual([
      'paths',
      '/users',
      'get',
      'responses',
      '200',
      'content',
      'application/json',
      'schema',
      '$ref',
    ]);
  });

  it('returns null between tokens', () => {
    const doc = docOf(SAMPLE_YAML);
    // The indentation whitespace before `title:`.
    expect(specPathAtOffset(doc, SAMPLE_YAML.indexOf('  title'))).toBeNull();
  });

  it('navigates JSON documents through the same AST', () => {
    const json = JSON.stringify({ openapi: '3.1.0', info: { title: 'Test API', version: '1.0.0' } }, null, 2);
    const doc = docOf(json);
    const hit = specPathAtOffset(doc, json.indexOf('"title"') + 2);
    expect(hit).toMatchObject({ path: ['info', 'title'], token: 'key' });
  });
});

describe('collectSpecRefs', () => {
  it('collects every local $ref value with its span and pointer', () => {
    const sites = collectSpecRefs(docOf(SAMPLE_YAML));
    expect(sites).toHaveLength(1);
    expect(sites[0].pointer).toBe('#/components/schemas/User');
    expect(SAMPLE_YAML.slice(sites[0].start, sites[0].end)).toBe("'#/components/schemas/User'");
  });

  it('skips external references and non-string values', () => {
    const yaml = [
      'paths:',
      '  /a:',
      '    get:',
      '      responses:',
      "        '200':",
      '          content:',
      '            application/json:',
      '              schema:',
      "                $ref: 'https://openheaders.io/schemas/a.yaml'",
      'components:',
      '  schemas:',
      '    A:',
      "      $ref: '#/components/schemas/B'",
      '    B:',
      '      type: object',
      '',
    ].join('\n');
    const sites = collectSpecRefs(docOf(yaml));
    expect(sites).toHaveLength(1);
    expect(sites[0].pointer).toBe('#/components/schemas/B');
  });
});

describe('resolveSpecPointer', () => {
  it('resolves a local component pointer to the target key span', () => {
    const doc = docOf(SAMPLE_YAML);
    const target = resolveSpecPointer(doc, '#/components/schemas/User');
    expect(target).not.toBeNull();
    expect(SAMPLE_YAML.slice(target?.start, target?.end)).toBe('User');
  });

  it('resolves sequence segments by index', () => {
    const doc = docOf(SAMPLE_YAML);
    const target = resolveSpecPointer(doc, '#/servers/1');
    expect(target).not.toBeNull();
    if (target === null) return;
    expect(SAMPLE_YAML.slice(target.start, target.end)).toContain('staging.openheaders.io');
  });

  it('unescapes JSON Pointer tokens (~1 → slash)', () => {
    const yaml = 'paths:\n  /users:\n    get:\n      summary: ok\n';
    const target = resolveSpecPointer(docOf(yaml), '#/paths/~1users');
    expect(target).not.toBeNull();
    expect(yaml.slice(target?.start, target?.end)).toBe('/users');
  });

  it('returns null for external references and missing paths', () => {
    const doc = docOf(SAMPLE_YAML);
    expect(resolveSpecPointer(doc, 'https://openheaders.io/schema.yaml#/User')).toBeNull();
    expect(resolveSpecPointer(doc, '#/components/schemas/Missing')).toBeNull();
    expect(resolveSpecPointer(doc, '#/servers/9')).toBeNull();
  });
});
