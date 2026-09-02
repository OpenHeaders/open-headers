/**
 * Seed builder for the session-scripts-mqtt-desktop spec — run under
 * tsx (the core schemas are TS source the Playwright loader can't
 * resolve), prints a JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject — here the
 * MQTT session script slots: a collection carrying an MQTT Before
 * connect slot (the ancestor level every request under it composes
 * ahead of its own — it subscribes the probe's reply topic at open),
 * and three MQTT requests against the playground's aedes probe
 * carrying their own slots — the CONNECT-mutation leg, the publish /
 * message leg, and the close-assertion leg. Every request runs the
 * 3.1.1 knob (the probe broker speaks 3.1.1 only).
 *
 * The probe's TCP port rides OH_E2E_MQTT_PROBE_PORT; the workspace id
 * rides OH_E2E_WORKSPACE_ID.
 */

import { CollectionSchema, MqttRequestSchema } from '@openheaders/core/schemas';
import type { Collection, MqttRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const probePort = Number(process.env.OH_E2E_MQTT_PROBE_PORT ?? 3131);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2esmcol';
const BROKER_URL = `mqtt://127.0.0.1:${probePort}`;

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Scripted Brokers', COLLECTION_UID)}`,
  name: 'Scripted Brokers',
  variables: [],
  // The collection's Before connect runs ahead of every request's own
  // at every dial — it subscribes the probe's reply topic, so the
  // Subscribed row proves the ancestor level ran.
  scripts: { 'mqtt-before-connect': `oh.addSubscription('probe/echo/reply', { qos: 1 });` },
});

function mqttRequest(
  uid: string,
  name: string,
  payload: string,
  scripts: NonNullable<MqttRequest['scripts']>,
): MqttRequest {
  return v.parse(MqttRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: BROKER_URL,
    protocolVersion: '3.1.1',
    topic: 'probe/echo',
    payload,
    topics: [],
    savedMessages: [],
    userProperties: [],
    scripts,
  });
}

const mqttRequests: MqttRequest[] = [
  // S1: the request's own Before connect composes after the collection's
  // — the CONNECT carries the scripted client id (the Connection tab
  // reads it back) and the hook logs the dial it saw.
  mqttRequest('e2esmq01', 'Scripted Connect', 'hello', {
    'mqtt-before-connect': `oh.setClientId('scripted-probe'); console.log('dialing', oh.connect.url, oh.connect.clientId);`,
  }),
  // S2: Before publish rewrites the compose payload (the probe echoes
  // it back on the reply topic), On message counts messages in
  // oh.session and replies to the probe's echo of the rewritten payload
  // through oh.publish — the reply is captured and echoed too, never
  // re-entering Before publish.
  mqttRequest('e2esmq02', 'Scripted Publish', 'ping', {
    'mqtt-before-publish': `oh.setPayload(oh.message.payload + '-rewritten');`,
    'mqtt-on-message': `oh.session.count = (oh.session.count ?? 0) + 1;
if (oh.message.text === 'ping-rewritten') { await oh.publish('probe/echo', 'reply-' + oh.session.count); }`,
  }),
  // S3: After close asserts on the end record — the Tests view reads
  // the verdicts; the Before publish drop keeps a message off the wire.
  mqttRequest('e2esmq03', 'Scripted Close', 'secret', {
    'mqtt-before-publish': `if (oh.message.payload === 'secret') { oh.drop(); }`,
    'mqtt-after-close': `await oh.test('disconnected cleanly', () => oh.expect(oh.close.end?.by).toBe('client'));
await oh.test('nothing was published', () => oh.expect(oh.close.published).toBe(0));`,
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.mqttRequests`]: mqttRequests,
};

process.stdout.write(JSON.stringify(values));
