/**
 * Insomnia importer coverage.
 *
 * Sections mirror the parser's entry shapes and mapping scope: v4
 * export envelope (workspace/folder/request tree, auth, bodies,
 * template rewrite), environments (base + sub flattening), NeDB doc
 * lines, v5 YAML/JSON documents, report + redaction.
 */

import { describe, expect, it } from 'vitest';
import { InsomniaParseError, parseInsomnia, parseInsomniaDocs } from '../../src/import/insomnia';
import { stripUids } from './_kv-utils';

// ── Helpers ─────────────────────────────────────────────────────────

function v4Export(resources: unknown[]): string {
  return JSON.stringify({
    _type: 'export',
    __export_format: 4,
    __export_date: '2026-07-12T00:00:00.000Z',
    __export_source: 'insomnia.desktop.app:v11.0.0',
    resources,
  });
}

const WORKSPACE = { _id: 'wrk_1', _type: 'workspace', name: 'Openheaders API', description: 'Smoke tests' };

function v4Request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: 'req_1',
    _type: 'request',
    parentId: 'wrk_1',
    name: 'Ping',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    ...overrides,
  };
}

// ── Top-level errors ───────────────────────────────────────────────

describe('parseInsomnia — top-level errors', () => {
  it('throws InsomniaParseError on garbage input', () => {
    expect(() => parseInsomnia('{{{ not anything')).toThrow(InsomniaParseError);
  });

  it('throws on JSON that is not an export', () => {
    expect(() => parseInsomnia(JSON.stringify({ hello: 'world' }))).toThrow(InsomniaParseError);
  });

  it('throws on an unsupported v5 document type', () => {
    expect(() => parseInsomnia(JSON.stringify({ type: 'spec.insomnia.rest/5.0', name: 'S' }))).toThrow(
      InsomniaParseError,
    );
  });
});

// ── v4 tree ────────────────────────────────────────────────────────

describe('v4 export — workspace / folder / request tree', () => {
  it('maps workspaces to collections and groups to folder paths', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        { _id: 'fld_1', _type: 'request_group', parentId: 'wrk_1', name: 'Auth' },
        { _id: 'fld_2', _type: 'request_group', parentId: 'fld_1', name: 'SSO' },
        v4Request({ _id: 'req_1', parentId: 'fld_2', name: 'Google', url: 'https://api.openheaders.io/sso/google' }),
        v4Request({ _id: 'req_2', parentId: 'wrk_1', name: 'Ping' }),
      ]),
    );
    expect(result.collections).toHaveLength(1);
    const col = result.collections[0]!;
    expect(col.name).toBe('Openheaders API');
    expect(col.description).toBe('Smoke tests');
    expect(col.folders.map((f) => f.path)).toEqual([['Auth'], ['Auth', 'SSO']]);
    expect(col.requests.map((r) => [r.request.name, r.folderPath])).toEqual([
      ['Google', ['Auth', 'SSO']],
      ['Ping', []],
    ]);
  });

  it('orders siblings by metaSortKey', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        v4Request({ _id: 'req_b', name: 'Second', metaSortKey: 2 }),
        v4Request({ _id: 'req_a', name: 'First', metaSortKey: 1 }),
      ]),
    );
    expect(result.collections[0]?.requests.map((r) => r.request.name)).toEqual(['First', 'Second']);
  });

  it('roots parentless docs in an implicit collection when no workspace exists', () => {
    const result = parseInsomnia(v4Export([v4Request({ parentId: null })]));
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]?.name).toBe('Imported Collection');
    expect(result.collections[0]?.requests).toHaveLength(1);
  });

  it('drops orphaned requests whose parent chain is unreachable', () => {
    // req_lost points at fld_gone which points at itself — never reaches a workspace.
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        { _id: 'fld_gone', _type: 'request_group', parentId: 'fld_gone', name: 'Cycle' },
        v4Request({ _id: 'req_lost', parentId: 'fld_gone', name: 'Lost' }),
      ]),
    );
    expect(result.collections[0]?.requests).toEqual([]);
    expect(result.report.drops.some((d) => /"Lost" is orphaned/.test(d.reason))).toBe(true);
  });

  it('aggregates unsupported resource types into per-type drops', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        { _id: 'jar_1', _type: 'cookie_jar', parentId: 'wrk_1', name: 'Default Jar' },
        { _id: 'ws_1', _type: 'websocket_request', parentId: 'wrk_1', name: 'Feed' },
        { _id: 'ws_2', _type: 'websocket_request', parentId: 'wrk_1', name: 'Feed 2' },
      ]),
    );
    const cookieDrop = result.report.drops.find((d) => d.path === 'resources[type=cookie_jar]');
    expect(cookieDrop?.reason).toMatch(/cookie jars are session state/);
    const wsDrop = result.report.drops.find((d) => d.path === 'resources[type=websocket_request]');
    expect(wsDrop?.reason).toMatch(/^2 resources/);
    expect(wsDrop?.tracking).toBe('#todo-request-kinds');
  });

  it('drops non-object resources with a report entry', () => {
    const result = parseInsomnia(v4Export([WORKSPACE, 42]));
    expect(result.report.drops.some((d) => d.path === 'resources[1]')).toBe(true);
  });
});

// ── Embedded API specs ─────────────────────────────────────────────

describe('v4 api_spec resources', () => {
  const SPEC_YAML = [
    'openapi: 3.0.3',
    'info:',
    '  title: Openheaders Public API',
    '  version: 1.0.0',
    'servers:',
    '  - url: https://api.openheaders.io/v1',
    'security:',
    '  - bearer: []',
    'components:',
    '  securitySchemes:',
    '    bearer:',
    '      type: http',
    '      scheme: bearer',
    'paths:',
    '  /rules:',
    '    get:',
    '      summary: List rules',
    '      tags: [Rules]',
    '',
  ].join('\n');

  function specResource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      _id: 'spc_1',
      _type: 'api_spec',
      parentId: 'wrk_1',
      fileName: 'openapi.yaml',
      contents: SPEC_YAML,
      contentType: 'yaml',
      ...overrides,
    };
  }

  it('imports the embedded spec as its own collection through the OpenAPI importer', () => {
    const result = parseInsomnia(v4Export([WORKSPACE, v4Request(), specResource()]));
    expect(result.collections).toHaveLength(2);
    const spec = result.collections[1];
    expect(spec?.name).toBe('Openheaders Public API');
    expect(spec?.requests).toHaveLength(1);
    expect(spec?.requests[0]?.request.url).toBe('{{baseUrl}}/rules');
    expect(spec?.requests[0]?.request.auth).toEqual({ type: 'inherit' });
    expect(spec?.folders.map((f) => f.path)).toEqual([['Rules']]);
    expect(spec?.variables).toEqual([{ name: 'baseUrl', value: 'https://api.openheaders.io/v1', type: 'default' }]);
    expect(spec?.auth).toEqual({ type: 'bearer', token: '' });
    const marker = result.report.transforms.find((t) => t.path === 'resources[spc_1]');
    expect(marker?.reason).toMatch(/OpenAPI importer/);
  });

  it('folds the spec parser notes under the resource path', () => {
    const withWebhooks = SPEC_YAML.concat('webhooks:\n  ping:\n    post:\n      summary: Ping\n');
    const result = parseInsomnia(v4Export([WORKSPACE, specResource({ contents: withWebhooks })]));
    expect(result.report.drops.some((d) => d.path === 'resources[spc_1].webhooks')).toBe(true);
  });

  it('drops an empty spec with a reason', () => {
    const result = parseInsomnia(v4Export([WORKSPACE, specResource({ contents: '   ' })]));
    expect(result.collections).toHaveLength(1);
    const drop = result.report.drops.find((d) => d.path === 'resources[spc_1]');
    expect(drop?.reason).toMatch(/"openapi.yaml" carries no contents/);
  });

  it('drops a Swagger 2.0 spec with the honest convert-to-3.x error', () => {
    const swagger = 'swagger: "2.0"\ninfo:\n  title: Legacy\npaths: {}\n';
    const result = parseInsomnia(v4Export([WORKSPACE, specResource({ contents: swagger })]));
    expect(result.collections).toHaveLength(1);
    const drop = result.report.drops.find((d) => d.path === 'resources[spc_1]');
    expect(drop?.reason).toMatch(/convert to OpenAPI 3\.x/);
  });

  it('counts spec requests into the summary', () => {
    const result = parseInsomnia(v4Export([WORKSPACE, specResource()]));
    expect(result.report.summary.imported).toBe(1);
  });
});

// ── Request mapping ────────────────────────────────────────────────

describe('v4 request mapping', () => {
  it('maps method, URL query split, headers, and parameters', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        v4Request({
          method: 'post',
          url: 'https://api.openheaders.io/things?a=1',
          headers: [
            { name: 'X-Trace', value: 'abc' },
            { name: 'X-Off', value: 'ignored', disabled: true },
          ],
          parameters: [
            { name: 'b', value: '2' },
            { name: 'c', value: '3', disabled: true },
          ],
        }),
      ]),
    );
    const req = result.collections[0]!.requests[0]!.request;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://api.openheaders.io/things');
    expect(stripUids(req.params)).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
      { key: 'c', value: '3', enabled: false },
    ]);
    expect(stripUids(req.headers)).toEqual([
      { key: 'X-Trace', value: 'abc' },
      { key: 'X-Off', value: 'ignored', enabled: false },
    ]);
  });

  it('defaults a missing method to GET with a drop', () => {
    const result = parseInsomnia(v4Export([WORKSPACE, v4Request({ method: undefined })]));
    expect(result.collections[0]?.requests[0]?.request.method).toBe('GET');
    expect(result.report.drops.some((d) => d.path.endsWith('.method'))).toBe(true);
  });

  it('rewrites {{ _.var }} template references with one transform per request', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        v4Request({
          url: '{{ _.baseUrl }}/users?token={{ _.token }}',
          headers: [{ name: 'X-Env', value: '{{ _.env.name }}' }],
        }),
      ]),
    );
    const req = result.collections[0]!.requests[0]!.request;
    expect(req.url).toBe('{{baseUrl}}/users');
    expect(stripUids(req.params)).toEqual([{ key: 'token', value: '{{token}}' }]);
    expect(stripUids(req.headers)).toEqual([{ key: 'X-Env', value: '{{env.name}}' }]);
    const transform = result.report.transforms.find((t) => t.from === '{{ _.var }}');
    expect(transform).toBeDefined();
    expect(transform?.reason).toMatch(/3 Insomnia template references/);
  });

  it('reports Nunjucks tag blocks and keeps them verbatim', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        v4Request({
          headers: [{ name: 'X-Prev', value: `{% response 'body', 'req_2', 'b64::JC50b2tlbg==' %}` }],
        }),
      ]),
    );
    const req = result.collections[0]!.requests[0]!.request;
    expect(req.headers[0]?.value).toContain('{% response');
    expect(result.report.drops.some((d) => /template tags/.test(d.reason))).toBe(true);
  });
});

describe('v4 auth mapping', () => {
  const authRequest = (authentication: Record<string, unknown>) => v4Export([WORKSPACE, v4Request({ authentication })]);

  it('maps basic auth', () => {
    const result = parseInsomnia(authRequest({ type: 'basic', username: 'alice', password: 'hunter2' }));
    expect(result.collections[0]?.requests[0]?.request.auth).toEqual({
      type: 'basic',
      username: 'alice',
      password: 'hunter2',
    });
  });

  it('maps bearer auth and flags a custom prefix', () => {
    const result = parseInsomnia(authRequest({ type: 'bearer', token: 'abc.def', prefix: 'Token' }));
    expect(result.collections[0]?.requests[0]?.request.auth).toEqual({ type: 'bearer', token: 'abc.def' });
    expect(result.report.transforms.some((t) => /prefix "Token"/.test(t.from))).toBe(true);
  });

  it('maps apikey auth to header and query placements', () => {
    const header = parseInsomnia(authRequest({ type: 'apikey', key: 'X-API-Key', value: 'abc' }));
    expect(header.collections[0]?.requests[0]?.request.auth).toEqual({
      type: 'api-key',
      key: 'X-API-Key',
      value: 'abc',
      in: 'header',
    });
    const query = parseInsomnia(authRequest({ type: 'apikey', key: 'api_key', value: 'xyz', addTo: 'queryParams' }));
    expect(query.collections[0]?.requests[0]?.request.auth).toEqual({
      type: 'api-key',
      key: 'api_key',
      value: 'xyz',
      in: 'query',
    });
  });

  it('promotes an Authorization: Bearer header when no explicit auth', () => {
    const result = parseInsomnia(
      v4Export([WORKSPACE, v4Request({ headers: [{ name: 'Authorization', value: 'Bearer abc.def' }] })]),
    );
    const req = result.collections[0]!.requests[0]!.request;
    expect(req.auth).toEqual({ type: 'bearer', token: 'abc.def' });
    expect(req.headers).toEqual([]);
  });

  it('drops disabled auth with a reason', () => {
    const result = parseInsomnia(authRequest({ type: 'basic', username: 'a', password: 'b', disabled: true }));
    expect(result.collections[0]?.requests[0]?.request.auth).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => /disabled in the source/.test(d.reason))).toBe(true);
  });

  it('drops oauth2 with tracking', () => {
    const result = parseInsomnia(authRequest({ type: 'oauth2', clientId: 'x' }));
    expect(result.collections[0]?.requests[0]?.request.auth).toEqual({ type: 'none' });
    expect(result.report.drops.some((d) => d.tracking === '#todo-oauth')).toBe(true);
  });

  it('drops iam with the AWS tracking pointer', () => {
    const result = parseInsomnia(authRequest({ type: 'iam' }));
    expect(result.report.drops.some((d) => d.tracking === '#todo-aws-sigv4')).toBe(true);
  });

  it('drops digest / ntlm / hawk / netrc / asap / oauth1', () => {
    for (const t of ['digest', 'ntlm', 'hawk', 'netrc', 'asap', 'oauth1']) {
      const result = parseInsomnia(authRequest({ type: t }));
      expect(result.collections[0]?.requests[0]?.request.auth).toEqual({ type: 'none' });
      expect(result.report.drops.some((d) => new RegExp(`${t} auth not imported`).test(d.reason))).toBe(true);
    }
  });
});

describe('v4 body mapping', () => {
  const bodyRequest = (body: Record<string, unknown>) => v4Export([WORKSPACE, v4Request({ method: 'POST', body })]);

  it('maps json / xml / plain bodies by mimeType', () => {
    const json = parseInsomnia(bodyRequest({ mimeType: 'application/json', text: '{"k":"v"}' }));
    expect(json.collections[0]?.requests[0]?.request.body).toEqual({ type: 'json', content: '{"k":"v"}' });
    const xml = parseInsomnia(bodyRequest({ mimeType: 'application/xml', text: '<root/>' }));
    expect(xml.collections[0]?.requests[0]?.request.body).toEqual({ type: 'xml', content: '<root/>' });
    const text = parseInsomnia(bodyRequest({ mimeType: 'text/plain', text: 'plain body' }));
    expect(text.collections[0]?.requests[0]?.request.body).toEqual({ type: 'text', content: 'plain body' });
  });

  it('returns none for an empty body object', () => {
    const result = parseInsomnia(v4Export([WORKSPACE, v4Request({ body: {} })]));
    expect(result.collections[0]?.requests[0]?.request.body).toEqual({ type: 'none' });
  });

  it('unwraps the GraphQL JSON envelope', () => {
    const result = parseInsomnia(
      bodyRequest({
        mimeType: 'application/graphql',
        text: JSON.stringify({ query: 'query { ping }', variables: { x: 1 } }),
      }),
    );
    expect(result.collections[0]?.requests[0]?.request.body).toEqual({
      type: 'graphql',
      content: 'query { ping }',
      graphqlVariables: '{"x":1}',
    });
  });

  it('keeps a bare GraphQL query when the envelope is not JSON', () => {
    const result = parseInsomnia(bodyRequest({ mimeType: 'application/graphql', text: 'query { ping }' }));
    expect(result.collections[0]?.requests[0]?.request.body).toEqual({ type: 'graphql', content: 'query { ping }' });
  });

  it('maps urlencoded params with disabled rows preserved', () => {
    const result = parseInsomnia(
      bodyRequest({
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          { name: 'a', value: '1' },
          { name: 'b', value: '2', disabled: true },
        ],
      }),
    );
    expect(stripUids((result.collections[0]!.requests[0]!.request.body as { formParts: object[] }).formParts)).toEqual([
      { key: 'a', value: '1' },
      { key: 'b', value: '2', enabled: false },
    ]);
  });

  it('maps multipart file params to placeholder FileRefs with a transform', () => {
    const result = parseInsomnia(
      bodyRequest({
        mimeType: 'multipart/form-data',
        params: [
          { name: 'name', value: 'alice' },
          { name: 'avatar', type: 'file', fileName: '/tmp/pic.png' },
        ],
      }),
    );
    const body = result.collections[0]!.requests[0]!.request.body;
    expect(body.type).toBe('multipart');
    if (body.type !== 'multipart') throw new Error('expected multipart body');
    expect(body.multipartParts[0]).toMatchObject({ kind: 'text', name: 'name', value: 'alice' });
    expect(body.multipartParts[1]).toMatchObject({
      kind: 'file',
      name: 'avatar',
      fileRefs: [expect.objectContaining({ filename: 'pic.png' })],
    });
    expect(result.report.transforms.some((t) => t.tracking === '#todo-file-blobs')).toBe(true);
  });

  it('maps an octet-stream file body to a one-part multipart placeholder', () => {
    const result = parseInsomnia(bodyRequest({ mimeType: 'application/octet-stream', fileName: '/tmp/x.bin' }));
    const body = result.collections[0]!.requests[0]!.request.body;
    expect(body.type).toBe('multipart');
    if (body.type !== 'multipart') throw new Error('expected multipart body');
    expect(body.multipartParts[0]?.kind).toBe('file');
    expect(result.report.transforms.some((t) => t.from === 'file (raw binary body)')).toBe(true);
  });

  it('keeps unknown mime types as text with a transform', () => {
    const result = parseInsomnia(bodyRequest({ mimeType: 'application/csv', text: 'a,b' }));
    expect(result.collections[0]?.requests[0]?.request.body).toEqual({ type: 'text', content: 'a,b' });
    expect(result.report.transforms.some((t) => t.from === 'application/csv')).toBe(true);
  });
});

// ── Environments ───────────────────────────────────────────────────

describe('v4 environments', () => {
  it('emits a lone base environment as-is with nested data flattened', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        {
          _id: 'env_base',
          _type: 'environment',
          parentId: 'wrk_1',
          name: 'Base Environment',
          data: { host: 'api.openheaders.io', auth: { scheme: 'bearer' }, retries: 3 },
        },
      ]),
    );
    expect(result.environments).toEqual([
      {
        name: 'Base Environment',
        variables: [
          { name: 'host', value: 'api.openheaders.io', type: 'default' },
          { name: 'auth.scheme', value: 'bearer', type: 'default' },
          { name: 'retries', value: '3', type: 'default' },
        ],
      },
    ]);
  });

  it('merges base values under each sub-environment (sub wins) with a transform', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        {
          _id: 'env_base',
          _type: 'environment',
          parentId: 'wrk_1',
          name: 'Base Environment',
          data: { host: 'api.openheaders.io', region: 'eu' },
        },
        {
          _id: 'env_staging',
          _type: 'environment',
          parentId: 'env_base',
          name: 'Staging',
          data: { host: 'staging.openheaders.io' },
        },
      ]),
    );
    expect(result.environments).toEqual([
      {
        name: 'Staging',
        variables: [
          { name: 'host', value: 'staging.openheaders.io', type: 'default' },
          { name: 'region', value: 'eu', type: 'default' },
        ],
      },
    ]);
    expect(result.report.transforms.some((t) => /sub-environment of "Base Environment"/.test(t.from))).toBe(true);
  });

  it('rewrites template references inside environment values', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        {
          _id: 'env_base',
          _type: 'environment',
          parentId: 'wrk_1',
          name: 'Base Environment',
          data: { url: 'https://{{ _.host }}/v1' },
        },
      ]),
    );
    expect(result.environments[0]?.variables[0]?.value).toBe('https://{{host}}/v1');
  });
});

// ── NeDB doc lines ─────────────────────────────────────────────────

describe('parseInsomniaDocs (NeDB lines)', () => {
  it('assembles PascalCase-typed docs the same way as a v4 export', () => {
    const result = parseInsomniaDocs([
      { _id: 'wrk_1', type: 'Workspace', name: 'Local Workspace' },
      { _id: 'fld_1', type: 'RequestGroup', parentId: 'wrk_1', name: 'Users' },
      {
        _id: 'req_1',
        type: 'Request',
        parentId: 'fld_1',
        name: 'Me',
        method: 'GET',
        url: 'https://api.openheaders.io/users/me',
        authentication: { type: 'bearer', token: '{{ _.token }}' },
      },
      { _id: 'env_1', type: 'Environment', parentId: 'wrk_1', name: 'Base Environment', data: { token: 'abc' } },
    ]);
    expect(result.collections[0]?.name).toBe('Local Workspace');
    expect(result.collections[0]?.requests[0]?.folderPath).toEqual(['Users']);
    expect(result.collections[0]?.requests[0]?.request.auth).toEqual({ type: 'bearer', token: '{{token}}' });
    expect(result.environments).toEqual([
      { name: 'Base Environment', variables: [{ name: 'token', value: 'abc', type: 'default' }] },
    ]);
    expect(result.report.summary.imported).toBe(2);
  });

  it('aggregates NeDB housekeeping doc types into drops without leaking values', () => {
    const result = parseInsomniaDocs([
      { _id: 'wrk_1', type: 'Workspace', name: 'W' },
      { _id: 'tok_1', type: 'OAuth2Token', parentId: 'wrk_1', accessToken: 'secret-access-token' },
    ]);
    const drop = result.report.drops.find((d) => d.path === 'resources[type=OAuth2Token]');
    expect(drop).toBeDefined();
    expect(JSON.stringify(result.report)).not.toContain('secret-access-token');
  });
});

// ── v5 documents ───────────────────────────────────────────────────

describe('v5 documents', () => {
  it('parses a YAML collection document with nested children and environments', () => {
    const yaml = `
type: collection.insomnia.rest/5.0
name: Openheaders API
meta:
  id: wrk_v5
collection:
  - name: Auth
    meta:
      id: fld_auth
      sortKey: 1
    children:
      - name: Login
        meta:
          id: req_login
        url: https://api.openheaders.io/auth/login
        method: POST
        headers:
          - name: Content-Type
            value: application/json
        body:
          mimeType: application/json
          text: '{"email":"{{ _.email }}"}'
  - name: Ping
    meta:
      id: req_ping
      sortKey: 2
    url: https://api.openheaders.io/ping
    method: GET
environments:
  name: Base Environment
  data:
    email: qa@openheaders.io
`;
    const result = parseInsomnia(yaml);
    expect(result.collections).toHaveLength(1);
    const col = result.collections[0]!;
    expect(col.name).toBe('Openheaders API');
    expect(col.folders.map((f) => f.path)).toEqual([['Auth']]);
    expect(col.requests.map((r) => r.request.name)).toEqual(['Login', 'Ping']);
    expect(col.requests[0]?.request.body).toEqual({ type: 'json', content: '{"email":"{{email}}"}' });
    expect(result.environments).toEqual([
      { name: 'Base Environment', variables: [{ name: 'email', value: 'qa@openheaders.io', type: 'default' }] },
    ]);
  });

  it('drops v5 request scripts with tracking', () => {
    const result = parseInsomnia(
      JSON.stringify({
        type: 'collection.insomnia.rest/5.0',
        name: 'API',
        collection: [
          {
            name: 'Ping',
            url: 'https://api.openheaders.io/ping',
            method: 'GET',
            scripts: { preRequest: 'insomnia.request.addHeader(...)', afterResponse: '' },
          },
        ],
      }),
    );
    const drops = result.report.drops.filter((d) => d.tracking === '#todo-scripts');
    expect(drops).toHaveLength(1);
    expect(drops[0]?.path).toMatch(/scripts\.preRequest$/);
  });

  it('parses a v5 environment document with sub-environments', () => {
    const yaml = `
type: environment.insomnia.rest/5.0
name: Base Environment
data:
  host: api.openheaders.io
subEnvironments:
  - name: Staging
    data:
      host: staging.openheaders.io
`;
    const result = parseInsomnia(yaml);
    expect(result.collections).toEqual([]);
    expect(result.environments).toEqual([
      { name: 'Staging', variables: [{ name: 'host', value: 'staging.openheaders.io', type: 'default' }] },
    ]);
  });

  it('drops the v5 cookie jar with a reason', () => {
    const result = parseInsomnia(
      JSON.stringify({
        type: 'collection.insomnia.rest/5.0',
        name: 'API',
        collection: [],
        cookieJar: { name: 'Default Jar', cookies: [] },
      }),
    );
    expect(result.report.drops.some((d) => d.path === 'cookieJar')).toBe(true);
  });
});

// ── Summary + redaction ────────────────────────────────────────────

describe('summary + redaction', () => {
  it('imported counts requests plus environments', () => {
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        v4Request({ _id: 'req_1', name: 'A' }),
        v4Request({ _id: 'req_2', name: 'B' }),
        { _id: 'env_1', _type: 'environment', parentId: 'wrk_1', name: 'Base Environment', data: { k: 'v' } },
      ]),
    );
    expect(result.report.summary.imported).toBe(3);
    expect(result.report.source).toBe('insomnia');
  });

  it('never leaks credential values into report entries', () => {
    const secret = 'super-secret-password-xyz';
    const result = parseInsomnia(
      v4Export([
        WORKSPACE,
        v4Request({ authentication: { type: 'basic', username: 'alice', password: secret, disabled: true } }),
        v4Request({ _id: 'req_2', authentication: { type: 'oauth2', clientSecret: secret } }),
      ]),
    );
    expect(result.report.drops.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(result.report)).not.toContain(secret);
  });
});
