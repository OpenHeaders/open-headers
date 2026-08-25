/**
 * Unit tests for the MQTT editor's pure modules:
 *
 *   - `draft.ts` — draft ⇄ entity projections whose fingerprints drive
 *     derived dirty (form-vs-canonical equality), including the
 *     property-block collapse, the last-will topic gate, the base64/hex
 *     encoding validation that gates Send honestly, and the
 *     saved-message compose binding (capture / load / match / mirror).
 *   - `local-tree-builder.ts` — all four request kinds sharing the
 *     collection tree, MQTT leaves alongside the WebSocket ones.
 *   - `compose.ts` — the saved-row topic-tag color derivation (equal
 *     text, equal color, palette membership).
 */

import type { Collection, MqttRequest, Request } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { buildRequestCollectionTrees } from '@openheaders/ui/shared/local-tree-builder';
import {
  SAVED_TOPIC_TAG_COLORS,
  savedTopicTagColor,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/compose';
import {
  buildMqttRequestUpdates,
  canonicalMqttRequestProjection,
  composeAsSavedMessage,
  draftFromMqttRequest,
  loadSavedMessageIntoCompose,
  mirrorComposeIntoSaved,
  payloadEncodingError,
  rowsToUserProperties,
  savedRowMatchesCompose,
  userPropertiesToRows,
} from '@openheaders/ui/workbench/components/mqtt-request-editor/draft';
import { grantFailureLabel } from '@openheaders/ui/workbench/components/mqtt-request-editor/session-display';
import { describe, expect, it } from 'vitest';

const mqttRequest = (overrides: Partial<MqttRequest> = {}): MqttRequest => ({
  schemaVersion: 5,
  uid: 'mqrq0001',
  path: 'requests/lighting-mqrq0001',
  name: 'Lighting',
  url: 'mqtt://broker.openheaders.io:1883',
  topic: 'streetlights/1/lumens',
  payload: '{"lumens": 1200}',
  payloadFormat: 'json',
  qos: 1,
  retain: true,
  topics: [{ uid: 'mqtp0001', topicFilter: 'streetlights/+/lumens', qos: 1 }],
  savedMessages: [{ uid: 'mqsm0001', name: 'Dim', topic: 'streetlights/1/dim', payload: '{"level": 30}' }],
  userProperties: [{ uid: 'mqup0001', key: 'x-tenant', value: 'openheaders', enabled: true }],
  specLink: { specUid: 'spec0001' },
  timeoutMs: 30_000,
  ...overrides,
});

describe('mqtt draft projections', () => {
  it('projects entity → draft → updates losslessly for the editable fields', () => {
    const entity = mqttRequest({ description: 'notes' });
    const updates = buildMqttRequestUpdates(draftFromMqttRequest(entity));
    expect(updates.description).toBe('notes');
    expect(updates.url).toBe(entity.url);
    expect(updates.protocolVersion).toBe('5.0');
    expect(updates.topic).toBe(entity.topic);
    expect(updates.payload).toBe(entity.payload);
    expect(updates.payloadFormat).toBe('json');
    expect(updates.qos).toBe(1);
    expect(updates.retain).toBe(true);
    expect(updates.topics).toEqual(entity.topics);
    expect(updates.savedMessages).toEqual(entity.savedMessages);
    expect(updates.userProperties).toEqual(entity.userProperties);
    expect(updates.specLink).toEqual({ specUid: 'spec0001' });
    expect(updates.timeoutMs).toBe(30_000);
  });

  it('reads absent knobs as their honest defaults', () => {
    const updates = buildMqttRequestUpdates(
      draftFromMqttRequest(
        mqttRequest({ protocolVersion: undefined, payloadFormat: undefined, qos: undefined, retain: undefined }),
      ),
    );
    expect(updates.protocolVersion).toBe('5.0');
    expect(updates.payloadFormat).toBe('text');
    expect(updates.qos).toBe(0);
    expect(updates.retain).toBe(false);
    expect(updates.cleanStart).toBe(true);
    expect(updates.sslVerification).toBe(true);
  });

  it('keeps the canonical projection fingerprint-stable across a round-trip', () => {
    const entity = mqttRequest({
      protocolVersion: '3.1.1',
      publishProperties: { responseTopic: 'acks/1', messageExpiryInterval: 60 },
      lastWill: { topic: 'status/reporter', payload: 'gone', qos: 1, willDelayInterval: 10 },
      clientId: 'oh-probe',
      cleanStart: false,
      keepAlive: 30,
    });
    const once = canonicalMqttRequestProjection(entity);
    const twice = buildMqttRequestUpdates(draftFromMqttRequest(entity));
    expect(twice).toEqual(once);
    expect(once.publishProperties).toEqual({ responseTopic: 'acks/1', messageExpiryInterval: 60 });
    expect(once.lastWill).toEqual({ topic: 'status/reporter', payload: 'gone', qos: 1, willDelayInterval: 10 });
  });

  it('collapses an all-empty property block to undefined', () => {
    const updates = buildMqttRequestUpdates(draftFromMqttRequest(mqttRequest()));
    expect(updates.publishProperties).toBeUndefined();
    expect(updates.lastWill).toBeUndefined();
  });

  it('gates the will on its topic — payload alone saves as no will', () => {
    const draft = draftFromMqttRequest(mqttRequest());
    draft.lastWill.payload = 'orphaned';
    expect(buildMqttRequestUpdates(draft).lastWill).toBeUndefined();
    draft.lastWill.topic = 'status/reporter';
    expect(buildMqttRequestUpdates(draft).lastWill).toEqual({ topic: 'status/reporter', payload: 'orphaned' });
  });

  it('trims unfilled topic rows and drops row fields left at absence', () => {
    const draft = draftFromMqttRequest(mqttRequest({ topics: [] }));
    draft.topics = [
      { uid: 'mqtp0002', topicFilter: 'alerts/#', qos: 2, noLocal: true },
      { uid: 'mqtp0003', topicFilter: '' },
    ];
    expect(buildMqttRequestUpdates(draft).topics).toEqual([
      { uid: 'mqtp0002', topicFilter: 'alerts/#', qos: 2, noLocal: true },
    ]);
  });

  it('reads absent auth as none and round-trips the Basic pair', () => {
    expect(buildMqttRequestUpdates(draftFromMqttRequest(mqttRequest())).auth).toEqual({ type: 'none' });
    const entity = mqttRequest({ auth: { type: 'basic', username: 'probe', password: '{{brokerSecret}}' } });
    const updates = buildMqttRequestUpdates(draftFromMqttRequest(entity));
    expect(updates.auth).toEqual({ type: 'basic', username: 'probe', password: '{{brokerSecret}}' });
    expect(canonicalMqttRequestProjection(entity).auth).toEqual(updates.auth);
  });

  it('round-trips CONNECT user-property rows through the KeyValue grid shape', () => {
    const rows = userPropertiesToRows([{ uid: 'mqup0001', key: 'x-tenant', value: 'openheaders', enabled: false }]);
    expect(rows[0].enabled).toBe(false);
    const back = rowsToUserProperties([...rows, { uid: 'mqup0002', key: '', value: 'ghost', enabled: true }]);
    expect(back).toEqual([{ uid: 'mqup0001', key: 'x-tenant', value: 'openheaders', enabled: false }]);
  });
});

describe('payload encoding validation', () => {
  it('passes text and json unconditionally', () => {
    expect(payloadEncodingError('not json at all', 'json')).toBeNull();
    expect(payloadEncodingError('anything', 'text')).toBeNull();
  });

  it('validates base64 with whitespace tolerance and padding', () => {
    expect(payloadEncodingError('aGVsbG8=', 'base64')).toBeNull();
    expect(payloadEncodingError('aGVs bG8=\n', 'base64')).toBeNull();
    expect(payloadEncodingError('', 'base64')).toBeNull();
    expect(payloadEncodingError('aGVsbG8', 'base64')).toBe('base64');
    expect(payloadEncodingError('!!!!', 'base64')).toBe('base64');
  });

  it('validates hex as even-length pairs', () => {
    expect(payloadEncodingError('48656c6c6f', 'hex')).toBeNull();
    expect(payloadEncodingError('48 65 6c', 'hex')).toBeNull();
    expect(payloadEncodingError('abc', 'hex')).toBe('hex');
    expect(payloadEncodingError('zz', 'hex')).toBe('hex');
  });
});

describe('request collection trees with MQTT leaves', () => {
  it('emits mqtt-request nodes beside the other request kinds', () => {
    const collection: Collection = {
      schemaVersion: 5,
      uid: 'col00001',
      path: 'requests/probe-col00001',
      name: 'Probe',
      variables: [],
      pinnedEnvironmentIds: [],
      defaultEnvironmentId: null,
    };
    const request: Request = {
      schemaVersion: 5,
      uid: 'req00001',
      path: 'requests/probe-col00001/ping-req00001',
      name: 'Ping',
      method: 'GET',
      url: 'https://api.openheaders.io/ping',
      headers: [],
      params: [],
      auth: { type: 'inherit' },
      body: { type: 'none' },
    };
    const mqtt = mqttRequest({ path: 'requests/probe-col00001/lighting-mqrq0001' });
    const trees = buildRequestCollectionTrees([collection], [], [request], [], [], [mqtt]);
    expect(trees[0].tree).toEqual([
      { type: 'request', uid: 'req00001', name: 'Ping', path: request.path, method: 'GET' },
      { type: 'mqtt-request', uid: 'mqrq0001', name: 'Lighting', path: mqtt.path },
    ]);
  });
});

describe('SUBACK grant labels', () => {
  // A key-echoing Translate keeps the mapping assertion locale-blind.
  const t = ((key: string, params?: Record<string, unknown>) =>
    `${key}${params !== undefined ? `:${Object.values(params).join(',')}` : ''}`) as Translate;

  it('renders success grants as silence and keeps failure codes verbatim with their spec names', () => {
    // Success (0-2) is silence — the subscribed state itself answers.
    expect(grantFailureLabel(1, t)).toBeNull();
    // 0x87 Not authorized — the name rides BESIDE the verbatim code.
    expect(grantFailureLabel(0x87, t)).toBe('workbench.editors.mqtt.timeline.grantFailedNamed:Not authorized,135');
    // A code the spec does not name renders bare.
    expect(grantFailureLabel(0xee, t)).toBe('workbench.editors.mqtt.timeline.grantFailed:238');
  });
});

describe('saved-message compose binding', () => {
  const draft = () => draftFromMqttRequest(mqttRequest());

  it('captures the compose as a saved row with optional fields absent at defaults', () => {
    const captured = composeAsSavedMessage(draft(), 'mqsm0002', 'Bright');
    expect(captured).toEqual({
      uid: 'mqsm0002',
      name: 'Bright',
      topic: 'streetlights/1/lumens',
      payload: '{"lumens": 1200}',
      format: 'json',
      qos: 1,
      retain: true,
    });
    const plain = composeAsSavedMessage(
      { ...draft(), payloadFormat: 'text', qos: 0, retain: false },
      'mqsm0003',
      'Plain',
    );
    expect(plain).toEqual({ uid: 'mqsm0003', name: 'Plain', topic: 'streetlights/1/lumens', payload: '{"lumens": 1200}' });
  });

  it('loads a row into the compose and the loaded compose matches the row', () => {
    const d = draft();
    const row = d.savedMessages[0];
    expect(savedRowMatchesCompose(d, row)).toBe(false);
    const loaded = loadSavedMessageIntoCompose(d, row);
    expect(loaded.topic).toBe('streetlights/1/dim');
    expect(loaded.payload).toBe('{"level": 30}');
    expect(loaded.payloadFormat).toBe('text');
    expect(loaded.qos).toBe(0);
    expect(loaded.retain).toBe(false);
    expect(savedRowMatchesCompose(loaded, row)).toBe(true);
  });

  it('mirror is identity-stable with no selection, a vanished row, or an already-matching row', () => {
    const d = draft();
    expect(mirrorComposeIntoSaved(d, null)).toBe(d);
    expect(mirrorComposeIntoSaved(d, 'mqsm-gone')).toBe(d);
    const loaded = loadSavedMessageIntoCompose(d, d.savedMessages[0]);
    expect(mirrorComposeIntoSaved(loaded, 'mqsm0001')).toBe(loaded);
  });

  it('mirror writes the compose through to the selected row, keeping its uid and name', () => {
    const loaded = loadSavedMessageIntoCompose(draft(), draft().savedMessages[0]);
    const edited = { ...loaded, payload: '{"level": 55}', qos: 2 as const, retain: true };
    const mirrored = mirrorComposeIntoSaved(edited, 'mqsm0001');
    expect(mirrored.savedMessages).toEqual([
      { uid: 'mqsm0001', name: 'Dim', topic: 'streetlights/1/dim', payload: '{"level": 55}', qos: 2, retain: true },
    ]);
  });
});

describe('saved-row topic tag colors', () => {
  it('derives the color from the tag text deterministically — equal text, equal color', () => {
    for (const text of ['streetlights/1/dim', 'sensors/+/temperature', 'topic', '主题']) {
      const color = savedTopicTagColor(text);
      expect(SAVED_TOPIC_TAG_COLORS).toContain(color);
      expect(savedTopicTagColor(text)).toBe(color);
    }
  });

  it('spreads distinct topics across the palette', () => {
    const colors = new Set(
      ['streetlights/1/dim', 'streetlights/1/lumens', 'sensors/+/temperature', 'clients/reporter/status', 'topic'].map(
        savedTopicTagColor,
      ),
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});
