/**
 * OpenAPI importer coverage.
 *
 * Sections mirror the parser's mapping scope: entry gate (versions,
 * JSON/YAML), document metadata, servers → {{baseUrl}}, paths ×
 * operations → requests, parameters (path/query/header/cookie),
 * tags → folders, $ref resolution, request bodies (examples +
 * schema scaffolds), security schemes → auth arms, documented
 * responses → Response Example payloads, and the permanent drops.
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

  it('derives the spec format from the version field', () => {
    expect(parseOpenApi(doc()).specFormat).toBe('openapi-3.0');
    expect(parseOpenApi(doc({ openapi: '3.1.0' })).specFormat).toBe('openapi-3.1');
    expect(parseOpenApi(doc({ openapi: '3.2.0' })).specFormat).toBe('openapi-3.1');
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

// ── Request bodies ─────────────────────────────────────────────────

describe('request bodies', () => {
  it('imports a concrete JSON example verbatim (structured values pretty-print)', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/users': {
            post: {
              requestBody: { content: { 'application/json': { example: { name: 'Ada', role: 'admin' } } } },
            },
          },
        },
      }),
    );
    expect(result.requests[0].request.body).toEqual({
      type: 'json',
      content: JSON.stringify({ name: 'Ada', role: 'admin' }, null, 2),
    });
  });

  it('synthesizes a scaffold for schema-only JSON bodies with a transform', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/users': {
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        age: { type: 'integer' },
                        active: { type: 'boolean' },
                        email: { type: 'string', format: 'email' },
                        tags: { type: 'array', items: { type: 'string' } },
                        plan: { enum: ['free', 'pro'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    );
    const body = result.requests[0].request.body;
    expect(body.type).toBe('json');
    expect(JSON.parse(body.type === 'json' ? body.content : '{}')).toEqual({
      name: 'string',
      age: 0,
      active: true,
      email: 'user@openheaders.com',
      tags: ['string'],
      plan: 'free',
    });
    expect(result.report.transforms.some((t) => t.to === 'synthesized placeholder body')).toBe(true);
  });

  it('survives a self-referential schema without hanging', () => {
    const result = parseOpenApi(
      doc({
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: { name: { type: 'string' }, next: { $ref: '#/components/schemas/Node' } },
            },
          },
        },
        paths: {
          '/nodes': {
            post: {
              requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } },
            },
          },
        },
      }),
    );
    const body = result.requests[0].request.body;
    const parsed = JSON.parse(body.type === 'json' ? body.content : '{}');
    expect(parsed.name).toBe('string');
  });

  it('prefers JSON and names the other media types in a transform', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/things': {
            post: {
              requestBody: {
                content: { 'text/plain': { example: 'hi' }, 'application/json': { example: { ok: true } } },
              },
            },
          },
        },
      }),
    );
    expect(result.requests[0].request.body.type).toBe('json');
    const transform = result.report.transforms.find((t) => t.to === 'application/json');
    expect(transform?.reason).toContain('text/plain');
  });

  it('maps urlencoded bodies to form parts from the example', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/login': {
            post: {
              requestBody: {
                content: {
                  'application/x-www-form-urlencoded': { example: { user: 'ada', remember: true } },
                },
              },
            },
          },
        },
      }),
    );
    const body = result.requests[0].request.body;
    expect(body.type).toBe('form');
    expect(body.type === 'form' ? body.formParts : []).toMatchObject([
      { key: 'user', value: 'ada' },
      { key: 'remember', value: 'true' },
    ]);
  });

  it('maps multipart bodies — binary properties become placeholder file parts', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/upload': {
            post: {
              requestBody: {
                content: {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      properties: {
                        avatar: { type: 'string', format: 'binary' },
                        caption: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    );
    const body = result.requests[0].request.body;
    expect(body.type).toBe('multipart');
    const parts = body.type === 'multipart' ? body.multipartParts : [];
    expect(parts).toMatchObject([
      { kind: 'file', name: 'avatar' },
      { kind: 'text', name: 'caption', value: 'string' },
    ]);
    expect(result.report.transforms.some((t) => t.tracking === '#todo-file-blobs')).toBe(true);
  });

  it('keeps literal XML examples and empties structured ones with a transform', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/a': {
            post: { requestBody: { content: { 'application/xml': { example: '<user name="ada"/>' } } } },
          },
          '/b': {
            post: { requestBody: { content: { 'application/xml': { schema: { type: 'object' } } } } },
          },
        },
      }),
    );
    expect(result.requests[0].request.body).toEqual({ type: 'xml', content: '<user name="ada"/>' });
    expect(result.requests[1].request.body).toEqual({ type: 'xml', content: '' });
    expect(result.report.transforms.some((t) => t.to === 'empty XML body')).toBe(true);
  });

  it('drops unmappable media types with the type named', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/blob': { post: { requestBody: { content: { 'application/octet-stream': { schema: {} } } } } },
        },
      }),
    );
    expect(result.requests[0].request.body).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => d.reason.includes('application/octet-stream'))).toBe(true);
  });
});

// ── Security schemes → auth ────────────────────────────────────────

describe('security schemes → auth', () => {
  function securedDoc(scheme: Record<string, unknown>, overrides: Record<string, unknown> = {}): string {
    return doc({
      components: { securitySchemes: { main: scheme } },
      security: [{ main: [] }],
      ...overrides,
    });
  }

  it('maps http basic / bearer / digest schemes onto native arms', () => {
    expect(parseOpenApi(securedDoc({ type: 'http', scheme: 'basic' })).collectionAuth).toEqual({
      type: 'basic',
      username: '',
      password: '',
    });
    expect(parseOpenApi(securedDoc({ type: 'http', scheme: 'bearer' })).collectionAuth).toEqual({
      type: 'bearer',
      token: '',
    });
    expect(parseOpenApi(securedDoc({ type: 'http', scheme: 'digest' })).collectionAuth).toEqual({
      type: 'digest',
      username: '',
      password: '',
    });
  });

  it('maps apiKey header/query and drops cookie placement', () => {
    expect(parseOpenApi(securedDoc({ type: 'apiKey', name: 'X-Api-Key', in: 'header' })).collectionAuth).toEqual({
      type: 'api-key',
      key: 'X-Api-Key',
      value: '',
      in: 'header',
    });
    const cookie = parseOpenApi(securedDoc({ type: 'apiKey', name: 'session', in: 'cookie' }));
    expect(cookie.collectionAuth).toEqual({ type: 'none' });
    expect(cookie.report.drops.some((d) => d.tracking === 'PERMANENT: cookies out of scope')).toBe(true);
  });

  it('maps the oauth2 authorizationCode flow with credential placeholders', () => {
    const result = parseOpenApi(
      securedDoc({
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://auth.openheaders.io/authorize',
            tokenUrl: 'https://auth.openheaders.io/token',
            scopes: { 'read:users': 'Read users', 'write:users': 'Write users' },
          },
        },
      }),
    );
    expect(result.collectionAuth).toMatchObject({
      type: 'oauth2',
      flow: 'authorization-code-pkce',
      grantType: 'authorization-code',
      authorizationEndpoint: 'https://auth.openheaders.io/authorize',
      tokenEndpoint: 'https://auth.openheaders.io/token',
      clientId: '{{clientId}}',
      clientSecret: '{{clientSecret}}',
      scopes: ['read:users', 'write:users'],
    });
    expect(result.report.transforms.some((t) => t.to === '{{clientId}} / {{clientSecret}} placeholders')).toBe(true);
  });

  it('maps clientCredentials and password flows onto their arms', () => {
    const cc = parseOpenApi(
      securedDoc({
        type: 'oauth2',
        flows: { clientCredentials: { tokenUrl: 'https://auth.openheaders.io/token', scopes: {} } },
      }),
    );
    expect(cc.collectionAuth).toMatchObject({ type: 'oauth2', flow: 'client-credentials' });
    const pw = parseOpenApi(
      securedDoc({
        type: 'oauth2',
        flows: { password: { tokenUrl: 'https://auth.openheaders.io/token', scopes: {} } },
      }),
    );
    expect(pw.collectionAuth).toMatchObject({ type: 'oauth2', flow: 'password-credentials' });
  });

  it('prefers authorizationCode over other flows and names the skipped ones', () => {
    const result = parseOpenApi(
      securedDoc({
        type: 'oauth2',
        flows: {
          implicit: { authorizationUrl: 'https://auth.openheaders.io/authorize', scopes: {} },
          clientCredentials: { tokenUrl: 'https://auth.openheaders.io/token', scopes: {} },
          authorizationCode: {
            authorizationUrl: 'https://auth.openheaders.io/authorize',
            tokenUrl: 'https://auth.openheaders.io/token',
            scopes: {},
          },
        },
      }),
    );
    expect(result.collectionAuth).toMatchObject({ type: 'oauth2', flow: 'authorization-code-pkce' });
    const transform = result.report.transforms.find((t) => t.to === 'authorizationCode');
    expect(transform?.reason).toContain('implicit');
    expect(transform?.reason).toContain('clientCredentials');
  });

  it('drops implicit-only schemes permanently', () => {
    const result = parseOpenApi(
      securedDoc({
        type: 'oauth2',
        flows: { implicit: { authorizationUrl: 'https://auth.openheaders.io/authorize', scopes: {} } },
      }),
    );
    expect(result.collectionAuth).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => d.tracking === 'PERMANENT: OAuth 2.0 implicit grant')).toBe(true);
  });

  it('drops oauth2 flows missing the token URL, openIdConnect, and mutualTLS with reasons', () => {
    const noToken = parseOpenApi(securedDoc({ type: 'oauth2', flows: { clientCredentials: { scopes: {} } } }));
    expect(noToken.report.drops.some((d) => d.reason.includes('token URL is missing'))).toBe(true);
    const oidc = parseOpenApi(
      securedDoc({ type: 'openIdConnect', openIdConnectUrl: 'https://auth.openheaders.io/.well-known' }),
    );
    expect(oidc.report.drops.some((d) => d.tracking === '#todo-openapi-oidc-discovery')).toBe(true);
    const mtls = parseOpenApi(securedDoc({ type: 'mutualTLS' }));
    expect(mtls.report.drops.some((d) => d.tracking === 'PERMANENT: mTLS is a request setting')).toBe(true);
  });

  it('requests without their own security import as inherit; overrides map; [] opts out', () => {
    const result = parseOpenApi(
      securedDoc(
        { type: 'http', scheme: 'bearer' },
        {
          components: {
            securitySchemes: {
              main: { type: 'http', scheme: 'bearer' },
              alt: { type: 'apiKey', name: 'X-Key', in: 'query' },
            },
          },
          paths: {
            '/inherits': { get: {} },
            '/overrides': { get: { security: [{ alt: [] }] } },
            '/open': { get: { security: [] } },
          },
        },
      ),
    );
    const byUrl = (suffix: string) => result.requests.find((r) => r.request.url.endsWith(suffix))?.request.auth;
    expect(byUrl('/inherits')).toEqual({ type: 'inherit' });
    expect(byUrl('/overrides')).toEqual({ type: 'api-key', key: 'X-Key', value: '', in: 'query' });
    expect(byUrl('/open')).toEqual({ type: 'none' });
  });

  it('requirement scopes override the flow-declared scope list', () => {
    const result = parseOpenApi(
      doc({
        components: {
          securitySchemes: {
            oauth: {
              type: 'oauth2',
              flows: {
                clientCredentials: {
                  tokenUrl: 'https://auth.openheaders.io/token',
                  scopes: { 'read:all': '', 'write:all': '' },
                },
              },
            },
          },
        },
        security: [{ oauth: ['read:all'] }],
      }),
    );
    expect(result.collectionAuth).toMatchObject({ type: 'oauth2', scopes: ['read:all'] });
  });

  it('imports the first of combined schemes and of alternative requirements with transforms', () => {
    const result = parseOpenApi(
      doc({
        components: {
          securitySchemes: {
            key: { type: 'apiKey', name: 'X-Key', in: 'header' },
            bearer: { type: 'http', scheme: 'bearer' },
          },
        },
        security: [{ key: [], bearer: [] }, { bearer: [] }],
      }),
    );
    expect(result.collectionAuth).toMatchObject({ type: 'api-key', key: 'X-Key' });
    expect(result.report.transforms.some((t) => t.from.includes('2 alternative security requirements'))).toBe(true);
    expect(result.report.transforms.some((t) => t.from.includes('combined schemes key + bearer'))).toBe(true);
  });

  it('authored security naming only unmappable schemes lands none, never inherit', () => {
    const result = parseOpenApi(
      doc({
        components: { securitySchemes: { mtls: { type: 'mutualTLS' } } },
        paths: { '/secure': { get: { security: [{ mtls: [] }] } } },
      }),
    );
    expect(result.requests[0].request.auth).toEqual({ type: 'none' });
  });
});

// ── Responses → examples ───────────────────────────────────────────

describe('responses → examples', () => {
  const RESPONSES_DOC = {
    paths: {
      '/users': {
        get: {
          responses: {
            '200': {
              description: 'OK',
              headers: { 'X-Request-Id': { schema: { type: 'string', example: 'req-1' } } },
              content: {
                'application/json': {
                  examples: {
                    one: { value: { users: [] } },
                    two: { value: { users: [{ name: 'Ada' }] } },
                  },
                },
              },
            },
            default: {
              description: 'Error',
              content: { 'application/json': { example: { error: 'nope' } } },
            },
          },
        },
      },
    },
  };

  it('mints one example per named example plus singular examples, off the request shape', () => {
    const result = parseOpenApi(doc(RESPONSES_DOC), { responseExamples: true });
    const examples = result.requests[0].examples ?? [];
    expect(examples.map((e) => e.name)).toEqual(['200 — OK · one', '200 — OK · two', 'default — Error']);
    expect(examples[0].response.status).toBe(200);
    expect(examples[0].response.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' });
    expect(examples[0].response.headers).toContainEqual({ key: 'X-Request-Id', value: 'req-1' });
    expect(JSON.parse(examples[1].response.body)).toEqual({ users: [{ name: 'Ada' }] });
    expect(examples[2].response.status).toBe(0);
    expect(examples[2].response.statusText).toBe('default');
    expect(examples[0].request.method).toBe('GET');
  });

  it('keeps an honest aggregate note when example emission is off', () => {
    const result = parseOpenApi(doc(RESPONSES_DOC));
    expect(result.requests[0].examples).toBeUndefined();
    const drop = result.report.drops.find((d) => d.tracking === '#todo-file-import-examples');
    expect(drop?.reason).toContain('1 operation');
  });

  it('notes schema-only responses instead of minting empty examples', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/things': {
            get: {
              responses: {
                '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object' } } } },
              },
            },
          },
        },
      }),
      { responseExamples: true },
    );
    expect(result.requests[0].examples).toBeUndefined();
    expect(
      result.report.drops.some((d) => d.tracking === 'PERMANENT: response schemas without concrete examples'),
    ).toBe(true);
  });

  it('drops response links with a count', () => {
    const result = parseOpenApi(
      doc({
        paths: {
          '/users': {
            post: {
              responses: {
                '201': {
                  description: 'Created',
                  content: { 'application/json': { example: { id: 1 } } },
                  links: { getUser: { operationId: 'getUser' } },
                },
              },
            },
          },
        },
      }),
      { responseExamples: true },
    );
    const drop = result.report.drops.find((d) => d.tracking === 'PERMANENT: response links');
    expect(drop?.reason).toContain('1 response link');
  });

  it('responses without content mint nothing and note nothing', () => {
    const result = parseOpenApi(
      doc({ paths: { '/a': { get: { responses: { '204': { description: 'No Content' } } } } } }),
      { responseExamples: true },
    );
    expect(result.requests[0].examples).toBeUndefined();
    expect(result.report.drops).toHaveLength(0);
  });
});

// ── Document-level drops ───────────────────────────────────────────

describe('document-level drops', () => {
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
      expect(request.auth).toEqual({ type: 'inherit' });
      expect(request.body).toEqual({ type: 'none' });
    }
  });
});
