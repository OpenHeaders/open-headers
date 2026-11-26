/**
 * Seed builder for the mqtt-delegated spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of daemon storage values to stdout (the grpc-seed idiom).
 *
 * One collection and one MQTT request over the RAW TCP scheme the
 * playground's aedes probe listens on — the reporter's case (a browser
 * page cannot dial mqtt://; the session is delegated to the
 * workspace's server, which dials it). The request subscribes to the
 * probe's echo reply and its pre-seeded retained topic, composes the
 * echo publish, and carries a Before connect script: the script runs
 * IN THE CONTEXT (the extension's page realm) even though the socket
 * opens on the server — the CONNECT the server dials carries the
 * scripted client id.
 *
 * Beside it, the workflow leg's entities: a second request on the same
 * listener that subscribes to the device's topics, the backend's reboot
 * call, and the workflow that listens, reboots and expects the answer.
 *
 * Ports ride env: OH_E2E_MQTT_PORT (the probe's TCP listener). The
 * backend's origin rides OH_E2E_DEVICES_ORIGIN, the workspace id
 * OH_E2E_WORKSPACE_ID (learned from the booted daemon before seeding).
 */

import { CollectionSchema, LiveWorkflowSchema, MqttRequestSchema, RequestSchema } from '@openheaders/core/schemas';
import type { Collection, LiveWorkflow, MqttRequest, Request } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const mqttPort = Number(process.env.OH_E2E_MQTT_PORT ?? 3131);
const devicesOrigin = process.env.OH_E2E_DEVICES_ORIGIN ?? 'http://127.0.0.1:3000';
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2emqc01';
const REQUEST_UID = 'e2emqtt1';

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Probe Broker', COLLECTION_UID)}`,
  name: 'Probe Broker',
  variables: [],
});

const request: MqttRequest = v.parse(MqttRequestSchema, {
  schemaVersion: 5,
  uid: REQUEST_UID,
  path: `${collection.path}/${toFolderName('Delegated tcp dial', REQUEST_UID)}`,
  name: 'Delegated tcp dial',
  url: `mqtt://127.0.0.1:${mqttPort}`,
  // aedes speaks 3.1.1 only — the version knob every probe-riding
  // request runs.
  protocolVersion: '3.1.1',
  topic: 'probe/echo',
  payload: 'echo-me-delegated',
  topics: [
    { uid: 'e2etop01', topicFilter: 'probe/echo/reply', subscribe: true },
    { uid: 'e2etop02', topicFilter: 'probe/retained', subscribe: true },
  ],
  savedMessages: [],
  userProperties: [],
  scripts: {
    'mqtt-before-connect': "oh.setClientId('context-scripted');",
  },
});

// The workflow leg: the playground's device scenario over the same raw
// TCP listener — a reboot commanded over HTTP, acknowledged on the
// device's status topic with the command's id.
const deviceProbe: MqttRequest = v.parse(MqttRequestSchema, {
  schemaVersion: 5,
  uid: 'e2emqtt2',
  path: `${collection.path}/${toFolderName('Delegated device probe', 'e2emqtt2')}`,
  name: 'Delegated device probe',
  url: `mqtt://127.0.0.1:${mqttPort}`,
  protocolVersion: '3.1.1',
  topic: '',
  payload: '',
  topics: [{ uid: 'e2etop03', topicFilter: 'devices/dev-1/#' }],
  savedMessages: [],
  userProperties: [],
});

const reboot: Request = v.parse(RequestSchema, {
  schemaVersion: 5,
  uid: 'e2emqreb',
  path: `${collection.path}/${toFolderName('Reboot dev-1', 'e2emqreb')}`,
  name: 'Reboot dev-1',
  method: 'POST',
  url: `${devicesOrigin}/api/devices/dev-1/reboot`,
  headers: [],
  params: [],
  auth: { type: 'none' },
  body: { type: 'none', content: '' },
});

const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
  schemaVersion: 5,
  uid: 'e2emqwf1',
  path: `live-workflows/${toFolderName('Device reboot over tcp', 'e2emqwf1')}`,
  name: 'Device reboot over tcp',
  steps: [
    { uid: 'e2emqlsn', id: 'probe', action: 'listen', sessionRequestUid: 'e2emqtt2', timeoutMs: 5_000, captures: [] },
    {
      uid: 'e2emqstr',
      id: 'reboot',
      requestUid: 'e2emqreb',
      captures: [{ uid: 'e2emqcid', name: 'commandId', extractor: { kind: 'json-path', path: '$.commandId' } }],
    },
    {
      uid: 'e2emqexp',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      address: 'devices/dev-1/status',
      match: [
        {
          kind: 'equals',
          uid: 'e2emqcrc',
          extractor: { kind: 'json-path', path: '$.commandId' },
          value: '{{step.reboot.commandId}}',
        },
      ],
      timeoutMs: 5_000,
      captures: [],
    },
  ],
  refresh: { kind: 'manual' },
  enabled: true,
  published: true,
});

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.mqttRequests`]: [request, deviceProbe],
  [`oh.ws.${workspaceId}.requests`]: [reboot],
  [`oh.ws.${workspaceId}.liveWorkflows`]: [workflow],
};

process.stdout.write(JSON.stringify(values));
