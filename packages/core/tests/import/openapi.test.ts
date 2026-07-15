/**
 * OpenAPI importer coverage.
 *
 * Sections mirror the parser's mapping scope: entry gate (versions,
 * JSON/YAML), document metadata, servers → {{baseUrl}}, paths ×
 * operations → requests, parameters (path/query/header/cookie),
 * tags → folders, $ref resolution, and the honest-note aggregates
 * for the slices that haven't landed yet.
 */

import { describe, expect, it } from 'vitest';
import { OpenApiParseError, parseOpenApi } from '../../src/import/openapi';

// ── Helpers ─────────────────────────────────────────────────────────

function doc(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Openheaders API', version: '1.2.0' },
    servers: [{ url: 'https://api.openheaders.io/v1' }],
    paths: {
      '/ping': {
        get: { operationId: 'ping', responses: {} },
      },
    },
    ...overrides,
  });
}

// ── Entry gate ─────────────────────────────────────────────────────

describe('parseOpenApi — entry gate', () => {
  it('throws OpenApiParseError on garbage input', () => {
    expect(() => parseOpenApi('{{{ not anything')).toThrow(OpenApiParseError);
  });

  it('throws on JSON that is not an OpenAPI document', () => {
    expect(() => parseOpenApi(JSON.stringify({ hello: 'world' }))).toThrow(OpenApiParseError);
  });

  it('refuses Swagger 2.0 by name', () => {
    expect(() => parseOpenApi(JSON.stringify({ swagger: '2.0', info: { title: 'Old' } }))).toThrow(
      /Swagger 2\.0 documents aren't supported yet/,
    );
  });

  it('accepts OpenAPI 3.1 documents', () => {
    const result = parseOpenApi(doc({ openapi: '3.1.0' }));
    expect(result.requests).toHaveLength(1);
  });

  it('parses YAML documents', () => {
    const yaml = [
      'openapi: 3.0.3',
      'info:',
      '  title: Openheaders API',
      '  version: 1.0.0',
      'servers:',
      '  - url: https://api.openheaders.io/v1',
      'paths:',
      '  /ping:',
      '    get:',
      '      operationId: ping',
    ].join('\n');
    const result = parseOpenApi(yaml);
    expect(result.collectionName).toBe('Openheaders API');
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].request.url).toBe('{{baseUrl}}/ping');
  });
});

// ── Document metadata ──────────────────────────────────────────────

describe('document metadata', () => {
  it('maps info.title / description / version onto the collection', () => {
    const result = parseOpenApi(doc({ info: { title: 'Openheaders API', description: 'HTTP bits.', version: '2.0' } }));
    expect(result.collectionName).toBe('Openheaders API');
    expect(result.collectionDescription).toBe('HTTP bits.\n\nAPI version: 2.0');
    expect(result.report.source).toBe('openapi');
  });

  it('falls back to a default collection name', () => {
    const result = parseOpenApi(doc({ info: {} }));
    expect(result.collectionName).toBe('Imported API');
  });

  it('reports a document without paths instead of importing silently nothing', () => {
    const result = parseOpenApi(doc({ paths: {} }));
    expect(result.requests).toHaveLength(0);
    expect(result.report.drops.some((d) => d.path === 'paths')).toBe(true);
  });
});

// ── Servers ────────────────────────────────────────────────────────

describe('servers → {{baseUrl}}', () => {
  it('mints the baseUrl collection variable from the first server', () => {
    const result = parseOpenApi(doc());
    expect(result.collectionVariables).toContainEqual({
      name: 'baseUrl',
      value: 'https://api.openheaders.io/v1',
      type: 'default',
    });
    expect(result.requests[0].request.url).toBe('{{baseUrl}}/ping');
  });

  it('substitutes server variables from their defaults with a transform', () => {
    const result = parseOpenApi(
      doc({
        servers: [
          {
            url: 'https://{tenant}.openheaders.io/{version}',
            variables: { tenant: { default: 'api' }, version: { enum: ['v1', 'v2'] } },
          },
        ],
      }),
    );
    expect(result.collectionVariables[0].value).toBe('https://api.openheaders.io/v1');
    expect(result.report.transforms.some((t) => t.path === 'servers[0]' && t.from.includes('{tenant}'))).toBe(true);
  });

  it('names additional servers in a transform', () => {
    const result = parseOpenApi(
      doc({ servers: [{ url: 'https://api.openheaders.io' }, { url: 'https://staging.openheaders.io' }] }),
    );
    const extra = result.report.transforms.find((t) => t.path === 'servers');
    expect(extra?.reason).toContain('https://staging.openheaders.io');
  });

  it('still mints an empty baseUrl when the document has no servers', () => {
    const result = parseOpenApi(doc({ servers: [] }));
    expect(result.collectionVariables[0]).toMatchObject({ name: 'baseUrl', value: '' });
    expect(result.report.transforms.some((t) => t.path === 'servers')).toBe(true);
  });

  it('pins operation-level servers literally with a transform', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/ping': { get: { servers: [{ url: 'https://other.openheaders.io' }] } },
        },
      }),
    );
    expect(result.requests[0].request.url).toBe('https://other.openheaders.io/ping');
    expect(result.report.transforms.some((t) => t.path === 'paths./ping.get.servers')).toBe(true);
  });
});

// ── Operations → requests ──────────────────────────────────────────

describe('operations → requests', () => {
  it('names requests from summary, then operationId, then METHOD /path', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/a': { get: { summary: 'List things', operationId: 'listThings' } },
          '/b': { post: { operationId: 'makeThing' } },
          '/c': { delete: {} },
        },
      }),
    );
    expect(result.requests.map((r) => r.request.name)).toEqual(['List things', 'makeThing', 'DELETE /c']);
    expect(result.requests.map((r) => r.request.method)).toEqual(['GET', 'POST', 'DELETE']);
  });

  it('carries operation descriptions and marks deprecated operations', () => {
    const result = parseOpenApi(
      doc({ paths: { '/old': { get: { description: 'Use /new instead.', deprecated: true } } } }),
    );
    expect(result.requests[0].request.description).toBe('Use /new instead.\n\nDeprecated.');
  });

  it('drops TRACE operations with a permanent reason', () => {
    const result = parseOpenApi(doc({ paths: { '/t': { trace: {}, get: {} } } }));
    expect(result.requests).toHaveLength(1);
    const drop = result.report.drops.find((d) => d.path === 'paths./t.trace');
    expect(drop?.tracking).toContain('PERMANENT');
  });

  it('rewrites path templating to variable references with a transform', () => {
    const result = parseOpenApi(doc({ paths: { '/users/{userId}/posts/{postId}': { get: {} } } }));
    expect(result.requests[0].request.url).toBe('{{baseUrl}}/users/{{userId}}/posts/{{postId}}');
    expect(result.report.transforms.some((t) => t.to === '/users/{{userId}}/posts/{{postId}}')).toBe(true);
  });
});

// ── Parameters ─────────────────────────────────────────────────────

describe('parameters', () => {
  it('maps query and header parameters to rows; optional ones land disabled', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/search': {
            get: {
              parameters: [
                { name: 'q', in: 'query', required: true, example: 'headers' },
                { name: 'limit', in: 'query', schema: { default: 25 } },
                { name: 'X-Trace', in: 'header', description: 'Trace id' },
              ],
            },
          },
        },
      }),
    );
    const request = result.requests[0].request;
    expect(request.params).toMatchObject([
      { key: 'q', value: 'headers' },
      { key: 'limit', value: '25', enabled: false },
    ]);
    expect(request.params[0].enabled).toBeUndefined();
    expect(request.headers).toMatchObject([{ key: 'X-Trace', value: '', description: 'Trace id', enabled: false }]);
  });

  it('merges path-level parameters under operation-level overrides', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/things': {
            parameters: [
              { name: 'limit', in: 'query', schema: { default: 10 } },
              { name: 'offset', in: 'query', schema: { default: 0 } },
            ],
            get: { parameters: [{ name: 'limit', in: 'query', schema: { default: 50 } }] },
          },
        },
      }),
    );
    const params = result.requests[0].request.params;
    expect(params.find((p) => p.key === 'limit')?.value).toBe('50');
    expect(params.find((p) => p.key === 'offset')?.value).toBe('0');
  });

  it('seeds collection variables from valued path parameters (first wins)', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/users/{userId}': {
            get: { parameters: [{ name: 'userId', in: 'path', required: true, example: 'u-123' }] },
            delete: { parameters: [{ name: 'userId', in: 'path', required: true, example: 'u-456' }] },
          },
        },
      }),
    );
    expect(result.collectionVariables).toContainEqual({ name: 'userId', value: 'u-123', type: 'default' });
  });

  it('aggregates cookie parameters into one permanent drop', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/a': { get: { parameters: [{ name: 'session', in: 'cookie' }] } },
          '/b': { get: { parameters: [{ name: 'csrftoken', in: 'cookie' }] } },
        },
      }),
    );
    const drop = result.report.drops.find((d) => d.path === 'paths[parameters in=cookie]');
    expect(drop?.reason).toContain('2 cookie parameters');
    expect(drop?.tracking).toBe('PERMANENT: cookies out of scope');
  });

  it('drops parameters without a usable name/in', () => {
    const result = parseOpenApi(doc({ paths: { '/a': { get: { parameters: [{ description: 'nameless' }] } } } }));
    expect(result.report.drops.some((d) => d.reason.includes('no usable `name`/`in`'))).toBe(true);
  });
});

// ── Tags → folders ─────────────────────────────────────────────────

describe('tags → folders', () => {
  it('files requests under their first tag and carries tag descriptions', () => {
    const result = parseOpenApi(
      doc({
        tags: [{ name: 'Users', description: 'User management' }],
        paths: {
          '/users': { get: { tags: ['Users'] } },
          '/ping': { get: {} },
        },
      }),
    );
    expect(result.folders).toEqual([{ path: ['Users'], description: 'User management' }]);
    expect(result.requests.find((r) => r.request.url.endsWith('/users'))?.folderPath).toEqual(['Users']);
    expect(result.requests.find((r) => r.request.url.endsWith('/ping'))?.folderPath).toEqual([]);
  });

  it('records a transform when additional tags cannot be represented', () => {
    const result = parseOpenApi(doc({ paths: { '/x': { get: { tags: ['Users', 'Admin'] } } } }));
    const transform = result.report.transforms.find((t) => t.path === 'paths./x.get.tags');
    expect(transform?.to).toBe('folder "Users"');
  });
});

// ── $ref resolution ────────────────────────────────────────────────

describe('$ref resolution', () => {
  it('resolves internal parameter refs from components', () => {
    const result = parseOpenApi(
      doc({
        components: {
          parameters: { Page: { name: 'page', in: 'query', schema: { default: 1 } } },
        },
        paths: { '/list': { get: { parameters: [{ $ref: '#/components/parameters/Page' }] } } },
      }),
    );
    expect(result.requests[0].request.params).toMatchObject([{ key: 'page', value: '1' }]);
  });

  it('drops external refs with the offline reason', () => {
    const result = parseOpenApi(doc({ paths: { '/a': { get: { parameters: [{ $ref: 'common.yaml#/Page' }] } } } }));
    expect(result.report.drops.some((d) => d.reason.includes('never fetches remote documents'))).toBe(true);
  });

  it('drops missing refs with a reason', () => {
    const result = parseOpenApi(
      doc({ paths: { '/a': { get: { parameters: [{ $ref: '#/components/parameters/Nope' }] } } } }),
    );
    expect(result.report.drops.some((d) => d.reason.includes('points at nothing'))).toBe(true);
  });

  it('drops circular refs instead of looping', () => {
    const result = parseOpenApi(
      doc({
        components: { parameters: { Loop: { $ref: '#/components/parameters/Loop' } } },
        paths: { '/a': { get: { parameters: [{ $ref: '#/components/parameters/Loop' }] } } },
      }),
    );
    expect(result.report.drops.some((d) => d.reason.includes('circular'))).toBe(true);
  });

  it('resolves path-item refs', () => {
    const result = parseOpenApi(
      doc({
        components: { pathItems: { Ping: { get: { operationId: 'ping' } } } },
        paths: { '/ping': { $ref: '#/components/pathItems/Ping' } },
      }),
    );
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].request.name).toBe('ping');
  });
});

// ── Honest notes for later slices ──────────────────────────────────

describe('todo notes for unlanded slices', () => {
  it('notes request bodies with their media types', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/users': {
            post: { requestBody: { content: { 'application/json': { schema: { type: 'object' } } } } },
          },
        },
      }),
    );
    const drop = result.report.drops.find((d) => d.tracking === '#todo-openapi-bodies');
    expect(drop?.reason).toContain('application/json');
  });

  it('notes document-level and per-operation security requirements', () => {
    const result = parseOpenApi(
      doc({
        security: [{ apiKey: [] }],
        paths: { '/a': { get: { security: [{ apiKey: [] }] } }, '/b': { get: {} } },
      }),
    );
    const drops = result.report.drops.filter((d) => d.tracking === '#todo-openapi-auth');
    expect(drops).toHaveLength(2);
    expect(drops.some((d) => d.path === 'security')).toBe(true);
    expect(drops.some((d) => d.reason.includes('1 operation declares'))).toBe(true);
  });

  it('aggregates response documentation into one note', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/a': { get: { responses: { '200': { description: 'ok' } } } },
          '/b': { get: { responses: { '200': { description: 'ok' } } } },
        },
      }),
    );
    const drop = result.report.drops.find((d) => d.tracking === '#todo-openapi-response-examples');
    expect(drop?.reason).toContain('2 operations');
  });

  it('drops callbacks and webhooks permanently', () => {
    const result = parseOpenApi(
      doc({
        webhooks: { newThing: { post: {} } },
        paths: { '/subscribe': { post: { callbacks: { onEvent: {} } } } },
      }),
    );
    expect(result.report.drops.find((d) => d.path === 'webhooks')?.tracking).toBe(
      'PERMANENT: server-initiated webhooks',
    );
    expect(result.report.drops.find((d) => d.path === 'paths[operations with callbacks]')?.tracking).toBe(
      'PERMANENT: server-initiated callbacks',
    );
  });
});

// ── Report bookkeeping ─────────────────────────────────────────────

describe('report bookkeeping', () => {
  it('counts imported requests and skeleton defaults', () => {
    const result = parseOpenApi(doc({ paths: { '/a': { get: {}, post: {} }, '/b': { put: {} } } }));
    expect(result.report.summary.imported).toBe(3);
    for (const { request } of result.requests) {
      expect(request.auth).toEqual({ type: 'none' });
      expect(request.body).toEqual({ type: 'none' });
    }
  });
});
