import { describe, expect, it } from 'vitest';
import {
  addRequestHeader,
  addRequestParam,
  createRequest,
  deleteRequest,
  type MutatorContext,
  removeRequestHeader,
  removeRequestParam,
  reorderRequestHeader,
  reorderRequestParam,
  REQUEST_ENTITY_TYPE,
  REQUEST_HEADERS_PATH,
  REQUEST_MUTATOR_VERSION,
  REQUEST_PARAMS_PATH,
  setRequestField,
} from '../../../../src/sync';

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 1_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

describe('addRequestHeader', () => {
  it('emits one addToSet on the request entity at the headers path', () => {
    const intent = addRequestHeader(ctx(), {
      requestUid: 'rq-1',
      header: { uid: 'hdr00001', key: 'Authorization', value: 'Bearer abc' },
      orderKey: 'm',
      itemId: 'h-1',
    });
    expect(intent.batch.mutations).toHaveLength(1);
    const env = intent.batch.mutations[0];
    expect(env.mutatorVersion).toBe(REQUEST_MUTATOR_VERSION);
    expect(env.body).toEqual({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
      path: REQUEST_HEADERS_PATH,
      itemId: 'h-1',
      item: { uid: 'hdr00001', key: 'Authorization', value: 'Bearer abc' },
      orderKey: 'm',
    });
    expect(intent.sideEffects).toEqual([]);
  });

  it("defaults itemId to the header's persisted uid when not overridden", () => {
    const intent = addRequestHeader(ctx(), {
      requestUid: 'rq-1',
      header: { uid: 'hdr00077', key: 'X-Trace', value: 't1' },
    });
    const body = intent.batch.mutations[0].body;
    if (body.kind !== 'addToSet') throw new Error('expected addToSet');
    expect(body.itemId).toBe('hdr00077');
    expect(body.orderKey).toBeUndefined();
  });
});

describe('removeRequestHeader', () => {
  it('emits a single removeFromSet on the headers path', () => {
    const intent = removeRequestHeader(ctx(), { requestUid: 'rq-1', itemId: 'h-1' });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
      path: REQUEST_HEADERS_PATH,
      itemId: 'h-1',
    });
  });
});

describe('reorderRequestHeader', () => {
  it('emits a moveBefore carrying the writer-committed orderKey', () => {
    const intent = reorderRequestHeader(ctx(), {
      requestUid: 'rq-1',
      itemId: 'h-1',
      orderKey: 'qz',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'moveBefore',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
      path: REQUEST_HEADERS_PATH,
      itemId: 'h-1',
      orderKey: 'qz',
    });
  });
});

describe('param factories route to the params path', () => {
  it('addRequestParam', () => {
    const intent = addRequestParam(ctx(), {
      requestUid: 'rq-1',
      param: { uid: 'qpr00001', key: 'q', value: '1', hasEquals: true },
      itemId: 'p-1',
    });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      path: REQUEST_PARAMS_PATH,
      itemId: 'p-1',
      item: { uid: 'qpr00001', key: 'q', value: '1', hasEquals: true },
    });
  });

  it('removeRequestParam', () => {
    const intent = removeRequestParam(ctx(), { requestUid: 'rq-1', itemId: 'p-1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'removeFromSet',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
      path: REQUEST_PARAMS_PATH,
      itemId: 'p-1',
    });
  });

  it('reorderRequestParam', () => {
    const intent = reorderRequestParam(ctx(), { requestUid: 'rq-1', itemId: 'p-1', orderKey: 'a' });
    expect(intent.batch.mutations[0].body).toMatchObject({
      kind: 'moveBefore',
      path: REQUEST_PARAMS_PATH,
      itemId: 'p-1',
      orderKey: 'a',
    });
  });
});

describe('setRequestField', () => {
  it('emits a setField at any of the typed scalar paths', () => {
    const intent = setRequestField(ctx(), {
      requestUid: 'rq-1',
      path: 'url',
      value: 'https://api.openheaders.io/v1',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
      path: 'url',
      value: 'https://api.openheaders.io/v1',
    });
  });

  it('routes auth + body through the same scalar contract (variant whole-object replace)', () => {
    const authIntent = setRequestField(ctx(), {
      requestUid: 'rq-1',
      path: 'auth',
      value: { type: 'bearer', token: 't' },
    });
    expect(authIntent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'auth',
      value: { type: 'bearer', token: 't' },
    });

    const bodyIntent = setRequestField(ctx(), {
      requestUid: 'rq-1',
      path: 'body',
      value: { type: 'json', content: '{"x":1}' },
    });
    expect(bodyIntent.batch.mutations[0].body).toMatchObject({
      kind: 'setField',
      path: 'body',
      value: { type: 'json', content: '{"x":1}' },
    });
  });
});

describe('createRequest', () => {
  it('mints a single create envelope carrying the full payload', () => {
    const payload = {
      schemaVersion: 5,
      path: 'requests/col/req',
      name: 'list users',
      method: 'GET',
      url: 'https://api.openheaders.io/v1/users',
      headers: [],
      params: [],
      auth: { type: 'inherit' },
      body: { type: 'none' },
    };
    const intent = createRequest(ctx(), { requestUid: 'rq-1', payload });
    expect(intent.batch.mutations).toHaveLength(1);
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'create',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
      payload,
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('deleteRequest', () => {
  it('emits a single delete envelope', () => {
    const intent = deleteRequest(ctx(), { requestUid: 'rq-1' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'delete',
      type: REQUEST_ENTITY_TYPE,
      id: 'rq-1',
    });
  });
});

describe('batch atomicity', () => {
  it('shares one batchId across emitted envelopes when ctx.batchId is supplied', () => {
    const intent = addRequestHeader(ctx({ batchId: 'b-add-header' }), {
      requestUid: 'rq-1',
      header: { uid: 'hdr00099', key: 'X', value: 'y' },
    });
    expect(intent.batch.batchId).toBe('b-add-header');
  });
});
