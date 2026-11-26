/**
 * Seed builder for the workflow-runs-extension spec — run under tsx (the
 * core schemas are TS source the Playwright loader can't resolve), prints
 * a JSON map of `chrome.storage` values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL core
 * valibot schema, so a schema change fails this script loudly instead of
 * seeding a shape the extension would silently reject.
 *
 * One collection over the playground's device scenario: the backend's two
 * HTTP requests, three MQTT requests — the probe over the broker's
 * WebSocket path, a 5.0 one that keeps the retain flag as published, and
 * one on the broker's raw TCP listener — and a workflow per leg of the
 * spec.
 *
 * The backend's origin rides OH_E2E_DEVICES_ORIGIN, the probe's WebSocket
 * url OH_E2E_MQTT_WS_URL, its TCP port OH_E2E_MQTT_PROBE_PORT, the
 * workspace id OH_E2E_WORKSPACE_ID.
 */

import { CollectionSchema, LiveWorkflowSchema, MqttRequestSchema, RequestSchema } from '@openheaders/core/schemas';
import type { Collection, LiveWorkflow, MqttRequest, Request, WorkflowStep } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const devicesOrigin = process.env.OH_E2E_DEVICES_ORIGIN ?? 'http://127.0.0.1:3000';
const probeWsUrl = process.env.OH_E2E_MQTT_WS_URL ?? 'ws://127.0.0.1:3000/net/mqtt';
const probePort = Number(process.env.OH_E2E_MQTT_PROBE_PORT ?? 3131);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2ewxcol';
const DEVICE_URL = `${devicesOrigin}/api/devices/dev-1`;

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Devices', COLLECTION_UID)}`,
  name: 'Devices',
  variables: [],
});

function httpRequest(uid: string, name: string, method: 'GET' | 'POST', url: string): Request {
  return v.parse(RequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    method,
    url,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none', content: '' },
  });
}

const requests: Request[] = [
  httpRequest('e2ewxreb', 'Reboot dev-1', 'POST', `${DEVICE_URL}/reboot`),
  httpRequest('e2ewxget', 'Get dev-1', 'GET', DEVICE_URL),
];

function mqttRequest(uid: string, name: string, overrides: Partial<MqttRequest> = {}): MqttRequest {
  return v.parse(MqttRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: probeWsUrl,
    protocolVersion: '3.1.1',
    topic: '',
    payload: '',
    topics: [{ uid: 'e2ewxrow', topicFilter: 'devices/dev-1/#' }],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  });
}

const mqttRequests: MqttRequest[] = [
  mqttRequest('e2ewxmq1', 'Probe MQTT', {
    savedMessages: [
      {
        uid: 'e2ewxmsg',
        name: 'Set name',
        topic: 'devices/dev-1/name',
        payload: '{"name":"n-{{dynamic.uuid}}"}',
        format: 'json',
        qos: 1,
      },
    ],
  }),
  // The probe broker speaks 3.1.1 only: a run that reached it would fail
  // at the CONNECT, so the refusal's own sentence proves nothing dialled.
  mqttRequest('e2ewxmq2', 'Probe MQTT 5', {
    protocolVersion: '5.0',
    topics: [{ uid: 'e2ewxrow', topicFilter: 'devices/dev-1/#', retainAsPublished: true }],
  }),
  mqttRequest('e2ewxmq3', 'Probe MQTT tcp', { url: `mqtt://127.0.0.1:${probePort}` }),
];

const listen = (sessionRequestUid: string): WorkflowStep => ({
  uid: 'e2ewxlsn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid,
  timeoutMs: 5_000,
  captures: [],
});

const REBOOT: WorkflowStep = {
  uid: 'e2ewxstr',
  id: 'reboot',
  requestUid: 'e2ewxreb',
  captures: [{ uid: 'e2ewxcid', name: 'commandId', extractor: { kind: 'json-path', path: '$.commandId' } }],
};

// The answer to THIS run's reboot: the id the backend minted for it.
const STATUS: WorkflowStep = {
  uid: 'e2ewxexp',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [
    { kind: 'equals', uid: 'e2ewxcst', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
    {
      kind: 'equals',
      uid: 'e2ewxcrc',
      extractor: { kind: 'json-path', path: '$.commandId' },
      value: '{{step.reboot.commandId}}',
    },
  ],
  timeoutMs: 5_000,
  captures: [{ uid: 'e2ewxcps', name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
};

function workflow(uid: string, name: string, steps: WorkflowStep[]): LiveWorkflow {
  return v.parse(LiveWorkflowSchema, {
    schemaVersion: 5,
    uid,
    path: `live-workflows/${toFolderName(name, uid)}`,
    name,
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  });
}

const liveWorkflows: LiveWorkflow[] = [
  workflow('e2ewxwf1', 'Device reboot', [listen('e2ewxmq1'), REBOOT, STATUS]),
  workflow('e2ewxwf2', 'Device rename', [
    listen('e2ewxmq1'),
    {
      uid: 'e2ewxsnd',
      id: 'rename',
      action: 'send',
      on: 'probe',
      messageUid: 'e2ewxmsg',
      captures: [{ uid: 'e2ewxcnm', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
    },
    {
      uid: 'e2ewxstg',
      id: 'device',
      requestUid: 'e2ewxget',
      captures: [],
      successCriteria: [
        {
          kind: 'equals',
          uid: 'e2ewxcnn',
          extractor: { kind: 'json-path', path: '$.name' },
          value: '{{step.rename.name}}',
        },
      ],
      poll: { maxAttempts: 10, delayMs: 200 },
    },
  ]),
  // Nothing publishes on the health topic, and the listen is its own
  // trigger: the run calls nothing.
  workflow('e2ewxwf3', 'Device silent', [
    listen('e2ewxmq1'),
    {
      uid: 'e2ewxexh',
      id: 'health',
      action: 'expect',
      on: 'probe',
      after: 'probe',
      address: 'devices/dev-1/health',
      match: [],
      timeoutMs: 1_500,
      captures: [],
    },
  ]),
  workflow('e2ewxwf4', 'Device reboot retained', [listen('e2ewxmq2'), REBOOT, STATUS]),
  workflow('e2ewxwf5', 'Device reboot over tcp', [listen('e2ewxmq3'), REBOOT, STATUS]),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.requests`]: requests,
  [`oh.ws.${workspaceId}.mqttRequests`]: mqttRequests,
  [`oh.ws.${workspaceId}.liveWorkflows`]: liveWorkflows,
};

process.stdout.write(JSON.stringify(values));
