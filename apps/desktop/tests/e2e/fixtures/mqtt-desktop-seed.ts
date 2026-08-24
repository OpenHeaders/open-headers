/**
 * Seed builder for the mqtt-desktop spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject.
 *
 * One request per M-leg of the Phase C gate: the full session walk on
 * the 3.1.1 knob (open-time subscription + echo compose), the
 * retained-delivery leg, the deterministic ticker-batch leg, the
 * refused-dial leg on a dead port, the live Subscribe-toggle leg (its
 * row seeds subscribe OFF), and the severed-end leg (the compose
 * publishes the probe's close topic). Every broker leg runs
 * `protocolVersion: '3.1.1'` — the playground's aedes broker speaks
 * 3.1.1 only (the epic's recorded fact), so the knob is the honest
 * coverage, not a convenience.
 *
 * The probe's TCP port rides OH_E2E_MQTT_PROBE_PORT (3131 when the
 * Playwright webServer boots the playground). The workspace id rides
 * OH_E2E_WORKSPACE_ID (learned from the booted app before seeding).
 * The dead port rides OH_E2E_MQTT_DEAD_PORT so the spec and the seed
 * agree on the refusal.
 */

import { CollectionSchema, MqttRequestSchema } from '@openheaders/core/schemas';
import type { Collection, MqttRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const probePort = Number(process.env.OH_E2E_MQTT_PROBE_PORT ?? 3131);
const deadPort = Number(process.env.OH_E2E_MQTT_DEAD_PORT ?? 19998);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2emqcol';
const BROKER_URL = `mqtt://127.0.0.1:${probePort}`;

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Probe Broker', COLLECTION_UID)}`,
  name: 'Probe Broker',
  variables: [],
});

function mqttRequest(uid: string, name: string, extra: Partial<MqttRequest> = {}): MqttRequest {
  return v.parse(MqttRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: BROKER_URL,
    protocolVersion: '3.1.1',
    topic: '',
    payload: '',
    topics: [],
    savedMessages: [],
    userProperties: [],
    ...extra,
  });
}

const mqttRequests: MqttRequest[] = [
  // M1: full session walk — the enabled row subscribes at open (SUBACK
  // grant recorded), the compose publishes the echo topic, the probe
  // republishes on the subscribed reply topic.
  mqttRequest('e2emqd01', 'Probe Session', {
    topic: 'probe/echo',
    payload: 'echo-me-desktop',
    qos: 1,
    topics: [{ uid: 'e2emqtp1', topicFilter: 'probe/echo/reply', qos: 1, subscribe: true }],
  }),
  // M2: retained delivery — the pre-seeded retained message arrives on
  // subscribe carrying its retain flag as the display tag.
  mqttRequest('e2emqd02', 'Probe Retained', {
    topics: [{ uid: 'e2emqtp2', topicFilter: 'probe/retained', subscribe: true }],
  }),
  // M3: ticker — subscribing starts 5 deterministic timed publishes,
  // the live-batch leg.
  mqttRequest('e2emqd03', 'Probe Ticker', {
    topics: [{ uid: 'e2emqtp3', topicFilter: 'probe/ticker', subscribe: true }],
  }),
  // M4: refused dial on a dead port — the classified pre-open error.
  mqttRequest('e2emqd04', 'Probe Refused', {
    url: `mqtt://127.0.0.1:${deadPort}`,
  }),
  // M5: live Subscribe toggle — the row seeds subscribe OFF, the spec
  // toggles it mid-session (the rider path, grant mark on the row).
  mqttRequest('e2emqd05', 'Probe Live Toggle', {
    topics: [{ uid: 'e2emqtp5', topicFilter: 'probe/echo/reply', qos: 1, subscribe: false }],
  }),
  // M6: severed end — publishing the probe's close topic makes the
  // broker destroy the connection without a DISCONNECT.
  mqttRequest('e2emqd06', 'Probe Severed', {
    topic: 'probe/close',
    payload: 'sever',
  }),
  // M8: Basic auth (Phase F) — the probe identity on CONNECT opens the
  // session; its wrong-password sibling refuses with return code 4.
  mqttRequest('e2emqd07', 'Probe Auth', {
    auth: { type: 'basic', username: 'probe', password: 'probe-secret' },
  }),
  mqttRequest('e2emqd08', 'Probe Auth Refused', {
    auth: { type: 'basic', username: 'probe', password: 'wrong-secret' },
  }),
  // M9: the 5.0 knob against the 3.1.1-only broker — aedes answers a
  // 3.1.1-form CONNACK return code 0x01; the refusal reads verbatim.
  mqttRequest('e2emqd09', 'Probe V5 Refused', {
    protocolVersion: '5.0',
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.mqttRequests`]: mqttRequests,
};

process.stdout.write(JSON.stringify(values));
