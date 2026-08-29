/**
 * Seed + parse helper for the tree-order e2e specs (extension and
 * desktop) — run under tsx, because the core schemas are TS source
 * the Playwright loader cannot resolve. Two modes on argv:
 *
 *   seed <legacy|merged>  — print a JSON map of storage values (the
 *     `oh.ws.<id>.*` slots) for one request collection holding two
 *     folders and three root requests, one request inside the first
 *     folder, three response examples under the first root request
 *     whose `capturedAt` runs BACKWARDS (so a reader that still sorted
 *     by capture time would show them reversed), and a tree-order
 *     record: `legacy` = the S8-era `{ folders, items }` pair (boot
 *     normalises it to folders-then-items and rewrites `children`),
 *     `merged` = one interleaved `children` list.
 *   parse  — read export YAML on stdin, print the parsed envelope.
 *
 * Every entity is a literal validated by the REAL core schema, so a
 * schema change fails here loudly instead of seeding a shape the app
 * would silently reject. The workspace id rides OH_E2E_WORKSPACE_ID;
 * the request URL rides OH_E2E_REQUEST_URL (a rig the runs can hit).
 */

import { CollectionSchema, FolderSchema, RequestSchema, ResponseExampleSchema } from '@openheaders/core/schemas';
import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import {
  type Collection,
  type Folder,
  type Request,
  type ResponseExample,
  type TreeOrderRecord,
  treeContainerKey,
} from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import { parseWorkspaceExport } from '@openheaders/core/workspace-export';
import * as v from 'valibot';
import { SEED } from './tree-order-ids';

function seed(record: 'legacy' | 'merged'): Record<string, unknown> {
  const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
  if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');
  const url = process.env.OH_E2E_REQUEST_URL ?? 'https://api.openheaders.io/status';

  const collection: Collection = v.parse(CollectionSchema, {
    schemaVersion: 5,
    uid: SEED.collection,
    path: `requests/${toFolderName('Mixed', SEED.collection)}`,
    name: 'Mixed',
    variables: [],
  });
  const other: Collection = v.parse(CollectionSchema, {
    schemaVersion: 5,
    uid: SEED.other,
    path: `requests/${toFolderName('Other', SEED.other)}`,
    name: 'Other',
    variables: [],
  });
  const folder = (uid: string, name: string): Folder =>
    v.parse(FolderSchema, { schemaVersion: 5, uid, path: `${collection.path}/${toFolderName(name, uid)}`, name });
  const folderA = folder(SEED.folderA, 'Folder A');
  const folderB = folder(SEED.folderB, 'Folder B');
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
  const r1 = request(SEED.r1, 'Root One', collection.path);
  const r2 = request(SEED.r2, 'Root Two', collection.path);
  const r3 = request(SEED.r3, 'Root Three', collection.path);
  const inFolder = request(SEED.inFolder, 'Inner', folderA.path);
  const example = (uid: string, name: string, capturedAt: string): ResponseExample =>
    v.parse(ResponseExampleSchema, {
      schemaVersion: 5,
      uid,
      path: `${r1.path}/examples/${toFolderName(name, uid)}`,
      requestUid: r1.uid,
      name,
      capturedAt,
      request: { method: 'GET', url, headers: [], params: [], body: { type: 'none' } },
      response: {
        status: 200,
        statusText: 'OK',
        url,
        headers: [],
        body: '{}',
        bodyTruncated: false,
        bodyBytes: 2,
        durationMs: 1,
      },
    });
  // Array order e1, e2, e3 = slot order at hydration; capture times run the other way.
  const examples = [
    example(SEED.e1, 'Example One', '2026-08-03T00:00:00.000Z'),
    example(SEED.e2, 'Example Two', '2026-08-02T00:00:00.000Z'),
    example(SEED.e3, 'Example Three', '2026-08-01T00:00:00.000Z'),
  ];

  const containerKey = treeContainerKey(REQUEST_COLLECTION_ENTITY_TYPE, SEED.collection);
  const folderKey = treeContainerKey(REQUEST_FOLDER_ENTITY_TYPE, SEED.folderA);
  const treeOrder: TreeOrderRecord = {
    schemaVersion: 5,
    containers:
      record === 'legacy'
        ? {
            [containerKey]: { folders: [SEED.folderA, SEED.folderB], items: [SEED.r1, SEED.r2, SEED.r3] },
            [folderKey]: { folders: [], items: [SEED.inFolder] },
          }
        : {
            [containerKey]: { children: [SEED.r1, SEED.folderA, SEED.r2, SEED.folderB, SEED.r3] },
            [folderKey]: { children: [SEED.inFolder] },
          },
  };

  const p = `oh.ws.${workspaceId}`;
  return {
    [`${p}.requestCollections`]: [collection, other],
    [`${p}.requestFolders`]: [folderA, folderB],
    [`${p}.requests`]: [r1, r2, r3, inFolder],
    [`${p}.responseExamples`]: examples,
    [`${p}.treeOrder`]: treeOrder,
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

async function main(): Promise<void> {
  const [mode, arg] = process.argv.slice(2);
  if (mode === 'seed') {
    if (arg !== 'legacy' && arg !== 'merged') throw new Error("seed needs 'legacy' or 'merged'");
    process.stdout.write(JSON.stringify(seed(arg)));
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
