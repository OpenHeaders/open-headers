/**
 * AsyncAPI collection generation plan — the per-family dispatch (the
 * MQTT-client plan Phase E over the WS Phase F module). Pins:
 *   - a ws-server document plans WebSocketRequests (url from server +
 *     channel address, example message, ids-only specLink) and leaves
 *     the mqtt family empty;
 *   - an mqtt-server document plans MqttRequests — scheme+host URL
 *     (the channel address is the TOPIC, never a URL path), publish
 *     topic from the address, a subscription row on receive
 *     operations, the synthesized payload on send operations — and
 *     leaves the ws family empty (the old honest no-go RETIRED);
 *   - a document naming both servers plans both families from the one
 *     census;
 *   - `secure-mqtt` reads as an mqtt server; unknown channels skip
 *     with a reason; a document with no family server plans nothing.
 */

import type { Spec } from '@openheaders/core/types';
import { buildWsCollectionPlan } from '@openheaders/ui/workbench/components/specs/ws-collection-plan';
import { describe, expect, it } from 'vitest';

const DOC = (servers: string) =>
  [
    'asyncapi: 3.0.0',
    'info:',
    '  title: Sensors API',
    '  version: 1.0.0',
    'servers:',
    ...servers.split('\n'),
    'channels:',
    '  temperature:',
    '    address: sensors/temperature',
    '    messages:',
    '      reading:',
    '        payload:',
    '          type: object',
    '          required: [celsius]',
    '          properties:',
    '            celsius:',
    '              type: number',
    '              examples: [21.5]',
    'operations:',
    '  sendReading:',
    '    action: send',
    '    channel:',
    '      $ref: "#/channels/temperature"',
    '  onReading:',
    '    action: receive',
    '    channel:',
    '      $ref: "#/channels/temperature"',
    '',
  ].join('\n');

const WS_SERVER = '  live:\n    host: ws.openheaders.io\n    protocol: wss';
const MQTT_SERVER = '  broker:\n    host: broker.openheaders.io:1883\n    protocol: mqtt';

function makeSpec(content: string, overrides: Partial<Spec> = {}): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/sensors-spc00001',
    name: 'Sensors API',
    format: 'asyncapi',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.yaml', content }],
    ...overrides,
  };
}

describe('buildWsCollectionPlan', () => {
  it('plans WebSocketRequests from a ws server and leaves the mqtt family empty', () => {
    const plan = buildWsCollectionPlan(makeSpec(DOC(WS_SERVER)));
    expect(plan.server?.protocol).toBe('wss');
    expect(plan.mqttServer).toBeNull();
    expect(plan.mqttRequests).toEqual([]);
    expect(plan.requests.map((r) => r.name)).toEqual(['sendReading', 'onReading']);
    const send = plan.requests[0];
    expect(send?.seed.url).toBe('wss://ws.openheaders.io/sensors/temperature');
    expect(send?.seed.specLink).toEqual({ specUid: 'spc00001' });
    expect(JSON.parse(send?.seed.message ?? '')).toEqual({ celsius: 21.5 });
  });

  it('plans MqttRequests from an mqtt server: topic from the address, subscribe on receive, payload on send', () => {
    const plan = buildWsCollectionPlan(makeSpec(DOC(MQTT_SERVER)));
    expect(plan.server).toBeNull();
    expect(plan.requests).toEqual([]);
    expect(plan.mqttServer?.protocol).toBe('mqtt');
    expect(plan.mqttRequests.map((r) => r.name)).toEqual(['sendReading', 'onReading']);
    const [send, receive] = plan.mqttRequests;
    // Scheme+host only — the channel address is the topic, not a path.
    expect(send?.seed.url).toBe('mqtt://broker.openheaders.io:1883');
    expect(send?.seed.topic).toBe('sensors/temperature');
    expect(send?.seed.specLink).toEqual({ specUid: 'spc00001' });
    expect(JSON.parse(send?.seed.payload ?? '')).toEqual({ celsius: 21.5 });
    expect(send?.seed.payloadFormat).toBe('json');
    expect(send?.seed.topics).toBeUndefined();
    expect(receive?.seed.topics?.map((row) => row.topicFilter)).toEqual(['sensors/temperature']);
    expect(receive?.seed.payload).toBeUndefined();
  });

  it('plans both families from a document naming both servers', () => {
    const plan = buildWsCollectionPlan(makeSpec(DOC(`${WS_SERVER}\n${MQTT_SERVER}`)));
    expect(plan.server?.protocol).toBe('wss');
    expect(plan.mqttServer?.protocol).toBe('mqtt');
    expect(plan.requests).toHaveLength(2);
    expect(plan.mqttRequests).toHaveLength(2);
  });

  it('reads secure-mqtt as an mqtts dial target', () => {
    const plan = buildWsCollectionPlan(
      makeSpec(DOC('  broker:\n    host: broker.openheaders.io:8883\n    protocol: secure-mqtt')),
    );
    expect(plan.mqttServer?.protocol).toBe('secure-mqtt');
    expect(plan.mqttRequests[0]?.seed.url).toBe('mqtts://broker.openheaders.io:8883');
  });

  it('skips operations whose channel does not resolve, with a reason', () => {
    const content = [
      'asyncapi: 3.0.0',
      'info:',
      '  title: Sensors API',
      '  version: 1.0.0',
      'servers:',
      ...MQTT_SERVER.split('\n'),
      'channels: {}',
      'operations:',
      '  sendReading:',
      '    action: send',
      '    channel:',
      '      $ref: "#/channels/missing"',
      '',
    ].join('\n');
    const plan = buildWsCollectionPlan(makeSpec(content));
    expect(plan.mqttRequests).toEqual([]);
    expect(plan.skipped).toEqual([{ operation: 'sendReading', reason: 'unknown-channel' }]);
  });

  it('plans nothing for a document with no family server', () => {
    const plan = buildWsCollectionPlan(
      makeSpec(DOC('  stream:\n    host: broker.openheaders.io:9092\n    protocol: kafka')),
    );
    expect(plan.server).toBeNull();
    expect(plan.mqttServer).toBeNull();
    expect(plan.requests).toEqual([]);
    expect(plan.mqttRequests).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });
});
