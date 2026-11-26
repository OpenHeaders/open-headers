/**
 * Seed builder for the workflow-runs-desktop spec, and for the
 * workflow-authoring-desktop spec, which authors on its requests — run
 * under tsx (the core schemas are TS source the Playwright loader can't
 * resolve), prints a JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL core
 * valibot schema, so a schema change fails this script loudly instead of
 * seeding a shape the app would silently reject.
 *
 * One collection over the playground's device scenario: the backend's two
 * HTTP requests, four MQTT requests on the probe broker — the plain
 * probe, one whose scripts misbehave on purpose, one whose Before connect
 * throws, and a 5.0 one that keeps the retain flag as published — and a
 * workflow per leg of the spec.
 *
 * The backend's origin rides OH_E2E_DEVICES_ORIGIN, the probe's TCP port
 * OH_E2E_MQTT_PROBE_PORT, the workspace id OH_E2E_WORKSPACE_ID.
 */

import { CollectionSchema, LiveWorkflowSchema, MqttRequestSchema, RequestSchema } from '@openheaders/core/schemas';
import type { Collection, LiveWorkflow, MqttRequest, Request, WorkflowStep } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const devicesOrigin = process.env.OH_E2E_DEVICES_ORIGIN ?? 'http://127.0.0.1:3000';
const probePort = Number(process.env.OH_E2E_MQTT_PROBE_PORT ?? 3131);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2ewrcol';
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
  httpRequest('e2ewrreb', 'Reboot dev-1', 'POST', `${DEVICE_URL}/reboot`),
  httpRequest('e2ewrget', 'Get dev-1', 'GET', DEVICE_URL),
];

function mqttRequest(uid: string, name: string, overrides: Partial<MqttRequest> = {}): MqttRequest {
  return v.parse(MqttRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: `mqtt://127.0.0.1:${probePort}`,
    protocolVersion: '3.1.1',
    topic: '',
    payload: '',
    topics: [{ uid: 'e2ewrrow', topicFilter: 'devices/dev-1/#' }],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  });
}

const mqttRequests: MqttRequest[] = [
  mqttRequest('e2ewrmq1', 'Probe MQTT', {
    savedMessages: [
      {
        uid: 'e2ewrmsg',
        name: 'Set name',
        topic: 'devices/dev-1/name',
        payload: '{"name":"n-{{dynamic.uuid}}"}',
        format: 'json',
        qos: 1,
      },
    ],
  }),
  // Its Before connect narrows nothing and renames the client; its On
  // message fails one test and then asks for what the run's tier refuses.
  mqttRequest('e2ewrmq2', 'Probe MQTT scripted', {
    scripts: {
      'mqtt-before-connect': `oh.setClientId('run-probe');`,
      'mqtt-on-message': `if (oh.message.topic === 'devices/dev-1/status') {
  await oh.test('the device is idle', () => oh.expect(JSON.parse(oh.message.text).state).toBe('idle'));
  await oh.sendRequest({ method: 'GET', url: '${DEVICE_URL}' });
}`,
    },
  }),
  mqttRequest('e2ewrmq3', 'Probe MQTT unsigned', {
    scripts: { 'mqtt-before-connect': `throw new Error('no key');` },
  }),
  // The probe broker speaks 3.1.1 only: a run that reached it would fail
  // at the CONNECT, so the refusal's own sentence proves nothing dialled.
  mqttRequest('e2ewrmq4', 'Probe MQTT 5', {
    protocolVersion: '5.0',
    topics: [{ uid: 'e2ewrrow', topicFilter: 'devices/dev-1/#', retainAsPublished: true }],
  }),
];

const listen = (sessionRequestUid: string, overrides: Record<string, unknown> = {}): WorkflowStep => ({
  uid: 'e2ewrlsn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid,
  timeoutMs: 5_000,
  captures: [],
  ...overrides,
});

const REBOOT: WorkflowStep = {
  uid: 'e2ewrstr',
  id: 'reboot',
  requestUid: 'e2ewrreb',
  captures: [{ uid: 'e2ewrcid', name: 'commandId', extractor: { kind: 'json-path', path: '$.commandId' } }],
};

// The answer to THIS run's reboot: the id the backend minted for it.
const STATUS: WorkflowStep = {
  uid: 'e2ewrexp',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [
    { kind: 'equals', uid: 'e2ewrcst', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
    {
      kind: 'equals',
      uid: 'e2ewrcrc',
      extractor: { kind: 'json-path', path: '$.commandId' },
      value: '{{step.reboot.commandId}}',
    },
  ],
  timeoutMs: 5_000,
  captures: [{ uid: 'e2ewrcps', name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
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
  workflow('e2ewrwf1', 'Device reboot', [listen('e2ewrmq1'), REBOOT, STATUS]),
  workflow('e2ewrwf2', 'Device rename', [
    listen('e2ewrmq1'),
    {
      uid: 'e2ewrsnd',
      id: 'rename',
      action: 'send',
      on: 'probe',
      messageUid: 'e2ewrmsg',
      captures: [{ uid: 'e2ewrcnm', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
    },
    {
      uid: 'e2ewrstg',
      id: 'device',
      requestUid: 'e2ewrget',
      captures: [],
      successCriteria: [
        {
          kind: 'equals',
          uid: 'e2ewrcnn',
          extractor: { kind: 'json-path', path: '$.name' },
          value: '{{step.rename.name}}',
        },
      ],
      poll: { maxAttempts: 10, delayMs: 200 },
    },
  ]),
  // Nothing publishes on the health topic, and the listen is its own
  // trigger: the run calls nothing.
  workflow('e2ewrwf3', 'Device silent', [
    listen('e2ewrmq1'),
    {
      uid: 'e2ewrexh',
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
  workflow('e2ewrwf4', 'Device reboot scripted', [listen('e2ewrmq2', { runScripts: true }), REBOOT, STATUS]),
  workflow('e2ewrwf5', 'Device reboot unsigned', [listen('e2ewrmq3', { runScripts: true }), REBOOT, STATUS]),
  workflow('e2ewrwf6', 'Device reboot retained', [listen('e2ewrmq4'), REBOOT, STATUS]),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.requests`]: requests,
  [`oh.ws.${workspaceId}.mqttRequests`]: mqttRequests,
  [`oh.ws.${workspaceId}.liveWorkflows`]: liveWorkflows,
};

process.stdout.write(JSON.stringify(values));
