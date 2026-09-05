/**
 * The graphql body variant's operation pick on disk — `operationName`
 * stays on the manifest (the query fans out to body.graphql, the
 * variables to variables.json) and round-trips through parse.
 */

import { describe, expect, it } from 'vitest';
import { parseRequest, serializeRequest } from '../../src/codec/yaml';
import { freshDocument } from '../../src/schemas/document';
import type { Request } from '../../src/types';

const request = (operationName?: string): Request => ({
  schemaVersion: 5,
  uid: 'rqst0001',
  path: 'requests/users-rqst0001',
  name: 'Users',
  method: 'POST',
  url: 'https://api.openheaders.io/graphql',
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: {
    type: 'graphql',
    content: 'query A { a } query B { b }',
    graphqlVariables: '{"x": 1}',
    ...(operationName !== undefined ? { operationName } : {}),
  },
});

describe('graphql body codec — operationName', () => {
  it('writes the pick on the manifest beside the fanned-out siblings', () => {
    const out = serializeRequest(freshDocument(request('B')));
    expect(out.requestYaml).toContain('operationName: B');
    expect(out.bodyFile).toEqual({ fileName: 'body.graphql', content: 'query A { a } query B { b }' });
    expect(out.variablesFile).toEqual({ fileName: 'variables.json', content: '{"x": 1}' });
  });

  it('omits the key when no pick is stored', () => {
    expect(serializeRequest(freshDocument(request())).requestYaml).not.toContain('operationName');
  });

  it('round-trips through parse', () => {
    const out = serializeRequest(freshDocument(request('B')));
    const parsed = parseRequest(out.requestYaml, {
      path: 'requests/users-rqst0001',
      siblings: [out.bodyFile, out.variablesFile].flatMap((file) => (file === null ? [] : [file])),
    });
    expect(parsed.value.body).toEqual({
      type: 'graphql',
      content: 'query A { a } query B { b }',
      graphqlVariables: '{"x": 1}',
      operationName: 'B',
    });
  });
});
