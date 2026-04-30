/**
 * Postman v2.1 importer coverage.
 *
 * Sections mirror the parser's scope: collection metadata, folder
 * tree, per-request method/URL/header/body/auth mapping, drops +
 * transforms audit, realistic round-trip.
 */

import { describe, expect, it } from 'vitest';
import { PostmanParseError, parsePostman, parsePostmanEnvironment } from '../../src/import/postman';
import { stripUids } from './_kv-utils';

// ── Helpers ─────────────────────────────────────────────────────────

function postmanCollection(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    info: {
      name: 'Test Collection',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
    ...overrides,
  });
}

// ── JSON + schema validation ───────────────────────────────────────

describe('parsePostman — top-level errors', () => {
  it('throws PostmanParseError on invalid JSON', () => {
    expect(() => parsePostman('not json')).toThrow(PostmanParseError);
  });

  it('throws on non-object root', () => {
    expect(() => parsePostman('"just a string"')).toThrow(PostmanParseError);
  });

  it('accepts a minimal v2.1 collection', () => {
    const result = parsePostman(postmanCollection());
    expect(result.collectionName).toBe('Test Collection');
    expect(result.requests).toEqual([]);
    expect(result.folders).toEqual([]);
  });

  it('defaults the collection name when info.name is empty', () => {
    const result = parsePostman(JSON.stringify({ info: { name: '', schema: '...' }, item: [] }));
    expect(result.collectionName).toBe('Imported Collection');
  });

  it('tolerates absence of info.schema (legacy v2.0 or v1 exports)', () => {
    const result = parsePostman(JSON.stringify({ info: { name: 'Old Collection' }, item: [] }));
    expect(result.collectionName).toBe('Old Collection');
  });
});

// ── Collection-level ───────────────────────────────────────────────

describe('collection metadata', () => {
  it('captures description (string form)', () => {
    const result = parsePostman(
      postmanCollection({
        info: {
          name: 'N',
          description: 'A description.',
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
      }),
    );
    expect(result.collectionDescription).toBe('A description.');
  });

  it('captures description (object form)', () => {
    const result = parsePostman(
      postmanCollection({
        info: {
          name: 'N',
          description: { content: 'Inside object.' },
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
      }),
    );
    expect(result.collectionDescription).toBe('Inside object.');
  });

  it('extracts collection variables as default-type V5 variables', () => {
    const result = parsePostman(
      postmanCollection({
        variable: [
          { key: 'baseUrl', value: 'https://api.openheaders.io', type: 'string' },
          { key: 'apiVersion', value: 'v1' },
          { key: '', value: 'empty key is dropped' },
        ],
      }),
    );
    expect(result.collectionVariables).toHaveLength(2);
    expect(result.collectionVariables[0]).toEqual({
      name: 'baseUrl',
      value: 'https://api.openheaders.io',
      type: 'default',
      description: undefined,
    });
  });

  it('drops collection-level events with tracking', () => {
    const result = parsePostman(
      postmanCollection({
        event: [
          { listen: 'prerequest', script: { exec: ['console.log("hi")'] } },
          { listen: 'test', script: { exec: ['pm.test("ok")'] } },
        ],
      }),
    );
    expect(result.report.drops.filter((d) => d.path.includes('collection.event'))).toHaveLength(2);
    expect(result.report.drops.every((d) => d.tracking === '#todo-scripts')).toBe(true);
  });

  it('flags ignored collection-level auth as a transform', () => {
    const result = parsePostman(
      postmanCollection({
        auth: { type: 'bearer', bearer: [{ key: 'token', value: 'xyz' }] },
      }),
    );
    const t = result.report.transforms.find((t) => t.path === 'collection.auth');
    expect(t).toBeDefined();
    expect(t?.to).toBe('ignored');
  });
});

// ── Folder tree ────────────────────────────────────────────────────

describe('folder tree', () => {
  it('records each folder path (root → leaf)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'Auth',
            item: [
              { name: 'Login', request: { method: 'POST', url: 'https://api.openheaders.io/login' } },
              {
                name: 'SSO',
                item: [{ name: 'Google', request: { method: 'POST', url: 'https://api.openheaders.io/sso/google' } }],
              },
            ],
          },
        ],
      }),
    );
    expect(result.folders.map((f) => f.path)).toEqual([['Auth'], ['Auth', 'SSO']]);
  });

  it('attaches requests to their parent folder path', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'Users',
            item: [{ name: 'Get', request: { method: 'GET', url: 'https://api.openheaders.io/users' } }],
          },
          { name: 'Ping', request: { method: 'GET', url: 'https://api.openheaders.io/ping' } },
        ],
      }),
    );
    expect(result.requests).toHaveLength(2);
    const users = result.requests.find((r) => r.request.name === 'Get');
    const ping = result.requests.find((r) => r.request.name === 'Ping');
    expect(users?.folderPath).toEqual(['Users']);
    expect(ping?.folderPath).toEqual([]);
  });

  it('defaults empty folder names to "Untitled Folder"', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: '', item: [{ name: 'R', request: { method: 'GET', url: 'https://api.openheaders.io/x' } }] }],
      }),
    );
    expect(result.folders[0]?.path).toEqual(['Untitled Folder']);
  });
});

// ── Per-request mapping ────────────────────────────────────────────

describe('request mapping — method + URL', () => {
  it('passes through method verbatim', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', request: { method: 'patch', url: 'https://api.openheaders.io/x' } }],
      }),
    );
    expect(result.requests[0]?.request.method).toBe('PATCH');
  });

  it('defaults missing method to GET with drop', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', request: { url: 'https://api.openheaders.io/x' } }],
      }),
    );
    expect(result.requests[0]?.request.method).toBe('GET');
    expect(result.report.drops.some((d) => d.path.endsWith('.method'))).toBe(true);
  });

  it('defaults unknown method to GET with drop', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', request: { method: 'FOO', url: 'https://api.openheaders.io/x' } }],
      }),
    );
    expect(result.requests[0]?.request.method).toBe('GET');
    expect(result.report.drops.some((d) => /Unknown HTTP method "FOO"/.test(d.reason))).toBe(true);
  });

  it('uses url.raw when present', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.openheaders.io/things?a=1',
                protocol: 'https',
                host: ['api', 'openheaders', 'io'],
                path: ['things'],
                query: [{ key: 'a', value: '1' }],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io/things');
    expect(stripUids(result.requests[0]!.request.params)).toEqual([{ key: 'a', value: '1' }]);
  });

  it('builds from structured parts when raw is missing', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: {
                protocol: 'https',
                host: ['api', 'openheaders', 'io'],
                path: ['v1', 'things'],
                query: [{ key: 'k', value: 'v' }],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io/v1/things');
    expect(stripUids(result.requests[0]!.request.params)).toEqual([{ key: 'k', value: 'v' }]);
  });

  it('substitutes :path variables with url.variable values', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: {
                raw: 'https://api.openheaders.io/users/:id/posts/:postId',
                variable: [
                  { key: 'id', value: '42' },
                  { key: 'postId', value: '99' },
                ],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io/users/42/posts/99');
  });

  it('accepts string-shorthand request (GET <url>)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', request: 'https://api.openheaders.io/ping?q=1' }],
      }),
    );
    const r = result.requests[0]!.request;
    expect(r.method).toBe('GET');
    expect(r.url).toBe('https://api.openheaders.io/ping');
    expect(stripUids(r.params)).toEqual([{ key: 'q', value: '1' }]);
  });
});

describe('request mapping — headers', () => {
  it('maps enabled + disabled headers', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              header: [
                { key: 'X-Trace', value: 'abc' },
                { key: 'X-Off', value: 'ignored', disabled: true },
              ],
            },
          },
        ],
      }),
    );
    const headers = stripUids(result.requests[0]!.request.headers);
    expect(headers).toContainEqual({ key: 'X-Trace', value: 'abc' });
    expect(headers).toContainEqual({ key: 'X-Off', value: 'ignored', enabled: false });
  });
});

describe('request mapping — auth', () => {
  it('promotes explicit basic auth', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'basic',
                basic: [
                  { key: 'username', value: 'alice' },
                  { key: 'password', value: 'hunter2' },
                ],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({
      type: 'basic',
      username: 'alice',
      password: 'hunter2',
    });
  });

  it('promotes bearer auth', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: { type: 'bearer', bearer: [{ key: 'token', value: 'abc.def' }] },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({ type: 'bearer', token: 'abc.def' });
  });

  it('promotes apikey (header)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'apikey',
                apikey: [
                  { key: 'key', value: 'X-API-Key' },
                  { key: 'value', value: 'abc' },
                  { key: 'in', value: 'header' },
                ],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({
      type: 'api-key',
      key: 'X-API-Key',
      value: 'abc',
      in: 'header',
    });
  });

  it('promotes apikey (query)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'apikey',
                apikey: [
                  { key: 'key', value: 'api_key' },
                  { key: 'value', value: 'xyz' },
                  { key: 'in', value: 'query' },
                ],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({
      type: 'api-key',
      key: 'api_key',
      value: 'xyz',
      in: 'query',
    });
  });

  it('promotes Authorization: Bearer header when no explicit auth', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              header: [{ key: 'Authorization', value: 'Bearer abc.def' }],
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({ type: 'bearer', token: 'abc.def' });
    expect(result.requests[0]?.request.headers.find((h) => h.key === 'Authorization')).toBeUndefined();
  });

  it('drops oauth2 with tracking', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: { type: 'oauth2' },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => /OAuth 2\.0/.test(d.reason))).toBe(true);
    expect(result.report.drops.some((d) => d.tracking === '#todo-oauth')).toBe(true);
  });

  it('drops awsv4 with tracking', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: { type: 'awsv4' },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => /AWS Signature v4/.test(d.reason))).toBe(true);
  });

  it('drops digest / hawk / ntlm / edgegrid / oauth1', () => {
    for (const t of ['digest', 'hawk', 'ntlm', 'edgegrid', 'oauth1']) {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                auth: { type: t },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.auth).toEqual({ type: 'none' });
      expect(result.report.drops.some((d) => new RegExp(`${t} auth not imported`).test(d.reason))).toBe(true);
    }
  });
});

describe('request mapping — body', () => {
  it('maps raw/json', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: { mode: 'raw', raw: '{"k":"v"}', options: { raw: { language: 'json' } } },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'json', content: '{"k":"v"}' });
  });

  it('maps raw/xml', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: { mode: 'raw', raw: '<root/>', options: { raw: { language: 'xml' } } },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'xml', content: '<root/>' });
  });

  it('maps raw/graphql', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/graphql',
              body: {
                mode: 'raw',
                raw: 'query { ping }',
                options: { raw: { language: 'graphql' } },
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'graphql', content: 'query { ping }' });
  });

  it('falls back to Content-Type inference when raw language is absent', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              header: [{ key: 'Content-Type', value: 'application/json' }],
              body: { mode: 'raw', raw: '{"a":1}' },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'json', content: '{"a":1}' });
  });

  it('transforms raw/html to text with a tracked transform', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: { mode: 'raw', raw: '<html></html>', options: { raw: { language: 'html' } } },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'text', content: '<html></html>' });
    expect(result.report.transforms.some((t) => /raw\/html/.test(t.from))).toBe(true);
  });

  it('maps urlencoded body', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: {
                mode: 'urlencoded',
                urlencoded: [
                  { key: 'a', value: '1' },
                  { key: 'b', value: 'two words' },
                  { key: 'c', value: 'disabled', disabled: true },
                ],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({
      type: 'form',
      formParts: [
        { key: 'a', value: '1', enabled: undefined, description: undefined },
        { key: 'b', value: 'two words', enabled: undefined, description: undefined },
        { key: 'c', value: 'disabled', enabled: false, description: undefined },
      ],
    });
  });

  it('maps graphql body with variables', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/graphql',
              body: {
                mode: 'graphql',
                graphql: { query: 'query { foo }', variables: '{"x":1}' },
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({
      type: 'graphql',
      content: 'query { foo }',
      graphqlVariables: '{"x":1}',
    });
  });

  it('reconciles formdata text + file parts into multipart with placeholder FileRefs', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: {
                mode: 'formdata',
                formdata: [
                  { key: 'name', value: 'alice', type: 'text' },
                  { key: 'avatar', type: 'file', src: '/tmp/pic.png' },
                ],
              },
            },
          },
        ],
      }),
    );
    const body = result.requests[0]?.request.body;
    expect(body?.type).toBe('multipart');
    if (body?.type !== 'multipart') throw new Error('expected multipart body');
    expect(body.multipartParts).toEqual([
      { kind: 'text', name: 'name', value: 'alice' },
      {
        kind: 'file',
        name: 'avatar',
        fileRefs: [
          {
            fileId: expect.stringMatching(/^placeholder:/),
            hash: expect.stringMatching(/^placeholder:/),
            filename: 'pic.png',
            mimeType: undefined,
            size: 0,
          },
        ],
      },
    ]);
    expect(
      result.report.transforms.some(
        (t) => t.to === 'multipart with placeholder FileRefs' && t.tracking === '#todo-file-blobs',
      ),
    ).toBe(true);
  });

  it('reconciles file-mode body into a single-part multipart placeholder', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: { mode: 'file', file: { src: '/tmp/x.bin' } },
            },
          },
        ],
      }),
    );
    const body = result.requests[0]?.request.body;
    expect(body?.type).toBe('multipart');
    if (body?.type !== 'multipart') throw new Error('expected multipart body');
    expect(body.multipartParts).toEqual([
      {
        kind: 'file',
        name: 'file',
        fileRefs: [
          {
            fileId: expect.stringMatching(/^placeholder:/),
            hash: expect.stringMatching(/^placeholder:/),
            filename: 'x.bin',
            mimeType: undefined,
            size: 0,
          },
        ],
      },
    ]);
    expect(
      result.report.transforms.some((t) => t.from === 'file (raw binary body)' && t.tracking === '#todo-file-blobs'),
    ).toBe(true);
  });

  it('drops binary-mode body with tracking', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: { mode: 'binary' },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => /Binary body/.test(d.reason))).toBe(true);
  });

  it('returns none for disabled body', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'POST',
              url: 'https://api.openheaders.io/x',
              body: { mode: 'raw', raw: '{}', disabled: true },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.body).toEqual({ type: 'none' });
  });
});

describe('events (scripts)', () => {
  it('drops per-request scripts with tracking', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            event: [
              { listen: 'prerequest', script: { exec: ['pm.request.headers.add(...)'] } },
              { listen: 'test', script: { exec: ['pm.test(...)'] } },
            ],
          },
        ],
      }),
    );
    const scriptDrops = result.report.drops.filter((d) => d.tracking === '#todo-scripts');
    expect(scriptDrops).toHaveLength(2);
  });

  it('ignores disabled events', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            event: [{ listen: 'prerequest', script: { exec: ['x'] }, disabled: true }],
          },
        ],
      }),
    );
    expect(result.report.drops.some((d) => d.tracking === '#todo-scripts')).toBe(false);
  });
});

describe('summary counting', () => {
  it('summary.imported reflects the number of successfully-mapped requests', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          { name: 'A', request: { method: 'GET', url: 'https://api.openheaders.io/a' } },
          { name: 'B', request: { method: 'POST', url: 'https://api.openheaders.io/b' } },
          {
            name: 'Folder',
            item: [{ name: 'C', request: { method: 'DELETE', url: 'https://api.openheaders.io/c' } }],
          },
        ],
      }),
    );
    expect(result.report.summary.imported).toBe(3);
  });

  it('skips items with no `request` field (non-folder) and logs a drop', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          { name: 'A', request: { method: 'GET', url: 'https://api.openheaders.io/a' } },
          { name: 'Broken' /* no request, no item */ },
        ],
      }),
    );
    expect(result.requests).toHaveLength(1);
    expect(result.report.drops.some((d) => /has no `request`/.test(d.reason))).toBe(true);
  });
});

// ── Environment importer ───────────────────────────────────────────

describe('parsePostmanEnvironment', () => {
  it('throws on invalid JSON', () => {
    expect(() => parsePostmanEnvironment('garbage')).toThrow(PostmanParseError);
  });

  it('throws when _postman_variable_scope is not "environment"', () => {
    expect(() =>
      parsePostmanEnvironment(JSON.stringify({ name: 'X', values: [], _postman_variable_scope: 'globals' })),
    ).toThrow(PostmanParseError);
  });

  it('accepts a scope-less export (legacy Postman)', () => {
    const r = parsePostmanEnvironment(
      JSON.stringify({ name: 'staging', values: [{ key: 'API_URL', value: 'https://api' }] }),
    );
    expect(r.name).toBe('staging');
    expect(r.variables).toHaveLength(1);
  });

  it('maps default + secret variable types', () => {
    const r = parsePostmanEnvironment(
      JSON.stringify({
        name: 'Prod',
        _postman_variable_scope: 'environment',
        values: [
          { key: 'baseUrl', value: 'https://api.openheaders.io', type: 'default', enabled: true },
          { key: 'apiKey', value: 'abc123', type: 'secret', enabled: true },
          { key: 'port', value: '443', type: 'any', enabled: true },
        ],
      }),
    );
    expect(r.variables).toEqual([
      { name: 'baseUrl', value: 'https://api.openheaders.io', type: 'default', description: undefined },
      { name: 'apiKey', value: 'abc123', type: 'secret', description: undefined },
      { name: 'port', value: '443', type: 'default', description: undefined },
    ]);
  });

  it('drops disabled variables with tracking', () => {
    const r = parsePostmanEnvironment(
      JSON.stringify({
        name: 'E',
        _postman_variable_scope: 'environment',
        values: [
          { key: 'a', value: '1', enabled: true },
          { key: 'b', value: '2', enabled: false },
        ],
      }),
    );
    expect(r.variables).toHaveLength(1);
    expect(r.variables[0]?.name).toBe('a');
    expect(r.report.drops.some((d) => /disabled/.test(d.reason))).toBe(true);
  });

  it('drops variables with no key', () => {
    const r = parsePostmanEnvironment(
      JSON.stringify({
        name: 'E',
        _postman_variable_scope: 'environment',
        values: [
          { key: '', value: '1' },
          { key: '   ', value: '2' },
          { key: 'ok', value: '3' },
        ],
      }),
    );
    expect(r.variables).toHaveLength(1);
    expect(r.report.drops).toHaveLength(2);
  });

  it('coerces non-string values (e.g., numeric)', () => {
    const r = parsePostmanEnvironment(
      JSON.stringify({
        name: 'E',
        _postman_variable_scope: 'environment',
        values: [{ key: 'PORT', value: 8080 }],
      }),
    );
    expect(r.variables[0]).toEqual({ name: 'PORT', value: '8080', type: 'default', description: undefined });
  });

  it('defaults missing name', () => {
    const r = parsePostmanEnvironment(JSON.stringify({ _postman_variable_scope: 'environment', values: [] }));
    expect(r.name).toBe('Imported Environment');
  });

  it('summary.imported reflects variables landed', () => {
    const r = parsePostmanEnvironment(
      JSON.stringify({
        name: 'E',
        _postman_variable_scope: 'environment',
        values: [
          { key: 'a', value: '1' },
          { key: 'b', value: '2' },
          { key: 'c', value: '3', enabled: false },
        ],
      }),
    );
    expect(r.report.summary.imported).toBe(2);
    expect(r.report.summary.dropped).toBe(1);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────

describe('edge cases', () => {
  describe('empty / minimal inputs', () => {
    it('accepts a collection with zero items', () => {
      const result = parsePostman(postmanCollection({ item: [] }));
      expect(result.requests).toEqual([]);
      expect(result.folders).toEqual([]);
      expect(result.report.summary.imported).toBe(0);
    });

    it('accepts a folder with zero items (still records the folder)', () => {
      const result = parsePostman(
        postmanCollection({
          item: [{ name: 'Empty Folder', item: [] }],
        }),
      );
      expect(result.folders.map((f) => f.path)).toEqual([['Empty Folder']]);
      expect(result.requests).toEqual([]);
    });

    it('accepts a minimal GET request with no headers/body/auth', () => {
      const result = parsePostman(
        postmanCollection({
          item: [{ name: 'Bare', request: { method: 'GET', url: 'https://api.openheaders.io/x' } }],
        }),
      );
      expect(result.requests[0]?.request).toMatchObject({
        name: 'Bare',
        method: 'GET',
        url: 'https://api.openheaders.io/x',
        headers: [],
        params: [],
        auth: { type: 'none' },
        body: { type: 'none' },
      });
    });
  });

  describe('unicode + special chars', () => {
    it('preserves unicode in collection, folder, and request names', () => {
      const result = parsePostman(
        postmanCollection({
          info: {
            name: '🚀 Émoji Collection',
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
          },
          item: [
            {
              name: 'Autorización',
              item: [
                {
                  name: 'ログイン',
                  request: { method: 'POST', url: 'https://api.openheaders.io/ログイン' },
                },
              ],
            },
          ],
        }),
      );
      expect(result.collectionName).toBe('🚀 Émoji Collection');
      expect(result.folders[0]?.path).toEqual(['Autorización']);
      expect(result.requests[0]?.request.name).toBe('ログイン');
      expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io/ログイン');
    });

    it('preserves special characters in header values', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                header: [
                  { key: 'X-Special', value: 'foo: bar; baz=qux' },
                  { key: 'X-Quoted', value: '"quoted-value"' },
                ],
              },
            },
          ],
        }),
      );
      const headers = stripUids(result.requests[0]!.request.headers);
      expect(headers).toContainEqual({ key: 'X-Special', value: 'foo: bar; baz=qux' });
      expect(headers).toContainEqual({ key: 'X-Quoted', value: '"quoted-value"' });
    });
  });

  describe('deeply nested folders', () => {
    it('handles 5-level nesting', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'L1',
              item: [
                {
                  name: 'L2',
                  item: [
                    {
                      name: 'L3',
                      item: [
                        {
                          name: 'L4',
                          item: [
                            {
                              name: 'L5',
                              item: [
                                {
                                  name: 'Leaf',
                                  request: { method: 'GET', url: 'https://api.openheaders.io/leaf' },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      );
      expect(result.folders.map((f) => f.path)).toEqual([
        ['L1'],
        ['L1', 'L2'],
        ['L1', 'L2', 'L3'],
        ['L1', 'L2', 'L3', 'L4'],
        ['L1', 'L2', 'L3', 'L4', 'L5'],
      ]);
      expect(result.requests[0]?.folderPath).toEqual(['L1', 'L2', 'L3', 'L4', 'L5']);
    });
  });

  describe('duplicate folder names', () => {
    it('treats same-named folders at different depths as distinct paths', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'Auth',
              item: [
                {
                  name: 'Login',
                  item: [{ name: 'R', request: { method: 'GET', url: 'https://api.openheaders.io/1' } }],
                },
              ],
            },
            {
              name: 'Login', // same name as a sub-folder of Auth, but root-level
              item: [{ name: 'R', request: { method: 'GET', url: 'https://api.openheaders.io/2' } }],
            },
          ],
        }),
      );
      const paths = result.folders.map((f) => f.path);
      // Three distinct folder paths: Auth, Auth/Login, Login.
      expect(paths).toContainEqual(['Auth']);
      expect(paths).toContainEqual(['Auth', 'Login']);
      expect(paths).toContainEqual(['Login']);
      expect(result.requests).toHaveLength(2);
    });
  });

  describe('auth parameter shapes', () => {
    it('accepts object-form auth params (pre-v2.1 shape)', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                auth: {
                  type: 'basic',
                  basic: { username: 'alice', password: 'secret' } as unknown as Array<{
                    key?: string;
                    value?: string;
                  }>,
                },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.auth).toEqual({
        type: 'basic',
        username: 'alice',
        password: 'secret',
      });
    });

    it('defaults missing apikey `in` to header', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                auth: {
                  type: 'apikey',
                  apikey: [
                    { key: 'key', value: 'X-Key' },
                    { key: 'value', value: 'v' },
                    // no `in`
                  ],
                },
              },
            },
          ],
        }),
      );
      const auth = result.requests[0]?.request.auth;
      expect(auth).toBeDefined();
      expect(auth?.type).toBe('api-key');
      if (auth?.type === 'api-key') expect(auth.in).toBe('header');
    });

    it('ignores an empty Authorization header without promoting auth', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                header: [{ key: 'Authorization', value: '' }],
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.auth).toEqual({ type: 'none' });
      // Empty auth header stays in the list so the user can edit it.
      expect(stripUids(result.requests[0]!.request.headers)).toContainEqual({ key: 'Authorization', value: '' });
    });
  });

  describe('URL edge cases', () => {
    it('handles URL with only query (no path)', () => {
      const result = parsePostman(
        postmanCollection({
          item: [{ name: 'X', request: { method: 'GET', url: 'https://api.openheaders.io?q=1&r=2' } }],
        }),
      );
      expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io');
      expect(stripUids(result.requests[0]!.request.params)).toEqual([
        { key: 'q', value: '1' },
        { key: 'r', value: '2' },
      ]);
    });

    it('drops URL fragment', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: { method: 'GET', url: 'https://api.openheaders.io/x?q=1#anchor' },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io/x');
      expect(stripUids(result.requests[0]!.request.params)).toEqual([{ key: 'q', value: '1' }]);
    });

    it('preserves {{var}} references in URL verbatim', () => {
      const result = parsePostman(
        postmanCollection({
          item: [{ name: 'X', request: { method: 'GET', url: '{{baseUrl}}/users?token={{token}}' } }],
        }),
      );
      // URL portion of raw stays as-is (flat {{var}} flows through).
      expect(result.requests[0]?.request.url).toBe('{{baseUrl}}/users');
      expect(stripUids(result.requests[0]!.request.params)).toEqual([{ key: 'token', value: '{{token}}' }]);
    });

    it('does not substitute :xxx when no url.variable entry matches', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: { raw: 'https://api.openheaders.io/users/:id', variable: [] },
              },
            },
          ],
        }),
      );
      // Without a matching variable, the :id placeholder stays. The
      // editor will then surface it via the resolver's error-as-spec.
      expect(result.requests[0]?.request.url).toBe('https://api.openheaders.io/users/:id');
    });
  });

  describe('malformed inputs tolerated', () => {
    it('skips items that are not objects', () => {
      const result = parsePostman(
        postmanCollection({
          item: [null, 'bogus', 42, { name: 'OK', request: { method: 'GET', url: 'https://api.openheaders.io/x' } }],
        }),
      );
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0]?.request.name).toBe('OK');
    });

    it('handles missing header key (silently drops it)', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                header: [{ value: 'no-key' }, { key: '   ' }, { key: 'Valid', value: 'v' }],
              },
            },
          ],
        }),
      );
      expect(stripUids(result.requests[0]!.request.headers)).toEqual([{ key: 'Valid', value: 'v' }]);
    });

    it('handles non-string body.raw by treating as none', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'POST',
                url: 'https://api.openheaders.io/x',
                body: {
                  mode: 'raw',
                  raw: null as unknown as string,
                  options: { raw: { language: 'json' } },
                },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.body).toEqual({ type: 'none' });
    });
  });

  describe('scale', () => {
    it('handles a collection with 200 requests without issue', () => {
      const requests = Array.from({ length: 200 }, (_, i) => ({
        name: `req-${i}`,
        request: { method: 'GET' as const, url: `https://api.openheaders.io/${i}` },
      }));
      const result = parsePostman(postmanCollection({ item: requests }));
      expect(result.requests).toHaveLength(200);
      expect(result.report.summary.imported).toBe(200);
    });

    it('handles 100 collection variables', () => {
      const variable = Array.from({ length: 100 }, (_, i) => ({ key: `v${i}`, value: String(i) }));
      const result = parsePostman(postmanCollection({ variable }));
      expect(result.collectionVariables).toHaveLength(100);
    });
  });

  describe('body.raw content-type inference', () => {
    it('infers XML from text/xml header', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'POST',
                url: 'https://api.openheaders.io/x',
                header: [{ key: 'Content-Type', value: 'text/xml' }],
                body: { mode: 'raw', raw: '<x/>' },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.body).toEqual({ type: 'xml', content: '<x/>' });
    });

    it('infers form from application/x-www-form-urlencoded header', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'POST',
                url: 'https://api.openheaders.io/x',
                header: [{ key: 'Content-Type', value: 'application/x-www-form-urlencoded' }],
                body: { mode: 'raw', raw: 'k=v' },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.body).toEqual({
        type: 'form',
        formParts: [{ key: 'k', value: 'v' }],
      });
    });

    it('falls back to text when no hints are present', () => {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'POST',
                url: 'https://api.openheaders.io/x',
                body: { mode: 'raw', raw: 'plain body' },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.body).toEqual({ type: 'text', content: 'plain body' });
    });
  });
});

// ── Realistic round-trip ───────────────────────────────────────────

describe('realistic round-trip (authentic Postman export)', () => {
  it('parses a multi-folder, multi-auth collection end-to-end', () => {
    const input = JSON.stringify({
      info: {
        _postman_id: 'abc',
        name: 'Openheaders API',
        description: 'Smoke-test collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: [
        {
          name: 'Auth',
          item: [
            {
              name: 'Login',
              request: {
                method: 'POST',
                url: {
                  raw: 'https://api.openheaders.io/auth/login',
                  protocol: 'https',
                  host: ['api', 'openheaders', 'io'],
                  path: ['auth', 'login'],
                },
                header: [{ key: 'Content-Type', value: 'application/json' }],
                body: {
                  mode: 'raw',
                  raw: '{"email":"{{email}}","password":"{{password}}"}',
                  options: { raw: { language: 'json' } },
                },
              },
              event: [
                {
                  listen: 'test',
                  script: { exec: ['pm.environment.set("token", pm.response.json().token)'] },
                },
              ],
            },
          ],
        },
        {
          name: 'Users',
          item: [
            {
              name: 'Me',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/users/me',
                auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}' }] },
              },
            },
            {
              name: 'Get by id',
              request: {
                method: 'GET',
                url: {
                  raw: 'https://api.openheaders.io/users/:id',
                  variable: [{ key: 'id', value: '42' }],
                },
              },
            },
          ],
        },
        {
          name: 'Ping',
          request: { method: 'GET', url: 'https://api.openheaders.io/ping' },
        },
      ],
      variable: [{ key: 'baseUrl', value: 'https://api.openheaders.io' }],
    });

    const result = parsePostman(input);

    expect(result.collectionName).toBe('Openheaders API');
    expect(result.collectionDescription).toBe('Smoke-test collection');
    expect(result.collectionVariables).toHaveLength(1);
    expect(result.folders.map((f) => f.path)).toEqual([['Auth'], ['Users']]);
    expect(result.requests.map((r) => r.request.name)).toEqual(['Login', 'Me', 'Get by id', 'Ping']);

    const login = result.requests[0]!;
    expect(login.folderPath).toEqual(['Auth']);
    expect(login.request.method).toBe('POST');
    expect(login.request.body.type).toBe('json');

    const me = result.requests[1]!;
    expect(me.folderPath).toEqual(['Users']);
    expect(me.request.auth).toEqual({ type: 'bearer', token: '{{token}}' });

    const byId = result.requests[2]!;
    expect(byId.request.url).toBe('https://api.openheaders.io/users/42');

    const ping = result.requests[3]!;
    expect(ping.folderPath).toEqual([]);

    // One drop per script — the Login test script.
    expect(result.report.drops.filter((d) => d.tracking === '#todo-scripts')).toHaveLength(1);
    // imported count reflects all 4 successful mappings.
    expect(result.report.summary.imported).toBe(4);
  });
});
