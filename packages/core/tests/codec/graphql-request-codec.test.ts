import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import { parseGraphqlRequest, serializeGraphqlRequest } from '../../src/codec/yaml';
import { freshDocument, mergePatch } from '../../src/schemas/document';
import type { GraphqlRequest } from '../../src/types';

const QUERY = 'query Viewer($first: Int) {\n  viewer {\n    id\n    notes(first: $first) {\n      id\n    }\n  }\n}\n';
const VARIABLES = '{\n  "first": 10\n}';

const graphqlRequest = (overrides: Partial<GraphqlRequest> = {}): GraphqlRequest => ({
  schemaVersion: 5,
  uid: 'gqrq0001',
  path: 'requests/viewer-gqrq0001',
  name: 'Viewer',
  url: 'https://api.openheaders.io/graphql',
  query: QUERY,
  variables: VARIABLES,
  operationName: 'Viewer',
  headers: [
    { uid: 'gqhd0001', key: 'X-Tenant', value: 'openheaders', enabled: true },
    { uid: 'gqhd0002', key: 'X-Trace', value: 'on', description: 'tracing' },
  ],
  auth: { type: 'inherit' },
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('serializeGraphqlRequest', () => {
  it('keeps the document and the variables out of the manifest and fans them out to siblings', () => {
    const out = serializeGraphqlRequest(freshDocument(graphqlRequest()));
    expect(out.graphqlYaml).not.toContain('viewer {');
    expect(out.graphqlYaml).not.toContain('"first": 10');
    expect(out.graphqlYaml).toContain('url: https://api.openheaders.io/graphql');
    expect(out.graphqlYaml).toContain('operationName: Viewer');
    expect(out.queryFile).toEqual({ fileName: 'query.graphql', content: QUERY });
    expect(out.variablesFile).toEqual({ fileName: 'variables.json', content: VARIABLES });
  });

  it('emits no document sibling for an empty query and no variables sibling when absent', () => {
    const out = serializeGraphqlRequest(freshDocument(graphqlRequest({ query: '', variables: undefined })));
    expect(out.queryFile).toBeNull();
    expect(out.variablesFile).toBeNull();
  });

  it('strips the runtime-only path from the manifest', () => {
    const out = serializeGraphqlRequest(freshDocument(graphqlRequest()));
    expect(out.graphqlYaml).not.toContain('requests/viewer-gqrq0001');
  });

  it('orders manifest fields metadata-top (invariant #6)', () => {
    const out = serializeGraphqlRequest(
      freshDocument(graphqlRequest({ description: 'ordered', sslVerification: false })),
    );
    const keys = Object.keys(YAML.parse(out.graphqlYaml) as Record<string, unknown>);
    expect(keys).toEqual([
      'schemaVersion',
      'uid',
      'name',
      'description',
      'url',
      'operationName',
      'headers',
      'auth',
      'specLink',
      'sslVerification',
      'timeoutMs',
    ]);
  });
});

describe('parseGraphqlRequest', () => {
  const siblingsOf = (out: ReturnType<typeof serializeGraphqlRequest>) => [
    ...(out.queryFile ? [out.queryFile] : []),
    ...(out.variablesFile ? [out.variablesFile] : []),
    ...out.scriptFiles,
  ];

  it('round-trips serialize → parse byte-identically', () => {
    const entity = graphqlRequest({ description: 'round trip' });
    const out = serializeGraphqlRequest(freshDocument(entity));
    const parsed = parseGraphqlRequest(out.graphqlYaml, { path: entity.path, siblings: siblingsOf(out) });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips a minimal request (no rows, no spec link, no document)', () => {
    const entity = graphqlRequest({
      query: '',
      variables: undefined,
      operationName: undefined,
      headers: [],
      specLink: undefined,
      timeoutMs: undefined,
    });
    const out = serializeGraphqlRequest(freshDocument(entity));
    const parsed = parseGraphqlRequest(out.graphqlYaml, { path: entity.path, siblings: [] });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips the HTTP settings knobs', () => {
    const entity = graphqlRequest({
      credentialsMode: 'include',
      followRedirects: false,
      sslVerification: false,
      tlsMinVersion: '1.2',
      tlsMaxVersion: '1.3',
      tlsCipherSuites: 'TLS_AES_256_GCM_SHA384',
      sniServerName: 'api.openheaders.io',
      httpVersion: '2',
      resolveToAddress: '10.0.0.12',
      clientCertificateRef: 'api-client',
      proxyMode: 'url',
      proxyUrl: 'http://proxy.openheaders.io:8080',
      proxyCredentialRef: 'corp-proxy',
      cookieJar: true,
      maxResponseBytes: 4_096,
      maxRedirects: 3,
      followOriginalHttpMethod: true,
      followAuthorizationHeader: true,
    });
    const out = serializeGraphqlRequest(freshDocument(entity));
    expect(out.graphqlYaml).toContain('httpVersion: "2"');
    const parsed = parseGraphqlRequest(out.graphqlYaml, { path: entity.path, siblings: siblingsOf(out) });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips the auth block under the HTTP mask — templates intact', () => {
    for (const auth of [
      { type: 'none' } as const,
      { type: 'bearer', token: '{{token}}' } as const,
      { type: 'api-key', key: 'X-Api-Key', value: '{{apiKey}}', in: 'header' } as const,
    ]) {
      const entity = graphqlRequest({ auth });
      const out = serializeGraphqlRequest(freshDocument(entity));
      const parsed = parseGraphqlRequest(out.graphqlYaml, { path: entity.path, siblings: siblingsOf(out) });
      expect(parsed.value).toEqual(entity);
    }
  });

  it('parses a missing document sibling as the empty draft', () => {
    const out = serializeGraphqlRequest(freshDocument(graphqlRequest()));
    const parsed = parseGraphqlRequest(out.graphqlYaml, { path: 'requests/viewer-gqrq0001', siblings: [] });
    expect(parsed.value.query).toBe('');
    expect(parsed.value.variables).toBeUndefined();
  });

  it('ignores unrecognized siblings', () => {
    const out = serializeGraphqlRequest(freshDocument(graphqlRequest()));
    const parsed = parseGraphqlRequest(out.graphqlYaml, {
      path: 'requests/viewer-gqrq0001',
      siblings: [{ fileName: 'notes.txt', content: 'scratch' }, ...siblingsOf(out)],
    });
    expect(parsed.value.query).toBe(QUERY);
  });

  it('preserves unknown manifest keys through a round-trip (invariant #4)', () => {
    const out = serializeGraphqlRequest(freshDocument(graphqlRequest()));
    const doc = YAML.parseDocument(out.graphqlYaml);
    doc.set('futureKey', 'kept');
    const parsed = parseGraphqlRequest(doc.toString(), { path: 'requests/viewer-gqrq0001', siblings: siblingsOf(out) });
    const reserialized = serializeGraphqlRequest(mergePatch(parsed, () => {}));
    expect(reserialized.graphqlYaml).toContain('futureKey: kept');
  });

  it('normalizes header row key order (canonicalize)', () => {
    const entity = graphqlRequest({
      headers: [
        {
          enabled: true,
          value: 'on',
          uid: 'gqhd0003',
          key: 'X-Trace',
          description: 'note',
        } as GraphqlRequest['headers'][number],
      ],
    });
    const out = serializeGraphqlRequest(freshDocument(entity));
    const parsed = YAML.parse(out.graphqlYaml) as { headers: Array<Record<string, unknown>> };
    expect(Object.keys(parsed.headers[0])).toEqual(['uid', 'key', 'value', 'description', 'enabled']);
  });
});

describe('script siblings', () => {
  it('fans the HTTP pair out one file per slot and reads them back, session kinds ignored', () => {
    const entity = graphqlRequest({
      preRequestScript: 'oh.request.headers.set("X-Probe", "1");\n',
      postResponseScript: 'oh.test("ok", () => {});\n',
    });
    const out = serializeGraphqlRequest(freshDocument(entity));
    expect(out.graphqlYaml).not.toContain('Script');
    expect(out.scriptFiles).toEqual([
      { fileName: 'pre-request.js', content: entity.preRequestScript },
      { fileName: 'post-response.js', content: entity.postResponseScript },
    ]);
    const parsed = parseGraphqlRequest(out.graphqlYaml, {
      path: entity.path,
      siblings: [
        ...out.scriptFiles,
        { fileName: 'query.graphql', content: QUERY },
        { fileName: 'variables.json', content: VARIABLES },
        { fileName: 'ws-on-message.js', content: 'foreign();' },
      ],
    });
    expect(parsed.value).toEqual(entity);
  });
});
