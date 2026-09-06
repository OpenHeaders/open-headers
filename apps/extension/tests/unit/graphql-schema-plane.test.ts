/**
 * The GraphQL schema plane's pure modules:
 *
 *   - `graphql-schema-source.ts` — the root text sniffs as SDL or an
 *     introspection result and reads into the model either way.
 *   - `use-graphql-schema.ts` — the introspection answer read off the
 *     HTTP snapshot the compile produced: a schema on a 200 envelope,
 *     the failure kinds otherwise (transport, HTTP status, a server's
 *     errors[], no `__schema`, a malformed result).
 *   - `GraphqlExplorer.tsx` — the one-way insertion text of a field.
 *   - `graphql-editor-services.ts` — the hover markdown per symbol.
 */

import { parseDocument, schemaFromSdl, symbolAt } from '@openheaders/core/graphql';
import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { fieldInsertionText } from '@openheaders/ui/workbench/components/graphql-request-editor/GraphqlExplorer';
import { hoverMarkdown } from '@openheaders/ui/workbench/components/graphql-request-editor/graphql-editor-services';
import {
  failureMessage,
  readIntrospectionSnapshot,
} from '@openheaders/ui/workbench/components/graphql-request-editor/use-graphql-schema';
import {
  graphqlSchemaSourceKind,
  readGraphqlSchemaSource,
} from '@openheaders/ui/workbench/components/specs/graphql-schema-source';
import { GRAPHQL_SDL_SCAFFOLD } from '@openheaders/ui/workbench/components/specs/spec-scaffold';
import { describe, expect, it } from 'vitest';

const SDL = `type Query {
  """The signed-in user."""
  viewer: User
  user(id: ID!, verbose: Boolean = false): User
  me: User @deprecated(reason: "Use viewer.")
  echo(text: String!): String!
}
type User { id: ID! name: String! }`;

const schema = (() => {
  const built = schemaFromSdl(SDL).schema;
  if (built === null) throw new Error('fixture schema');
  return built;
})();

function snapshot(overrides: Partial<ExecutedRequestSnapshot>): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/graphql',
    headers: [],
    body: '',
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 1,
    error: null,
    scriptResult: null,
    ...overrides,
  } as ExecutedRequestSnapshot;
}

describe('graphql schema source', () => {
  it('sniffs SDL against an introspection result and reads both into the model', () => {
    expect(graphqlSchemaSourceKind(GRAPHQL_SDL_SCAFFOLD)).toBe('sdl');
    expect(graphqlSchemaSourceKind('  { "data": {} }')).toBe('introspection');
    const sdl = readGraphqlSchemaSource(SDL);
    expect(sdl.kind).toBe('sdl');
    expect(sdl.result.schema?.queryType).toBe('Query');
    const bad = readGraphqlSchemaSource('{ nope');
    expect(bad.kind).toBe('introspection');
    expect(bad.result.schema).toBeNull();
    expect(bad.result.errors[0].message).toContain('Not valid JSON');
  });
});

describe('readIntrospectionSnapshot', () => {
  it('builds the schema from a 200 envelope and keeps the raw __schema for the cache', () => {
    const body = JSON.stringify({
      data: {
        __schema: {
          queryType: { name: 'Query' },
          types: [{ kind: 'OBJECT', name: 'Query', fields: [] }],
          directives: [],
        },
      },
    });
    const read = readIntrospectionSnapshot(snapshot({ body }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.result.schema?.queryType).toBe('Query');
    expect(read.introspection).toEqual({ __schema: expect.objectContaining({ queryType: { name: 'Query' } }) });
  });

  it('names each failure kind verbatim', () => {
    const transport = readIntrospectionSnapshot(snapshot({ status: 0, error: 'ECONNREFUSED 127.0.0.1:3000' }));
    expect(transport).toMatchObject({
      ok: false,
      failure: { kind: 'transport', message: 'ECONNREFUSED 127.0.0.1:3000' },
    });
    const http = readIntrospectionSnapshot(snapshot({ status: 403, statusText: 'Forbidden', body: 'nope' }));
    expect(http).toMatchObject({ ok: false, failure: { kind: 'http', status: 403 } });
    if (!http.ok) expect(failureMessage(http.failure)).toBe('HTTP 403 Forbidden');
    const refused = readIntrospectionSnapshot(
      snapshot({ body: JSON.stringify({ errors: [{ message: 'Introspection is disabled.' }] }) }),
    );
    expect(refused).toMatchObject({
      ok: false,
      failure: { kind: 'graphql-errors', messages: ['Introspection is disabled.'] },
    });
    expect(readIntrospectionSnapshot(snapshot({ body: '<html>' }))).toMatchObject({
      ok: false,
      failure: { kind: 'no-schema' },
    });
    expect(readIntrospectionSnapshot(snapshot({ body: '{"data":{"viewer":null}}' }))).toMatchObject({
      ok: false,
      failure: { kind: 'no-schema' },
    });
    const malformed = readIntrospectionSnapshot(snapshot({ body: '{"data":{"__schema":{"types":"x"}}}' }));
    expect(malformed).toMatchObject({ ok: false, failure: { kind: 'malformed' } });
    expect(readIntrospectionSnapshot(null)).toMatchObject({ ok: false, failure: { kind: 'transport' } });
  });
});

describe('fieldInsertionText', () => {
  it('inserts the name, the required arguments as variables, and an empty selection on a composite type', () => {
    const query = schema.types.get('Query');
    if (query === undefined || query.kind !== 'OBJECT') throw new Error('fixture');
    const field = (name: string) => query.fields.find((entry) => entry.name === name)!;
    expect(fieldInsertionText(field('viewer'), schema)).toBe('viewer { }');
    expect(fieldInsertionText(field('user'), schema)).toBe('user(id: $id) { }');
    expect(fieldInsertionText(field('echo'), schema)).toBe('echo(text: $text)');
  });
});

describe('hoverMarkdown', () => {
  it('renders the signature block, the description and the deprecation', () => {
    const document = parseDocument('{ me viewer user(id: "1") }').document!;
    const me = symbolAt(document, 3, schema);
    expect(me?.kind).toBe('field');
    if (me === null) return;
    const blocks = hoverMarkdown(me);
    expect(blocks[0]).toBe('```graphql\nQuery.me: User\n```');
    expect(blocks).toContain('**Deprecated**: Use viewer.');
    const viewer = symbolAt(document, 6, schema);
    if (viewer === null) return;
    expect(hoverMarkdown(viewer)).toEqual(['```graphql\nQuery.viewer: User\n```', 'The signed-in user.']);
    const id = symbolAt(document, '{ me viewer user('.length + 1, schema);
    expect(id?.kind).toBe('argument');
    if (id === null) return;
    expect(hoverMarkdown(id)[0]).toBe('```graphql\nid: ID!\n```');
  });
});
