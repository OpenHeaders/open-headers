/**
 * Spec editor validation plane — parse-on-idle's pure core.
 *
 * Pins the Phase C contract: parse failures are errors, report drops
 * are warnings, the blank scaffolds validate clean (vendor parity:
 * 0 errors / 0 warnings on creation), file syntax derives from the
 * extension (invariant #15), and validation dispatches on the spec's
 * format — protobuf and asyncapi sources run their census parsers,
 * graphql roots the core schema model (SDL or introspection JSON).
 */

import {
  ASYNCAPI_30_SCAFFOLD,
  GRAPHQL_SDL_SCAFFOLD,
  OPENAPI_31_SCAFFOLD,
  PROTO3_SCAFFOLD,
} from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import {
  specFileLanguage,
  specFileSyntaxLabel,
  validateSpecSource,
} from '@openheaders/ui/workbench/components/specs/spec-validation';
import { describe, expect, it } from 'vitest';

describe('validateSpecSource', () => {
  it('blank scaffold validates clean', () => {
    const result = validateSpecSource(OPENAPI_31_SCAFFOLD, 'openapi-3.1');
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
    const result = validateSpecSource(doc, 'openapi-3.1');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports one error when the source is neither valid JSON nor YAML', () => {
    const result = validateSpecSource('foo: [unclosed', 'openapi-3.1');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('not valid JSON or YAML');
    expect(result.warnings).toEqual([]);
  });

  it('reports the version gate as an error', () => {
    const result = validateSpecSource('swagger: "2.0"\ninfo:\n  title: Old\n  version: "1.0"\n', 'openapi-3.1');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Swagger 2.0');
  });

  it('reports a non-object document as an error', () => {
    const result = validateSpecSource('- just\n- a\n- list\n', 'openapi-3.1');
    expect(result.errors).toHaveLength(1);
  });

  it('surfaces report drops as warnings on a parseable document', () => {
    const result = validateSpecSource(
      'openapi: "3.1.0"\ninfo:\n  title: Empty API\n  version: "1.0.0"\n',
      'openapi-3.1',
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('paths');
  });

  it('graphql scaffold validates clean through the schema model', () => {
    const result = validateSpecSource(GRAPHQL_SDL_SCAFFOLD, 'graphql');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports a graphql syntax error and a build problem with their positions', () => {
    const syntax = validateSpecSource('type Query {', 'graphql');
    expect(syntax.errors).toHaveLength(1);
    expect(syntax.errors[0]).toMatch(/^1:\d+: /);
    const duplicate = validateSpecSource('type A { id: ID }\ntype A { id: ID }', 'graphql');
    expect(duplicate.errors).toEqual(['2:6: Type `A` is defined more than once.']);
  });

  it('reads a graphql introspection root and reports malformed JSON', () => {
    const good = validateSpecSource(
      JSON.stringify({ data: { __schema: { queryType: { name: 'Query' }, types: [], directives: [] } } }),
      'graphql',
    );
    expect(good.errors).toEqual([]);
    const bad = validateSpecSource('{ "data": ', 'graphql');
    expect(bad.errors).toHaveLength(1);
    expect(bad.errors[0]).toContain('Not valid JSON');
    const noSchema = validateSpecSource('{ "data": {} }', 'graphql');
    expect(noSchema.errors).toEqual(['Introspection: no `__schema` object in the response.']);
  });

  it('protobuf scaffold validates clean through the census parser', () => {
    const result = validateSpecSource(PROTO3_SCAFFOLD, 'protobuf');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports a protobuf structural failure with its position', () => {
    const result = validateSpecSource('message Broken {\n  string name = ;\n}\n', 'protobuf');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('line 2');
    expect(result.warnings).toEqual([]);
  });

  it('asyncapi scaffold validates clean through the census parser', () => {
    const result = validateSpecSource(ASYNCAPI_30_SCAFFOLD, 'asyncapi');
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('reports a non-AsyncAPI document as an error', () => {
    const result = validateSpecSource('openapi: 3.1.0\ninfo:\n  title: Not AsyncAPI\n', 'asyncapi');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('asyncapi');
    expect(result.warnings).toEqual([]);
  });

  it('surfaces asyncapi census issues as warnings', () => {
    const result = validateSpecSource(
      'asyncapi: 3.0.0\nchannels:\n  events:\n    messages:\n      lost:\n        $ref: "#/components/messages/Nope"\n',
      'asyncapi',
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('channels.events.messages.lost');
  });
});

describe('spec file syntax derivation', () => {
  it('derives language and label from the extension', () => {
    expect(specFileLanguage('index.yaml')).toBe('yaml');
    expect(specFileLanguage('index.yml')).toBe('yaml');
    expect(specFileLanguage('index.json')).toBe('json');
    expect(specFileLanguage('index.proto')).toBe('protobuf');
    expect(specFileLanguage('index.graphql')).toBe('graphql');
    expect(specFileLanguage('schema.gql')).toBe('graphql');
    expect(specFileSyntaxLabel('index.yaml')).toBe('YAML');
    expect(specFileSyntaxLabel('index.json')).toBe('JSON');
    expect(specFileSyntaxLabel('index.proto')).toBe('PROTO');
    expect(specFileSyntaxLabel('index.graphql')).toBe('SDL');
  });
});
