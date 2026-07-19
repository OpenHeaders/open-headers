/**
 * Seed builder for the websocket-desktop spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject.
 *
 * One request per W-leg of the Phase C gate: the full session walk
 * (subprotocol offer + custom handshake header + compose text), the
 * `?push=` live-batch leg (enabled param rows — proves
 * appendQueryParams made the wire), the close-code-menu leg, and the
 * refused-dial leg on a dead port.
 *
 * The probe port rides OH_E2E_WS_PROBE_PORT (the playground dev
 * server's `/net/ws-probe` upgrade — 3000 when the Playwright
 * webServer boots it). The workspace id rides OH_E2E_WORKSPACE_ID
 * (learned from the booted app before seeding). The dead port rides
 * OH_E2E_WS_DEAD_PORT so the spec and the seed agree on the refusal.
 */

import { CollectionSchema, WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { Collection, WebSocketRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const probePort = Number(process.env.OH_E2E_WS_PROBE_PORT ?? 3000);
const deadPort = Number(process.env.OH_E2E_WS_DEAD_PORT ?? 19997);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2ewscol';
const PROBE_URL = `ws://127.0.0.1:${probePort}/net/ws-probe`;

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Probe Sessions', COLLECTION_UID)}`,
  name: 'Probe Sessions',
  variables: [],
});

function websocketRequest(
  uid: string,
  name: string,
  message: string,
  extra: Partial<WebSocketRequest> = {},
): WebSocketRequest {
  return v.parse(WebSocketRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: PROBE_URL,
    flavor: 'raw',
    subprotocols: [],
    headers: [],
    params: [],
    message,
    messageFormat: 'text',
    ...extra,
  });
}

const websocketRequests: WebSocketRequest[] = [
  websocketRequest('e2ewsd01', 'Probe Session', 'hello probe', {
    subprotocols: ['oh-e2e-proto'],
    headers: [{ uid: 'e2ewshd1', key: 'x-probe-client', value: 'oh-desktop-e2e', enabled: true }],
  }),
  websocketRequest('e2ewsd02', 'Probe Push', '', {
    params: [
      { uid: 'e2ewspp1', key: 'push', value: '3', enabled: true },
      { uid: 'e2ewspp2', key: 'ms', value: '60', enabled: true },
    ],
  }),
  websocketRequest('e2ewsd03', 'Probe Close Menu', 'close:4321:probe-menu'),
  websocketRequest('e2ewsd04', 'Probe Refused', '', {
    url: `ws://127.0.0.1:${deadPort}/net/ws-probe`,
  }),
  // The Phase E socketio leg: the REAL socket.io server at
  // /net/sio-probe, a named namespace, an acked event compose, and the
  // Phase G session credential riding the CONNECT auth payload (the
  // probe greeting mirrors it back).
  websocketRequest('e2ewsd05', 'Probe SIO', '["from-desktop", 7]', {
    flavor: 'socketio',
    url: `ws://127.0.0.1:${probePort}/net/sio-probe`,
    namespace: '/probe',
    eventName: 'echo',
    ackEnabled: true,
    auth: { type: 'bearer', token: 'sio-tok-e2e' },
  }),
  // The Phase G auth leg on the raw flavor: the credential lands as
  // the Authorization handshake header (the greeting mirrors it back).
  websocketRequest('e2ewsd06', 'Probe Auth', '', {
    auth: { type: 'bearer', token: 'raw-tok-e2e' },
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.websocketRequests`]: websocketRequests,
};

process.stdout.write(JSON.stringify(values));
