/**
 * Seed builder for the graphql-desktop spec — run under tsx (the core
 * schemas are TS source the Playwright loader can't resolve), prints a
 * JSON map of desktop storage values to stdout.
 *
 * Every entity is built as a literal and then validated by the REAL
 * core valibot schema, so a schema change fails this script loudly
 * instead of seeding a shape the app would silently reject.
 *
 * One collection carrying an auth POOL whose default is the probe's
 * bearer (`probe-token`) — the auth-inheritance leg: a GraphQL request
 * on `inherit` presents as `http` to the mask and resolves the pool
 * entry through the compile, so the probe's `gated` field unlocks with
 * no request-level credential — and one GraphQL request per G-leg of
 * the Phase C gate: the echo round trip, the partial (200-with-errors)
 * answer, the gated pair (inherited bearer vs. an explicit `none`),
 * the two-operation document with a stored pick.
 *
 * The probe URL rides OH_E2E_GRAPHQL_PROBE_URL (the playground's
 * `/api/graphql` on 3000 when the Playwright webServer boots it). The
 * workspace id rides OH_E2E_WORKSPACE_ID (learned from the booted app
 * before seeding).
 */

import { CollectionSchema, GraphqlRequestSchema } from '@openheaders/core/schemas';
import type { Collection, GraphqlRequest } from '@openheaders/core/types';
import { toFolderName } from '@openheaders/core/utils';
import * as v from 'valibot';

const probeUrl = process.env.OH_E2E_GRAPHQL_PROBE_URL ?? 'http://127.0.0.1:3000/api/graphql';
const workspaceId = process.env.OH_E2E_WORKSPACE_ID;
if (!workspaceId) throw new Error('OH_E2E_WORKSPACE_ID is required');

const COLLECTION_UID = 'e2egqcol';
const BEARER_AUTH_UID = 'e2egqbrr';

const collection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: COLLECTION_UID,
  path: `requests/${toFolderName('Probe GraphQL', COLLECTION_UID)}`,
  name: 'Probe GraphQL',
  variables: [],
  // The pool: one bearer entry, the collection's default — what an
  // `inherit` request resolves to.
  auths: [{ uid: BEARER_AUTH_UID, name: 'Probe Bearer', config: { type: 'bearer', token: 'probe-token' } }],
  defaultAuthUid: BEARER_AUTH_UID,
});

function graphqlRequest(uid: string, name: string, extra: Partial<GraphqlRequest> = {}): GraphqlRequest {
  return v.parse(GraphqlRequestSchema, {
    schemaVersion: 5,
    uid,
    path: `${collection.path}/${toFolderName(name, uid)}`,
    name,
    url: probeUrl,
    query: '',
    headers: [],
    auth: { type: 'inherit' },
    ...extra,
  });
}

const graphqlRequests: GraphqlRequest[] = [
  // G1: the echo round trip — variables ride the envelope.
  graphqlRequest('e2egqd01', 'Probe Echo', {
    query: 'query Echo($t: String!) { echo(text: $t) }',
    variables: '{"t": "hi-from-the-desktop"}',
  }),
  // G2: the 200-with-errors trap — data beside errors[].
  graphqlRequest('e2egqd02', 'Probe Partial', {
    query: '{ partial { ok broken } }',
  }),
  // G3: the gated field through the INHERITED bearer (the pool's default)…
  graphqlRequest('e2egqd03', 'Probe Gated', {
    query: '{ gated viewer { name } }',
  }),
  // …and its sibling with an explicit `none` — the probe refuses with
  // UNAUTHENTICATED, an HTTP 200 whose data is null.
  graphqlRequest('e2egqd04', 'Probe Gated Anonymous', {
    query: '{ gated }',
    auth: { type: 'none' },
  }),
  // G4: two operations with a stored pick — the operation select.
  graphqlRequest('e2egqd05', 'Probe Two Operations', {
    query: 'query A { echo(text: "answer-a") } query B { echo(text: "answer-b") }',
    operationName: 'B',
  }),
];

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection],
  [`oh.ws.${workspaceId}.graphqlRequests`]: graphqlRequests,
};

process.stdout.write(JSON.stringify(values));
