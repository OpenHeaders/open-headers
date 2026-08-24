import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';
import { parseMqttRequest, serializeMqttRequest } from '../../src/codec/yaml';
import { freshDocument, mergePatch } from '../../src/schemas/document';
import type { MqttRequest } from '../../src/types';

const PAYLOAD = '{\n  "lumens": 1200,\n  "sentAt": "2026-08-24T00:00:00Z"\n}';

const mqttRequest = (overrides: Partial<MqttRequest> = {}): MqttRequest => ({
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtt://broker.openheaders.io:1883',
  topic: 'streetlights/1/lumens',
  payload: PAYLOAD,
  payloadFormat: 'json',
  qos: 1,
  retain: true,
  topics: [
    { uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens', qos: 1 },
    { uid: 'mqtp0002', topicFilter: 'streetlights/#', qos: 0, subscribe: false, noLocal: true, retainHandling: 2 },
  ],
  savedMessages: [
    { uid: 'mqsm0001', name: 'Dim', topic: 'streetlights/1/dim', payload: '{"level": 30}', format: 'json' },
  ],
  userProperties: [{ uid: 'mqup0001', key: 'x-tenant', value: 'openheaders', enabled: true }],
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('serializeMqttRequest', () => {
  it('keeps the payload out of the manifest and fans it out to a format-matched sibling', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest()));
    expect(out.mqttYaml).not.toContain('lumens": 1200');
    expect(out.mqttYaml).toContain('url: mqtt://broker.openheaders.io:1883');
    expect(out.mqttYaml).toContain('topic: streetlights/1/lumens');
    expect(out.payloadFile).toEqual({ fileName: 'payload.json', content: PAYLOAD });
  });

  it('fans a text-format draft out to payload.txt', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest({ payload: 'on', payloadFormat: undefined })));
    expect(out.payloadFile).toEqual({ fileName: 'payload.txt', content: 'on' });
  });

  it('fans base64/hex drafts out to payload.txt (the encoding is authored text)', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest({ payload: 'deadbeef', payloadFormat: 'hex' })));
    expect(out.payloadFile).toEqual({ fileName: 'payload.txt', content: 'deadbeef' });
  });

  it('emits no payload sibling for an empty compose draft', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest({ payload: '' })));
    expect(out.payloadFile).toBeNull();
  });

  it('strips the runtime-only path from the manifest', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest()));
    expect(out.mqttYaml).not.toContain('requests/lighting-mqrq0001');
  });

  it('orders manifest fields metadata-top (invariant #6)', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest({ description: 'ordered' })));
    const keys = Object.keys(YAML.parse(out.mqttYaml) as Record<string, unknown>);
    expect(keys).toEqual([
      'schemaVersion',
      'uid',
      'name',
      'description',
      'url',
      'topic',
      'payloadFormat',
      'qos',
      'retain',
      'topics',
      'savedMessages',
      'userProperties',
      'specLink',
      'timeoutMs',
    ]);
  });
});

describe('parseMqttRequest', () => {
  it('round-trips serialize → parse byte-identically', () => {
    const entity = mqttRequest({ description: 'round trip' });
    const out = serializeMqttRequest(freshDocument(entity));
    const parsed = parseMqttRequest(out.mqttYaml, {
      path: entity.path,
      siblings: out.payloadFile ? [out.payloadFile] : [],
    });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips a minimal request (no rows, no spec link, no payload)', () => {
    const entity = mqttRequest({
      topic: '',
      payload: '',
      payloadFormat: undefined,
      qos: undefined,
      retain: undefined,
      topics: [],
      savedMessages: [],
      userProperties: [],
      specLink: undefined,
      timeoutMs: undefined,
    });
    const out = serializeMqttRequest(freshDocument(entity));
    const parsed = parseMqttRequest(out.mqttYaml, { path: entity.path, siblings: [] });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips the version knob, connect knobs and last will', () => {
    const entity = mqttRequest({
      protocolVersion: '3.1.1',
      clientId: 'oh-{{env.stage}}',
      cleanStart: false,
      sessionExpiryInterval: 3_600,
      keepAlive: 30,
      receiveMaximum: 20,
      maximumPacketSize: 268_435_456,
      sslVerification: false,
      lastWill: {
        topic: 'streetlights/1/offline',
        payload: 'gone',
        qos: 1,
        retain: true,
        willDelayInterval: 10,
        properties: { contentType: 'text/plain' },
      },
    });
    const out = serializeMqttRequest(freshDocument(entity));
    expect(out.mqttYaml).toContain('protocolVersion: 3.1.1');
    expect(out.mqttYaml).toContain('willDelayInterval: 10');
    const parsed = parseMqttRequest(out.mqttYaml, {
      path: entity.path,
      siblings: out.payloadFile ? [out.payloadFile] : [],
    });
    expect(parsed.value).toEqual(entity);
  });

  it('round-trips the per-message properties block with nested user properties', () => {
    const entity = mqttRequest({
      publishProperties: {
        userProperties: [{ uid: 'mqup0002', key: 'trace', value: 'on' }],
        responseTopic: 'streetlights/1/ack',
        correlationData: 'req-42',
        messageExpiryInterval: 60,
        contentType: 'application/json',
        payloadFormatIndicator: true,
      },
    });
    const out = serializeMqttRequest(freshDocument(entity));
    const parsed = parseMqttRequest(out.mqttYaml, {
      path: entity.path,
      siblings: out.payloadFile ? [out.payloadFile] : [],
    });
    expect(parsed.value).toEqual(entity);
  });

  it('parses a missing payload sibling as the empty draft', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest()));
    const parsed = parseMqttRequest(out.mqttYaml, { path: 'requests/lighting-mqrq0001', siblings: [] });
    expect(parsed.value.payload).toBe('');
  });

  it('ignores unrecognized siblings', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest()));
    const parsed = parseMqttRequest(out.mqttYaml, {
      path: 'requests/lighting-mqrq0001',
      siblings: [{ fileName: 'notes.txt', content: 'scratch' }, ...(out.payloadFile ? [out.payloadFile] : [])],
    });
    expect(parsed.value.payload).toBe(PAYLOAD);
  });

  it('preserves unknown manifest keys through a round-trip (invariant #4)', () => {
    const out = serializeMqttRequest(freshDocument(mqttRequest()));
    const doc = YAML.parseDocument(out.mqttYaml);
    doc.set('futureKey', 'kept');
    const parsed = parseMqttRequest(doc.toString(), {
      path: 'requests/lighting-mqrq0001',
      siblings: out.payloadFile ? [out.payloadFile] : [],
    });
    const reserialized = serializeMqttRequest(mergePatch(parsed, () => {}));
    expect(reserialized.mqttYaml).toContain('futureKey: kept');
  });

  it('normalizes topic and saved-message row key order (canonicalize)', () => {
    const entity = mqttRequest({
      topics: [
        {
          retainHandling: 1,
          subscribe: true,
          topicFilter: 'a/b',
          qos: 2,
          uid: 'mqtp0003',
          description: 'note',
        } as MqttRequest['topics'][number],
      ],
      savedMessages: [
        {
          retain: true,
          payload: 'x',
          name: 'Probe',
          topic: 'a/b',
          uid: 'mqsm0002',
          qos: 1,
        } as MqttRequest['savedMessages'][number],
      ],
    });
    const out = serializeMqttRequest(freshDocument(entity));
    const parsed = YAML.parse(out.mqttYaml) as {
      topics: Array<Record<string, unknown>>;
      savedMessages: Array<Record<string, unknown>>;
    };
    expect(Object.keys(parsed.topics[0])).toEqual([
      'uid',
      'topicFilter',
      'qos',
      'subscribe',
      'description',
      'retainHandling',
    ]);
    expect(Object.keys(parsed.savedMessages[0])).toEqual(['uid', 'name', 'topic', 'payload', 'qos', 'retain']);
  });
});
