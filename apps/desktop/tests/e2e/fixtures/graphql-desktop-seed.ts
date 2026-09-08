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
 * the two-operation document with a stored pick, the subscriptions
 * (ticks, the listener, its mutation, the open stream) — and the spec
 * binding leg: a `graphql` Spec, a collection generated from it whose
 * link carries a STALE hash (the drift), and a request in it linked
 * to the same spec.
 *
 * The probe URL rides OH_E2E_GRAPHQL_PROBE_URL (the playground's
 * `/api/graphql` on 3000 when the Playwright webServer boots it). The
 * workspace id rides OH_E2E_WORKSPACE_ID (learned from the booted app
 * before seeding).
 */

import { CollectionSchema, GraphqlRequestSchema, RequestSchema, SpecSchema } from '@openheaders/core/schemas';
import type { Collection, GraphqlRequest, Request, Spec } from '@openheaders/core/types';
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
  // G10: the subscriptions over the WebSocket plane — three ticks then
  // the server's complete; the listener a second request's mutation
  // fires; the open stream Stop cuts.
  graphqlRequest('e2egqd06', 'Probe Ticks', {
    query: 'subscription { tick(everyMs: 100, take: 3) }',
  }),
  graphqlRequest('e2egqd07', 'Probe Note Created', {
    query: 'subscription { noteCreated { id title author { name } } }',
  }),
  graphqlRequest('e2egqd08', 'Probe Create Note', {
    query: 'mutation { createNote(input: { title: "Live note", authorId: "2" }) { id } }',
  }),
  graphqlRequest('e2egqd09', 'Probe Ticks Open', {
    query: 'subscription { tick(everyMs: 100, take: 100) }',
  }),
];

// G8: an HTTP request whose body is the graphql body mode — the
// "Convert to GraphQL request" source; its query row folds into the
// URL honestly on conversion.
const HTTP_UID = 'e2ehttp1';
const httpRequest: Request = v.parse(RequestSchema, {
  schemaVersion: 5,
  uid: HTTP_UID,
  path: `${collection.path}/${toFolderName('Probe Echo HTTP', HTTP_UID)}`,
  name: 'Probe Echo HTTP',
  method: 'POST',
  url: probeUrl,
  headers: [],
  params: [{ uid: 'e2eprm01', key: 'trace', value: 'convert' }],
  auth: { type: 'inherit' },
  body: {
    type: 'graphql',
    content: 'query Echo($t: String!) { echo(text: $t) }',
    graphqlVariables: '{"t": "hi-from-the-converted-request"}',
  },
});

// G13: the spec binding — a `graphql` Spec (SDL), a collection generated
// from it with a stale `sourceHash` (the spec "changed since"), and a
// request inside it linked to the spec: the Spec tab names the spec,
// the collection and the drift; the Schema tab resolves from it.
const SPEC_UID = 'e2egqspc';
const SPEC_ROOT_UID = 'e2egqspf';
const spec: Spec = v.parse(SpecSchema, {
  schemaVersion: 5,
  uid: SPEC_UID,
  path: `specs/${toFolderName('Probe Schema', SPEC_UID)}`,
  name: 'Probe Schema',
  format: 'graphql',
  rootFileUid: SPEC_ROOT_UID,
  files: [
    {
      uid: SPEC_ROOT_UID,
      fileName: 'index.graphql',
      content: [
        'type Query {',
        '  """The signed-in user."""',
        '  viewer: Viewer',
        '  note(id: ID!): Note',
        '}',
        'type Viewer { id: ID! name: String! }',
        'type Note { id: ID! title: String! }',
        '',
      ].join('\n'),
    },
  ],
});

const GENERATED_COLLECTION_UID = 'e2egqgen';
const generatedCollection: Collection = v.parse(CollectionSchema, {
  schemaVersion: 5,
  uid: GENERATED_COLLECTION_UID,
  path: `requests/${toFolderName('Probe Generated', GENERATED_COLLECTION_UID)}`,
  name: 'Probe Generated',
  variables: [],
  specLink: { specUid: SPEC_UID, sourceHash: 'stale-generation-hash' },
});

const LINKED_UID = 'e2egqd10';
const linkedRequest: GraphqlRequest = v.parse(GraphqlRequestSchema, {
  schemaVersion: 5,
  uid: LINKED_UID,
  path: `${generatedCollection.path}/${toFolderName('Probe Linked', LINKED_UID)}`,
  name: 'Probe Linked',
  url: probeUrl,
  query: 'query Viewer { viewer { id name } }',
  headers: [],
  auth: { type: 'inherit' },
  specLink: { specUid: SPEC_UID },
});

const values: Record<string, unknown> = {
  [`oh.ws.${workspaceId}.requestCollections`]: [collection, generatedCollection],
  [`oh.ws.${workspaceId}.requests`]: [httpRequest],
  [`oh.ws.${workspaceId}.graphqlRequests`]: [...graphqlRequests, linkedRequest],
  [`oh.ws.${workspaceId}.specs`]: [spec],
};

process.stdout.write(JSON.stringify(values));
