/**
 * Local-write schema gate at the oracle apply path.
 *
 * The registry declares one `localWriteSchema` per entity kind
 * (`entity-registry.ts`); `buildLocalWriteValidator` composes them and
 * the oracle validates every touched entity's materialized post-state
 * after a LOCAL batch applies — a failing shape rolls the whole batch
 * back with `schema-rejected` and a path-bearing detail. Inbound
 * envelopes (peer wire, hydration seeds, snapshot replay) are exempt
 * by design: a replica-side validation veto would fork CRDT
 * convergence, so malformed persisted data is absorbed by the
 * tolerant read gates instead.
 *
 * Three suites:
 *   1. gate mechanics — reject/rollback/inbound-exempt/delete/unknown
 *   2. registry coverage tripwire — every flat kind declares a schema
 *   3. per-kind seed smoke — a canonical valid entity per gated kind
 *      rides its REAL seed builder through a local apply and passes,
 *      pinning schema ↔ materialized-shape agreement per kind.
 */

import {
  FOLDER_ENTITY_TYPE,
  type MutationBatch,
  type MutatorContext,
  mintBatch,
  REQUEST_ENTITY_TYPE,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedEnvironment } from '@openheaders/core/sync-builders/projections/env-projection';
import { seedFolder } from '@openheaders/core/sync-builders/projections/folder-projection';
import { seedGrpcRequest } from '@openheaders/core/sync-builders/projections/grpc-request-projection';
import { seedGrpcResponseExample } from '@openheaders/core/sync-builders/projections/grpc-response-example-projection';
import { seedLiveVariable } from '@openheaders/core/sync-builders/projections/live-variable-projection';
import { seedLiveWorkflow } from '@openheaders/core/sync-builders/projections/live-workflow-projection';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequestFolder } from '@openheaders/core/sync-builders/projections/request-folder-projection';
import { seedRequest } from '@openheaders/core/sync-builders/projections/request-projection';
import { seedResponseExample } from '@openheaders/core/sync-builders/projections/response-example-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import { seedScriptPackage } from '@openheaders/core/sync-builders/projections/script-package-projection';
import { seedSpec } from '@openheaders/core/sync-builders/projections/spec-projection';
import { seedTemplateCollection } from '@openheaders/core/sync-builders/projections/template-collection-projection';
import { seedTemplateFolder } from '@openheaders/core/sync-builders/projections/template-folder-projection';
import { seedTemplate } from '@openheaders/core/sync-builders/projections/template-projection';
import { seedWebSocketRequest } from '@openheaders/core/sync-builders/projections/websocket-request-projection';
import { seedWsResponseExample } from '@openheaders/core/sync-builders/projections/ws-response-example-projection';
import type {
  Collection,
  Environment,
  Folder,
  GrpcRequest,
  GrpcResponseExample,
  HeaderRule,
  LiveVariable,
  LiveWorkflow,
  Request,
  ResponseExample,
  ScriptPackage,
  Spec,
  Template,
  WebSocketRequest,
  WsResponseExample,
} from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import {
  buildLocalWriteValidator,
  buildSchemaRegistry,
  GLOBAL_REGISTRY,
  WORKSPACE_REGISTRY,
} from '../../src/sync/entity-registry';
import { InMemoryMutationLog } from '../../src/sync/mutation-log';
import { EntityOracle } from '../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../src/sync/pending-intents';

const FIXED_TIMESTAMP = '2026-04-27T18:30:00.000Z';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function makeOracle(): { oracle: EntityOracle; published: () => number } {
  const broadcast = new InMemoryBroadcast();
  let count = 0;
  broadcast.subscribe(() => {
    count += 1;
  });
  const oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock: async (_ws, _type, _id, fn) => fn(),
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
    validateLocalWrite: buildLocalWriteValidator(WORKSPACE_REGISTRY),
  });
  return { oracle, published: () => count };
}

// ── Fixtures (schema-valid by construction) ─────────────────────────

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'rq000001',
    path: 'requests/login-rq000001',
    name: 'Login',
    method: 'POST',
    url: 'https://api.openheaders.io/login',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

const headerRule: HeaderRule = {
  schemaVersion: 5,
  uid: 'r0000001',
  path: 'rules/auth-r0000001',
  name: 'Auth',
  type: 'header',
  enabled: true,
  conditions: [],
  action: { requestHeaders: [], responseHeaders: [] },
};

const environment: Environment = {
  schemaVersion: 5,
  uid: 'env00001',
  path: 'environments/staging-env00001',
  name: 'Staging',
  variables: [],
};

const collection: Collection = {
  schemaVersion: 5,
  uid: 'col00001',
  path: 'collections/api-calls-col00001',
  name: 'API Calls',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};

const folder: Folder = {
  schemaVersion: 5,
  uid: 'fld00001',
  path: 'collections/api-calls-col00001/auth-fld00001',
  name: 'Auth',
};

const template: Template = {
  schemaVersion: 5,
  uid: 'tpl00001',
  path: 'templates/bearer-tpl00001',
  name: 'Bearer',
  ruleType: 'header',
  icon: 'shield',
  description: '',
  includes: { conditions: true, formValues: true },
  conditions: [],
  formValues: {},
  createdAt: FIXED_TIMESTAMP,
  updatedAt: FIXED_TIMESTAMP,
};

const liveWorkflow: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wf000001',
  path: 'live-workflows/refresh-token-wf000001',
  name: 'Refresh token',
  enabled: true,
  steps: [{ uid: 'stp00001', id: 's1', requestUid: 'rq000001', captures: [] }],
  refresh: { kind: 'manual' },
};

const liveVariable: LiveVariable = {
  schemaVersion: 5,
  uid: 'lv000001',
  path: 'live-variables/token-lv000001',
  name: 'TOKEN',
  enabled: true,
  workflowUid: 'wf000001',
  stepId: 's1',
  captureName: 'token',
};

const grpcRequest: GrpcRequest = {
  schemaVersion: 5,
  uid: 'grpc0001',
  path: 'requests/library-grpc0001',
  name: 'Create Book',
  url: 'grpc.openheaders.io:443',
  tls: true,
  method: { service: 'library.v1.Library', rpc: 'CreateBook' },
  message: '{"title": "The Library"}',
  metadata: [],
};

const websocketRequest: WebSocketRequest = {
  schemaVersion: 5,
  uid: 'wsrq0001',
  path: 'requests/live-events-wsrq0001',
  name: 'Live Events',
  url: 'wss://events.openheaders.io/live',
  flavor: 'raw',
  subprotocols: [],
  headers: [],
  params: [],
  message: '{"event": "subscribe"}',
  messageFormat: 'json',
};

const scriptPackage: ScriptPackage = {
  schemaVersion: 5,
  uid: 'spk00001',
  path: 'script-packages/utils-spk00001',
  name: 'utils',
  source: 'module.exports = {};',
};

const spec: Spec = {
  schemaVersion: 5,
  uid: 'spc00001',
  path: 'specs/openheaders-api-spc00001',
  name: 'OpenHeaders API',
  format: 'openapi-3.1',
  rootFileUid: 'fil00001',
  files: [{ uid: 'fil00001', fileName: 'index.yaml', content: 'openapi: 3.1.0\n' }],
};

const responseExample: ResponseExample = {
  schemaVersion: 5,
  uid: 'rex00001',
  path: 'requests/login-rq000001/examples/ok-rex00001',
  requestUid: 'rq000001',
  name: 'OK',
  capturedAt: FIXED_TIMESTAMP,
  request: {
    method: 'POST',
    url: 'https://api.openheaders.io/login',
    headers: [],
    params: [],
    body: { type: 'none' },
  },
  response: {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/login',
    headers: [],
    body: '{"ok":true}',
    bodyTruncated: false,
    bodyBytes: 11,
    durationMs: 12,
  },
};

const grpcResponseExample: GrpcResponseExample = {
  schemaVersion: 5,
  uid: 'gex00001',
  path: 'requests/library-grpc0001/examples/ok-gex00001',
  grpcRequestUid: 'grpc0001',
  name: 'OK',
  capturedAt: FIXED_TIMESTAMP,
  request: {
    url: 'grpc.openheaders.io:443',
    tls: true,
    sslVerification: true,
    method: { service: 'library.v1.Library', rpc: 'CreateBook' },
    metadata: [],
    message: '{}',
  },
  response: {
    grpcStatus: 0,
    statusSource: 'trailers',
    metadata: [],
    trailers: [],
    messages: [],
    bodyTruncated: false,
    bodyBytes: 0,
    durationMs: 8,
  },
};

const wsResponseExample: WsResponseExample = {
  schemaVersion: 5,
  uid: 'wex00001',
  path: 'requests/live-events-wsrq0001/examples/ok-wex00001',
  websocketRequestUid: 'wsrq0001',
  name: 'OK',
  capturedAt: FIXED_TIMESTAMP,
  request: {
    url: 'wss://events.openheaders.io/live',
    flavor: 'raw',
    sslVerification: true,
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
  },
  response: {
    protocol: '',
    extensions: '',
    messages: [],
    droppedMessages: 0,
    close: { code: 1000, reason: '', wasClean: true },
    durationMs: 40,
  },
};

// ── 1. Gate mechanics ───────────────────────────────────────────────

describe('local-write schema gate mechanics', () => {
  it('rejects a malformed local create with a path-bearing schema-rejected failure and rolls back', async () => {
    const { oracle, published } = makeOracle();
    const malformed = makeRequest({ body: { type: 'form' } as unknown as Request['body'] });

    const result = await oracle.apply(seedRequest(malformed, ctx(1_000)), [], 'local');

    expect(result.ok).toBe(false);
    expect(result.failure?.status).toBe('schema-rejected');
    expect(result.failure?.detail).toMatch(/formParts/);
    expect(oracle.materializeOne(REQUEST_ENTITY_TYPE, malformed.uid)).toBeNull();
    expect(published()).toBe(0);
  });

  it('applies the same malformed envelopes when inbound — convergence is never vetoed', async () => {
    const { oracle } = makeOracle();
    const malformed = makeRequest({ body: { type: 'form' } as unknown as Request['body'] });
    const batch = seedRequest(malformed, ctx(1_000));

    await oracle.apply(batch, [], 'local'); // rejected + rolled back (incl. dedup set)
    const inbound = await oracle.apply(batch, [], 'inbound');

    expect(inbound.ok).toBe(true);
    expect(oracle.materializeOne(REQUEST_ENTITY_TYPE, malformed.uid)).not.toBeNull();
  });

  it('rejects a local update that would converge on an invalid post-state and keeps the prior state', async () => {
    const { oracle } = makeOracle();
    const valid = makeRequest();
    const created = await oracle.apply(seedRequest(valid, ctx(1_000)), [], 'local');
    expect(created.ok).toBe(true);

    const update: MutationBatch = mintBatch(ctx(2_000), [
      { kind: 'setField', type: REQUEST_ENTITY_TYPE, id: valid.uid, path: 'body.type', value: 'form' },
    ]);
    const result = await oracle.apply(update, [], 'local');

    expect(result.ok).toBe(false);
    expect(result.failure?.status).toBe('schema-rejected');
    const materialized = oracle.materializeOne(REQUEST_ENTITY_TYPE, valid.uid);
    expect(materialized).not.toBeNull();
    expect((materialized!.data as Request).body).toEqual({ type: 'none' });
  });

  it('lets a local delete pass — tombstoned entities materialize to null and skip the gate', async () => {
    const { oracle } = makeOracle();
    const valid = makeRequest();
    await oracle.apply(seedRequest(valid, ctx(1_000)), [], 'local');

    const del = mintBatch(ctx(2_000), [{ kind: 'delete', type: REQUEST_ENTITY_TYPE, id: valid.uid }]);
    const result = await oracle.apply(del, [], 'local');

    expect(result.ok).toBe(true);
    expect(oracle.materializeOne(REQUEST_ENTITY_TYPE, valid.uid)).toBeNull();
  });

  it('passes entity kinds without a registered schema through ungated', async () => {
    const { oracle } = makeOracle();
    const batch = mintBatch(ctx(1_000), [
      { kind: 'create', type: 'oh.probeKind', id: 'probe001', payload: { anything: true } },
    ]);
    const result = await oracle.apply(batch, [], 'local');
    expect(result.ok).toBe(true);
  });

  it('rejects a malformed folder shell against the bespoke materialized-shape schema', async () => {
    const { oracle } = makeOracle();
    const batch = mintBatch(ctx(1_000), [
      { kind: 'create', type: FOLDER_ENTITY_TYPE, id: 'fld00002', payload: { schemaVersion: 5, name: 'No segment' } },
    ]);
    const result = await oracle.apply(batch, [], 'local');
    expect(result.ok).toBe(false);
    expect(result.failure?.status).toBe('schema-rejected');
    expect(result.failure?.detail).toMatch(/pathSegment/);
  });
});

// ── 2. Registry coverage tripwire ───────────────────────────────────

describe('local-write schema registry coverage', () => {
  it('every flat registration declares a localWriteSchema', () => {
    for (const reg of [...WORKSPACE_REGISTRY, ...GLOBAL_REGISTRY]) {
      if (reg.kind !== 'flat') continue;
      expect(reg.localWriteSchema, `${reg.entityType} must declare a localWriteSchema`).not.toBeNull();
    }
  });
});

// ── 3. Per-kind seed smoke — schema ↔ materialized-shape agreement ──

describe('local-write gate accepts every gated kind’s canonical seed', () => {
  const cases: Array<{ label: string; seed: (c: MutatorContext) => MutationBatch }> = [
    { label: 'rule', seed: (c) => seedRule(headerRule, c) },
    { label: 'environment', seed: (c) => seedEnvironment(environment, c) },
    { label: 'collection', seed: (c) => seedCollection(collection, c) },
    { label: 'folder', seed: (c) => seedFolder(folder, c) },
    { label: 'request', seed: (c) => seedRequest(makeRequest(), c) },
    { label: 'grpc request', seed: (c) => seedGrpcRequest(grpcRequest, c) },
    { label: 'websocket request', seed: (c) => seedWebSocketRequest(websocketRequest, c) },
    { label: 'request collection', seed: (c) => seedRequestCollection(collection, c) },
    { label: 'request folder', seed: (c) => seedRequestFolder(folder, c) },
    { label: 'template', seed: (c) => seedTemplate(template, c) },
    { label: 'template collection', seed: (c) => seedTemplateCollection(collection, c) },
    { label: 'template folder', seed: (c) => seedTemplateFolder(folder, c) },
    { label: 'live variable', seed: (c) => seedLiveVariable(liveVariable, c) },
    { label: 'live workflow', seed: (c) => seedLiveWorkflow(liveWorkflow, c) },
    { label: 'script package', seed: (c) => seedScriptPackage(scriptPackage, c) },
    { label: 'spec', seed: (c) => seedSpec(spec, c) },
    { label: 'response example', seed: (c) => seedResponseExample(responseExample, c) },
    { label: 'grpc response example', seed: (c) => seedGrpcResponseExample(grpcResponseExample, c) },
    { label: 'ws response example', seed: (c) => seedWsResponseExample(wsResponseExample, c) },
  ];

  for (const { label, seed } of cases) {
    it(`${label}: a canonical valid seed applies locally`, async () => {
      const { oracle } = makeOracle();
      const result = await oracle.apply(seed(ctx(1_000)), [], 'local');
      expect(result.failure?.detail, label).toBeUndefined();
      expect(result.ok).toBe(true);
    });
  }
});
