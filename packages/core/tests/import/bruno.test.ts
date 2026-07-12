/**
 * Bruno importer coverage.
 *
 * Sections mirror the parser's scope: the block tokenizer via
 * single-file requests (methods, headers, params, bodies, auth),
 * folder composition (bruno.json / collection.bru / folder.bru /
 * environments), ordering, drops + redaction.
 */

import { describe, expect, it } from 'vitest';
import {
  BrunoParseError,
  isBrunoImportPath,
  parseBruno,
  parseBrunoFiles,
  stripBrunoRootPrefix,
} from '../../src/import/bruno';
import { stripUids } from './_kv-utils';

// ── Helpers ─────────────────────────────────────────────────────────

const PING = `meta {
  name: Ping
  type: http
  seq: 1
}

get {
  url: https://api.openheaders.io/ping
}
`;

// ── Single file ────────────────────────────────────────────────────

describe('parseBruno — single file', () => {
  it('parses a minimal GET request', () => {
    const result = parseBruno(PING);
    expect(result.collectionName).toBe('Imported Collection');
    expect(result.requests).toHaveLength(1);
    const req = result.requests[0]!.request;
    expect(req.name).toBe('Ping');
    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://api.openheaders.io/ping');
    expect(result.report.source).toBe('bruno');
    expect(result.report.summary.imported).toBe(1);
    expect(result.report.drops).toHaveLength(0);
  });

  it('falls back to the file name when meta.name is absent', () => {
    const result = parseBrunoFiles([
      { path: 'login request.bru', content: `post {\n  url: https://api.openheaders.io/login\n}\n` },
    ]);
    expect(result.requests[0]!.request.name).toBe('login request');
    expect(result.requests[0]!.request.method).toBe('POST');
  });

  it('imports headers with the ~ disabled prefix as enabled: false', () => {
    const content = `meta {
  name: Headers
}

get {
  url: https://api.openheaders.io/v1/me
}

headers {
  Accept: application/json
  ~X-Debug: 1
}
`;
    const result = parseBruno(content);
    expect(stripUids(result.requests[0]!.request.headers)).toEqual([
      { key: 'Accept', value: 'application/json' },
      { key: 'X-Debug', value: '1', enabled: false },
    ]);
  });

  it('promotes an Authorization header to auth config', () => {
    const content = `get {
  url: https://api.openheaders.io/v1/me
}

headers {
  Authorization: Bearer tok-123
}
`;
    const result = parseBruno(content);
    expect(result.requests[0]!.request.auth).toEqual({ type: 'bearer', token: 'tok-123' });
    expect(result.requests[0]!.request.headers).toHaveLength(0);
  });

  it('merges params:query with the URL query string', () => {
    const content = `get {
  url: https://api.openheaders.io/v1/users?active=true
}

params:query {
  page: 2
  ~limit: 10
}
`;
    const result = parseBruno(content);
    const req = result.requests[0]!.request;
    expect(req.url).toBe('https://api.openheaders.io/v1/users');
    expect(stripUids(req.params)).toEqual([
      { key: 'active', value: 'true' },
      { key: 'page', value: '2' },
      { key: 'limit', value: '10', enabled: false },
    ]);
  });

  it('accepts the legacy bare query block', () => {
    const content = `get {
  url: https://api.openheaders.io/v1/users
}

query {
  page: 3
}
`;
    expect(stripUids(parseBruno(content).requests[0]!.request.params)).toEqual([{ key: 'page', value: '3' }]);
  });

  it('substitutes params:path into :placeholders', () => {
    const content = `get {
  url: https://api.openheaders.io/v1/users/:userId/posts
}

params:path {
  userId: 42
}
`;
    expect(parseBruno(content).requests[0]!.request.url).toBe('https://api.openheaders.io/v1/users/42/posts');
  });

  it('keeps {{var}} template references verbatim', () => {
    const content = `get {
  url: {{host}}/v1/me
}

headers {
  X-Token: {{token}}
}
`;
    const result = parseBruno(content);
    expect(result.requests[0]!.request.url).toBe('{{host}}/v1/me');
    expect(stripUids(result.requests[0]!.request.headers)).toEqual([{ key: 'X-Token', value: '{{token}}' }]);
    expect(result.report.transforms).toHaveLength(0);
  });

  it('imports a request with no method block as an empty GET with a drop', () => {
    const result = parseBruno(`meta {\n  name: Broken\n}\n`);
    expect(result.requests[0]!.request.method).toBe('GET');
    expect(result.report.drops.some((d) => d.reason.includes('No method block'))).toBe(true);
  });

  it('defaults unsupported methods (trace) to GET with a drop', () => {
    const result = parseBruno(`trace {\n  url: https://api.openheaders.io/ping\n}\n`);
    expect(result.requests[0]!.request.method).toBe('GET');
    expect(result.report.drops.some((d) => d.reason.includes('"TRACE"'))).toBe(true);
  });

  it('throws BrunoParseError on an empty file list', () => {
    expect(() => parseBrunoFiles([])).toThrow(BrunoParseError);
  });
});

// ── Bodies ─────────────────────────────────────────────────────────

describe('parseBruno — bodies', () => {
  function withBody(selector: string, blocks: string): string {
    return `post {\n  url: https://api.openheaders.io/v1/rules\n  body: ${selector}\n}\n\n${blocks}`;
  }

  it('imports a json body with nested braces intact', () => {
    const content = withBody('json', `body:json {\n  {\n    "rule": { "enabled": true }\n  }\n}\n`);
    expect(parseBruno(content).requests[0]!.request.body).toEqual({
      type: 'json',
      content: '{\n  "rule": { "enabled": true }\n}',
    });
  });

  it('imports the legacy bare body block as json', () => {
    const content = withBody('json', `body {\n  {"a": 1}\n}\n`);
    expect(parseBruno(content).requests[0]!.request.body).toEqual({ type: 'json', content: '{"a": 1}' });
  });

  it('imports text and xml bodies', () => {
    expect(parseBruno(withBody('text', `body:text {\n  hello\n}\n`)).requests[0]!.request.body).toEqual({
      type: 'text',
      content: 'hello',
    });
    expect(parseBruno(withBody('xml', `body:xml {\n  <a/>\n}\n`)).requests[0]!.request.body).toEqual({
      type: 'xml',
      content: '<a/>',
    });
  });

  it('imports graphql bodies with variables', () => {
    const content = withBody(
      'graphql',
      `body:graphql {\n  query { me { id } }\n}\n\nbody:graphql:vars {\n  {"id": 1}\n}\n`,
    );
    expect(parseBruno(content).requests[0]!.request.body).toEqual({
      type: 'graphql',
      content: 'query { me { id } }',
      graphqlVariables: '{"id": 1}',
    });
  });

  it('implies a graphql body from meta.type when the selector is absent', () => {
    const content = `meta {
  name: GQL
  type: graphql
}

post {
  url: https://api.openheaders.io/graphql
}

body:graphql {
  query { ping }
}
`;
    expect(parseBruno(content).requests[0]!.request.body).toEqual({ type: 'graphql', content: 'query { ping }' });
  });

  it('imports form-urlencoded bodies with disabled rows', () => {
    const content = withBody('formUrlEncoded', `body:form-urlencoded {\n  user: alice\n  ~debug: 1\n}\n`);
    const body = parseBruno(content).requests[0]!.request.body;
    expect(body.type).toBe('form');
    expect(body.type === 'form' && stripUids(body.formParts ?? [])).toEqual([
      { key: 'user', value: 'alice' },
      { key: 'debug', value: '1', enabled: false },
    ]);
  });

  it('imports multipart bodies with @file parts as placeholders', () => {
    const content = withBody(
      'multipartForm',
      `body:multipart-form {\n  note: hello\n  avatar: @file(images/me.png)\n}\n`,
    );
    const result = parseBruno(content);
    const body = result.requests[0]!.request.body;
    expect(body.type).toBe('multipart');
    if (body.type !== 'multipart') return;
    expect(body.multipartParts).toHaveLength(2);
    expect(body.multipartParts?.[0]).toMatchObject({ kind: 'text', name: 'note', value: 'hello' });
    expect(body.multipartParts?.[1]).toMatchObject({ kind: 'file', name: 'avatar' });
    expect(result.report.transforms.some((t) => t.tracking === '#todo-file-blobs')).toBe(true);
  });

  it('keeps sparql bodies as text with a transform', () => {
    const content = withBody('sparql', `body:sparql {\n  SELECT * WHERE { ?s ?p ?o }\n}\n`);
    const result = parseBruno(content);
    expect(result.requests[0]!.request.body).toEqual({ type: 'text', content: 'SELECT * WHERE { ?s ?p ?o }' });
    expect(result.report.transforms.some((t) => t.from === 'sparql')).toBe(true);
  });
});

// ── Auth ───────────────────────────────────────────────────────────

describe('parseBruno — auth', () => {
  function withAuth(selector: string, blocks: string): string {
    return `get {\n  url: https://api.openheaders.io/v1/me\n  auth: ${selector}\n}\n\n${blocks}`;
  }

  it('imports basic auth', () => {
    const result = parseBruno(withAuth('basic', `auth:basic {\n  username: alice\n  password: s3cret\n}\n`));
    expect(result.requests[0]!.request.auth).toEqual({ type: 'basic', username: 'alice', password: 's3cret' });
  });

  it('imports bearer auth', () => {
    const result = parseBruno(withAuth('bearer', `auth:bearer {\n  token: tok-1\n}\n`));
    expect(result.requests[0]!.request.auth).toEqual({ type: 'bearer', token: 'tok-1' });
  });

  it('imports apikey auth with queryparams placement', () => {
    const result = parseBruno(
      withAuth('apikey', `auth:apikey {\n  key: api_key\n  value: v-1\n  placement: queryparams\n}\n`),
    );
    expect(result.requests[0]!.request.auth).toEqual({ type: 'api-key', key: 'api_key', value: 'v-1', in: 'query' });
  });

  it('ignores auth blocks that are not selected', () => {
    const result = parseBruno(withAuth('none', `auth:bearer {\n  token: tok-1\n}\n`));
    expect(result.requests[0]!.request.auth).toEqual({ type: 'none' });
  });

  it('drops oauth2 / awsv4 / inherit with tracking entries', () => {
    const oauth = parseBruno(withAuth('oauth2', `auth:oauth2 {\n  client_secret: sh-1\n}\n`));
    expect(oauth.requests[0]!.request.auth).toEqual({ type: 'none' });
    expect(oauth.report.drops.some((d) => d.tracking === '#todo-oauth')).toBe(true);

    const aws = parseBruno(withAuth('awsv4', ''));
    expect(aws.report.drops.some((d) => d.tracking === '#todo-aws-sigv4')).toBe(true);

    const inherit = parseBruno(withAuth('inherit', ''));
    expect(inherit.report.drops.some((d) => d.tracking === '#todo-collection-defaults')).toBe(true);
  });
});

// ── Unsupported blocks ─────────────────────────────────────────────

describe('parseBruno — unsupported blocks', () => {
  it('drops scripts, tests, vars, docs, and settings with reasons', () => {
    const content = `${PING}
script:pre-request {
  req.setHeader('x', '1');
}

tests {
  test("ok", () => {});
}

vars:pre-request {
  token: abc
}

docs {
  This pings the API.
}

settings {
  encodeUrl: true
}
`;
    const result = parseBruno(content);
    expect(result.requests).toHaveLength(1);
    const tracking = result.report.drops.map((d) => d.tracking);
    expect(tracking.filter((t) => t === '#todo-scripts')).toHaveLength(3);
    expect(tracking).toContain('#todo-request-docs');
    expect(tracking).toContain('#todo-request-settings');
  });

  it('reports dict lines that do not parse as key: value', () => {
    const content = `get {
  url: https://api.openheaders.io/ping
}

headers {
  Accept: application/json
  this line is stray
}
`;
    const result = parseBruno(content);
    expect(stripUids(result.requests[0]!.request.headers)).toEqual([{ key: 'Accept', value: 'application/json' }]);
    expect(result.report.drops.some((d) => d.reason.includes('did not parse'))).toBe(true);
  });
});

// ── Folder composition ─────────────────────────────────────────────

describe('parseBrunoFiles — folder composition', () => {
  it('composes a collection from files, dirs, and metadata', () => {
    const result = parseBrunoFiles([
      { path: 'bruno.json', content: JSON.stringify({ version: '1', name: 'Openheaders API', type: 'collection' }) },
      { path: 'ping.bru', content: PING },
      {
        path: 'auth/folder.bru',
        content: `meta {\n  name: Authentication\n}\n`,
      },
      {
        path: 'auth/login.bru',
        content: `meta {\n  name: Login\n  seq: 2\n}\n\npost {\n  url: https://api.openheaders.io/login\n}\n`,
      },
      {
        path: 'auth/logout.bru',
        content: `meta {\n  name: Logout\n  seq: 1\n}\n\npost {\n  url: https://api.openheaders.io/logout\n}\n`,
      },
      {
        path: 'auth/sso/google.bru',
        content: `get {\n  url: https://api.openheaders.io/sso/google\n}\n`,
      },
    ]);

    expect(result.collectionName).toBe('Openheaders API');
    expect(result.folders.map((f) => f.path)).toEqual([['Authentication'], ['Authentication', 'sso']]);
    expect(result.requests.map((r) => [r.request.name, r.folderPath])).toEqual([
      ['Ping', []],
      ['Logout', ['Authentication']],
      ['Login', ['Authentication']],
      ['google', ['Authentication', 'sso']],
    ]);
  });

  it('names the collection from collection.bru when bruno.json is absent', () => {
    const result = parseBrunoFiles([
      { path: 'collection.bru', content: `meta {\n  name: Staging API\n}\n` },
      { path: 'ping.bru', content: PING },
    ]);
    expect(result.collectionName).toBe('Staging API');
  });

  it('drops collection-level defaults with guidance', () => {
    const result = parseBrunoFiles([
      {
        path: 'collection.bru',
        content: `meta {\n  name: API\n}\n\nheaders {\n  X-Env: staging\n}\n\nauth:bearer {\n  token: tok-1\n}\n`,
      },
      { path: 'ping.bru', content: PING },
    ]);
    const paths = result.report.drops.map((d) => d.path);
    expect(paths).toContain('collection.bru.headers');
    expect(paths).toContain('collection.bru.auth:bearer');
    expect(result.report.drops.every((d) => d.tracking === '#todo-collection-defaults')).toBe(true);
  });

  it('parses environments with secret names dropped', () => {
    const result = parseBrunoFiles([
      { path: 'ping.bru', content: PING },
      {
        path: 'environments/staging.bru',
        content: `vars {\n  host: https://staging.openheaders.io\n  ~legacy: 1\n}\n\nvars:secret [\n  apiToken,\n  dbPassword\n]\n`,
      },
    ]);
    expect(result.environments).toEqual([
      { name: 'staging', variables: [{ name: 'host', value: 'https://staging.openheaders.io', type: 'default' }] },
    ]);
    const secretDrop = result.report.drops.find((d) => d.path.includes('vars:secret'));
    expect(secretDrop?.reason).toContain('apiToken');
    expect(result.report.summary.imported).toBe(2);
  });

  it('drops non-.bru files with a reason', () => {
    const result = parseBrunoFiles([
      { path: 'ping.bru', content: PING },
      { path: 'readme.md', content: '# hi' },
    ]);
    expect(result.report.drops.some((d) => d.path === 'readme.md')).toBe(true);
  });

  it('composes a picker-shaped folder after root-prefix stripping', () => {
    const picked = stripBrunoRootPrefix([
      { path: 'My Collection/bruno.json', content: JSON.stringify({ version: '1', name: 'Picked API' }) },
      { path: 'My Collection/ping.bru', content: PING },
      {
        path: 'My Collection/environments/staging.bru',
        content: `vars {\n  host: https://staging.openheaders.io\n}\n`,
      },
    ]);
    const result = parseBrunoFiles(picked);
    expect(result.collectionName).toBe('Picked API');
    expect(result.requests.map((r) => r.request.name)).toEqual(['Ping']);
    expect(result.environments.map((e) => e.name)).toEqual(['staging']);
  });

  it('never leaks secret values into the report', () => {
    const secret = 'super-secret-password-xyz';
    const result = parseBrunoFiles([
      {
        path: 'login.bru',
        content: `post {\n  url: https://api.openheaders.io/login\n  auth: oauth2\n}\n\nauth:oauth2 {\n  client_secret: ${secret}\n}\n`,
      },
    ]);
    expect(JSON.stringify(result.report)).not.toContain(secret);
  });
});

// ── Picker helpers ─────────────────────────────────────────────────

describe('isBrunoImportPath', () => {
  it('accepts .bru files and bruno.json at any depth', () => {
    expect(isBrunoImportPath('ping.bru')).toBe(true);
    expect(isBrunoImportPath('auth/login.BRU')).toBe(true);
    expect(isBrunoImportPath('bruno.json')).toBe(true);
    expect(isBrunoImportPath('environments/staging.bru')).toBe(true);
  });

  it('rejects other files, dot-paths, and node_modules', () => {
    expect(isBrunoImportPath('readme.md')).toBe(false);
    expect(isBrunoImportPath('assets/logo.png')).toBe(false);
    expect(isBrunoImportPath('.git/config.bru')).toBe(false);
    expect(isBrunoImportPath('auth/.hidden.bru')).toBe(false);
    expect(isBrunoImportPath('node_modules/pkg/x.bru')).toBe(false);
  });
});

describe('stripBrunoRootPrefix', () => {
  it('strips the one shared leading directory', () => {
    expect(
      stripBrunoRootPrefix([
        { path: 'coll/bruno.json' },
        { path: 'coll/ping.bru' },
        { path: 'coll/auth/login.bru' },
      ]).map((f) => f.path),
    ).toEqual(['bruno.json', 'ping.bru', 'auth/login.bru']);
  });

  it('strips exactly one level — genuine shared subfolders survive', () => {
    expect(stripBrunoRootPrefix([{ path: 'coll/auth/login.bru' }, { path: 'coll/auth/logout.bru' }]).map((f) => f.path)).toEqual([
      'auth/login.bru',
      'auth/logout.bru',
    ]);
  });

  it('leaves unshared, root-level, and environments-rooted paths alone', () => {
    expect(stripBrunoRootPrefix([{ path: 'a/x.bru' }, { path: 'b/y.bru' }]).map((f) => f.path)).toEqual([
      'a/x.bru',
      'b/y.bru',
    ]);
    expect(stripBrunoRootPrefix([{ path: 'ping.bru' }]).map((f) => f.path)).toEqual(['ping.bru']);
    expect(
      stripBrunoRootPrefix([{ path: 'environments/staging.bru' }, { path: 'environments/prod.bru' }]).map(
        (f) => f.path,
      ),
    ).toEqual(['environments/staging.bru', 'environments/prod.bru']);
  });

  it('normalizes separators while stripping', () => {
    expect(stripBrunoRootPrefix([{ path: 'coll\\ping.bru' }, { path: '/coll/auth/login.bru' }]).map((f) => f.path)).toEqual([
      'ping.bru',
      'auth/login.bru',
    ]);
  });
});
