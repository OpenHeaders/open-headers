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

  it('lands collection-level events on the collection script slots (translated)', () => {
    const result = parsePostman(
      postmanCollection({
        event: [
          { listen: 'prerequest', script: { exec: ['console.log("hi")'] } },
          { listen: 'test', script: { exec: ['pm.test("ok", function () { });'] } },
        ],
      }),
    );
    expect(result.report.drops.filter((d) => d.path.includes('collection.event'))).toHaveLength(0);
    expect(result.collectionPreRequestScript).toBe('console.log("hi")');
    expect(result.collectionPostResponseScript).toContain('oh.test');
    // Each landed event records a transform, exactly like request events.
    expect(result.report.transforms.filter((t) => t.path.includes('collection.event'))).toHaveLength(2);
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

  it('imports a URL-less request with a transform, not a drop', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'Draft', request: { method: 'POST' } }],
      }),
    );
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0]?.request.url).toBe('');
    expect(result.report.drops.some((d) => d.path.endsWith('.request.url'))).toBe(false);
    const t = result.report.transforms.find((t) => t.path.endsWith('.request.url'));
    expect(t?.to).toBe('imported with an empty URL');
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
    const t = result.report.transforms.find((t) => t.to === 'inline values');
    expect(t?.from).toBe('path variables :id, :postId');
    expect(result.report.drops).toHaveLength(0);
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

describe('request mapping — description', () => {
  it('imports request.description (string form)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x', description: 'Fetches the thing.' },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.description).toBe('Fetches the thing.');
  });

  it('imports request.description (object form)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              description: { content: 'Object-form docs.' },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.description).toBe('Object-form docs.');
  });

  it('falls back to the item description when the request carries none', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            description: 'Item-level docs.',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.description).toBe('Item-level docs.');
  });

  it('carries the item description through the string-shorthand request form', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', description: 'Shorthand docs.', request: 'https://api.openheaders.io/ping' }],
      }),
    );
    expect(result.requests[0]?.request.description).toBe('Shorthand docs.');
  });

  it('omits the field when neither request nor item has a description', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', request: { method: 'GET', url: 'https://api.openheaders.io/x' } }],
      }),
    );
    expect('description' in result.requests[0]!.request).toBe(false);
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

  it('drops oauth2 grants that are not shipped yet (default is plain authorization_code)', () => {
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
    expect(result.report.drops.some((d) => /"authorization_code" grant not imported/.test(d.reason))).toBe(true);
    expect(result.report.drops.some((d) => d.tracking === '#todo-oauth-grants')).toBe(true);
  });

  it('imports an authorization_code_with_pkce oauth2 config', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'oauth2',
                oauth2: [
                  { key: 'grant_type', value: 'authorization_code_with_pkce' },
                  { key: 'authUrl', value: 'https://auth.openheaders.io/authorize' },
                  { key: 'accessTokenUrl', value: 'https://auth.openheaders.io/token' },
                  { key: 'clientId', value: 'client-abc' },
                  { key: 'scope', value: 'read write' },
                  { key: 'tokenName', value: 'Openheaders token' },
                  { key: 'state', value: 'xyz' },
                  { key: 'challengeAlgorithm', value: 'S256' },
                  { key: 'client_authentication', value: 'header' },
                  { key: 'addTokenTo', value: 'queryParams' },
                ],
              },
            },
          },
        ],
      }),
    );
    const auth = result.requests[0]?.request.auth;
    expect(auth).toMatchObject({
      type: 'oauth2',
      flow: 'authorization-code-pkce',
      grantType: 'authorization-code-pkce',
      authorizationEndpoint: 'https://auth.openheaders.io/authorize',
      tokenEndpoint: 'https://auth.openheaders.io/token',
      clientId: 'client-abc',
      scopes: ['read', 'write'],
      label: 'Openheaders token',
      clientAuthentication: 'basic-header',
      sendAs: 'query',
    });
    if (auth?.type !== 'oauth2') throw new Error('expected oauth2 auth');
    expect(auth.credentialRef.length).toBeGreaterThan(0);
    expect(result.report.drops).toHaveLength(0);
  });

  it('imports a client_credentials oauth2 config with a secret and separate refresh endpoint', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'oauth2',
                oauth2: [
                  { key: 'grant_type', value: 'client_credentials' },
                  { key: 'accessTokenUrl', value: 'https://auth.openheaders.io/token' },
                  { key: 'refreshTokenUrl', value: 'https://auth.openheaders.io/refresh' },
                  { key: 'clientId', value: 'svc-client' },
                  { key: 'clientSecret', value: 'shh' },
                ],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toMatchObject({
      type: 'oauth2',
      flow: 'client-credentials',
      tokenEndpoint: 'https://auth.openheaders.io/token',
      refreshEndpoint: 'https://auth.openheaders.io/refresh',
      clientId: 'svc-client',
      clientSecret: 'shh',
      scopes: [],
    });
  });

  it('maps advanced request-params rows onto the extra-params lists (disabled rows stay behind)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'oauth2',
                oauth2: [
                  { key: 'grant_type', value: 'authorization_code_with_pkce' },
                  { key: 'accessTokenUrl', value: 'https://auth.openheaders.io/token' },
                  { key: 'clientId', value: 'client-abc' },
                  {
                    key: 'authRequestParams',
                    value: [
                      { key: 'audience', value: 'https://api.openheaders.io', enabled: true },
                      { key: 'off', value: 'nope', enabled: false },
                    ],
                  },
                  { key: 'tokenRequestParams', value: [{ key: 'resource', value: 'urn:openheaders' }] },
                ],
              },
            },
          },
        ],
      }),
    );
    const auth = result.requests[0]?.request.auth;
    if (auth?.type !== 'oauth2') throw new Error('expected oauth2 auth');
    expect(auth.extraAuthParams?.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: 'audience', value: 'https://api.openheaders.io' },
    ]);
    expect(auth.extraTokenParams?.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: 'resource', value: 'urn:openheaders' },
    ]);
  });

  it('drops an oauth2 config missing its token URL or client id', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'oauth2',
                oauth2: [{ key: 'grant_type', value: 'client_credentials' }],
              },
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.auth).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => /access token URL \+ client id is missing/.test(d.reason))).toBe(true);
  });

  it('notes oauth2 params without a counterpart in one aggregate entry', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: {
              method: 'GET',
              url: 'https://api.openheaders.io/x',
              auth: {
                type: 'oauth2',
                oauth2: [
                  { key: 'grant_type', value: 'authorization_code_with_pkce' },
                  { key: 'accessTokenUrl', value: 'https://auth.openheaders.io/token' },
                  { key: 'clientId', value: 'client-abc' },
                  { key: 'headerPrefix', value: 'Token' },
                  { key: 'useBrowser', value: 'true' },
                ],
              },
            },
          },
        ],
      }),
    );
    const note = result.report.drops.find((d) => d.tracking === '#todo-oauth-params');
    expect(note?.reason).toContain('headerPrefix');
    expect(note?.reason).toContain('useBrowser');
  });

  it('drops password_credentials and implicit grants with honest notes', () => {
    for (const grant of ['password_credentials', 'implicit']) {
      const result = parsePostman(
        postmanCollection({
          item: [
            {
              name: 'X',
              request: {
                method: 'GET',
                url: 'https://api.openheaders.io/x',
                auth: {
                  type: 'oauth2',
                  oauth2: [
                    { key: 'grant_type', value: grant },
                    { key: 'accessTokenUrl', value: 'https://auth.openheaders.io/token' },
                    { key: 'clientId', value: 'client-abc' },
                  ],
                },
              },
            },
          ],
        }),
      );
      expect(result.requests[0]?.request.auth).toEqual({ type: 'none' });
      expect(result.report.drops.some((d) => new RegExp(`"${grant}" grant not imported`).test(d.reason))).toBe(true);
    }
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
        {
          uid: expect.stringMatching(/^[a-z0-9]{8}$/),
          key: 'a',
          value: '1',
          enabled: undefined,
          description: undefined,
        },
        {
          uid: expect.stringMatching(/^[a-z0-9]{8}$/),
          key: 'b',
          value: 'two words',
          enabled: undefined,
          description: undefined,
        },
        {
          uid: expect.stringMatching(/^[a-z0-9]{8}$/),
          key: 'c',
          value: 'disabled',
          enabled: false,
          description: undefined,
        },
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
      { kind: 'text', uid: expect.stringMatching(/^[a-z0-9]{8}$/), name: 'name', value: 'alice' },
      {
        kind: 'file',
        uid: expect.stringMatching(/^[a-z0-9]{8}$/),
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
        uid: expect.stringMatching(/^[a-z0-9]{8}$/),
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

describe('request mapping — protocolProfileBehavior', () => {
  it('maps the shipped knobs (strictSSL renames to sslVerification)', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            protocolProfileBehavior: {
              strictSSL: false,
              followRedirects: false,
              maxRedirects: 5,
              followOriginalHttpMethod: true,
              followAuthorizationHeader: true,
            },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.settings).toEqual({
      sslVerification: false,
      followRedirects: false,
      maxRedirects: 5,
      followOriginalHttpMethod: true,
      followAuthorizationHeader: true,
    });
    expect(result.report.drops).toHaveLength(0);
  });

  it('leaves settings absent when the item carries no behavior object', () => {
    const result = parsePostman(
      postmanCollection({
        item: [{ name: 'X', request: { method: 'GET', url: 'https://api.openheaders.io/x' } }],
      }),
    );
    expect('settings' in result.requests[0]!.request).toBe(false);
  });

  it('notes keys without a counterpart knob', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            protocolProfileBehavior: { disableCookies: false, insecureHTTPParser: true, strictSSL: false },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.settings).toEqual({ sslVerification: false });
    const noted = result.report.drops.filter((d) => d.tracking === '#todo-request-settings');
    expect(noted.map((d) => d.path)).toEqual([
      'collection.item[0].protocolProfileBehavior.disableCookies',
      'collection.item[0].protocolProfileBehavior.insecureHTTPParser',
    ]);
  });

  it('silently accepts disableBodyPruning: true (behavior-identical) but notes false', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'A',
            request: { method: 'GET', url: 'https://api.openheaders.io/a' },
            protocolProfileBehavior: { disableBodyPruning: true },
          },
          {
            name: 'B',
            request: { method: 'GET', url: 'https://api.openheaders.io/b' },
            protocolProfileBehavior: { disableBodyPruning: false },
          },
        ],
      }),
    );
    const noted = result.report.drops.filter((d) => d.tracking === '#todo-request-settings');
    expect(noted.map((d) => d.path)).toEqual(['collection.item[1].protocolProfileBehavior.disableBodyPruning']);
  });

  it('clamps an out-of-bounds maxRedirects with a transform', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            protocolProfileBehavior: { maxRedirects: 100 },
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.settings).toEqual({ maxRedirects: 50 });
    expect(result.report.transforms.some((t) => t.from === '100' && t.to === '50')).toBe(true);
  });

  it('drops mistyped values with a note', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            protocolProfileBehavior: { strictSSL: 'yes', maxRedirects: 'ten' },
          },
        ],
      }),
    );
    expect('settings' in result.requests[0]!.request).toBe(false);
    expect(result.report.drops.filter((d) => /expects a boolean|expects an integer/.test(d.reason))).toHaveLength(2);
  });

  it('notes collection-level and folder-level behavior objects', () => {
    const result = parsePostman(
      postmanCollection({
        protocolProfileBehavior: { followRedirects: false },
        item: [
          {
            name: 'F',
            protocolProfileBehavior: { strictSSL: false },
            item: [{ name: 'X', request: { method: 'GET', url: 'https://api.openheaders.io/x' } }],
          },
        ],
      }),
    );
    expect('settings' in result.requests[0]!.request).toBe(false);
    const noted = result.report.drops.filter((d) => d.tracking === '#todo-settings-inheritance');
    expect(noted.map((d) => d.path)).toEqual([
      'collection.protocolProfileBehavior',
      'collection.item[0].protocolProfileBehavior',
    ]);
  });
});

describe('events (scripts)', () => {
  it('lands per-request scripts on the script slots with a transform each', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            event: [
              { listen: 'prerequest', script: { exec: ['pm.environment.set("k", "v")'] } },
              { listen: 'test', script: { exec: ['const data = pm.response.json();'] } },
            ],
          },
        ],
      }),
    );
    expect(result.report.drops.filter((d) => d.tracking === '#todo-scripts')).toHaveLength(0);
    const request = result.requests[0]?.request;
    expect(request?.preRequestScript).toBe('await oh.variables.set("k", "v")');
    expect(request?.postResponseScript).toBe('const data = JSON.parse(oh.response.body);');
    expect(result.report.transforms.filter((t) => t.to === 'oh.* script')).toHaveLength(2);
  });

  it('imports untranslatable scripts verbatim behind a marker with a tracked transform', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            event: [
              {
                listen: 'test',
                script: { exec: ["const sdk = require('postman-collection');", 'console.log(request.name);'] },
              },
            ],
          },
        ],
      }),
    );
    const request = result.requests[0]?.request;
    expect(request?.postResponseScript).toContain('// == Imported unchanged ==');
    expect(request?.postResponseScript).toContain("const sdk = require('postman-collection');");
    const t = result.report.transforms.find((t) => t.tracking === '#todo-script-translation');
    expect(t?.to).toBe('imported unchanged');
    expect(t?.reason).toContain('require(…)');
  });

  it('silently skips empty scripts at every level', () => {
    const result = parsePostman(
      postmanCollection({
        event: [{ listen: 'prerequest', script: { exec: [''] } }],
        item: [
          {
            name: 'Folder',
            item: [
              {
                name: 'X',
                request: { method: 'GET', url: 'https://api.openheaders.io/x' },
                event: [{ listen: 'test', script: { exec: ['', ''] } }],
              },
            ],
            event: [{ listen: 'test', script: { exec: [] } }],
          },
        ],
      }),
    );
    expect(result.report.drops.filter((d) => d.tracking === '#todo-scripts')).toHaveLength(0);
    expect(result.report.transforms.filter((t) => t.path.includes('event'))).toHaveLength(0);
    expect(result.requests[0]?.request.postResponseScript).toBeUndefined();
    expect(result.collectionPreRequestScript).toBeUndefined();
    expect(result.folders[0]?.postResponseScript).toBeUndefined();
  });

  it('lands non-empty folder/collection scripts on their ancestor slots (translated)', () => {
    const result = parsePostman(
      postmanCollection({
        event: [{ listen: 'prerequest', script: { exec: ['pm.environment.set("a", "1")'] } }],
        item: [
          {
            name: 'Folder',
            item: [],
            event: [{ listen: 'test', script: { exec: ['pm.environment.set("b", "2")'] } }],
          },
        ],
      }),
    );
    expect(result.report.drops.filter((d) => d.tracking === '#todo-scripts')).toHaveLength(0);
    expect(result.collectionPreRequestScript).toContain('oh.variables.set');
    expect(result.folders[0]?.postResponseScript).toContain('oh.variables.set');
    // One transform per landed event, same accounting as request events.
    expect(result.report.transforms.filter((t) => t.path === 'collection.event[prerequest]')).toHaveLength(1);
    expect(result.report.transforms.filter((t) => t.path === 'collection.item[0].event[test]')).toHaveLength(1);
  });

  it('concatenates multiple events of the same kind in order', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            event: [
              { listen: 'test', script: { exec: ['console.log(1);'] } },
              { listen: 'test', script: { exec: ['console.log(2);'] } },
            ],
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.postResponseScript).toBe('console.log(1);\n\nconsole.log(2);');
  });

  it('drops events with an unrecognized listen kind', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: { method: 'GET', url: 'https://api.openheaders.io/x' },
            event: [{ listen: 'weird', script: { exec: ['console.log(1);'] } }],
          },
        ],
      }),
    );
    const drop = result.report.drops.find((d) => d.path.includes('event[weird]'));
    expect(drop?.reason).toContain('unrecognized event');
    expect(result.requests[0]?.request.postResponseScript).toBeUndefined();
  });

  it('lands scripts on string-shorthand request items too', () => {
    const result = parsePostman(
      postmanCollection({
        item: [
          {
            name: 'X',
            request: 'https://api.openheaders.io/x',
            event: [{ listen: 'prerequest', script: { exec: ['console.log("hi");'] } }],
          },
        ],
      }),
    );
    expect(result.requests[0]?.request.preRequestScript).toBe('console.log("hi");');
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
    expect(result.requests[0]?.request.preRequestScript).toBeUndefined();
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
        formParts: [{ uid: expect.stringMatching(/^[a-z0-9]{8}$/), key: 'k', value: 'v' }],
      });
      const t = result.report.transforms.find((t) => t.to === 'structured form fields');
      expect(t?.reason).toContain('wire bytes are identical');
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

// ── Saved responses → Response Examples ────────────────────────────

describe('saved responses', () => {
  const SAVED_RESPONSE = {
    id: 'fe314b57-4e7d-4f44-a110-04d8ada69eaf',
    name: 'Created charge',
    originalRequest: {
      method: 'POST',
      header: [
        { key: 'Content-Type', value: 'application/json', type: 'text' },
        { key: 'Authorization', value: 'Bearer wire-token' },
      ],
      body: { mode: 'raw', raw: '{"amount":100}', options: { raw: { language: 'json' } } },
      url: {
        raw: 'https://api.openheaders.io/charges?expand=balance',
        host: ['api', 'openheaders', 'io'],
        path: ['charges'],
        query: [{ key: 'expand', value: 'balance' }],
      },
    },
    status: 'Created',
    code: 201,
    _postman_previewlanguage: 'json',
    header: [
      { key: 'Content-Type', value: 'application/json' },
      { key: '', value: 'empty keys are skipped' },
    ],
    cookie: [],
    responseTime: null,
    body: '{"id":"ch_1"}',
    createdAt: '2024-09-09T14:21:12.000Z',
    updatedAt: '2024-09-10T00:00:00.000Z',
    uid: 'owner-123',
  };

  function collectionWithResponses(responses: unknown[]): string {
    return postmanCollection({
      item: [
        {
          name: 'Create charge',
          request: { method: 'POST', url: 'https://api.openheaders.io/charges' },
          response: responses,
        },
      ],
    });
  }

  it('keeps an honest per-request drop note by default', () => {
    const result = parsePostman(collectionWithResponses([SAVED_RESPONSE]));
    expect(result.requests[0]?.examples).toBeUndefined();
    const drop = result.report.drops.find((d) => d.path.endsWith('.response'));
    expect(drop?.reason).toContain('Response Examples');
    expect(drop?.tracking).toBe('#todo-file-import-examples');
    expect(result.report.summary.imported).toBe(1);
  });

  it('emits examples under the responseExamples option with the full field mapping', () => {
    const result = parsePostman(collectionWithResponses([SAVED_RESPONSE]), { responseExamples: true });
    expect(result.report.drops).toHaveLength(0);
    const examples = result.requests[0]?.examples;
    expect(examples).toHaveLength(1);
    const ex = examples?.[0];
    expect(ex?.name).toBe('Created charge');
    expect(ex?.capturedAt).toBe('2024-09-09T14:21:12.000Z');
    expect(ex?.request.method).toBe('POST');
    expect(ex?.request.url).toBe('https://api.openheaders.io/charges');
    expect(stripUids(ex?.request.params ?? [])).toEqual([{ key: 'expand', value: 'balance' }]);
    // Authorization rows stay verbatim — the captured shape has no
    // auth slot to promote into.
    expect(stripUids(ex?.request.headers ?? [])).toEqual([
      { key: 'Content-Type', value: 'application/json' },
      { key: 'Authorization', value: 'Bearer wire-token' },
    ]);
    expect(ex?.request.body).toEqual({ type: 'json', content: '{"amount":100}' });
    expect(ex?.response.status).toBe(201);
    expect(ex?.response.statusText).toBe('Created');
    expect(ex?.response.url).toBe('https://api.openheaders.io/charges?expand=balance');
    expect(ex?.response.headers).toEqual([{ key: 'Content-Type', value: 'application/json' }]);
    expect(ex?.response.body).toBe('{"id":"ch_1"}');
    expect(ex?.response.bodyTruncated).toBe(false);
    expect(ex?.response.bodyBytes).toBe(13);
    // `responseTime: null` is the vendor's "not recorded" marker.
    expect(ex?.response.durationMs).toBe(0);
    // Examples count as imported entities: 1 request + 1 example.
    expect(result.report.summary.imported).toBe(2);
  });

  it('maps a numeric responseTime onto durationMs and omits capturedAt without createdAt', () => {
    const { createdAt: _createdAt, updatedAt: _updatedAt, ...exported } = SAVED_RESPONSE;
    const result = parsePostman(collectionWithResponses([{ ...exported, responseTime: 320 }]), {
      responseExamples: true,
    });
    const ex = result.requests[0]?.examples?.[0];
    expect(ex?.capturedAt).toBeUndefined();
    expect(ex?.response.durationMs).toBe(320);
  });

  it('falls back to the parent request shape when originalRequest is absent', () => {
    const { originalRequest: _orig, ...withoutRequest } = SAVED_RESPONSE;
    const result = parsePostman(collectionWithResponses([withoutRequest]), { responseExamples: true });
    const ex = result.requests[0]?.examples?.[0];
    expect(ex?.request.method).toBe('POST');
    expect(ex?.request.url).toBe('https://api.openheaders.io/charges');
    expect(ex?.request.headers).toEqual([]);
    expect(ex?.response.url).toBe('https://api.openheaders.io/charges');
    expect(result.report.drops).toHaveLength(0);
  });

  it('defaults name, status, and statusText when the wire omits them', () => {
    const result = parsePostman(
      collectionWithResponses([{ originalRequest: { method: 'GET', url: 'https://api.openheaders.io/ping' } }]),
      { responseExamples: true },
    );
    const ex = result.requests[0]?.examples?.[0];
    expect(ex?.name).toBe('Saved Response');
    expect(ex?.response.status).toBe(0);
    expect(ex?.response.statusText).toBe('');
    expect(ex?.response.body).toBe('');
    expect(ex?.response.bodyBytes).toBe(0);
  });

  it('drops non-object entries with a note and keeps the rest', () => {
    const result = parsePostman(collectionWithResponses(['bogus', SAVED_RESPONSE]), { responseExamples: true });
    expect(result.requests[0]?.examples).toHaveLength(1);
    const drop = result.report.drops.find((d) => d.path.endsWith('.response[0]'));
    expect(drop?.reason).toContain('not an object');
  });

  it('notes non-empty cookie rows — the schema excludes wire capture', () => {
    const result = parsePostman(
      collectionWithResponses([{ ...SAVED_RESPONSE, cookie: [{ name: 'sid', value: 'abc' }] }]),
      { responseExamples: true },
    );
    expect(result.requests[0]?.examples).toHaveLength(1);
    const drop = result.report.drops.find((d) => d.path.endsWith('.cookie'));
    expect(drop?.reason).toContain('1 cookie row');
  });

  it('records path-variable substitution in an example URL as the usual handled-for-you transform', () => {
    const result = parsePostman(
      collectionWithResponses([
        {
          ...SAVED_RESPONSE,
          originalRequest: {
            method: 'GET',
            url: { raw: 'https://api.openheaders.io/charges/:id', variable: [{ key: 'id', value: 'ch_1' }] },
          },
        },
      ]),
      { responseExamples: true },
    );
    const ex = result.requests[0]?.examples?.[0];
    expect(ex?.request.url).toBe('https://api.openheaders.io/charges/ch_1');
    expect(result.report.transforms.some((t) => t.to === 'inline values')).toBe(true);
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

    // The Login test script translates onto the request's script slot.
    expect(result.report.drops.filter((d) => d.tracking === '#todo-scripts')).toHaveLength(0);
    expect(login.request.postResponseScript).toBe(
      'await oh.variables.set("token", JSON.parse(oh.response.body).token)',
    );
    // imported count reflects all 4 successful mappings.
    expect(result.report.summary.imported).toBe(4);
  });
});
