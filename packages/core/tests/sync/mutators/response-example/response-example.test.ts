import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ResponseExampleSchema } from '../../../../src/schemas';
import {
  createResponseExample,
  deleteResponseExample,
  type MutatorContext,
  REQUEST_ENTITY_TYPE,
  REQUEST_EXAMPLES_PATH,
  RESPONSE_EXAMPLE_ENTITY_TYPE,
  RESPONSE_EXAMPLE_MUTATOR_VERSION,
  responseExampleChild,
  setResponseExampleField,
} from '../../../../src/sync';
import {
  buildAddResponseExampleBatch,
  buildDeleteResponseExampleBatch,
  buildDeleteResponseExampleEntityBatch,
  buildRenameResponseExampleBatch,
} from '../../../../src/sync-builders/mutations/response-example-mutations';
import {
  projectResponseExample,
  seedResponseExample,
} from '../../../../src/sync-builders/projections/response-example-projection';
import type { ResponseExample } from '../../../../src/types';

const parent = { type: REQUEST_ENTITY_TYPE, uid: 'req00001' } as const;

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const example = (overrides: Partial<ResponseExample> = {}): ResponseExample => ({
  schemaVersion: 5,
  uid: 'ex000001',
  path: 'requests/my-requests-col00001/ping-req00001/examples/ping-ex000001',
  requestUid: 'req00001',
  name: 'ping',
  capturedAt: '2026-07-09T09:00:00.000Z',
  request: {
    method: 'GET',
    url: 'https://api.openheaders.io/ping',
    headers: [{ uid: 'hdr00001', key: 'Accept', value: 'application/json', enabled: true }],
    params: [],
    body: { type: 'none' },
  },
  response: {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/ping',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: '{"ok":true}',
    bodyTruncated: false,
    bodyBytes: 11,
    durationMs: 42,
  },
  ...overrides,
});

describe('ResponseExampleSchema', () => {
  it('accepts a full example', () => {
    expect(() => v.parse(ResponseExampleSchema, example())).not.toThrow();
  });

  it('accepts a truncated body with its cap recorded', () => {
    const e = example();
    expect(() =>
      v.parse(ResponseExampleSchema, {
        ...e,
        response: { ...e.response, bodyTruncated: true, bodyCapBytes: 1_048_576, bodyBytes: 2_000_000 },
      }),
    ).not.toThrow();
  });

  it('accepts a never-completed capture (status 0)', () => {
    const e = example();
    expect(() =>
      v.parse(ResponseExampleSchema, {
        ...e,
        response: { ...e.response, status: 0, statusText: '', body: '', bodyBytes: 0 },
      }),
    ).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => v.parse(ResponseExampleSchema, example({ name: '' }))).toThrow();
  });

  it('rejects a malformed parent uid', () => {
    expect(() => v.parse(ResponseExampleSchema, example({ requestUid: 'nope' }))).toThrow();
  });
});

describe('createResponseExample', () => {
  it('mints the create + the request examples slot in one batch', () => {
    const { uid: _uid, ...payload } = example();
    const intent = createResponseExample(ctx(), { responseExampleUid: 'ex000001', parent, payload, orderKey: 'mm' });
    expect(intent.batch.mutations.map((m) => m.mutatorVersion)).toEqual([
      RESPONSE_EXAMPLE_MUTATOR_VERSION,
      RESPONSE_EXAMPLE_MUTATOR_VERSION,
    ]);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'ex000001', payload },
      {
        kind: 'addToSet',
        type: REQUEST_ENTITY_TYPE,
        id: 'req00001',
        path: REQUEST_EXAMPLES_PATH,
        itemId: 'ex000001',
        item: { uid: 'ex000001', type: RESPONSE_EXAMPLE_ENTITY_TYPE },
        orderKey: 'mm',
      },
    ]);
    expect(intent.sideEffects).toEqual([]);
  });

  it('the exported child verbs mint the same slot the seed builder appends', () => {
    expect(responseExampleChild.slotAdd('ex000001', parent, 'k')).toEqual({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: 'req00001',
      path: REQUEST_EXAMPLES_PATH,
      itemId: 'ex000001',
      item: { uid: 'ex000001', type: RESPONSE_EXAMPLE_ENTITY_TYPE },
      orderKey: 'k',
    });
  });
});

describe('deleteResponseExample', () => {
  it('emits the request slot tombstone + the entity tombstone with no side effects', () => {
    const intent = deleteResponseExample(ctx(), { responseExampleUid: 'ex000001', parent });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: REQUEST_ENTITY_TYPE,
        id: 'req00001',
        path: REQUEST_EXAMPLES_PATH,
        itemId: 'ex000001',
      },
      { kind: 'delete', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'ex000001' },
    ]);
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setResponseExampleField', () => {
  it('emits a setField at the writable scalar path', () => {
    const intent = setResponseExampleField(ctx(), { responseExampleUid: 'ex000001', path: 'name', value: 'renamed' });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'ex000001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('buildRenameResponseExampleBatch', () => {
  it('emits one setField per defined key and skips undefined values', () => {
    const { batch, sideEffects } = buildRenameResponseExampleBatch(
      'ex000001',
      { name: 'renamed', path: undefined },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'ex000001',
      path: 'name',
      value: 'renamed',
    });
    expect(sideEffects).toEqual([]);
  });
});

describe('seedResponseExample / projectResponseExample', () => {
  it('round-trips through a create envelope + materialized shape', () => {
    const entity = example();
    const batch = seedResponseExample(entity, ctx());
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body;
    expect(body).toMatchObject({ kind: 'create', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'ex000001' });
    if (body.kind !== 'create') throw new Error('expected create body');
    const projected = projectResponseExample({
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: entity.uid,
      data: body.payload as Record<string, unknown>,
      fieldOrigins: {},
    });
    expect(projected).toEqual(entity);
  });

  it('returns null for a foreign entity type', () => {
    expect(projectResponseExample({ type: 'request', id: 'r1', data: {}, fieldOrigins: {} })).toBeNull();
  });
});

describe('seedResponseExample with a placement', () => {
  it('stamps the frozen pathSegment and appends the request slot after the create', () => {
    const entity = example();
    const batch = seedResponseExample(entity, ctx(), { parent, orderKey: 'mm' });
    expect(batch.mutations.map((m) => m.body.kind)).toEqual(['create', 'addToSet']);
    const body = batch.mutations[0].body;
    if (body.kind !== 'create') throw new Error('expected create body');
    expect((body.payload as Record<string, unknown>).pathSegment).toBe(entity.path.split('/').at(-1));
    expect(batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      type: REQUEST_ENTITY_TYPE,
      id: 'req00001',
      path: REQUEST_EXAMPLES_PATH,
      itemId: entity.uid,
      orderKey: 'mm',
    });
  });

  it('projects path and the parent uid from the live slot, keeping the stored values with no slot', () => {
    const entity = example();
    const materialized = {
      type: RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: entity.uid,
      data: { ...entity, pathSegment: 'moved-ex000001' },
      fieldOrigins: {},
    };
    expect(projectResponseExample(materialized)).toEqual({ ...entity, pathSegment: 'moved-ex000001' });
    expect(
      projectResponseExample(materialized, { path: 'requests/other-col00002/req-req00009', uid: 'req00009' }),
    ).toMatchObject({ path: 'requests/other-col00002/req-req00009/examples/moved-ex000001', requestUid: 'req00009' });
  });
});

describe('response-example write-site builders', () => {
  it('buildAddResponseExampleBatch places the example on its request, or leaves it slot-less on null', () => {
    const placed = buildAddResponseExampleBatch(example(), ctx(), { parent, orderKey: 'mm' });
    expect(placed.batch.mutations.map((m) => m.body.kind)).toEqual(['create', 'addToSet']);
    const bare = buildAddResponseExampleBatch(example(), ctx(), null);
    expect(bare.batch.mutations.map((m) => m.body.kind)).toEqual(['create']);
    expect(placed.sideEffects).toEqual([]);
  });

  it('buildDeleteResponseExampleBatch tombstones the slot with the entity; the entity builder is bare', () => {
    expect(buildDeleteResponseExampleBatch('ex000001', parent, ctx()).batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: REQUEST_ENTITY_TYPE,
        id: 'req00001',
        path: REQUEST_EXAMPLES_PATH,
        itemId: 'ex000001',
      },
      { kind: 'delete', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'ex000001' },
    ]);
    expect(buildDeleteResponseExampleEntityBatch('ex000001', ctx()).batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'delete', type: RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'ex000001' },
    ]);
  });
});
