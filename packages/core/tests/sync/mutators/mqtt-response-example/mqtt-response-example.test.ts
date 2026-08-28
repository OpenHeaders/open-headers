import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { MqttResponseExampleSchema } from '../../../../src/schemas';
import {
  createMqttResponseExample,
  deleteMqttResponseExample,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_EXAMPLES_PATH,
  MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
  MQTT_RESPONSE_EXAMPLE_MUTATOR_VERSION,
  type MutatorContext,
  mqttResponseExampleChild,
  setMqttResponseExampleField,
} from '../../../../src/sync';
import { buildRenameMqttResponseExampleBatch } from '../../../../src/sync-builders/mutations/mqtt-response-example-mutations';
import {
  projectMqttResponseExample,
  seedMqttResponseExample,
} from '../../../../src/sync-builders/projections/mqtt-response-example-projection';
import type { MqttResponseExample } from '../../../../src/types';

const parent = { type: MQTT_REQUEST_ENTITY_TYPE, uid: 'mqr00001' } as const;

const ctx = (overrides: Partial<MutatorContext> = {}): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
  ...overrides,
});

const example = (overrides: Partial<MqttResponseExample> = {}): MqttResponseExample => ({
  schemaVersion: 5,
  uid: 'mex00001',
  path: 'requests/my-requests-col00001/sensors-mqr00001/examples/sensors-mex00001',
  mqttRequestUid: 'mqr00001',
  name: 'Sensors',
  capturedAt: '2026-08-24T09:00:00.000Z',
  request: {
    url: 'mqtt://broker.openheaders.io:1883',
    protocolVersion: '5.0',
    topic: 'sensors/1/temperature',
    payload: '{"temp": 21}',
    payloadFormat: 'json',
    qos: 1,
    retain: false,
    topics: [{ uid: 'tp000001', topicFilter: 'sensors/+/temperature', qos: 1 }],
    sslVerification: true,
    timeoutMs: 30_000,
  },
  response: {
    connack: { sessionPresent: false, reasonCode: 0 },
    clientId: 'oh-abc123',
    events: [
      { kind: 'subscribed', grants: [{ topicFilter: 'sensors/+/temperature', reasonCode: 1 }] },
      {
        kind: 'message',
        direction: 'up',
        topic: 'sensors/1/temperature',
        payloadBase64: 'eyJ0ZW1wIjogMjF9',
        qos: 1,
        retain: false,
        dup: false,
      },
      {
        kind: 'message',
        direction: 'down',
        topic: 'sensors/1/temperature',
        payloadBase64: 'eyJ0ZW1wIjogMjF9',
        qos: 1,
        retain: true,
        dup: false,
      },
      { kind: 'unsubscribed', topicFilters: ['sensors/+/temperature'] },
    ],
    droppedMessages: 0,
    end: { by: 'client' },
    durationMs: 42,
  },
  ...overrides,
});

describe('MqttResponseExampleSchema', () => {
  it('accepts a full settled-session example', () => {
    expect(() => v.parse(MqttResponseExampleSchema, example())).not.toThrow();
  });

  it('accepts a broker DISCONNECT end and a severed null end', () => {
    const e = example();
    expect(() =>
      v.parse(MqttResponseExampleSchema, {
        ...e,
        response: { ...e.response, end: { by: 'broker', reasonCode: 141 } },
      }),
    ).not.toThrow();
    expect(() =>
      v.parse(MqttResponseExampleSchema, {
        ...e,
        response: { ...e.response, end: null, stopped: true, droppedMessages: 7 },
      }),
    ).not.toThrow();
  });

  it('rejects an unknown event kind', () => {
    const e = example();
    expect(() =>
      v.parse(MqttResponseExampleSchema, {
        ...e,
        response: { ...e.response, events: [{ kind: 'pinged' }] },
      }),
    ).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => v.parse(MqttResponseExampleSchema, example({ name: '' }))).toThrow();
  });

  it('rejects a malformed parent uid', () => {
    expect(() => v.parse(MqttResponseExampleSchema, example({ mqttRequestUid: 'nope' }))).toThrow();
  });

  it('strips volatile execution fields from the captured response', () => {
    const e = example();
    const parsed = v.parse(MqttResponseExampleSchema, {
      ...e,
      response: {
        ...e.response,
        error: 'boom',
        executedOn: { kind: 'backend', name: 'dev' },
        proxyRoute: { kind: 'direct' },
      },
    });
    expect('error' in parsed.response).toBe(false);
    expect('executedOn' in parsed.response).toBe(false);
    expect('proxyRoute' in parsed.response).toBe(false);
  });
});

describe('createMqttResponseExample', () => {
  it('mints the create + the request examples slot in one batch', () => {
    const { uid: _uid, ...payload } = example();
    const intent = createMqttResponseExample(ctx(), {
      mqttResponseExampleUid: 'mex00001',
      parent,
      payload,
      orderKey: 'mm',
    });
    expect(intent.batch.mutations.map((m) => m.mutatorVersion)).toEqual([
      MQTT_RESPONSE_EXAMPLE_MUTATOR_VERSION,
      MQTT_RESPONSE_EXAMPLE_MUTATOR_VERSION,
    ]);
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      { kind: 'create', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'mex00001', payload },
      {
        kind: 'addToSet',
        type: MQTT_REQUEST_ENTITY_TYPE,
        id: 'mqr00001',
        path: MQTT_REQUEST_EXAMPLES_PATH,
        itemId: 'mex00001',
        item: { uid: 'mex00001', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE },
        orderKey: 'mm',
      },
    ]);
    expect(intent.sideEffects).toEqual([]);
  });

  it('the exported child verbs mint the same slot the seed builder appends', () => {
    expect(mqttResponseExampleChild.slotAdd('mex00001', parent, 'k')).toEqual({
      kind: 'addToSet',
      type: MQTT_REQUEST_ENTITY_TYPE,
      id: 'mqr00001',
      path: MQTT_REQUEST_EXAMPLES_PATH,
      itemId: 'mex00001',
      item: { uid: 'mex00001', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE },
      orderKey: 'k',
    });
  });
});

describe('deleteMqttResponseExample', () => {
  it('emits the request slot tombstone + the entity tombstone with no side effects', () => {
    const intent = deleteMqttResponseExample(ctx(), { mqttResponseExampleUid: 'mex00001', parent });
    expect(intent.batch.mutations.map((m) => m.body)).toEqual([
      {
        kind: 'removeFromSet',
        type: MQTT_REQUEST_ENTITY_TYPE,
        id: 'mqr00001',
        path: MQTT_REQUEST_EXAMPLES_PATH,
        itemId: 'mex00001',
      },
      { kind: 'delete', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'mex00001' },
    ]);
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('setMqttResponseExampleField', () => {
  it('emits a setField at the writable scalar path', () => {
    const intent = setMqttResponseExampleField(ctx(), {
      mqttResponseExampleUid: 'mex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'mex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(intent.sideEffects).toEqual([]);
  });
});

describe('buildRenameMqttResponseExampleBatch', () => {
  it('emits one setField per defined key and skips undefined values', () => {
    const { batch, sideEffects } = buildRenameMqttResponseExampleBatch(
      'mex00001',
      { name: 'renamed', path: undefined },
      ctx(),
    );
    expect(batch.mutations).toHaveLength(1);
    expect(batch.mutations[0].body).toEqual({
      kind: 'setField',
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: 'mex00001',
      path: 'name',
      value: 'renamed',
    });
    expect(sideEffects).toEqual([]);
  });
});

describe('seedMqttResponseExample / projectMqttResponseExample', () => {
  it('round-trips through a create envelope + materialized shape', () => {
    const entity = example();
    const batch = seedMqttResponseExample(entity, ctx());
    expect(batch.mutations).toHaveLength(1);
    const body = batch.mutations[0].body;
    expect(body).toMatchObject({ kind: 'create', type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE, id: 'mex00001' });
    if (body.kind !== 'create') throw new Error('expected create body');
    const projected = projectMqttResponseExample({
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: entity.uid,
      data: body.payload as Record<string, unknown>,
      fieldOrigins: {},
    });
    expect(projected).toEqual(entity);
  });

  it('returns null for a foreign entity type', () => {
    expect(projectMqttResponseExample({ type: 'mqttRequest', id: 'r1', data: {}, fieldOrigins: {} })).toBeNull();
  });
});

describe('seedMqttResponseExample with a placement', () => {
  it('stamps the frozen pathSegment and appends the request slot after the create', () => {
    const entity = example();
    const batch = seedMqttResponseExample(entity, ctx(), { parent, orderKey: 'mm' });
    expect(batch.mutations.map((m) => m.body.kind)).toEqual(['create', 'addToSet']);
    const body = batch.mutations[0].body;
    if (body.kind !== 'create') throw new Error('expected create body');
    expect((body.payload as Record<string, unknown>).pathSegment).toBe(entity.path.split('/').at(-1));
    expect(batch.mutations[1].body).toMatchObject({
      kind: 'addToSet',
      type: MQTT_REQUEST_ENTITY_TYPE,
      id: 'mqr00001',
      path: MQTT_REQUEST_EXAMPLES_PATH,
      itemId: entity.uid,
      orderKey: 'mm',
    });
  });

  it('projects path and the parent uid from the live slot, keeping the stored values with no slot', () => {
    const entity = example();
    const materialized = {
      type: MQTT_RESPONSE_EXAMPLE_ENTITY_TYPE,
      id: entity.uid,
      data: { ...entity, pathSegment: 'moved-mex00001' },
      fieldOrigins: {},
    };
    expect(projectMqttResponseExample(materialized)).toEqual({ ...entity, pathSegment: 'moved-mex00001' });
    expect(
      projectMqttResponseExample(materialized, { path: 'requests/other-col00002/req-req00009', uid: 'req00009' }),
    ).toMatchObject({
      path: 'requests/other-col00002/req-req00009/examples/moved-mex00001',
      mqttRequestUid: 'req00009',
    });
  });
});
