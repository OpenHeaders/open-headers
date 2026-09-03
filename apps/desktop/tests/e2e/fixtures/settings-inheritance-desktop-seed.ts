/**
 * Seed + parse helper for the settings-inheritance desktop spec — run
 * under tsx (the core schemas are TS source the Playwright loader
 * cannot resolve). Two modes on argv:
 *
 *   seed   — print a JSON map of desktop storage values: a collection
 *     `Payments` carrying a per-kind settings record (an HTTP slice
 *     and a WebSocket slice), a transparent collection `Other`, the
 *     folder chain `Cards › Refunds` under Payments, an HTTP request
 *     `Charge` under Refunds, an HTTP request `Ping` at the root, and
 *     a WebSocket request `Live` under Cards. Folders seed with their
 *     identity alone — the spec sets their knobs through the UI (the
 *     folder mirror slot is the surface under test).
 *   parse  — read export YAML on stdin, print the parsed envelope.
 *
 * Every entity is a literal validated by the REAL core schema, so a
 * schema change fails here loudly instead of seeding a shape the app
 * would silently reject. The workspace id rides OH_E2E_WORKSPACE_ID;
 * the request URL rides OH_E2E_REQUEST_URL (a rig the sends can hit).
 */

import { CollectionSchema, FolderSchema, RequestSchema, WebSocketRequestSchema } from '@openheaders/core/schemas';
import type { Collection, Folder, Request, WebSocketRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import { parseWorkspaceExport } from '@openheaders/core/workspace-export';
import * as v from 'valibot';

/** The fixed uids — the spec inlines the same literals. */
const SEED = {
  payments: 'e2esicol',
  other: 'e2esioth',
  cards: 'e2esifca',
  refunds: 'e2esifre',
  charge: 'e2esirch',
  ping: 'e2esirpg',
  live: 'e2esiwsl',
} as const;

function seed(): Record<string, unknown> {
  const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
  if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');
  const url = process.env.OH_E2E_REQUEST_URL ?? 'https://api.openheaders.io/status';

  const payments: Collection = v.parse(CollectionSchema, {
    schemaVersion: 5,
    uid: SEED.payments,
    path: `requests/${toFolderName('Payments', SEED.payments)}`,
    name: 'Payments',
    variables: [],
    settings: {
      http: { tlsMinVersion: '1.3', timeoutMs: 30_000 },
      websocket: { timeoutMs: 5_000 },
    },
  });
  const other: Collection = v.parse(CollectionSchema, {
    schemaVersion: 5,
    uid: SEED.other,
    path: `requests/${toFolderName('Other', SEED.other)}`,
    name: 'Other',
    variables: [],
  });
  const folder = (uid: string, name: string, parentPath: string): Folder =>
    v.parse(FolderSchema, { schemaVersion: 5, uid, path: `${parentPath}/${toFolderName(name, uid)}`, name });
  const cards = folder(SEED.cards, 'Cards', payments.path);
  const refunds = folder(SEED.refunds, 'Refunds', cards.path);
  const request = (uid: string, name: string, parentPath: string): Request =>
    v.parse(RequestSchema, {
      schemaVersion: 5,
      uid,
      path: `${parentPath}/${toFolderName(name, uid)}`,
      name,
      method: 'GET',
      url,
      headers: [],
      params: [],
      auth: { type: 'none' },
      body: { type: 'none' },
    });
  const charge = request(SEED.charge, 'Charge', refunds.path);
  const ping = request(SEED.ping, 'Ping', payments.path);
  const live: WebSocketRequest = v.parse(WebSocketRequestSchema, {
    schemaVersion: 5,
    uid: SEED.live,
    path: `${cards.path}/${toFolderName('Live', SEED.live)}`,
    name: 'Live',
    url: 'ws://127.0.0.1:9/live',
    flavor: 'raw',
    subprotocols: [],
    headers: [],
    params: [],
    message: '',
    messageFormat: 'text',
  });

  const p = `oh.ws.${workspaceId}`;
  return {
    [`${p}.requestCollections`]: [payments, other],
    [`${p}.requestFolders`]: [cards, refunds],
    [`${p}.requests`]: [charge, ping],
    [`${p}.websocketRequests`]: [live],
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  const [mode] = process.argv.slice(2);
  if (mode === 'seed') {
    process.stdout.write(JSON.stringify(seed()));
    return;
  }
  if (mode === 'parse') {
    const result = parseWorkspaceExport(await readStdin());
    if (!result.ok) throw new Error(`export did not parse: ${JSON.stringify(result)}`);
    process.stdout.write(JSON.stringify(result.export));
    return;
  }
  throw new Error(`unknown mode '${mode}'`);
}

void main();
