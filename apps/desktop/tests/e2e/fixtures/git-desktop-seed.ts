/**
 * Seed builder for the git-desktop spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject.
 *
 * The git spec needs a workspace whose materialized tree carries more
 * than the manifest: one collection and two plain requests give the
 * pass distinct yaml files to edit on each side of a divergence, so
 * the two-parent merge leg converges different files instead of
 * fighting over `workspace.yaml`.
 *
 * The workspace id rides OH_E2E_WORKSPACE_ID (learned from the booted
 * app before seeding).
 */

import { CollectionSchema, RequestSchema } from '@openheaders/core/schemas';
import type { Collection, Request } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2egcol1';

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Git Pass', COLLECTION_UID)}`,
  name: 'Git Pass',
  variables: [],
});

function request(uid: string, name: string): Request {
  return v.parse(RequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    method: 'GET',
    url: 'https://api.openheaders.io/status',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
  });
}

const requests: Request[] = [request('e2egreq1', 'Status Probe'), request('e2egreq2', 'Health Probe')];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.requests`]: requests,
};

process.stdout.write(JSON.stringify(values));
