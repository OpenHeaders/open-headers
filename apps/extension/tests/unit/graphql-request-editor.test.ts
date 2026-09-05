/**
 * Unit tests for the GraphQL editor's pure modules:
 *
 *   - `draft.ts` — draft ⇄ entity projections whose fingerprints drive
 *     derived dirty (form-vs-canonical equality): the header-row
 *     round-trip, the '' ↔ absent mapping of variables / operationName
 *     / the script pair, the HTTP knobs' tri-state, and the proxy pair
 *     riding the mode.
 *   - `graphql-editor-services.ts` — the diagnostics the Query editor
 *     marks: the parser's error on a broken document, the schema-free
 *     validation subset on a whole one, nothing on a clean one.
 *   - `local-tree-builder.ts` — every request kind sharing the
 *     collection tree, GraphQL leaves alongside the MQTT ones.
 *   - `request-kind-menu.tsx` — the GQL badge in the create menus and
 *     the HTTP script group naming the GraphQL flavor.
 *   - `languages/graphql.ts` — the Monarch grammar registers its id,
 *     tokenizer and configuration on a Monaco-shaped stub.
 */

import type { Collection, GraphqlRequest, MqttRequest, Request } from '@openheaders/core/types';
import { buildRequestCollectionTrees } from '@openheaders/ui/shared/local-tree-builder';
import {
  buildGraphqlRequestUpdates,
  canonicalGraphqlRequestProjection,
  draftFromGraphqlRequest,
  headersToRows,
  rowsToHeaders,
} from '@openheaders/ui/workbench/components/graphql-request-editor/draft';
import { graphqlDiagnostics } from '@openheaders/ui/workbench/components/graphql-request-editor/graphql-editor-services';
import { scriptSlotGroupsFor } from '@openheaders/ui/workbench/components/script-editor/script-slots';
import { REQUEST_KIND_COLORS } from '@openheaders/ui/workbench/components/sidebar/icons';
import { registerGraphqlLanguage } from '@openheaders/ui/workbench/languages/graphql';
import { toMonacoLanguage } from '@openheaders/ui/workbench/languages/registry';
import { ALL_REQUEST_KINDS, requestKindMeta } from '@openheaders/ui/workbench/request-kind-menu';
import { describe, expect, it } from 'vitest';

const graphqlRequest = (overrides: Partial<GraphqlRequest> = {}): GraphqlRequest => ({
  schemaVersion: 5,
  uid: 'gqrq0001',
  path: 'requests/viewer-gqrq0001',
  name: 'Viewer',
  url: 'https://api.openheaders.io/graphql',
  query: 'query Viewer($first: Int) { viewer { id notes(first: $first) { id } } }',
  variables: '{"first": 10}',
  operationName: 'Viewer',
  headers: [
    { uid: 'gqhd0001', key: 'X-Tenant', value: 'openheaders', enabled: true },
    { uid: 'gqhd0002', key: 'X-Trace', value: 'on', description: 'tracing', enabled: false },
  ],
  auth: { type: 'inherit' },
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('graphql draft projections', () => {
  it('round-trips an entity through the draft byte-identically on the fingerprint', () => {
    const entity = graphqlRequest({ preRequestScript: 'pre();', sslVerification: false });
    const draft = draftFromGraphqlRequest(entity);
    expect(buildGraphqlRequestUpdates(draft)).toEqual(canonicalGraphqlRequestProjection(entity));
    expect(draft.variables).toBe('{"first": 10}');
    expect(draft.operationName).toBe('Viewer');
    expect(draft.preRequestScript).toBe('pre();');
    expect(draft.postResponseScript).toBe('');
    expect(draft.sslVerification).toBe(false);
  });

  it('maps the empty form fields to absent on the patch — variables, the operation pick, the script pair', () => {
    const updates = buildGraphqlRequestUpdates(
      draftFromGraphqlRequest(
        graphqlRequest({ variables: undefined, operationName: undefined, preRequestScript: '   ' }),
      ),
    );
    expect(updates.variables).toBeUndefined();
    expect(updates.operationName).toBeUndefined();
    expect(updates.preRequestScript).toBeUndefined();
    expect(updates.postResponseScript).toBeUndefined();
    expect(updates.query).toBe(graphqlRequest().query);
  });

  it('keeps the HTTP knobs tri-state — an absent knob stays absent, an explicit one rides verbatim', () => {
    const updates = buildGraphqlRequestUpdates(draftFromGraphqlRequest(graphqlRequest({ followRedirects: false })));
    expect(updates.followRedirects).toBe(false);
    expect(updates.timeoutMs).toBe(30_000);
    expect(updates.httpVersion).toBeUndefined();
    expect(updates.cookieJar).toBeUndefined();
    // Every knob is a key on the patch so a cleared one tombstones.
    expect(Object.keys(updates)).toContain('maxRedirects');
  });

  it('drops the proxy URL and credential when the mode is cleared (the pair rides the mode)', () => {
    const draft = draftFromGraphqlRequest(
      graphqlRequest({ proxyMode: 'url', proxyUrl: 'http://proxy.openheaders.io:8080', proxyCredentialRef: 'corp' }),
    );
    expect(buildGraphqlRequestUpdates(draft).proxyUrl).toBe('http://proxy.openheaders.io:8080');
    const cleared = buildGraphqlRequestUpdates({ ...draft, proxyMode: undefined });
    expect(cleared.proxyMode).toBeUndefined();
    expect(cleared.proxyUrl).toBeUndefined();
    expect(cleared.proxyCredentialRef).toBeUndefined();
  });

  it('projects header rows both ways, trimming the grid ghost and keeping identity + description', () => {
    const rows = headersToRows(graphqlRequest().headers);
    expect(rows.map((r) => r.uid)).toEqual(['gqhd0001', 'gqhd0002']);
    expect(rows[1].description).toBe('tracing');
    expect(rows[1].enabled).toBe(false);
    const ghost = { ...rows[0], uid: 'ghost000', key: '', value: '', description: '' };
    expect(rowsToHeaders([...rows, ghost])).toEqual(graphqlRequest().headers);
  });
});

describe('graphql editor diagnostics (schema-free)', () => {
  it('marks nothing on a well-formed document', () => {
    expect(graphqlDiagnostics('query Viewer($first: Int) { viewer(first: $first) { id } }', null)).toEqual([]);
  });

  it('reports the parser’s error on a broken document', () => {
    const diagnostics = graphqlDiagnostics('query { viewer { id }', null);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].rule).toBe('syntax');
  });

  it('reports the schema-free validation rules — an undefined variable, an unknown fragment', () => {
    const rules = graphqlDiagnostics('query { viewer(first: $first) { ...Bits } }', null).map((d) => d.rule);
    expect(rules).toContain('undefined-variable');
    expect(rules).toContain('unknown-fragment');
  });
});

describe('graphql leaves in the collection tree', () => {
  const collection: Collection = {
    schemaVersion: 5,
    uid: 'c0ll0001',
    path: 'requests/api-c0ll0001',
    name: 'API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  };
  const http: Request = {
    schemaVersion: 5,
    uid: 'req00001',
    path: 'requests/api-c0ll0001/ping-req00001',
    name: 'Ping',
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [],
    params: [],
    auth: { type: 'inherit' },
    body: { type: 'none' },
  };
  const mqtt: MqttRequest = {
    schemaVersion: 5,
    uid: 'mqrq0001',
    path: 'requests/api-c0ll0001/lighting-mqrq0001',
    name: 'Lighting',
    url: 'mqtt://broker.openheaders.io:1883',
    topic: '',
    payload: '',
    topics: [],
    savedMessages: [],
    userProperties: [],
  };

  it('lands a graphql-request node beside the HTTP and MQTT leaves', () => {
    const trees = buildRequestCollectionTrees(
      [collection],
      [],
      [http],
      [],
      [],
      [mqtt],
      [graphqlRequest({ path: 'requests/api-c0ll0001/viewer-gqrq0001' })],
    );
    expect(trees[0].tree.map((n) => n.type)).toEqual(['request', 'mqtt-request', 'graphql-request']);
    const leaf = trees[0].tree[2];
    expect(leaf.type === 'graphql-request' && leaf.name).toBe('Viewer');
  });
});

describe('the GraphQL kind in the workbench vocabulary', () => {
  it('carries the GQL badge, its own color, and closes the create-menu order', () => {
    expect(requestKindMeta('graphql').code).toBe('GQL');
    expect(ALL_REQUEST_KINDS.map((k) => k.key)).toEqual(['http', 'grpc', 'websocket', 'socketio', 'mqtt', 'graphql']);
    expect(REQUEST_KIND_COLORS.graphql).not.toBe(REQUEST_KIND_COLORS.http);
  });

  it('reads the HTTP script group as its flavor — no group of its own', () => {
    const groups = scriptSlotGroupsFor('graphql');
    expect(groups.map((g) => g.requestKind)).toEqual(['http']);
    expect(groups[0].flavors).toEqual(['graphql']);
    expect(groups[0].slots.map((s) => s.kind)).toEqual(['pre-request', 'post-response']);
  });

  it('maps the graphql language id to its own Monaco grammar — the plaintext fallback is gone', () => {
    expect(toMonacoLanguage('graphql')).toBe('graphql');
    const registered: string[] = [];
    const tokenizers: string[] = [];
    const configurations: string[] = [];
    registerGraphqlLanguage({
      languages: {
        register: (def) => {
          registered.push(def.id);
        },
        setMonarchTokensProvider: (id) => {
          tokenizers.push(id);
          return { dispose: () => {} };
        },
        setLanguageConfiguration: (id) => {
          configurations.push(id);
          return { dispose: () => {} };
        },
      },
    });
    expect(registered).toEqual(['graphql']);
    expect(tokenizers).toEqual(['graphql']);
    expect(configurations).toEqual(['graphql']);
  });
});
