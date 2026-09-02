/**
 * Seed builder for the session-scripts-desktop spec — run under tsx
 * (the core schemas are TS source the Playwright loader can't
 * resolve), prints a JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject — here the
 * session script slots: a collection carrying a WebSocket Before
 * connect slot (the ancestor level every request under it composes
 * ahead of its own), and three WebSocket requests against the ws-probe
 * carrying their own slots — the dial-mutation leg, the send / message
 * leg, and the close-assertion leg.
 *
 * The probe port rides OH_E2E_WS_PROBE_PORT; the workspace id rides
 * OH_E2E_WORKSPACE_ID.
 */

import { CollectionSchema, WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { Collection, WebSocketRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const probePort = Number(process.env.OH_E2E_WS_PROBE_PORT ?? 3000);
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2esccol';
const PROBE_URL = `ws://127.0.0.1:${probePort}/net/ws-probe`;

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Scripted Sessions', COLLECTION_UID)}`,
  name: 'Scripted Sessions',
  variables: [],
  // The collection's Before connect runs ahead of every request's own
  // at every dial — the greeting's request-target mirrors its param.
  scripts: { 'ws-before-connect': `oh.setQueryParam('from', 'collection');` },
});

function websocketRequest(
  uid: string,
  name: string,
  message: string,
  scripts: NonNullable<WebSocketRequest['scripts']>,
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
    scripts,
  });
}

const websocketRequests: WebSocketRequest[] = [
  // S1: the request's own Before connect composes after the collection's
  // — both params reach the probe's request-target; the hook logs the
  // dial it saw.
  websocketRequest('e2escws1', 'Scripted Dial', 'hello', {
    'ws-before-connect': `oh.setQueryParam('tag', 'from-request'); console.log('dialing', oh.connect.url);`,
  }),
  // S2: Before send rewrites the compose text (the probe echoes it
  // back), On message counts frames in oh.session and replies to the
  // probe's echo of the rewritten text — the reply is captured and
  // echoed too, never re-entering Before send.
  websocketRequest('e2escws2', 'Scripted Send', 'ping', {
    'ws-before-send': `oh.setMessage(oh.message.text + '-rewritten');`,
    'ws-on-message': `oh.session.count = (oh.session.count ?? 0) + 1;
if (oh.message.text === 'echo:ping-rewritten') { await oh.send('reply-' + oh.session.count); }`,
  }),
  // S3: After close asserts on the end record — the Tests view reads
  // the verdicts; the Before send drop keeps a message off the wire.
  websocketRequest('e2escws3', 'Scripted Close', 'secret', {
    'ws-before-send': `if (oh.message.text === 'secret') { oh.drop(); }`,
    'ws-after-close': `await oh.test('closed cleanly', () => oh.expect(oh.close.code).toBe(1000));
await oh.test('nothing was sent', () => oh.expect(oh.close.messages).toBe(1));`,
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.websocketRequests`]: websocketRequests,
};

process.stdout.write(JSON.stringify(values));
