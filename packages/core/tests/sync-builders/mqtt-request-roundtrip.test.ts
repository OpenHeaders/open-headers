/**
 * MqttRequest sync round-trip: seed → materialize → project, plus the
 * update-batch shapes — scalar `setField` leaves, per-leaf flatten-diff
 * for `publishProperties` / `lastWill` / `specLink`, and minimum
 * set-diff envelopes for the three set-modeled row paths.
 */

import { describe, expect, it } from 'vitest';
import {
  InMemoryDocumentStore,
  MQTT_REQUEST_ENTITY_TYPE,
  MQTT_REQUEST_SAVED_MESSAGES_PATH,
  MQTT_REQUEST_TOPICS_PATH,
  MQTT_REQUEST_USER_PROPERTIES_PATH,
  type MutatorContext,
} from '../../src/sync';
import {
  buildMqttAddBatch,
  buildMqttUpdateBatch,
  type MqttLiveFieldValue,
  type MqttRequestMutationPayload,
} from '../../src/sync-builders/mutations/mqtt-request-mutations';
import { projectMqttRequest } from '../../src/sync-builders/projections/mqtt-request-projection';
import type { MqttRequest } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

const mqttSchemas = new Map([
  [
    MQTT_REQUEST_ENTITY_TYPE,
    { setPaths: [MQTT_REQUEST_TOPICS_PATH, MQTT_REQUEST_SAVED_MESSAGES_PATH, MQTT_REQUEST_USER_PROPERTIES_PATH] },
  ],
]);

const noSets = () => [];

function applyBatch(store: InMemoryDocumentStore, payload: MqttRequestMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

function liveField(store: InMemoryDocumentStore, uid: string): MqttLiveFieldValue {
  return (_uid, path) => {
    const m = store.materializeOne(MQTT_REQUEST_ENTITY_TYPE, uid);
    const r = m ? projectMqttRequest(m) : null;
    if (!r) return undefined;
    if (path === 'publishProperties') return r.publishProperties;
    if (path === 'lastWill') return r.lastWill;
    if (path === 'specLink') return r.specLink;
    return undefined;
  };
}

function materialized(store: InMemoryDocumentStore, uid: string): MqttRequest {
  const m = store.materializeOne(MQTT_REQUEST_ENTITY_TYPE, uid);
  const r = m ? projectMqttRequest(m) : null;
  if (!r) throw new Error('mqtt request did not materialize');
  return r;
}

const seed: MqttRequest = {
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtt://broker.openheaders.io:1883',
  topic: 'streetlights/1/lumens',
  payload: '{"lumens": 1200}',
  payloadFormat: 'json',
  qos: 1,
  topics: [
    { uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens', qos: 1 },
    { uid: 'mqtp0002', topicFilter: 'streetlights/#', subscribe: false },
  ],
  savedMessages: [{ uid: 'mqsm0001', name: 'Dim', topic: 'streetlights/1/dim', payload: '{"level": 30}' }],
  userProperties: [{ uid: 'mqup0001', key: 'x-tenant', value: 'openheaders', enabled: true }],
  specLink: { specUid: 'spec0001' },
};

describe('mqtt request seed → project round-trip', () => {
  it('materializes the seeded entity back to the persisted shape', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch(seed, ctx(1_000)));
    expect(materialized(store, 'mqrq0001')).toEqual(seed);
  });

  it('materializes empty set paths as [] (schema-aware set paths)', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch({ ...seed, topics: [], savedMessages: [], userProperties: [] }, ctx(1_000)));
    const after = materialized(store, 'mqrq0001');
    expect(after.topics).toEqual([]);
    expect(after.savedMessages).toEqual([]);
    expect(after.userProperties).toEqual([]);
  });

  it('emits one addToSet per row with the row uid as itemId', () => {
    const payload = buildMqttAddBatch(seed, ctx(1_000));
    const adds = payload.batch.mutations.filter((m) => m.body.kind === 'addToSet');
    expect(adds.map((m) => (m.body.kind === 'addToSet' ? m.body.itemId : ''))).toEqual([
      'mqtp0001',
      'mqtp0002',
      'mqsm0001',
      'mqup0001',
    ]);
    // The create shell must not carry the set-modeled fields — a
    // numeric-indexed flatten would compete with the addToSet entries.
    const create = payload.batch.mutations[0];
    expect(create.body.kind).toBe('create');
    if (create.body.kind === 'create') {
      expect((create.body.payload as Record<string, unknown>).topics).toBeUndefined();
      expect((create.body.payload as Record<string, unknown>).savedMessages).toBeUndefined();
      expect((create.body.payload as Record<string, unknown>).userProperties).toBeUndefined();
    }
  });

  it('round-trips the last will and publish properties blocks', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    const seeded: MqttRequest = {
      ...seed,
      publishProperties: { responseTopic: 'streetlights/1/ack', payloadFormatIndicator: true },
      lastWill: { topic: 'streetlights/1/offline', payload: 'gone', qos: 1, willDelayInterval: 10 },
    };
    applyBatch(store, buildMqttAddBatch(seeded, ctx(1_000)));
    expect(materialized(store, 'mqrq0001')).toEqual(seeded);
  });

  it('projects null for a foreign entity type', () => {
    expect(projectMqttRequest({ type: 'request', id: 'x', data: {}, fieldOrigins: {} })).toBeNull();
  });
});

describe('mqtt request update batches', () => {
  it('persists scalar edits (url, topic, payload, qos) as setField leaves', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildMqttUpdateBatch(
        'mqrq0001',
        { url: 'mqtts://broker.openheaders.io:8883', topic: 'streetlights/2/lumens', payload: 'ping', qos: 2 },
        ctx(2_000),
        noSets,
        liveField(store, 'mqrq0001'),
      ),
    );

    const after = materialized(store, 'mqrq0001');
    expect(after.url).toBe('mqtts://broker.openheaders.io:8883');
    expect(after.topic).toBe('streetlights/2/lumens');
    expect(after.payload).toBe('ping');
    expect(after.qos).toBe(2);
  });

  it('routes a last-will edit through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(
      store,
      buildMqttAddBatch({ ...seed, lastWill: { topic: 'streetlights/1/offline', payload: 'gone' } }, ctx(1_000)),
    );

    const payload = buildMqttUpdateBatch(
      'mqrq0001',
      { lastWill: { topic: 'streetlights/1/offline', payload: 'gone', qos: 1, retain: true } },
      ctx(2_000),
      noSets,
      liveField(store, 'mqrq0001'),
    );
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(paths).not.toContain('lastWill');
    expect(paths).toContain('lastWill.qos');
    expect(paths).toContain('lastWill.retain');

    applyBatch(store, payload);
    expect(materialized(store, 'mqrq0001').lastWill).toEqual({
      topic: 'streetlights/1/offline',
      payload: 'gone',
      qos: 1,
      retain: true,
    });
  });

  it('persists a spec re-link through the per-leaf flatten-diff', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch(seed, ctx(1_000)));

    applyBatch(
      store,
      buildMqttUpdateBatch(
        'mqrq0001',
        { specLink: { specUid: 'spec0002' } },
        ctx(2_000),
        noSets,
        liveField(store, 'mqrq0001'),
      ),
    );
    expect(materialized(store, 'mqrq0001').specLink).toEqual({ specUid: 'spec0002' });
  });

  it('clears a previously-saved last will when the patch carries an explicit undefined', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(
      store,
      buildMqttAddBatch(
        { ...seed, lastWill: { topic: 'streetlights/1/offline', payload: 'gone', qos: 1, retain: true } },
        ctx(1_000),
      ),
    );

    const payload = buildMqttUpdateBatch(
      'mqrq0001',
      { lastWill: undefined },
      ctx(2_000),
      noSets,
      liveField(store, 'mqrq0001'),
    );
    // The clear rides per-leaf tombstones — every saved leaf unsets.
    const kinds = payload.batch.mutations.map((m) => m.body.kind);
    expect(kinds.length).toBeGreaterThan(0);
    expect(new Set(kinds)).toEqual(new Set(['unsetField']));

    applyBatch(store, payload);
    expect(materialized(store, 'mqrq0001').lastWill).toBeUndefined();
  });

  it('clears previously-saved publish properties and the spec link the same way', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(
      store,
      buildMqttAddBatch(
        { ...seed, publishProperties: { responseTopic: 'streetlights/1/ack', contentType: 'application/json' } },
        ctx(1_000),
      ),
    );

    applyBatch(
      store,
      buildMqttUpdateBatch(
        'mqrq0001',
        { publishProperties: undefined, specLink: undefined },
        ctx(2_000),
        noSets,
        liveField(store, 'mqrq0001'),
      ),
    );
    const after = materialized(store, 'mqrq0001');
    expect(after.publishProperties).toBeUndefined();
    expect(after.specLink).toBeUndefined();
  });

  it('emits nothing for an undefined container key with no saved baseline', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch({ ...seed, specLink: undefined }, ctx(1_000)));

    // The editor's save patch always names the container keys — with
    // nothing saved and nothing composed the update stays a no-op.
    const payload = buildMqttUpdateBatch(
      'mqrq0001',
      { publishProperties: undefined, lastWill: undefined, specLink: undefined },
      ctx(2_000),
      noSets,
      liveField(store, 'mqrq0001'),
    );
    expect(payload.batch.mutations).toHaveLength(0);
  });

  it('emits minimum set-diff envelopes for topic row edits', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch(seed, ctx(1_000)));

    // Live reader over the materialized set — ordered (itemId, orderKey, item).
    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(MQTT_REQUEST_ENTITY_TYPE, uid, setPath);
      const entity = materialized(store, uid);
      const rows =
        setPath === MQTT_REQUEST_TOPICS_PATH
          ? entity.topics
          : setPath === MQTT_REQUEST_SAVED_MESSAGES_PATH
            ? entity.savedMessages
            : entity.userProperties;
      const byUid = new Map<string, unknown>(rows.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [
      { uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens', qos: 2 as const }, // content edit
      { uid: 'mqtp0003', topicFilter: 'alerts/#' }, // added
      // mqtp0002 removed
    ];
    const payload = buildMqttUpdateBatch(
      'mqrq0001',
      { topics: next },
      ctx(2_000),
      liveSets,
      liveField(store, 'mqrq0001'),
    );
    const kinds = payload.batch.mutations.map((m) => m.body.kind);
    expect(kinds).toContain('addToSet');
    expect(kinds).toContain('removeFromSet');

    applyBatch(store, payload);
    expect(materialized(store, 'mqrq0001').topics).toEqual(next);
    // The other sets are untouched by a topics-only patch.
    expect(materialized(store, 'mqrq0001').savedMessages).toEqual(seed.savedMessages);
    expect(materialized(store, 'mqrq0001').userProperties).toEqual(seed.userProperties);
  });

  it('emits minimum set-diff envelopes for saved-message row edits', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch(seed, ctx(1_000)));

    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(MQTT_REQUEST_ENTITY_TYPE, uid, setPath);
      const entity = materialized(store, uid);
      const byUid = new Map<string, unknown>(entity.savedMessages.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [
      { uid: 'mqsm0001', name: 'Dim to 50', topic: 'streetlights/1/dim', payload: '{"level": 50}' }, // content edit
      { uid: 'mqsm0002', name: 'Off', topic: 'streetlights/1/off', payload: '{}' }, // added
    ];
    applyBatch(
      store,
      buildMqttUpdateBatch('mqrq0001', { savedMessages: next }, ctx(2_000), liveSets, liveField(store, 'mqrq0001')),
    );
    expect(materialized(store, 'mqrq0001').savedMessages).toEqual(next);
    expect(materialized(store, 'mqrq0001').topics).toEqual(seed.topics);
  });

  it('emits minimum set-diff envelopes for user-property row edits', () => {
    const store = new InMemoryDocumentStore(mqttSchemas);
    applyBatch(store, buildMqttAddBatch(seed, ctx(1_000)));

    const liveSets = (uid: string, setPath: string) => {
      const entries = store.liveOrderedSetItems(MQTT_REQUEST_ENTITY_TYPE, uid, setPath);
      const entity = materialized(store, uid);
      const byUid = new Map<string, unknown>(entity.userProperties.map((r) => [r.uid, r]));
      return entries.map((e) => ({ itemId: e.itemId, orderKey: e.key, item: byUid.get(e.itemId) }));
    };

    const next = [{ uid: 'mqup0001', key: 'x-tenant', value: 'rotated', enabled: false }];
    applyBatch(
      store,
      buildMqttUpdateBatch('mqrq0001', { userProperties: next }, ctx(2_000), liveSets, liveField(store, 'mqrq0001')),
    );
    expect(materialized(store, 'mqrq0001').userProperties).toEqual(next);
  });
});
