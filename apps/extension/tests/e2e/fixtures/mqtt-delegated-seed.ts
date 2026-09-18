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
 * Ports ride env: OH_E2E_MQTT_PORT (the probe's TCP listener). The
 * workspace id rides OH_E2E_WORKSPACE_ID (learned from the booted
 * daemon before seeding).
 */

import { CollectionSchema, MqttRequestSchema } from '@openheaders/core/schemas';
import type { Collection, MqttRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const mqttPort = Number(process.env.OH_E2E_MQTT_PORT ?? 3131);
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

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.mqttRequests`]: [request],
};

process.stdout.write(JSON.stringify(values));
